export type ContentTarget =
  | 'instagram_story'
  | 'instagram_post'
  | 'instagram_reel'
  | 'whatsapp_status'
  | 'youtube_short'
  | 'other';

export type ContentOrigin = 'instagram_share' | 'gallery' | 'camera' | 'other_share';

export interface Song {
  id: string;
  title: string;
  artist: string;
  language: string;
  genres: string[];
  previewUrl: string | null;
  coverUrl: string | null;
  releaseYear: number | null;
}

export type RecCategory = 'best_match' | 'trending_match' | 'your_taste' | 'social_match' | 'hidden_gem' | 'good_match';

export interface RecItem {
  song_id: string;
  rank: number;
  score: number;
  category: RecCategory;
  source: string;
  reasons: string[];
  why_this_song: Record<string, number>;
  song: Song;
}

export interface Recommendation {
  recommendation_id: string;
  content_type: string;
  algorithm: string;
  content_received_at: string | null;
  latency_ms: number;
  items: RecItem[];
}

export interface MediaAnalysis {
  structured: Record<string, unknown>;
  vibe: Record<string, number>;
  confidence: number;
  provider: string;
}

export interface UploadedMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  contentTarget: ContentTarget;
  receivedAt: string;
  analysis: MediaAnalysis;
}

export interface Me {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  onboarded: boolean;
  displayName: string | null;
  preferences: { languages: string[]; vibes: string[]; favoriteArtists: string[]; allowMlUse?: boolean } | null;
  instagramConnected: boolean;
}

export interface AuthResult {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}

export interface HistoryItem {
  recommendation_id: string;
  created_at: string;
  content_type: string;
  media_id: string | null;
  time_to_selection_ms: number | null;
  selected_song: Song | null;
  top_song: Song | null;
}

export type InteractionType =
  | 'recommendation_impression'
  | 'song_open'
  | 'song_preview_start'
  | 'song_preview_complete'
  | 'song_selected'
  | 'song_saved'
  | 'song_shared'
  | 'song_skipped'
  | 'song_rejected'
  | 'search'
  | 'filter_used';

export interface InteractionEvent {
  type: InteractionType;
  songId?: string;
  recommendationId?: string;
  sessionId?: string;
  position?: number;
  source?: string;
  context?: { previewMs?: number; query?: string; filter?: string };
  occurredAt?: string;
}

export type FeedbackRating = 'exactly' | 'good' | 'okay' | 'not_my_vibe';
export type FeedbackReason =
  | 'wrong_mood'
  | 'wrong_language'
  | 'too_common'
  | 'too_slow'
  | 'too_energetic'
  | 'dislike_artist'
  | 'doesnt_match_photo'
  | 'not_trending';

export interface RecommendationRequest {
  media_id?: string;
  content_type: ContentTarget;
  occasion?: string | null;
  language_preferences?: string[];
  mood?: string | null;
  natural_language_context?: string | null;
  session_id?: string | null;
}
