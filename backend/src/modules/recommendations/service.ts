import type { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_RANKING_CONFIG,
  emptyTaste,
  rankingConfigSchema,
  recommend,
  type RankingConfig,
  type TasteState,
  type UserProfile,
  type VibeVector,
} from '../../engine/index.js';
import { effectiveLanguages } from '../../engine/taste.js';
import { mergeVectors } from '../../engine/math.js';
import { toSongCandidate } from '../music/mapper.js';
import { parseIntent } from '../search/nl.js';
import { createHash } from 'node:crypto';

export interface RecommendationRequest {
  mediaId?: string;
  contentTarget: string;
  occasion?: string | null;
  languagePreferences: string[];
  mood?: string | null;
  naturalLanguageContext?: string | null;
  sessionId?: string | null;
}

const positive = (v: VibeVector): VibeVector =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.max(0, x)]));

/** Active DB config, optionally overridden by an experiment variant (deterministic per user). */
export async function resolveConfig(prisma: PrismaClient, userId: string): Promise<{ config: RankingConfig; algorithm: string }> {
  let config = DEFAULT_RANKING_CONFIG;
  const active = await prisma.rankingConfig.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  if (active) {
    const parsed = rankingConfigSchema.safeParse(active.weights);
    if (parsed.success) config = { ...parsed.data, version: active.version };
  }
  let algorithm = config.version;
  const exp = await prisma.experiment.findFirst({ where: { key: 'ranking_algorithm', active: true } });
  if (exp) {
    const variants = exp.variants as { name: string; weight: number; config?: Partial<RankingConfig> }[];
    const existing = await prisma.experimentAssignment.findUnique({ where: { experimentId_userId: { experimentId: exp.id, userId } } });
    let name = existing?.variant;
    if (!name) {
      name = pickVariant(userId, exp.key, variants);
      await prisma.experimentAssignment.create({ data: { experimentId: exp.id, userId, variant: name } });
    }
    const v = variants.find((x) => x.name === name);
    if (v?.config) {
      const merged = rankingConfigSchema.safeParse({ ...config, ...v.config, weights: { ...config.weights, ...(v.config.weights ?? {}) } });
      if (merged.success) config = merged.data;
    }
    algorithm = `${config.version}:${exp.key}:${name}`;
  }
  return { config, algorithm };
}

export function pickVariant(userId: string, key: string, variants: { name: string; weight: number }[]): string {
  const hash = createHash('sha256').update(`${key}:${userId}`).digest();
  const bucket = hash.readUInt32BE(0) % 100;
  const total = variants.reduce((a, v) => a + v.weight, 0) || 1;
  let acc = 0;
  for (const v of variants) {
    acc += (v.weight / total) * 100;
    if (bucket < acc) return v.name;
  }
  return variants[variants.length - 1]?.name ?? 'control';
}

const INTERACTION_AFFINITY: Record<string, number> = {
  song_selected: 1, song_saved: 1, song_shared: 1, song_rejected: -1, song_skipped: -0.4, feedback_positive: 0.8, feedback_negative: -0.8,
};

