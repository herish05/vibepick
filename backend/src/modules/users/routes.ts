import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { emptyTaste, seedTaste, updateTaste, EVENT_WEIGHTS, DEFAULT_RANKING_CONFIG } from '../../engine/index.js';
import type { TasteState } from '../../engine/index.js';
import { toSongCandidate } from '../music/mapper.js';

export const preferencesSchema = z.object({
  languages: z.array(z.string().min(1).max(30)).max(15).default([]),
  vibes: z.array(z.string().min(1).max(30)).max(15).default([]),
  favoriteArtists: z.array(z.string().min(1).max(80)).max(20).default([]),
  allowMlUse: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, storage } = app.deps;
  const auth = { onRequest: [app.authenticate] };

  app.get('/me', auth, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      include: { profile: true, preference: true, instagram: { select: { connectedAt: true, lastSyncAt: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      onboarded: user.profile?.onboarded ?? false,
      displayName: user.profile?.displayName ?? null,
      preferences: user.preference,
      instagramConnected: Boolean(user.instagram),
    };
  });

  app.patch('/me/profile', auth, async (req) => {
    const body = z.object({ displayName: z.string().trim().min(1).max(60) }).parse(req.body);
    return prisma.userProfile.upsert({
      where: { userId: req.user.sub },
      create: { userId: req.user.sub, ...body },
      update: body,
    });
  });

  app.get('/me/preferences', auth, async (req) => prisma.userPreference.findUnique({ where: { userId: req.user.sub } }));

  // Onboarding + settings. Declared preferences cold-start the long-term taste vector.
  app.put('/me/preferences', auth, async (req) => {
    const body = preferencesSchema.parse(req.body);
    const userId = req.user.sub;
    const pref = await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });
    const seeded = seedTaste(pref);
    await prisma.userTasteVector.upsert({
      where: { userId },
      create: { userId, longTerm: seeded as unknown as Prisma.InputJsonValue, shortTerm: emptyTaste() as unknown as Prisma.InputJsonValue },
      update: { longTerm: seeded as unknown as Prisma.InputJsonValue },
    });
    await prisma.userProfile.upsert({ where: { userId }, create: { userId, onboarded: true }, update: { onboarded: true } });
    return pref;
  });

  // Cold-start "pick songs that feel like you" game.
  app.post('/me/preferences/quiz', auth, async (req) => {
    const { songIds } = z.object({ songIds: z.array(z.string().uuid()).min(1).max(20) }).parse(req.body);
    const songs = await prisma.song.findMany({ where: { id: { in: songIds } }, include: { artist: true, features: true } });
    const tv = await prisma.userTasteVector.findUnique({ where: { userId: req.user.sub } });
    let long = (tv?.longTerm as unknown as TasteState) ?? emptyTaste();
    for (const s of songs) {
      const c = toSongCandidate(s);
      long = updateTaste(long, c, EVENT_WEIGHTS['song_selected'] ?? 1, {
        rate: 0.2,
        halfLifeDays: DEFAULT_RANKING_CONFIG.decay.halfLifeDays,
      });
    }
    await prisma.userTasteVector.upsert({
      where: { userId: req.user.sub },
      create: { userId: req.user.sub, longTerm: long as unknown as Prisma.InputJsonValue, shortTerm: emptyTaste() as unknown as Prisma.InputJsonValue },
      update: { longTerm: long as unknown as Prisma.InputJsonValue },
    });
    return { updated: songs.length };
  });

  app.get('/me/taste', auth, async (req) => {
    const tv = await prisma.userTasteVector.findUnique({ where: { userId: req.user.sub } });
    return { longTerm: tv?.longTerm ?? {}, shortTerm: tv?.shortTerm ?? {} };
  });

  app.get('/me/export', auth, async (req) => {
    const userId = req.user.sub;
    const [user, interactions, feedback, favorites, recs] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, createdAt: true, preference: true } }),
      prisma.userInteraction.findMany({ where: { userId } }),
      prisma.feedback.findMany({ where: { userId } }),
      prisma.favorite.findMany({ where: { userId } }),
      prisma.recommendation.findMany({ where: { userId }, include: { items: true } }),
    ]);
    return { user, interactions, feedback, favorites, recommendations: recs };
  });

  // Hard delete: DB rows cascade; stored media files are removed too.
  app.delete('/me', auth, async (req, reply) => {
    const userId = req.user.sub;
    const media = await prisma.media.findMany({ where: { userId } });
    for (const m of media) {
      await storage.remove(m.storageKey);
      if (m.thumbKey) await storage.remove(m.thumbKey);
    }
    await prisma.auditLog.create({ data: { userId: null, action: 'account_deleted', meta: { userIdHash: userId.slice(0, 8) } } });
    await prisma.user.delete({ where: { id: userId } });
    return reply.status(204).send();
  });

}
