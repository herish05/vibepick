import type { RankingConfig } from './config.js';
import { cosine, mergeVectors } from './math.js';
import { languageMatch, occasionMatch } from './scoring.js';
import type { Candidate, RecommendationContext, SongCandidate, Source, UserProfile, VibeVector } from './types.js';

type Scorer = (s: SongCandidate) => number;

/**
 * Multi-source candidate retrieval. Each source contributes its top-N songs;
 * candidates carry the set of sources that surfaced them.
 */
export function retrieveCandidates(
  songs: SongCandidate[],
  ctx: RecommendationContext,
  user: UserProfile,
  userVibes: VibeVector,
  cfg: RankingConfig,
): Candidate[] {
  const songVibe = (s: SongCandidate) => mergeVectors(s.mood, s.aesthetic, 0.6);
  const scorers: Record<Source, Scorer> = {
    visual: (s) => cosine(ctx.vibe, songVibe(s)),
    taste: (s) => cosine(userVibes, songVibe(s)),
    occasion: (s) => (ctx.occasion ? occasionMatch(s, ctx) : 0),
    language: (s) => languageMatch(s, ctx, user),
    trending: (s) => s.trendScore,
    history: (s) => ((user.historyAffinity[s.id] ?? 0) + 1) / 2 - (s.id in user.historyAffinity ? 0 : 1),
    collaborative: (s) => s.socialScore,
    // high relevance + low saturation
    discovery: (s) => cosine(ctx.vibe, songVibe(s)) * (1 - s.popularity),
  };

  const byId = new Map<string, Candidate>();
  for (const source of Object.keys(scorers) as Source[]) {
    const fn = scorers[source];
    const top = songs
      .map((s) => ({ s, v: fn(s) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, cfg.retrieval.perSource);
    for (const { s } of top) {
      const existing = byId.get(s.id);
      if (existing) existing.sources.add(source);
      else byId.set(s.id, { song: s, sources: new Set([source]) });
    }
  }
  return [...byId.values()].slice(0, cfg.retrieval.maxCandidates);
}

export function filterCandidates(
  candidates: Candidate[],
  ctx: RecommendationContext,
  user: UserProfile,
  cfg: RankingConfig,
): Candidate[] {
  let out = candidates.filter((c) => !user.rejectedSongIds.has(c.song.id));
  if (ctx.requestedLanguages.length > 0) {
    const wanted = new Set(ctx.requestedLanguages.map((l) => l.toLowerCase()));
    const strict = out.filter((c) => wanted.has(c.song.language.toLowerCase()));
    // Explicit language request is honoured whenever a minimum number of matches exist.
    if (strict.length >= cfg.rerank.strictLanguageMin) out = strict;
  }
  // Prefer not repeating very recent recommendations, but never starve the pool.
  const fresh = out.filter((c) => !user.recentSongIds.has(c.song.id));
  if (fresh.length >= cfg.rerank.finalCount * 2) out = fresh;
  return out;
}
