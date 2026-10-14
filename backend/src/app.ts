import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Env } from './config/env.js';
import { HttpError, forbidden, unauthorized } from './lib/errors.js';
import type { MlClient } from './lib/ml.js';
import type { Storage } from './lib/storage.js';
import { registerRoutes } from './modules/index.js';
import { metrics } from './lib/metrics.js';

export interface Deps {
  env: Env;
  prisma: PrismaClient;
  storage: Storage;
  ml: MlClient;
  redisPing?: () => Promise<boolean>;
  enqueue?: (queue: string, data: Record<string, unknown>) => Promise<void>;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: 'USER' | 'ADMIN' };
    user: { sub: string; role: 'USER' | 'ADMIN' };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { env } = deps;
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.refreshToken'],
          },
    bodyLimit: 1024 * 1024,
  });
  app.decorate('deps', deps);

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',') });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.ACCESS_TOKEN_TTL } });
  await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });
  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    await app.authenticate(req, undefined as never);
    if (req.user.role !== 'ADMIN') throw forbidden();
  });

  app.addHook('onResponse', async (req, reply) => {
    metrics.observe(req.routeOptions.url ?? 'unknown', req.method, reply.statusCode, reply.elapsedTime);
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'validation_error', message: 'Invalid input', issues: err.issues });
    }
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(413).send({ error: 'file_too_large', message: 'File too large' });
    if (e.statusCode && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: e.code ?? 'error', message: e.message });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: 'internal_error', message: 'Something went wrong' });
  });

  await registerRoutes(app);
  return app;
}
