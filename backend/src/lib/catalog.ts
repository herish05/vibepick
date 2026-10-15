import type { PrismaClient } from '@prisma/client';

/**
 * Live music catalogue backed by the public iTunes Search API (no key required). It returns real
 * titles, artists, cover art and 30-second preview clips. Results are cached in our own database so
 * recommendations, favourites and history keep working with stable song ids.
 */

interface ITunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

export interface CatalogHit {
  externalId: string;
  title: string;
  artist: string;
  genre: string;
  previewUrl: string | null;
  coverUrl: string | null;
  releaseYear: number | null;
}

const ENDPOINT = 'https://itunes.apple.com/search';

export async function searchCatalog(term: string, limit = 25, fetchImpl: typeof fetch = fetch): Promise<CatalogHit[]> {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit), country: 'IN' }).toString();
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`catalog_http_${res.status}`);
  const json = (await res.json()) as { results?: ITunesTrack[] };
  const seen = new Set<string>();
  const hits: CatalogHit[] = [];
  for (const r of json.results ?? []) {
    if (!r.trackId || !r.trackName || !r.artistName) continue;
    const key = `${r.trackName.toLowerCase()}|${r.artistName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : NaN;
    hits.push({
      externalId: `itunes:${r.trackId}`,
      title: r.trackName,
      artist: r.artistName,
      genre: (r.primaryGenreName ?? 'pop').toLowerCase(),
      previewUrl: r.previewUrl ?? null,
      coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '400x400bb') : null,
      releaseYear: Number.isFinite(year) ? year : null,
    });
  }
  return hits;
}

type Vec = Record<string, number>;
interface Dna {
  mood: Vec;
  aesthetic: Vec;
  occasions: string[];
  energy: number;
  danceability: number;
  tempo: number;
}

/** Coarse, genre-based song DNA so imported tracks participate in recommendations. */
function dnaFor(genre: string): Dna {
  if (/hip|rap/.test(genre))
    return { mood: { confident: 0.9, energetic: 0.75, party: 0.55 }, aesthetic: { luxury: 0.7, night: 0.7 }, occasions: ['night-out', 'friends', 'gym'], energy: 0.78, danceability: 0.72, tempo: 100 };
  if (/dance|electro|house|edm/.test(genre))
    return { mood: { party: 0.95, energetic: 0.9, happy: 0.7 }, aesthetic: { night: 0.8, party: 0.9 }, occasions: ['party', 'birthday', 'night-out'], energy: 0.9, danceability: 0.88, tempo: 124 };
  if (/rock|metal|alternative/.test(genre))
    return { mood: { energetic: 0.8, confident: 0.7 }, aesthetic: { street: 0.6 }, occasions: ['gym', 'friends', 'travel'], energy: 0.8, danceability: 0.5, tempo: 125 };
  if (/chill|ambient|lounge|acoustic|singer|folk|indie/.test(genre))
    return { mood: { chill: 0.9, peaceful: 0.7, aesthetic: 0.7 }, aesthetic: { aesthetic: 0.85, sunset: 0.7 }, occasions: ['travel', 'solo', 'friends'], energy: 0.35, danceability: 0.4, tempo: 90 };
  if (/soundtrack|bollywood|filmi|indian|hindi/.test(genre))
    return { mood: { romantic: 0.8, emotional: 0.7, cinematic: 0.6 }, aesthetic: { cinematic: 0.7, warm: 0.6 }, occasions: ['wedding', 'couple', 'travel'], energy: 0.5, danceability: 0.5, tempo: 95 };
  return { mood: { happy: 0.7, chill: 0.5, romantic: 0.4 }, aesthetic: { aesthetic: 0.6, warm: 0.5 }, occasions: ['friends', 'travel', 'solo'], energy: 0.6, danceability: 0.6, tempo: 105 };
}

/** Persist catalogue hits (idempotent) and return their database song ids in input order. */
export async function importHits(prisma: PrismaClient, hits: CatalogHit[], language: string): Promise<string[]> {
  const ids: string[] = [];
  for (const h of hits) {
    try {
      ids.push(await importOne(prisma, h, language));
    } catch {
      // A concurrent request may have imported the same track; the next lookup will find it.
    }
  }
  return ids;
}

async function importOne(prisma: PrismaClient, h: CatalogHit, language: string): Promise<string> {
  {
    const existing = await prisma.song.findUnique({ where: { externalId: h.externalId }, select: { id: true } });
    if (existing) return existing.id;
    const artist = await prisma.artist.upsert({ where: { name: h.artist }, create: { name: h.artist, genres: [h.genre] }, update: {} });
    const dna = dnaFor(h.genre);
    const song = await prisma.song.create({
      data: {
        title: h.title,
        artistId: artist.id,
        language,
        genres: [h.genre],
        popularity: 0.5,
        releaseYear: h.releaseYear,
        previewUrl: h.previewUrl,
        coverUrl: h.coverUrl,
        externalId: h.externalId,
        provider: 'itunes',
        features: {
          create: { mood: dna.mood, aesthetic: dna.aesthetic, occasions: dna.occasions, tempo: dna.tempo, energy: dna.energy, danceability: dna.danceability },
        },
      },
      select: { id: true },
    });
    return song.id;
  }
}
