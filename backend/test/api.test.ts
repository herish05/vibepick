import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import type { MlClient } from '../src/lib/ml.js';
import { LocalStorage } from '../src/lib/storage.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://vibepick:vibepick@localhost:5433/vibepick_test';

const partyVibe = { party: 0.9, energetic: 0.85, happy: 0.8, confident: 0.5, aesthetic: 0.4 };
const ml: MlClient = {
  analyzeImage: async () => ({ structured: { occasion: 'birthday' }, vibe: partyVibe, embedding: [], provider: 'mock', confidence: 0.9 }),
};

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

function multipart(file: Buffer, fields: Record<string, string> = {}) {
  const boundary = '----vp' + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`));
  parts.push(file, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

let app: FastifyInstance;
let prisma: PrismaClient;

async function register(email: string) {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email, password: 'correct-horse-1' } });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  return { ...body, headers: { authorization: `Bearer ${body.accessToken}` } } as { user: { id: string }; accessToken: string; refreshToken: string; headers: { authorization: string } };
}

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const env = loadEnv({
    NODE_ENV: 'test', DATABASE_URL: DB, JWT_SECRET: 'x'.repeat(40),
    UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'vp-')), MAX_UPLOAD_MB: '1', AUTH_RATE_LIMIT_MAX: '1000',
  });
  app = await buildApp({ env, prisma, storage: new LocalStorage(env.UPLOAD_DIR), ml });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const uid = () => Math.random().toString(36).slice(2, 10);

describe('auth', () => {
  it('registers, logs in, rotates refresh tokens, and rejects reuse', async () => {
    const email = `a-${uid()}@test.dev`;
    const u = await register(email);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'correct-horse-1' } });
    expect(login.statusCode).toBe(200);

    const r1 = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: u.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: u.refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });

  it('gives identical errors for wrong password and unknown user', async () => {
    const email = `b-${uid()}@test.dev`;
    await register(email);
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'wrong-password-1' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: `no-${uid()}@test.dev`, password: 'wrong-password-1' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual(unknown.json());
  });

  it('rejects weak/invalid input and injection-style payloads', async () => {
    const weak = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'x@test.dev', password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const inj = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: "' OR 1=1 --", password: 'whatever123' } });
    expect(inj.statusCode).toBe(400);
  });

  it('requires a token for protected routes and blocks non-admins from admin', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/me' })).statusCode).toBe(401);
    const u = await register(`c-${uid()}@test.dev`);
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/stats', headers: u.headers })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: 'Bearer garbage' } })).statusCode).toBe(401);
  });
});

describe('media upload security', () => {
  it('rejects non-media content even with an image MIME type', async () => {
    const u = await register(`m-${uid()}@test.dev`);
    const m = multipart(Buffer.from('<?php echo 1; ?> not an image at all'));
    const res = await app.inject({ method: 'POST', url: '/api/v1/media', headers: { ...u.headers, ...m.headers }, payload: m.payload });
    expect(res.statusCode).toBe(415);
  });

  it('rejects oversized files', async () => {
    const u = await register(`o-${uid()}@test.dev`);
    const m = multipart(Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]));
    const res = await app.inject({ method: 'POST', url: '/api/v1/media', headers: { ...u.headers, ...m.headers }, payload: m.payload });
    expect(res.statusCode).toBe(413);
  });

  it("does not let users read each other's media", async () => {
    const a = await register(`ua-${uid()}@test.dev`);
    const b = await register(`ub-${uid()}@test.dev`);
    const m = multipart(png);
    const up = await app.inject({ method: 'POST', url: '/api/v1/media', headers: { ...a.headers, ...m.headers }, payload: m.payload });
    expect(up.statusCode).toBe(201);
    const id = up.json().id;
    expect((await app.inject({ method: 'GET', url: `/api/v1/media/${id}`, headers: b.headers })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/media/${id}/url`, headers: b.headers })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/media/${id}/file?exp=9999999999&sig=bad` })).statusCode).toBe(403);

    const signed = (await app.inject({ method: 'GET', url: `/api/v1/media/${id}/url`, headers: a.headers })).json().url as string;
    const file = await app.inject({ method: 'GET', url: signed });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
  });
});

describe('core flow: share -> recommend -> select -> learn', () => {
  it('works end to end and records time-to-selection', async () => {
    const u = await register(`f-${uid()}@test.dev`);
    const prefs = await app.inject({
      method: 'PUT', url: '/api/v1/me/preferences', headers: u.headers,
      payload: { languages: ['punjabi', 'hindi'], vibes: ['party', 'confident'], favoriteArtists: ['AP Dhillon'] },
    });
    expect(prefs.statusCode).toBe(200);

    const m = multipart(png, { contentTarget: 'instagram_reel', origin: 'share_sheet', receivedAt: new Date(Date.now() - 4000).toISOString() });
    const up = await app.inject({ method: 'POST', url: '/api/v1/media', headers: { ...u.headers, ...m.headers }, payload: m.payload });
    expect(up.statusCode).toBe(201);
    const mediaId = up.json().id;

    const rec = await app.inject({
      method: 'POST', url: '/api/v1/recommendations', headers: u.headers,
      payload: { media_id: mediaId, content_type: 'instagram_reel', natural_language_context: 'punjabi, not too popular' },
    });
    expect(rec.statusCode).toBe(200);
    const body = rec.json();
    expect(body.items.length).toBeGreaterThanOrEqual(5);
    expect(body.items.length).toBeLessThanOrEqual(10);
    expect(body.items[0].category).toBe('best_match');
    expect(body.items[0].why_this_song).toHaveProperty('visual_match');
    expect(body.items[0].reasons.length).toBeGreaterThan(0);
    const artists = body.items.map((i: { song: { artist: string } }) => i.song.artist);
    expect(new Set(artists).size).toBe(artists.length);
    expect(body.items.every((i: { song: { language: string } }) => i.song.language === 'Punjabi')).toBe(true);

    const pick = body.items[0];
    const ev = await app.inject({
      method: 'POST', url: '/api/v1/interactions', headers: u.headers,
      payload: { events: [
        { type: 'song_preview_start', songId: pick.song_id, recommendationId: body.recommendation_id, position: 1 },
        { type: 'song_selected', songId: pick.song_id, recommendationId: body.recommendation_id, position: 1 },
      ] },
    });
    expect(ev.statusCode).toBe(202);
    const stored = await prisma.recommendation.findUniqueOrThrow({ where: { id: body.recommendation_id } });
    expect(stored.timeToSelectionMs).toBeGreaterThanOrEqual(3500);
    expect(stored.selectedSongId).toBe(pick.song_id);

    const fb = await app.inject({
      method: 'POST', url: '/api/v1/feedback', headers: u.headers,
      payload: { recommendationId: body.recommendation_id, songId: body.items[1].song_id, rating: 'not_my_vibe', reasons: ['too_common'] },
    });
    expect(fb.statusCode).toBe(201);

    const taste = (await app.inject({ method: 'GET', url: '/api/v1/me/taste', headers: u.headers })).json();
    expect(taste.shortTerm.languages.punjabi).toBeGreaterThan(0);

    // Disliked song is excluded next time
    const again = (await app.inject({
      method: 'POST', url: '/api/v1/recommendations', headers: u.headers, payload: { media_id: mediaId },
    })).json();
    expect(again.items.map((i: { song_id: string }) => i.song_id)).not.toContain(body.items[1].song_id);

    const hist = (await app.inject({ method: 'GET', url: '/api/v1/history', headers: u.headers })).json();
    expect(hist.items[hist.items.length - 1].time_to_selection_ms ?? hist.items.some((h: { time_to_selection_ms: number | null }) => h.time_to_selection_ms)).toBeTruthy();
  });

  it("cannot attach interactions to someone else's recommendation", async () => {
    const a = await register(`ia-${uid()}@test.dev`);
    const b = await register(`ib-${uid()}@test.dev`);
    const rec = (await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers: a.headers, payload: { natural_language_context: 'romantic hindi' } })).json();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/interactions', headers: b.headers,
      payload: { events: [{ type: 'song_selected', songId: rec.items[0].song_id, recommendationId: rec.recommendation_id }] },
    });
    expect(res.json()).toEqual({ accepted: 0, rejected: 1 });
    expect((await app.inject({ method: 'GET', url: `/api/v1/recommendations/${rec.recommendation_id}`, headers: b.headers })).statusCode).toBe(404);
  });

  it('works without media (describe-your-vibe) and with a cold-start user', async () => {
    const u = await register(`cs-${uid()}@test.dev`);
    const res = await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers: u.headers, payload: { natural_language_context: 'sad rainy night' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThan(0);
    expect((await app.inject({ method: 'POST', url: '/api/v1/recommendations', headers: u.headers, payload: {} })).statusCode).toBe(400);
  });
});

describe('privacy', () => {
  it('deletes the account and all related data', async () => {
    const u = await register(`d-${uid()}@test.dev`);
    const m = multipart(png);
    await app.inject({ method: 'POST', url: '/api/v1/media', headers: { ...u.headers, ...m.headers }, payload: m.payload });
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: u.headers })).statusCode).toBe(204);
    expect(await prisma.user.count({ where: { id: u.user.id } })).toBe(0);
    expect(await prisma.media.count({ where: { userId: u.user.id } })).toBe(0);
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers: u.headers })).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('Instagram is optional: status works unconnected and connect is refused when unconfigured', async () => {
    const u = await register(`ig-${uid()}@test.dev`);
    const s = (await app.inject({ method: 'GET', url: '/api/v1/instagram/status', headers: u.headers })).json();
    expect(s).toMatchObject({ available: false, connected: false });
    expect((await app.inject({ method: 'POST', url: '/api/v1/instagram/connect', headers: u.headers })).statusCode).toBe(400);
  });
});

describe('rate limiting', () => {
  it('throttles repeated auth attempts', async () => {
    const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: DB, JWT_SECRET: 'x'.repeat(40), AUTH_RATE_LIMIT_MAX: '3' });
    const limited = await buildApp({ env, prisma, storage: new LocalStorage(env.UPLOAD_DIR), ml });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await limited.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'rl@test.dev', password: 'whatever123' } });
      codes.push(r.statusCode);
    }
    await limited.close();
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
  });
});

describe('ops', () => {
  it('exposes health, ready, metrics', async () => {
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/ready' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/metrics' })).body).toContain('http_requests_total');
  });
});
