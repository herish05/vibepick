export const colors = {
  bg: '#09090F',
  card: '#13131E',
  surface2: '#1B1B2A',
  border: '#24243A',
  text: '#F5F5FA',
  muted: '#9A9AB5',
  faint: '#6B6B85',
  primary: '#8B5CF6',
  primarySoft: 'rgba(139,92,246,0.16)',
  accent: '#EC4899',
  primaryText: '#FFFFFF',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  ok: '#34D399',
  okSoft: 'rgba(52,211,153,0.14)',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const gradients = {
  brand: ['#7C3AED', '#EC4899'] as const,
  brandSoft: ['rgba(124,58,237,0.35)', 'rgba(236,72,153,0.10)'] as const,
  glow: ['rgba(139,92,246,0.30)', 'rgba(9,9,15,0)'] as const,
};

const COVERS: readonly (readonly [string, string])[] = [
  ['#7C3AED', '#EC4899'],
  ['#2563EB', '#06B6D4'],
  ['#F97316', '#EC4899'],
  ['#10B981', '#3B82F6'],
  ['#8B5CF6', '#06B6D4'],
  ['#EF4444', '#F59E0B'],
  ['#14B8A6', '#8B5CF6'],
  ['#EC4899', '#F59E0B'],
];

/** Stable gradient for a song, so each track keeps the same "cover" colours. */
export function coverColors(seed: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length] as readonly [string, string];
}

