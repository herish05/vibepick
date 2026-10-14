import { DEFAULT_RANKING_CONFIG, type RankingConfig } from './config.js';
import { explain } from './explain.js';
import { topKeys } from './math.js';
import { rerank } from './rerank.js';
import { filterCandidates, retrieveCandidates } from './retrieval.js';
import { blendProfileVibes, scoreCandidates } from './scoring.js';
import type { RankedItem, RecommendationContext, SongCandidate, UserProfile, VibeVector } from './types.js';

export interface PipelineInput {
  songs: SongCandidate[];
  context: RecommendationContext;
  user: UserProfile;
  longTermVibes: VibeVector;
  shortTermVibes: VibeVector;
  config?: RankingConfig;
}

export interface PipelineStats {
  retrieved: number;
  filtered: number;
  ranked: number;
  final: number;
}

/** Retrieval -> filter -> score -> diversity re-rank -> explanations. Pure and deterministic. */
export function recommend(input: PipelineInput): { items: RankedItem[]; stats: PipelineStats } {
  const cfg = input.config ?? DEFAULT_RANKING_CONFIG;
  const userVibes = blendProfileVibes(input.longTermVibes, input.shortTermVibes, cfg);
  const retrieved = retrieveCandidates(input.songs, input.context, input.user, userVibes, cfg);
  const filtered = filterCandidates(retrieved, input.context, input.user, cfg);
  const scored = scoreCandidates(filtered, input.context, input.user, userVibes, cfg).slice(0, cfg.filter.keep);
  const items = rerank(scored, cfg);
  const topVibes = topKeys(input.context.vibe);
  for (const item of items) {
    item.reasons = explain(item.signals, { occasion: input.context.occasion, topVibes });
  }
  return {
    items,
    stats: { retrieved: retrieved.length, filtered: filtered.length, ranked: scored.length, final: items.length },
  };
}

export * from './types.js';
export * from './config.js';
export * from './taste.js';
