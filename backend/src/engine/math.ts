import type { VibeVector } from './types.js';

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function cosine(a: VibeVector, b: VibeVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? 0;
    const y = b[k] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

export function mergeVectors(a: VibeVector, b: VibeVector, wa = 0.5): VibeVector {
  const out: VibeVector = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = (a[k] ?? 0) * wa + (b[k] ?? 0) * (1 - wa);
  }
  return out;
}

export function topKeys(v: VibeVector, n = 3): string[] {
  return Object.entries(v)
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .filter(([, s]) => s > 0.3)
    .map(([k]) => k);
}
