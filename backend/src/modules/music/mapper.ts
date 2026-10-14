import type { Artist, Song, SongFeatures } from '@prisma/client';
import type { SongCandidate, VibeVector } from '../../engine/types.js';

type SongWithRelations = Song & { artist: Artist; features: SongFeatures | null };

export function toSongCandidate(s: SongWithRelations, extras: { trendScore?: number; socialScore?: number } = {}): SongCandidate {
  const f = s.features;
  return {
    id: s.id,
    title: s.title,
    artistId: s.artistId,
    artist: s.artist.name,
    language: s.language.toLowerCase(),
    genres: s.genres.map((g) => g.toLowerCase()),
    popularity: s.popularity,
    mood: (f?.mood as VibeVector | undefined) ?? {},
    aesthetic: (f?.aesthetic as VibeVector | undefined) ?? {},
    occasions: f?.occasions ?? [],
    energy: f?.energy ?? 0.5,
    tempo: f?.tempo ?? 100,
    danceability: f?.danceability ?? 0.5,
    trendScore: extras.trendScore ?? 0,
    socialScore: extras.socialScore ?? 0,
  };
}

export function toSongDto(s: SongWithRelations) {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist.name,
    language: s.language,
    genres: s.genres,
    previewUrl: s.previewUrl,
    coverUrl: s.coverUrl,
    releaseYear: s.releaseYear,
  };
}
