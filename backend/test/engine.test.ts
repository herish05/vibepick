import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANKING_CONFIG,
  decayFactor,
  emptyTaste,
  recommend,
  seedTaste,
  updateTaste,
  type SongCandidate,
  type UserProfile,
} from '../src/engine/index.js';
import { weightedScore } from '../src/engine/scoring.js';

let n = 0;
function song(p: Partial<SongCandidate> & { artist: string }): SongCandidate {
  n++;
  return {
    id: `s${n}`,
    title: `Song ${n}`,
    artistId: p.artist,
    language: 'hindi',
    genres: ['pop'],
    popularity: 0.5,
    mood: {},
    aesthetic: {},
    occasions: [],
    energy: 0.5,
    tempo: 100,
    danceability: 0.5,
    trendScore: 0.1,
    socialScore: 0,
    ...p,
  };
}

const user = (over: Partial<UserProfile> = {}): UserProfile => ({
  languages: {},
  vibes: {},
  artists: {},
  energy: 0.5,
  discoveryPreference: 0.5,
  rejectedSongIds: new Set(),
  recentSongIds: new Set(),
  historyAffinity: {},
  ...over,
});

function catalog(): SongCandidate[] {
  const out: SongCandidate[] = [];
  for (let i = 0; i < 12; i++) {
    out.push(
      song({
        artist: `party-artist-${i}`,
        language: i % 2 ? 'punjabi' : 'hindi',
        genres: [i % 3 === 0 ? 'hip-hop' : 'pop'],
        mood: { party: 0.9, energetic: 0.9, happy: 0.8 },
        aesthetic: { night: 0.8 },
        occasions: ['birthday'],
        popularity: 0.3 + (i % 5) * 0.15,
      }),
    );
    out.push(song({ artist: `sad-artist-${i}`, mood: { sad: 0.9, chill: 0.6 }, occasions: ['rainy'] }));
  }
  return out;
}

describe('recommendation engine', () => {
  const ctx = { vibe: { party: 0.9, energetic: 0.8, happy: 0.9 }, occasion: 'birthday', requestedLanguages: [] };

  it('ranks visually matching songs above mismatched ones', () => {
    const { items } = recommend({ songs: catalog(), context: ctx, user: user(), longTermVibes: {}, shortTermVibes: {} });
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0]?.signals.visual_match).toBeGreaterThan(0.8);
    expect(items[0]?.category).toBe('best_match');
    expect(items[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('enforces artist diversity', () => {
    const songs = Array.from({ length: 10 }, () =>
      song({ artist: 'same', mood: { party: 1 }, occasions: ['birthday'] }),
    ).concat(catalog());
    const { items } = recommend({ songs, context: ctx, user: user(), longTermVibes: {}, shortTermVibes: {} });
    const artists = items.map((i) => songs.find((s) => s.id === i.songId)?.artistId);
    expect(artists.filter((a) => a === 'same').length).toBeLessThanOrEqual(1);
  });

  it('hard-filters by requested language when enough candidates exist', () => {
    const songs = catalog().concat(
      Array.from({ length: 10 }, (_, i) =>
        song({ artist: `pj-${i}`, language: 'punjabi', mood: { party: 0.7 }, occasions: ['birthday'] }),
      ),
    );
    const { items } = recommend({
      songs,
      context: { ...ctx, requestedLanguages: ['punjabi'] },
      user: user(),
      longTermVibes: {},
      shortTermVibes: {},
    });
    for (const i of items) expect(songs.find((s) => s.id === i.songId)?.language).toBe('punjabi');
  });

  it('never returns rejected songs', () => {
    const songs = catalog();
    const rejected = new Set(songs.slice(0, 10).map((s) => s.id));
    const { items } = recommend({
      songs,
      context: ctx,
      user: user({ rejectedSongIds: rejected }),
      longTermVibes: {},
      shortTermVibes: {},
    });
    expect(items.some((i) => rejected.has(i.songId))).toBe(false);
  });

  it('cold start (empty profile) still returns results', () => {
    const { items, stats } = recommend({ songs: catalog(), context: ctx, user: user(), longTermVibes: {}, shortTermVibes: {} });
    expect(stats.final).toBe(items.length);
    expect(items.length).toBeGreaterThan(0);
  });

  it('personalization shifts ranking toward liked artist', () => {
    const songs = catalog();
    const liked = songs.find((s) => s.artist === 'party-artist-4')!;
    const base = recommend({ songs, context: ctx, user: user(), longTermVibes: {}, shortTermVibes: {} });
    const boosted = recommend({
      songs,
      context: ctx,
      user: user({ artists: { 'party-artist-4': 1 }, historyAffinity: { [liked.id]: 1 } }),
      longTermVibes: { party: 1 },
      shortTermVibes: { party: 1 },
    });
    const rank = (r: typeof base) => r.items.find((i) => i.songId === liked.id)?.rank ?? 99;
    expect(rank(boosted)).toBeLessThanOrEqual(rank(base));
  });

  it('uses configurable weights', () => {
    const signals = {
      visual_match: 1, taste_match: 0, mood_match: 0, language_match: 0,
      occasion_match: 0, trend_score: 0, social_score: 0,
    };
    expect(weightedScore(signals, DEFAULT_RANKING_CONFIG.weights)).toBeCloseTo(0.3);
    expect(weightedScore(signals, { ...DEFAULT_RANKING_CONFIG.weights, visual_match: 1 })).toBeGreaterThan(0.4);
  });
});

describe('taste model', () => {
  const s = { language: 'Punjabi', artist: 'X', mood: { party: 1 }, aesthetic: {} };
  const opts = { rate: 0.3, halfLifeDays: 1, now: new Date('2026-01-02') };

  it('reinforces on positive and reduces on negative', () => {
    const base = { ...emptyTaste(new Date('2026-01-02')) };
    const up = updateTaste(base, s, 1, opts);
    expect(up.languages['punjabi']).toBeGreaterThan(0);
    const down = updateTaste(up, s, -1, opts);
    expect(down.languages['punjabi']).toBeLessThan(up.languages['punjabi']!);
  });

  it('decays old preferences over time', () => {
    const old = { ...seedTaste({ languages: ['hindi'], vibes: [], favoriteArtists: [] }, new Date('2025-12-01')) };
    const updated = updateTaste(old, s, 0, { ...opts, rate: 0.3 });
    expect(updated.languages['hindi']!).toBeLessThan(0.8);
    expect(decayFactor(30, 30)).toBeCloseTo(0.5);
  });
});
