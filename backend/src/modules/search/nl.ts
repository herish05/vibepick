import type { VibeVector } from '../../engine/types.js';

export interface ParsedIntent {
  languages: string[];
  occasion: string | null;
  mood: string | null;
  energy: number | null;
  vibe: VibeVector;
  preferLowPopularity: boolean;
  preferTrending: boolean;
}

const LANGUAGES = ['hindi', 'punjabi', 'english', 'haryanvi', 'bengali', 'tamil', 'telugu', 'marathi', 'malayalam', 'kannada', 'gujarati'];
const OCCASIONS: Record<string, string[]> = {
  birthday: ['birthday', 'bday'],
  wedding: ['wedding', 'shaadi'],
  travel: ['travel', 'trip', 'vacation', 'road trip'],
  'night-out': ['night out', 'night-out', 'club'],
  graduation: ['graduation'],
  festival: ['festival', 'diwali', 'holi'],
  gym: ['gym', 'workout'],
  rainy: ['rain', 'rainy'],
};
const VIBE_WORDS: Record<string, { vibe: string; energy?: number }> = {
  romantic: { vibe: 'romantic' },
  love: { vibe: 'romantic' },
  sad: { vibe: 'sad', energy: 0.25 },
  emotional: { vibe: 'emotional' },
  chill: { vibe: 'chill', energy: 0.3 },
  classy: { vibe: 'aesthetic' },
  aesthetic: { vibe: 'aesthetic' },
  party: { vibe: 'party', energy: 0.85 },
  energetic: { vibe: 'energetic', energy: 0.85 },
  attitude: { vibe: 'confident', energy: 0.75 },
  confident: { vibe: 'confident', energy: 0.7 },
  funny: { vibe: 'funny' },
  nostalgic: { vibe: 'nostalgic' },
  cinematic: { vibe: 'cinematic' },
  peaceful: { vibe: 'peaceful', energy: 0.2 },
  happy: { vibe: 'happy' },
};

/** Deterministic NL -> structured intent. An LLM can later replace this behind the same interface. */
export function parseIntent(text: string | null | undefined): ParsedIntent {
  const t = (text ?? '').toLowerCase();
  const out: ParsedIntent = { languages: [], occasion: null, mood: null, energy: null, vibe: {}, preferLowPopularity: false, preferTrending: false };
  if (!t.trim()) return out;
  out.languages = LANGUAGES.filter((l) => t.includes(l));
  for (const [occ, words] of Object.entries(OCCASIONS)) if (words.some((w) => t.includes(w))) out.occasion = occ;
  const negated = (w: string) => new RegExp(`(not|no|less|without)\\s+(too\\s+)?${w}`).test(t);
  for (const [word, { vibe, energy }] of Object.entries(VIBE_WORDS)) {
    if (!t.includes(word) || negated(word)) continue;
    out.vibe[vibe] = 0.9;
    out.mood ??= vibe;
    if (energy != null) out.energy = out.energy == null ? energy : (out.energy + energy) / 2;
  }
  if (/not too (aggressive|loud|intense)/.test(t)) out.energy = Math.min(out.energy ?? 0.6, 0.6);
  out.preferLowPopularity = /(not too popular|hidden gem|underrated|less popular|unheard)/.test(t);
  out.preferTrending = /\btrending\b|\bviral\b/.test(t);
  return out;
}
