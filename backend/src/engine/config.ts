import { z } from 'zod';

export const weightsSchema = z.object({
  visual_match: z.number().min(0),
  taste_match: z.number().min(0),
  mood_match: z.number().min(0),
  language_match: z.number().min(0),
  occasion_match: z.number().min(0),
  trend_score: z.number().min(0),
  social_score: z.number().min(0),
});

export const rankingConfigSchema = z.object({
  version: z.string(),
  weights: weightsSchema,
  profile: z.object({ longTerm: z.number().min(0).max(1), shortTerm: z.number().min(0).max(1) }),
  retrieval: z.object({ perSource: z.number().int().positive(), maxCandidates: z.number().int().positive() }),
  filter: z.object({ keep: z.number().int().positive() }),
  rerank: z.object({
    finalCount: z.number().int().min(1).max(10),
    maxPerArtist: z.number().int().min(1),
    strictLanguageMin: z.number().int().min(1).default(3),
    genrePenalty: z.number().min(0),
    discoverySlots: z.number().int().min(0),
    hiddenGemMaxPopularity: z.number().min(0).max(1),
    hiddenGemMinRelevance: z.number().min(0).max(1),
  }),
  decay: z.object({ halfLifeDays: z.number().positive() }),
});

export type RankingConfig = z.infer<typeof rankingConfigSchema>;
export type Weights = z.infer<typeof weightsSchema>;

/** Default configuration. Overridable from DB (RankingConfig table) via the admin module. */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  version: 'v1-default',
  weights: {
    visual_match: 0.3,
    taste_match: 0.25,
    mood_match: 0.15,
    language_match: 0.1,
    occasion_match: 0.1,
    trend_score: 0.05,
    social_score: 0.05,
  },
  profile: { longTerm: 0.6, shortTerm: 0.4 },
  retrieval: { perSource: 80, maxCandidates: 500 },
  filter: { keep: 100 },
  rerank: {
    finalCount: 8,
    maxPerArtist: 1,
    strictLanguageMin: 3,
    genrePenalty: 0.04,
    discoverySlots: 1,
    hiddenGemMaxPopularity: 0.4,
    hiddenGemMinRelevance: 0.55,
  },
  decay: { halfLifeDays: 30 },
};
