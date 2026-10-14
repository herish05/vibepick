import type {
  AuthResult,
  FeedbackReason,
  FeedbackRating,
  HistoryItem,
  InteractionEvent,
  Me,
  Recommendation,
  RecommendationRequest,
  Song,
  UploadedMedia,
  ContentOrigin,
  ContentTarget,
} from './types';

export interface TokenStore {
  get(): Promise<{ accessToken: string; refreshToken: string } | null>;
  set(t: { accessToken: string; refreshToken: string }): Promise<void>;
  clear(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  onSessionExpired?: () => void;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, '') + '/api/v1';
  let refreshing: Promise<boolean> | null = null;

  async function raw(path: string, init: RequestInit, token?: string): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    try {
      return await doFetch(base + path, { ...init, headers });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Check your connection.');
    }
  }

  async function refresh(): Promise<boolean> {
    const t = await opts.tokens.get();
    if (!t) return false;
    const res = await raw('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: t.refreshToken }),
    });
    if (!res.ok) {
      await opts.tokens.clear();
      opts.onSessionExpired?.();
      return false;
    }
    await opts.tokens.set((await res.json()) as { accessToken: string; refreshToken: string });
    return true;
  }

  async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    const send = async () => raw(path, init, auth ? (await opts.tokens.get())?.accessToken : undefined);
    let res = await send();
    if (res.status === 401 && auth) {
      refreshing ??= refresh().finally(() => {
        refreshing = null;
      });
      if (await refreshing) res = await send();
    }
    if (res.status === 204) return undefined as T;
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const b = body as { message?: string; error?: string };
      throw new ApiError(res.status, b.message ?? 'Something went wrong', b.error);
    }
    return body as T;
  }

  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    async register(email: string, password: string): Promise<AuthResult> {
      const r = await request<AuthResult>('/auth/register', json('POST', { email, password }), false);
      await opts.tokens.set(r);
      return r;
    },
    async login(email: string, password: string): Promise<AuthResult> {
      const r = await request<AuthResult>('/auth/login', json('POST', { email, password }), false);
      await opts.tokens.set(r);
      return r;
    },
    async logout(): Promise<void> {
      const t = await opts.tokens.get();
      if (t) await request('/auth/logout', json('POST', { refreshToken: t.refreshToken }), false).catch(() => undefined);
      await opts.tokens.clear();
    },
    forgotPassword: (email: string) => request<void>('/auth/forgot-password', json('POST', { email }), false),

    me: () => request<Me>('/me'),
    setPreferences: (p: { languages: string[]; vibes: string[]; favoriteArtists: string[]; allowMlUse?: boolean }) =>
      request('/me/preferences', json('PUT', p)),
    exportData: () => request<unknown>('/me/export'),
    deleteAccount: async () => {
      await request<void>('/me', json('DELETE'));
      await opts.tokens.clear();
    },

    async uploadMedia(
      file: UploadFile,
      meta: { contentTarget: ContentTarget; origin: ContentOrigin; receivedAt: string },
    ): Promise<UploadedMedia> {
      const form = new FormData();
      // Fields must precede the file so the server can read them from the multipart stream.
      form.append('contentTarget', meta.contentTarget);
      form.append('origin', meta.origin);
      form.append('receivedAt', meta.receivedAt);
      // React Native FormData accepts a { uri, name, type } descriptor.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      return request<UploadedMedia>('/media', { method: 'POST', body: form });
    },
    deleteMedia: (id: string) => request<void>(`/media/${id}`, { method: 'DELETE' }),
    mediaUrl: async (id: string) => {
      const r = await request<{ url: string }>(`/media/${id}/url`);
      return opts.baseUrl.replace(/\/$/, '') + r.url;
    },

    recommend: (body: RecommendationRequest) => request<Recommendation>('/recommendations', json('POST', body)),
    recommendation: (id: string) => request<Recommendation>(`/recommendations/${id}`),
    history: (limit = 20) => request<{ items: HistoryItem[] }>(`/history?limit=${limit}`),

    sendInteractions: (events: InteractionEvent[]) => request<void>('/interactions', json('POST', { events })),
    sendFeedback: (b: { recommendationId: string; songId?: string; rating: FeedbackRating; reasons: FeedbackReason[] }) =>
      request('/feedback', json('POST', b)),

    songs: (q: { q?: string; language?: string; limit?: number } = {}) => {
      const p = new URLSearchParams();
      if (q.q) p.set('q', q.q);
      if (q.language) p.set('language', q.language);
      p.set('limit', String(q.limit ?? 20));
      return request<{ items: Song[] }>(`/songs?${p}`);
    },
    song: (id: string) => request<Song>(`/songs/${id}`),
    favorites: () => request<{ items: Song[] }>('/favorites'),
    addFavorite: (id: string) => request<void>(`/favorites/${id}`, { method: 'PUT' }),
    removeFavorite: (id: string) => request<void>(`/favorites/${id}`, { method: 'DELETE' }),

    instagramStatus: () => request<{ available: boolean; connected: boolean; connectedAt: string | null }>('/instagram/status'),
    instagramConnect: () => request<{ url: string }>('/instagram/connect', json('POST')),
    instagramDisconnect: () => request<void>('/instagram', { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
