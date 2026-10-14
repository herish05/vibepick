import type { RankingConfig } from './config.js';
import { clamp01, cosine, mergeVectors } from './math.js';
import type {
  Candidate,
  RecommendationContext,
  ScoredCandidate,
  SignalScores,
  SongCandidate,
  Source,
  UserProfile,
  VibeVector,
} from './types.js';

/** final profile = long_term * w_l + short_term * w_s (configurable). */
export function blendProfileVibes(long: VibeVector, short: VibeVector, cfg: RankingConfig): VibeVector {
  const total = cfg.profile.longTerm + cfg.profile.shortTerm || 1;
  return mergeVectors(long, short, cfg.profile.longTerm / total);
}

const songVibe = (s: SongCandidate): VibeVector => mergeVectors(s.mood, s.aesthetic, 0.6);

function moodTarget(ctx: RecommendationContext): VibeVector {
  if (ctx.mood) return { [ctx.mood]: 1 };
  return ctx.vibe;
}

export function languageMatch(song: SongCandidate, ctx: RecommendationContext, user: UserProfile): number {
  const lang = song.language.toLowerCase();
  if (ctx.requestedLanguages.length > 0) {
    return ctx.requestedLanguages.some((l) => l.toLowerCase() === lang) ? 1 : 0;
  }
  return clamp01(user.languages[lang] ?? 0.2);
}

export function occasionMatch(song: SongCandidate, ctx: RecommendationContext): number {
  if (!ctx.occasion) return 0.5; // neutral when unknown
  const occ = ctx.occasion.toLowerCase();
  if (song.occasions.some((o) => o.toLowerCase() === occ)) return 1;
  return clamp01((song.aesthetic[occ] ?? 0) * 0.8);
}

export function tasteMatch(song: SongCandidate, user: UserProfile, userVibes: VibeVector): number {
  const vibe = cosine(userVibes, songVibe(song));
  const artist = clamp01(((user.artists[song.artist.toLowerCase()] ?? 0) + 1) / 2); // -1..1 -> 0..1
  const hasArtist = song.artist.toLowerCase() in user.artists;
  const history = clamp01(((user.historyAffinity[song.id] ?? 0) + 1) / 2);
  const hasHistory = song.id in user.historyAffinity;
  let score = vibe * 0.6;
  let weight = 0.6;
  if (hasArtist) {
    score += artist * 0.25;
    weight += 0.25;
  }
  if (hasHistory) {
    score += history * 0.15;
    weight += 0.15;
  }
  const energyFit = 1 - Math.abs(user.energy - song.energy);
  score += energyFit * 0.1;
  weight += 0.1;
  return clamp01(score / weight);
}

export function computeSignals(
  song: SongCandidate,
  ctx: RecommendationContext,
  user: UserProfile,
  userVibes: VibeVector,
): SignalScores {
  const visual = cosine(ctx.vibe, songVibe(song));
  let mood = cosine(moodTarget(ctx), song.mood);
  if (ctx.energy != null) mood = clamp01(mood * 0.7 + (1 - Math.abs(ctx.energy - song.energy)) * 0.3);
  return {
    visual_match: round(visual),
    taste_match: round(tasteMatch(song, user, userVibes)),
    mood_match: round(mood),
    language_match: languageMatch(song, ctx, user),
    occasion_match: round(occasionMatch(song, ctx)),
    trend_score: round(clamp01(song.trendScore)),
    social_score: round(clamp01(song.socialScore)),
  };
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export function weightedScore(signals: SignalScores, weights: RankingConfig['weights']): number {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  let sum = 0;
  for (const key of Object.keys(weights) as (keyof SignalScores)[]) sum += signals[key] * weights[key];
  return round(clamp01(sum / total));
}

export function scoreCandidates(
  candidates: Candidate[],
  ctx: RecommendationContext,
  user: UserProfile,
  userVibes: VibeVector,
  cfg: RankingConfig,
): ScoredCandidate[] {
  return candidates
    .map((c) => {
      const signals = computeSignals(c.song, ctx, user, userVibes);
      return { ...c, signals, score: weightedScore(signals, cfg.weights) };
    })
    .sort((a, b) => b.score - a.score);
}

export const SOURCE_PRIORITY: Source[] = [
  'visual',
  'occasion',
  'taste',
  'history',
  'language',
  'trending',
  'collaborative',
  'discovery',
];