export async function generateRecommendation(prisma: PrismaClient, userId: string, req: RecommendationRequest) {
  const started = Date.now();
  const intent = parseIntent(req.naturalLanguageContext);
  const now = new Date();

  const [media, tv, interactions, recent, trends] = await Promise.all([
    req.mediaId
      ? prisma.media.findFirst({ where: { id: req.mediaId, userId }, include: { analysis: true } })
      : Promise.resolve(null),
    prisma.userTasteVector.findUnique({ where: { userId } }),
    prisma.userInteraction.findMany({
      where: { userId, songId: { not: null }, type: { in: Object.keys(INTERACTION_AFFINITY) as never[] }, createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      select: { songId: true, type: true },
    }),
    prisma.recommendationItem.findMany({
      where: { recommendation: { userId, createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } } },
      select: { songId: true },
    }),
    prisma.trendSnapshot.findMany({ where: { scope: 'global' }, orderBy: { capturedAt: 'desc' }, distinct: ['songId'] }),
  ]);
  if (req.mediaId && !media) return null;

  const long = (tv?.longTerm as unknown as TasteState) ?? emptyTaste();
  const short = (tv?.shortTerm as unknown as TasteState) ?? emptyTaste();

  const historyAffinity: Record<string, number> = {};
  const rejected = new Set<string>();
  for (const i of interactions) {
    if (!i.songId) continue;
    const w = INTERACTION_AFFINITY[i.type] ?? 0;
    historyAffinity[i.songId] = Math.max(-1, Math.min(1, (historyAffinity[i.songId] ?? 0) + w));
    if (i.type === 'song_rejected' || i.type === 'feedback_negative') rejected.add(i.songId);
  }

  const user: UserProfile = {
    languages: effectiveLanguages(long, short),
    vibes: {},
    artists: { ...long.artists, ...short.artists },
    energy: 0.6,
    discoveryPreference: 0.5,
    rejectedSongIds: rejected,
    recentSongIds: new Set(recent.map((r) => r.songId)),
    historyAffinity,
  };

  // Current content vibe = media analysis, shifted by what the user said right now
  const mediaVibe = (media?.analysis?.vibe as VibeVector | undefined) ?? {};
  const vibe = Object.keys(intent.vibe).length ? mergeVectors(mediaVibe, intent.vibe, 0.5) : mediaVibe;
  const structured = (media?.analysis?.structured as { occasion?: string } | undefined) ?? {};
  const occasion = req.occasion ?? intent.occasion ?? structured.occasion ?? null;
  const languages = req.languagePreferences.length ? req.languagePreferences : intent.languages;

  const { config: baseConfig, algorithm } = await resolveConfig(prisma, userId);
  let config = baseConfig;
  if (intent.preferTrending) {
    config = { ...config, weights: { ...config.weights, trend_score: config.weights.trend_score * 4 } };
  }

  const trendMap = new Map(trends.map((t) => [t.songId, t.score]));
  const rows = await prisma.song.findMany({ where: { active: true }, include: { artist: true, features: true }, take: 3000 });
  let songs = rows.map((r) => toSongCandidate(r, { trendScore: trendMap.get(r.id) ?? 0 }));
  if (intent.preferLowPopularity) {
    const inLanguage = (s: { language: string }) => languages.length === 0 || languages.some((l) => l.toLowerCase() === s.language);
    const lowPop = songs.filter((s) => s.popularity <= 0.6 && inLanguage(s));
    if (lowPop.length >= 5) songs = songs.filter((s) => s.popularity <= 0.6);
  }

  // Session intent: current content context is blended into short-term taste (it overrides some long-term)
  const result = recommend({
    songs,
    context: { vibe, occasion, requestedLanguages: languages, mood: req.mood ?? null, energy: intent.energy },
    user,
    longTermVibes: positive(long.vibes),
    shortTermVibes: mergeVectors(positive(short.vibes), vibe, 0.4),
    config,
  });

  const latencyMs = Date.now() - started;
  const context = { occasion, languages, mood: req.mood ?? null, nl: req.naturalLanguageContext ?? null, intent, stats: result.stats } as unknown as Prisma.InputJsonValue;
  const rec = await prisma.recommendation.create({
    data: {
      userId,
      mediaId: media?.id,
      sessionId: req.sessionId ?? undefined,
      contentType: media?.contentTarget ?? req.contentTarget,
      context,
      algorithm,
      weightsVersion: config.version,
      contentReceivedAt: media?.receivedAt ?? now,
      latencyMs,
      items: {
        create: result.items.map((i) => ({
          songId: i.songId, rank: i.rank, score: i.score, category: i.category, source: i.source,
          signals: i.signals as unknown as Prisma.InputJsonValue, reasons: i.reasons,
        })),
      },
    },
    include: { items: { include: { song: { include: { artist: true, features: true } } }, orderBy: { rank: 'asc' } } },
  });
  await prisma.userInteraction.createMany({
    data: rec.items.map((i) => ({
      userId, songId: i.songId, recommendationId: rec.id, type: 'recommendation_impression' as const,
      position: i.rank, source: i.source, sessionId: req.sessionId ?? undefined, contentId: media?.id,
    })),
  });
  return rec;
}
