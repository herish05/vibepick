import type { SignalScores } from './types.js';

/**
 * Deterministic explanations built only from real scoring signals — nothing is invented.
 * An LLM may later paraphrase these, but only given this structured input.
 */
export function explain(signals: SignalScores, ctx: { occasion?: string | null; topVibes?: string[] }): string[] {
  const reasons: string[] = [];
  const vibes = ctx.topVibes?.length ? ` (${ctx.topVibes.slice(0, 2).join(', ')})` : '';
  if (signals.visual_match >= 0.7) reasons.push(`Strong match with your photo's vibe${vibes}`);
  else if (signals.visual_match >= 0.5) reasons.push('Fits the visual mood');
  if (signals.taste_match >= 0.7) reasons.push('Matches your music taste');
  if (signals.language_match >= 1) reasons.push('In your preferred language');
  if (ctx.occasion && signals.occasion_match >= 0.8) reasons.push(`Great for ${ctx.occasion}`);
  if (signals.mood_match >= 0.75) reasons.push('Right mood and energy');
  if (signals.trend_score >= 0.7) reasons.push('Trending right now');
  if (signals.social_score >= 0.5) reasons.push('Popular with people you follow');
  return reasons.slice(0, 4).length ? reasons.slice(0, 4) : ['Balanced match across your signals'];
}
