import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';
import { HttpMlClient } from '../lib/ml.js';
import { LocalStorage } from '../lib/storage.js';
import { computeTrendSnapshots } from '../modules/analytics/service.js';
import type { Prisma } from '@prisma/client';

const env = loadEnv();
if (!env.REDIS_URL) throw new Error('REDIS_URL is required for the worker');
const prisma = new PrismaClient();
const storage = new LocalStorage(env.UPLOAD_DIR);
const ml = new HttpMlClient(env.ML_SERVICE_URL, env.ML_TIMEOUT_MS);
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Retries analysis for media that fell back to neutral analysis. */
const imageAnalysis = new Worker(
  'image_analysis',
  async (job) => {
    const media = await prisma.media.findUnique({ where: { id: String(job.data.mediaId) } });
    if (!media || media.status === 'DELETED' || media.type !== 'IMAGE') return;
    const chunks: Buffer[] = [];
    for await (const c of await storage.read(media.storageKey)) chunks.push(c as Buffer);
    const result = await ml.analyzeImage(Buffer.concat(chunks), media.mimeType);
    await prisma.mediaAnalysis.upsert({
      where: { mediaId: media.id },
      create: { mediaId: media.id, ...result, structured: result.structured as Prisma.InputJsonValue },
      update: { ...result, structured: result.structured as Prisma.InputJsonValue },
    });
    await prisma.media.update({ where: { id: media.id }, data: { status: 'READY' } });
  },
  { connection, concurrency: 4 },
);

/** Hourly trend recompute + daily media retention sweep. */
const maintenance = new Worker(
  'maintenance',
  async (job) => {
    if (job.name === 'trend_calculation') await computeTrendSnapshots(prisma);
    if (job.name === 'media_retention') {
      const expired = await prisma.media.findMany({ where: { expiresAt: { lt: new Date() }, status: { not: 'DELETED' } }, take: 500 });
      for (const m of expired) {
        await storage.remove(m.storageKey);
        await prisma.media.update({ where: { id: m.id }, data: { status: 'DELETED' } });
      }
    }
  },
  { connection },
);

const maintenanceQueue = new Queue('maintenance', { connection });
await maintenanceQueue.upsertJobScheduler('trend_calculation', { every: 3_600_000 }, { name: 'trend_calculation' });
await maintenanceQueue.upsertJobScheduler('media_retention', { every: 86_400_000 }, { name: 'media_retention' });

for (const w of [imageAnalysis, maintenance]) {
  w.on('failed', (job, err) => console.error(JSON.stringify({ level: 'error', queue: w.name, job: job?.id, err: err.message })));
}
console.log('worker started');
