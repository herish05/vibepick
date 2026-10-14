import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { conflict, unauthorized } from '../../lib/errors.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/security.js';

const credentials = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, env } = app.deps;

  async function issueTokens(user: { id: string; role: 'USER' | 'ADMIN' }) {
    const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
    const refreshToken = randomToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  const strict = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.post('/auth/register', strict, async (req, reply) => {
    const body = credentials.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict('Email already registered');
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        profile: { create: {} },
        preference: { create: { languages: [], vibes: [], favoriteArtists: [] } },
      },
    });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'register' } });
    return reply.status(201).send({ user: { id: user.id, email: user.email }, ...(await issueTokens(user)) });
  });

  app.post('/auth/login', strict, async (req) => {
    const body = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same error for unknown user and wrong password (no user enumeration)
    if (!user || user.deletedAt || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized('Invalid email or password');
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: 'login' } });
    return { user: { id: user.id, email: user.email }, ...(await issueTokens(user)) };
  });

  app.post('/auth/refresh', strict, async (req) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20).max(200) }).parse(req.body);
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date() || record.user.deletedAt) {
      throw unauthorized('Invalid refresh token');
    }
    // Rotation: old token is revoked on use
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return issueTokens(record.user);
  });

  app.post('/auth/logout', async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().max(200) }).parse(req.body);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return reply.status(204).send();
  });

  // Always 202 so the endpoint cannot be used to enumerate accounts. Email delivery is a TODO integration.
  app.post('/auth/forgot-password', strict, async (req, reply) => {
    z.object({ email: z.string().email() }).parse(req.body);
    return reply.status(202).send({ message: 'If the account exists, a reset link will be sent.' });
  });
}
