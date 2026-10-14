import type { RankingConfig } from './config.js';
import { SOURCE_PRIORITY } from './scoring.js';
import type { Category, RankedItem, ScoredCandidate, Source } from './types.js';

function primarySource(c: ScoredCandidate): Source {
  return SOURCE_PRIORITY.find((s) => c.sources.has(s)) ?? 'visual';
}

function categorize(c: ScoredCandidate, rank: number, cfg: RankingConfig): Category {
  const { hiddenGemMaxPopularity, hiddenGemMinRelevance } = cfg.rerank;
  const relevance = (c.signals.visual_match + c.signals.mood_match) / 2;
  if (rank === 1) return 'best_match';
  if (c.song.popularity <= hiddenGemMaxPopularity && relevance >= hiddenGemMinRelevance) return 'hidden_gem';
  if (c.signals.social_score >= 0.5) return 'social_match';
  if (c.signals.trend_score >= 0.7) return 'trending_match';
  if (c.signals.taste_match >= 0.7) return 'your_taste';
  return 'good_match';
}

/**
 * Greedy diversity-aware re-ranking: artist cap, genre and popularity-band penalties,
 * plus reserved discovery slots.
 */
export function rerank(scored: ScoredCandidate[], cfg: RankingConfig): RankedItem[] {
  const { finalCount, maxPerArtist, genrePenalty, discoverySlots, hiddenGemMaxPopularity } = cfg.rerank;
  const pool = [...scored];
  const picked: ScoredCandidate[] = [];
  const artistCount = new Map<string, number>();
  const genreCount = new Map<string, number>();
  const popBand = new Map<number, number>();
  const band = (p: number) => Math.min(2, Math.floor(p * 3));

  const adjusted = (c: ScoredCandidate): number => {
    const genrePen = c.song.genres.reduce((a, g) => a + (genreCount.get(g) ?? 0), 0) * genrePenalty;
    const bandPen = (popBand.get(band(c.song.popularity)) ?? 0) * (genrePenalty / 2);
    return c.score - genrePen - bandPen;
  };
  const take = (c: ScoredCandidate) => {
    picked.push(c);
    pool.splice(pool.indexOf(c), 1);
    artistCount.set(c.song.artistId, (artistCount.get(c.song.artistId) ?? 0) + 1);
    for (const g of c.song.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    popBand.set(band(c.song.popularity), (popBand.get(band(c.song.popularity)) ?? 0) + 1);
  };
  const eligible = (c: ScoredCandidate) => (artistCount.get(c.song.artistId) ?? 0) < maxPerArtist;

  const mainSlots = Math.max(1, finalCount - discoverySlots);
  while (picked.length < mainSlots) {
    const best = pool.filter(eligible).sort((a, b) => adjusted(b) - adjusted(a))[0];
    if (!best) break;
    take(best);
  }
  // Discovery slots: relevant but not saturated
  for (let i = 0; i < discoverySlots && picked.length < finalCount; i++) {
    const gem = pool
      .filter((c) => eligible(c) && c.song.popularity <= hiddenGemMaxPopularity)
      .sort((a, b) => adjusted(b) - adjusted(a))[0];
    if (gem) take(gem);
  }
  // Backfill if constraints left gaps
  while (picked.length < finalCount) {
    const best = pool.filter(eligible).sort((a, b) => adjusted(b) - adjusted(a))[0];
    if (!best) break;
    take(best);
  }

  picked.sort((a, b) => b.score - a.score);
  return picked.map((c, i) => ({
    songId: c.song.id,
    rank: i + 1,
    score: c.score,
    category: categorize(c, i + 1, cfg),
    source: primarySource(c),
    signals: c.signals,
    reasons: [],
  }));
}
