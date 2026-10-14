import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { encrypt, signValue, verifySignature } from '../../lib/security.js';

/**
 * Optional, official-OAuth-only Instagram connector. Only user-authorized capabilities that the
 * official API currently exposes are used (basic profile). It does NOT access follower activity,
 * other users' audio choices, or anything unofficial. Swap the connector if API capabilities change.
 */
export interface InstagramConnector {
  readonly enabled: boolean;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; userId?: string; scopes: string[] }>;
}

const SCOPES = ['instagram_business_basic'];

export function createInstagramConnector(env: {
  INSTAGRAM_CLIENT_ID?: string;
  INSTAGRAM_CLIENT_SECRET?: string;
  INSTAGRAM_REDIRECT_URI?: string;
}): InstagramConnector {
  const { INSTAGRAM_CLIENT_ID: id, INSTAGRAM_CLIENT_SECRET: secret, INSTAGRAM_REDIRECT_URI: redirect } = env;
  const enabled = Boolean(id && secret && redirect);
  return {
    enabled,
    authorizeUrl(state) {
      const u = new URL('https://www.instagram.com/oauth/authorize');
      u.search = new URLSearchParams({
        client_id: id ?? '', redirect_uri: redirect ?? '', response_type: 'code', scope: SCOPES.join(','), state,
      }).toString();
      return u.toString();
    },
    async exchangeCode(code) {
      const res = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: id ?? '', client_secret: secret ?? '', grant_type: 'authorization_code', redirect_uri: redirect ?? '', code,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw badRequest('Instagram authorization failed');
      const json = (await res.json()) as { access_token?: string; user_id?: string | number };
      if (!json.access_token) throw badRequest('Instagram authorization failed');
      return { accessToken: json.access_token, userId: json.user_id ? String(json.user_id) : undefined, scopes: SCOPES };
    },
  };
}

export async function instagramRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, env } = app.deps;
  const connector = createInstagramConnector(env);
  const auth = { onRequest: [app.authenticate] };

  app.get('/instagram/status', auth, async (req) => {
    const conn = await prisma.instagramConnection.findUnique({ where: { userId: req.user.sub } });
    return { available: connector.enabled, connected: Boolean(conn), connectedAt: conn?.connectedAt ?? null, lastSyncAt: conn?.lastSyncAt ?? null, scopes: conn?.scopes ?? [] };
  });

  app.post('/instagram/connect', auth, async (req) => {
    if (!connector.enabled) throw badRequest('Instagram connection is not configured on this server');
    const payload = `${req.user.sub}.${Math.floor(Date.now() / 1000) + 600}`;
    const state = `${Buffer.from(payload).toString('base64url')}.${signValue(payload, env.JWT_SECRET)}`;
    return { url: connector.authorizeUrl(state) };
  });

  app.get('/instagram/callback', async (req, reply) => {
    const { code, state } = z.object({ code: z.string().max(1000), state: z.string().max(500) }).parse(req.query);
    const [p, sig] = state.split('.');
    const payload = p ? Buffer.from(p, 'base64url').toString() : '';
    const [userId, exp] = payload.split('.');
    if (!sig || !userId || !exp || Number(exp) < Date.now() / 1000 || !verifySignature(payload, sig, env.JWT_SECRET)) {
      throw badRequest('Invalid state');
    }
    const token = await connector.exchangeCode(code);
    const data = { igUserId: token.userId, encryptedToken: encrypt(token.accessToken, env.TOKEN_ENCRYPTION_KEY), scopes: token.scopes };
    await prisma.instagramConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await prisma.auditLog.create({ data: { userId, action: 'instagram_connected' } });
    return reply.redirect('vibepick://instagram?status=connected');
  });

  // Disconnect + delete everything imported from Instagram.
  app.delete('/instagram', auth, async (req, reply) => {
    await prisma.instagramConnection.deleteMany({ where: { userId: req.user.sub } });
    await prisma.auditLog.create({ data: { userId: req.user.sub, action: 'instagram_disconnected' } });
    return reply.status(204).send();
  });
}
