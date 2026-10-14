import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { buildApp, type Deps } from './app.js';
import { loadEnv } from './config/env.js';
import { HttpMlClient } from './lib/ml.js';
import { LocalStorage } from './lib/storage.js';

export function buildDeps(): Deps & { shutdown: () => Promise<void> } {
  const env = loadEnv();
  const prisma = new PrismaClient();
  const closers: (() => Promise<unknown>)[] = [() => prisma.$disconnect()];
  const deps: Deps = {
    env,
    prisma,
    storage: new LocalStorage(env.UPLOAD_DIR),
    ml: new HttpMlClient(env.ML_SERVICE_URL, env.ML_TIMEOUT_MS),
  };
  if (env.REDIS_URL) {
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
    redis.on('error', () => undefined);
    const queues = new Map<string, Queue>();
    deps.redisPing = async () => (await redis.ping()) === 'PONG';
    deps.enqueue = async (name, data) => {
      let q = queues.get(name);
      if (!q) {
        q = new Queue(name, { connection: redis });
        queues.set(name, q);
      }
      await q.add(name, data, { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    };
    closers.push(async () => {
      await Promise.all([...queues.values()].map((q) => q.close()));
      redis.disconnect();
    });
  }
  return { ...deps, shutdown: async () => void (await Promise.all(closers.map((c) => c()))) };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const app = await buildApp(deps);
  const stop = async () => {
    await app.close();
    await deps.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  await app.listen({ port: deps.env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
