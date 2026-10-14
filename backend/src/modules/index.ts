import type { FastifyInstance } from 'fastify';
import { metrics } from '../lib/metrics.js';
import { adminRoutes } from './admin/routes.js';
import { authRoutes } from './auth/routes.js';
import { instagramRoutes } from './instagram/routes.js';
import { interactionRoutes } from './interactions/routes.js';
import { mediaRoutes } from './media/routes.js';
import { musicRoutes } from './music/routes.js';
import { recommendationRoutes } from './recommendations/routes.js';
import { userRoutes } from './users/routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, boolean> = {};
    try {
      await app.deps.prisma.$queryRaw`SELECT 1`;
      checks['database'] = true;
    } catch {
      checks['database'] = false;
    }
    if (app.deps.redisPing) checks['redis'] = await app.deps.redisPing().catch(() => false);
    const ok = Object.values(checks).every(Boolean);
    return reply.status(ok ? 200 : 503).send({ status: ok ? 'ready' : 'degraded', checks });
  });

  app.get('/metrics', async (_req, reply) => reply.header('Content-Type', 'text/plain; version=0.0.4').send(metrics.render()));

  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(userRoutes);
      await v1.register(mediaRoutes);
      await v1.register(musicRoutes);
      await v1.register(recommendationRoutes);
      await v1.register(interactionRoutes);
      await v1.register(instagramRoutes);
      await v1.register(adminRoutes);
    },
    { prefix: '/api/v1' },
  );
}
