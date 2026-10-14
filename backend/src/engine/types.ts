export const VIBE_KEYS = [
  'happy',
  'sad',
  'romantic',
  'energetic',
  'chill',
  'party',
  'aesthetic',
  'cinematic',
  'nostalgic',
  'confident',
  'peaceful',
  'funny',
  'emotional',
] as const;

export type VibeKey = (typeof VIBE_KEYS)[number];
export type VibeVector = Record<string, number>;

export interface SongCandidate {
  id: string;
  title: string;
  artistId: string;
  artist: string;
  language: string;
  genres: string[];
  popularity: number; // 0..1 global saturation
  mood: VibeVector;
  aesthetic: VibeVector;
  occasions: string[];
  energy: number;
  tempo: number;
  danceability: number;
  trendScore: number; // 0..1
  socialScore: number; // 0..1, from the app's own social graph only
}

export interface UserProfile {
  languages: Record<string, number>;
  vibes: VibeVector;
  artists: Record<string, number>; // artist name (lowercase) -> affinity -1..1
  energy: number;
  discoveryPreference: number; // 0..1
  rejectedSongIds: Set<string>;
  recentSongIds: Set<string>; // already recommended recently, to reduce repetition
  historyAffinity: Record<string, number>; // songId -> affinity
}

export interface RecommendationContext {
  vibe: VibeVector; // from media analysis or NL parse
  occasion?: string | null;
  requestedLanguages: string[];
  mood?: string | null;
  energy?: number | null;
}

export type Source =
  | 'visual'
  | 'taste'
  | 'occasion'
  | 'language'
  | 'trending'
  | 'history'
  | 'discovery'
  | 'collaborative';

export interface SignalScores {
  visual_match: number;
  taste_match: number;
  mood_match: number;
  language_match: number;
  occasion_match: number;
  trend_score: number;
  social_score: number;
}

export type Category =
  | 'best_match'
  | 'trending_match'
  | 'your_taste'
  | 'social_match'
  | 'hidden_gem'
  | 'good_match';

export interface Candidate {
  song: SongCandidate;
  sources: Set<Source>;
}

export interface ScoredCandidate extends Candidate {
  signals: SignalScores;
  score: number;
}

export interface RankedItem {
  songId: string;
  rank: number;
  score: number;
  category: Category;
  source: Source;
  signals: SignalScores;
  reasons: string[];
}
