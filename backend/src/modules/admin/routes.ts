import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { rankingConfigSchema } from '../../engine/index.js';
import { computeStats, computeTrendSnapshots } from '../analytics/service.js';

const vibeMap = z.record(z.number().min(0).max(1));
const songInput = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(120),
  language: z.string().min(1).max(30),
  genres: z.array(z.string().max(30)).max(8).default([]),
  popularity: z.number().min(0).max(1).default(0.5),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  previewUrl: z.string().url().optional(),
  features: z.object({
    mood: vibeMap, aesthetic: vibeMap, occasions: z.array(z.string().max(30)).max(10),
    tempo: z.number().int().min(30).max(250), energy: z.number().min(0).max(1), danceability: z.number().min(0).max(1),
  }),
});

/** Admin endpoints never expose user media or personal listening data — only aggregates and catalog. */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const { prisma } = app.deps;
  const admin = { onRequest: [app.requireAdmin] };

  app.get('/admin/stats', admin, async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
    return computeStats(prisma, days);
  });

  app.post('/admin/trends/recompute', admin, async () => ({ snapshots: await computeTrendSnapshots(prisma) }));

  app.get('/admin/songs', admin, async () => ({
    items: await prisma.song.findMany({ include: { artist: true, features: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
  }));

  app.post('/admin/songs', admin, async (req, reply) => {
    const b = songInput.parse(req.body);
    const artist = await prisma.artist.upsert({ where: { name: b.artist }, create: { name: b.artist, genres: b.genres }, update: {} });
    const song = await prisma.song.create({
      data: {
        title: b.title, artistId: artist.id, language: b.language, genres: b.genres, popularity: b.popularity,
        releaseYear: b.releaseYear, previewUrl: b.previewUrl,
        features: { create: { ...b.features, mood: b.features.mood as Prisma.InputJsonValue, aesthetic: b.features.aesthetic as Prisma.InputJsonValue } },
      },
    });
    return reply.status(201).send(song);
  });

  app.patch('/admin/songs/:id', admin, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = z.object({ active: z.boolean().optional(), popularity: z.number().min(0).max(1).optional() }).parse(req.body);
    return prisma.song.update({ where: { id }, data: b });
  });

  app.get('/admin/ranking-config', admin, async () => ({
    items: await prisma.rankingConfig.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  }));

  app.put('/admin/ranking-config', admin, async (req, reply) => {
    const cfg = rankingConfigSchema.parse(req.body);
    await prisma.rankingConfig.updateMany({ where: { active: true }, data: { active: false } });
    const row = await prisma.rankingConfig.create({ data: { version: cfg.version, weights: cfg as unknown as Prisma.InputJsonValue, active: true } });
    return reply.status(201).send(row);
  });

  app.get('/admin/experiments', admin, async () => ({ items: await prisma.experiment.findMany() }));

  app.post('/admin/experiments', admin, async (req, reply) => {
    const b = z
      .object({
        key: z.string().min(1).max(60),
        description: z.string().max(300).optional(),
        variants: z.array(z.object({ name: z.string(), weight: z.number().min(0), config: z.record(z.unknown()).optional() })).min(2),
        active: z.boolean().default(false),
      })
      .parse(req.body);
    return reply.status(201).send(await prisma.experiment.create({ data: { ...b, variants: b.variants as Prisma.InputJsonValue } }));
  });

  app.get('/admin/failed-media', admin, async () => ({
    items: await prisma.media.findMany({ where: { status: 'FAILED' }, select: { id: true, createdAt: true, type: true }, take: 100 }),
  }));
}
