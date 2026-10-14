import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(254),
  password: z.string().min(8, 'At least 8 characters').max(128),
});

export const registerSchema = loginSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email') });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;

export const LANGUAGES = ['English', 'Hindi', 'Punjabi', 'Tamil', 'Telugu', 'Spanish', 'Korean', 'Arabic'] as const;
export const OCCASIONS = ['birthday', 'wedding', 'travel', 'night-out', 'graduation', 'festival', 'gym', 'rainy', 'friends', 'solo', 'couple'] as const;
export const MOODS = ['happy', 'chill', 'romantic', 'energetic', 'sad', 'party'] as const;
export const TARGET_LABEL: Record<string, string> = {
  instagram_story: 'Story',
  instagram_post: 'Post',
  instagram_reel: 'Reel',
  whatsapp_status: 'WhatsApp',
  youtube_short: 'Short',
  other: 'Other',
};
export const VIBES = ['chill', 'happy', 'romantic', 'energetic', 'sad', 'aesthetic', 'party', 'nostalgic'] as const;

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '–';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  best_match: 'Best match',
  trending_match: 'Trending match',
  your_taste: 'Your taste',
  social_match: 'Popular with similar creators',
  hidden_gem: 'Hidden gem',
  good_match: 'More options',
};

/** Turn engine signal contributions (0..1) into short human reasons, strongest first. */
export function signalReasons(why: Record<string, number>, max = 3): string[] {
  const labels: Record<string, string> = {
    visual_match: 'Matches the look of your content',
    taste_match: 'Fits your taste',
    mood_match: 'Matches the mood',
    language_match: 'In your language',
    occasion_match: 'Suits the occasion',
    trend_score: 'Trending right now',
    social_score: 'Popular with similar creators',
  };
  return Object.entries(why)
    .filter(([k, v]) => labels[k] && v >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => labels[k] as string);
}
