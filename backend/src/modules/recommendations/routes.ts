import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { metrics } from '../../lib/metrics.js';
import { toSongDto } from '../music/mapper.js';
import { CONTENT_TARGETS } from '../media/routes.js';
import { generateRecommendation } from './service.js';

const bodySchema = z
  .object({
    media_id: z.string().uuid().optional(),
    content_type: z.enum(CONTENT_TARGETS).default('instagram_story'),
    occasion: z.string().max(40).nullish(),
    language_preferences: z.array(z.string().max(30)).max(10).default([]),
    mood: z.string().max(30).nullish(),
    natural_language_context: z.string().max(300).nullish(),
    session_id: z.string().max(64).nullish(),
  })
  .refine((b) => b.media_id || b.natural_language_context, { message: 'Provide media_id or natural_language_context' });

type Rec = NonNullable<Awaited<ReturnType<typeof generateRecommendation>>>;

function toDto(rec: Rec) {
  return {
    recommendation_id: rec.id,
    content_type: rec.contentType,
    algorithm: rec.algorithm,
    content_received_at: rec.contentReceivedAt,
    latency_ms: rec.latencyMs,
    items: rec.items.map((i) => ({
      song_id: i.songId,
      rank: i.rank,
      score: i.score,
      category: i.category,
      source: i.source,
      reasons: i.reasons,
      why_this_song: i.signals,
      song: toSongDto(i.song),
    })),
  };
}

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  const { prisma } = app.deps;
  const auth = { onRequest: [app.authenticate] };

  app.post('/recommendations', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const b = bodySchema.parse(req.body);
    const rec = await generateRecommendation(prisma, req.user.sub, {
      mediaId: b.media_id,
      contentTarget: b.content_type,
      occasion: b.occasion,
      languagePreferences: b.language_preferences,
      mood: b.mood,
      naturalLanguageContext: b.natural_language_context,
      sessionId: b.session_id,
    });
    if (!rec) throw notFound('Media not found');
    metrics.inc('recommendations_total');
    return toDto(rec);
  });

  app.get('/recommendations/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rec = await prisma.recommendation.findFirst({
      where: { id, userId: req.user.sub },
      include: { items: { include: { song: { include: { artist: true, features: true } } }, orderBy: { rank: 'asc' } } },
    });
    if (!rec) throw notFound('Recommendation not found');
    return toDto(rec);
  });

  app.get('/history', auth, async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(req.query);
    const recs = await prisma.recommendation.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: { where: { rank: 1 }, include: { song: { include: { artist: true, features: true } } } } },
    });
    const selectedIds = recs.map((r) => r.selectedSongId).filter((x): x is string => Boolean(x));
    const selected = await prisma.song.findMany({ where: { id: { in: selectedIds } }, include: { artist: true, features: true } });
    const byId = new Map(selected.map((s) => [s.id, s]));
    return {
      items: recs.map((r) => {
        const sel = r.selectedSongId ? byId.get(r.selectedSongId) : undefined;
        const top = r.items[0]?.song;
        return {
          recommendation_id: r.id,
          created_at: r.createdAt,
          content_type: r.contentType,
          media_id: r.mediaId,
          time_to_selection_ms: r.timeToSelectionMs,
          selected_song: sel ? toSongDto(sel) : null,
          top_song: top ? toSongDto(top) : null,
        };
      }),
    };
  });
}
