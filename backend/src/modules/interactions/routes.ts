import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { applyLearning, FEEDBACK_RATING_WEIGHT, weightForEvent } from './learning.js';

const INTERACTION_TYPES = [
  'recommendation_impression',
  'song_open',
  'song_preview_start',
  'song_preview_complete',
  'song_selected',
  'song_saved',
  'song_shared',
  'song_skipped',
  'song_rejected',
  'feedback_positive',
  'feedback_negative',
  'search',
  'filter_used',
] as const;

const eventSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  songId: z.string().uuid().optional(),
  recommendationId: z.string().uuid().optional(),
  contentId: z.string().uuid().optional(),
  sessionId: z.string().max(64).optional(),
  position: z.number().int().min(0).max(100).optional(),
  source: z.string().max(40).optional(),
  // Whitelisted, small context: never free-form sensitive data
  context: z
    .object({ previewMs: z.number().int().min(0).max(600_000).optional(), query: z.string().max(100).optional(), filter: z.string().max(40).optional() })
    .optional(),
  occurredAt: z.string().datetime().optional(),
});

export const feedbackSchema = z.object({
  recommendationId: z.string().uuid(),
  songId: z.string().uuid().optional(),
  rating: z.enum(['exactly', 'good', 'okay', 'not_my_vibe']),
  reasons: z
    .array(z.enum(['wrong_mood', 'wrong_language', 'too_common', 'too_slow', 'too_energetic', 'dislike_artist', 'doesnt_match_photo', 'not_trending']))
    .max(8)
    .default([]),
});

export async function interactionRoutes(app: FastifyInstance): Promise<void> {
  const { prisma } = app.deps;
  const auth = { onRequest: [app.authenticate] };

  app.post('/interactions', auth, async (req, reply) => {
    const { events } = z.object({ events: z.array(eventSchema).min(1).max(50) }).parse(req.body);
    const userId = req.user.sub;

    // Only accept references to this user's own recommendations
    const recIds = [...new Set(events.map((e) => e.recommendationId).filter((x): x is string => Boolean(x)))];
    const owned = new Set(
      (await prisma.recommendation.findMany({ where: { id: { in: recIds }, userId }, select: { id: true } })).map((r) => r.id),
    );
    const valid = events.filter((e) => !e.recommendationId || owned.has(e.recommendationId));

    await prisma.userInteraction.createMany({
      data: valid.map((e) => ({
        userId,
        type: e.type,
        songId: e.songId,
        recommendationId: e.recommendationId,
        contentId: e.contentId,
        sessionId: e.sessionId,
        position: e.position,
        source: e.source,
        context: e.context ?? {},
        ...(e.occurredAt ? { createdAt: new Date(e.occurredAt) } : {}),
      })),
    });

    for (const e of valid) {
      if (e.songId) await applyLearning(prisma, userId, e.songId, weightForEvent(e.type));
      // Time-to-selection: contentReceivedAt -> selectedAt, first selection only
      if (e.type === 'song_selected' && e.recommendationId && e.songId) {
        const rec = await prisma.recommendation.findFirst({ where: { id: e.recommendationId, userId, selectedAt: null } });
        if (rec) {
          const selectedAt = e.occurredAt ? new Date(e.occurredAt) : new Date();
          const start = rec.contentReceivedAt ?? rec.createdAt;
          await prisma.recommendation.update({
            where: { id: rec.id },
            data: { selectedAt, selectedSongId: e.songId, timeToSelectionMs: Math.max(0, selectedAt.getTime() - start.getTime()) },
          });
        }
      }
    }
    return reply.status(202).send({ accepted: valid.length, rejected: events.length - valid.length });
  });

  app.post('/feedback', auth, async (req, reply) => {
    const body = feedbackSchema.parse(req.body);
    const userId = req.user.sub;
    const rec = await prisma.recommendation.findFirst({ where: { id: body.recommendationId, userId } });
    if (!rec) throw notFound('Recommendation not found');
    await prisma.feedback.create({ data: { userId, recommendationId: rec.id, songId: body.songId, rating: body.rating, reasons: body.reasons } });
    const negative = body.rating === 'not_my_vibe';
    await prisma.userInteraction.create({
      data: {
        userId,
        recommendationId: rec.id,
        songId: body.songId,
        type: negative ? 'feedback_negative' : 'feedback_positive',
        context: { rating: body.rating, reasons: body.reasons },
        source: 'feedback',
      },
    });
    if (body.songId) {
      let weight = FEEDBACK_RATING_WEIGHT[body.rating] ?? 0;
      if (body.reasons.includes('dislike_artist') || body.reasons.includes('wrong_language')) weight *= 1.5;
      await applyLearning(prisma, userId, body.songId, weight);
    }
    return reply.status(201).send({ ok: true });
  });
}
