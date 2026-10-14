import { describe, expect, it, vi } from 'vitest';
import { toPendingContent, targetFromUrl, isSupportedMime } from '@/lib/sharing';
import { createEventQueue, type KeyValueStore } from '@/lib/eventQueue';
import { createApiClient, ApiError, type TokenStore } from '@/lib/api';
import { loginSchema, registerSchema, signalReasons, formatDuration } from '@/lib/validation';

const memStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
};

describe('share intake', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  it('maps a shared image and starts the clock at receipt', () => {
    const c = toPendingContent({ files: [{ path: '/tmp/a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' }] }, now);
    expect(c).toMatchObject({ kind: 'media', uri: 'file:///tmp/a.jpg', isVideo: false, contentTarget: 'instagram_story', receivedAt: now.toISOString() });
  });
  it('defaults videos to reel and keeps content:// uris', () => {
    const c = toPendingContent({ files: [{ path: 'content://x/1', mimeType: 'video/mp4', fileName: 'v.mp4' }] }, now);
    expect(c).toMatchObject({ kind: 'media', uri: 'content://x/1', isVideo: true, contentTarget: 'instagram_reel' });
  });
  it('rejects unsupported file types and falls back to text', () => {
    expect(toPendingContent({ files: [{ path: '/a.gif', mimeType: 'image/gif', fileName: 'a.gif' }] }, now)).toBeNull();
    expect(toPendingContent({ text: ' late night drive ' }, now)).toMatchObject({ kind: 'text', text: 'late night drive' });
  });
  it('treats links as links (never fetched) and infers the target', () => {
    expect(toPendingContent({ webUrl: 'https://www.instagram.com/reel/abc/' }, now)).toMatchObject({ kind: 'link', contentTarget: 'instagram_reel' });
    expect(targetFromUrl('https://instagram.com/stories/u/1')).toBe('instagram_story');
    expect(targetFromUrl('https://youtube.com/shorts/x')).toBe('youtube_short');
    expect(targetFromUrl('not a url')).toBeNull();
    expect(isSupportedMime('video/quicktime')).toBe(true);
  });
  it('returns null for empty shares', () => {
    expect(toPendingContent({}, now)).toBeNull();
  });
});

describe('event queue', () => {
  it('keeps events when offline and delivers them in order later', async () => {
    const store = memStore();
    let online = false;
    const sent: string[] = [];
    const q = createEventQueue(store, async (batch) => {
      if (!online) throw new Error('offline');
      sent.push(...batch.map((e) => e.type));
    });
    await q.track({ type: 'song_open' });
    await q.track({ type: 'song_selected' });
    await q.flush();
    expect(await q.size()).toBe(2);
    online = true;
    await q.flush();
    expect(sent).toEqual(['song_open', 'song_selected']);
    expect(await q.size()).toBe(0);
  });
  it('stamps occurredAt when tracking', async () => {
    const store = memStore();
    const q = createEventQueue(store, async () => {
      throw new Error('x');
    });
    await q.track({ type: 'search' });
    expect(JSON.parse(store.data.get('vp.eventQueue.v1') as string)[0].occurredAt).toBeTruthy();
  });
});

describe('api client', () => {
  function setup(responses: Response[]) {
    let tokens: { accessToken: string; refreshToken: string } | null = { accessToken: 'a1', refreshToken: 'r1' };
    const store: TokenStore = { get: async () => tokens, set: async (t) => void (tokens = t), clear: async () => void (tokens = null) };
    const fetchImpl = vi.fn(async () => responses.shift() as Response);
    const expired = vi.fn();
    const api = createApiClient({ baseUrl: 'http://x', tokens: store, fetchImpl: fetchImpl as unknown as typeof fetch, onSessionExpired: expired });
    return { api, fetchImpl, expired, getTokens: () => tokens };
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('refreshes once on 401 and retries with the new token', async () => {
    const { api, fetchImpl, getTokens } = setup([json(401, { message: 'no' }), json(200, { accessToken: 'a2', refreshToken: 'r2' }), json(200, { id: 'u' })]);
    expect(await api.me()).toEqual({ id: 'u' });
    expect(getTokens()?.accessToken).toBe('a2');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('signs out when refresh fails', async () => {
    const { api, expired, getTokens } = setup([json(401, { message: 'no' }), json(401, { message: 'bad' }), json(401, { message: 'no' })]);
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalled();
    expect(getTokens()).toBeNull();
  });
  it('maps network failure to a friendly error', async () => {
    const store: TokenStore = { get: async () => null, set: async () => undefined, clear: async () => undefined };
    const api = createApiClient({ baseUrl: 'http://x', tokens: store, fetchImpl: (async () => { throw new TypeError('fail'); }) as unknown as typeof fetch });
    await expect(api.login('a@b.co', 'password1')).rejects.toMatchObject({ status: 0, isNetwork: true });
  });
});

describe('validation helpers', () => {
  it('validates credentials', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: '12345678' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '12345678', confirm: 'nope' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '12345678', confirm: '12345678' }).success).toBe(true);
  });
  it('builds explanations only from real signals', () => {
    expect(signalReasons({ visual_match: 0.9, taste_match: 0.1, language_match: 1, trend_score: 0 })).toEqual(['In your language', 'Matches the look of your content']);
    expect(signalReasons({ trend_score: 0.05 })).toEqual([]);
  });
  it('formats time-to-selection', () => {
    expect(formatDuration(null)).toBe('–');
    expect(formatDuration(8_000)).toBe('8s');
    expect(formatDuration(75_000)).toBe('1m 15s');
  });
});
