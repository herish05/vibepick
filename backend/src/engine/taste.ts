import type { SongCandidate, VibeVector } from './types.js';
import { mergeVectors } from './math.js';

export interface TasteState {
  languages: Record<string, number>;
  vibes: VibeVector;
  artists: Record<string, number>;
  updatedAt: string; // ISO
}

export const emptyTaste = (now: Date = new Date()): TasteState => ({
  languages: {},
  vibes: {},
  artists: {},
  updatedAt: now.toISOString(),
});

/** Signed learning weight per event type. */
export const EVENT_WEIGHTS: Record<string, number> = {
  song_selected: 1,
  song_saved: 1.2,
  song_shared: 1,
  song_preview_complete: 0.4,
  song_preview_start: 0.1,
  song_skipped: -0.3,
  song_rejected: -1,
  feedback_positive: 1.5,
  feedback_negative: -1,
};

export const TASTE_RATES = { longTerm: 0.05, shortTerm: 0.3 };
export const SHORT_TERM_HALF_LIFE_DAYS = 1;

const clampSigned = (n: number) => Math.max(-1, Math.min(1, n));

export function decayFactor(ageDays: number, halfLifeDays: number): number {
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function decayMap(map: Record<string, number>, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v * factor]));
}

/**
 * Applies time decay then nudges affinities toward (or away from) the song's attributes.
 * Positive weights reinforce, negative weights reduce affinity.
 */
export function updateTaste(
  state: TasteState,
  song: Pick<SongCandidate, 'language' | 'artist' | 'mood' | 'aesthetic'>,
  weight: number,
  opts: { rate: number; halfLifeDays: number; now?: Date },
): TasteState {
  const now = opts.now ?? new Date();
  const ageDays = (now.getTime() - new Date(state.updatedAt).getTime()) / 86_400_000;
  const f = decayFactor(ageDays, opts.halfLifeDays);
  const lr = opts.rate * weight;

  const languages = decayMap(state.languages, f);
  const lang = song.language.toLowerCase();
  languages[lang] = clampSigned((languages[lang] ?? 0) + lr);

  const artists = decayMap(state.artists, f);
  const artist = song.artist.toLowerCase();
  artists[artist] = clampSigned((artists[artist] ?? 0) + lr);

  const vibes = decayMap(state.vibes, f);
  const songVibes = mergeVectors(song.mood, song.aesthetic, 0.6);
  for (const [k, v] of Object.entries(songVibes)) {
    vibes[k] = clampSigned((vibes[k] ?? 0) + lr * v);
  }
  return { languages, vibes, artists, updatedAt: now.toISOString() };
}

/** Seed taste from explicit onboarding choices (cold start). */
export function seedTaste(
  prefs: { languages: string[]; vibes: string[]; favoriteArtists: string[] },
  now: Date = new Date(),
): TasteState {
  const s = emptyTaste(now);
  for (const l of prefs.languages) s.languages[l.toLowerCase()] = 0.8;
  for (const v of prefs.vibes) s.vibes[v.toLowerCase()] = 0.8;
  for (const a of prefs.favoriteArtists) s.artists[a.toLowerCase()] = 0.7;
  return s;
}

/** Merge long and short taste into single maps for profile building (positive-only vibes for cosine). */
export function effectiveLanguages(long: TasteState, short: TasteState, wl = 0.6): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(long.languages), ...Object.keys(short.languages)])) {
    out[k] = Math.max(0, (long.languages[k] ?? 0) * wl + (short.languages[k] ?? 0) * (1 - wl));
  }
  return out;
}
