import type { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_RANKING_CONFIG,
  EVENT_WEIGHTS,
  SHORT_TERM_HALF_LIFE_DAYS,
  TASTE_RATES,
  emptyTaste,
  updateTaste,
  type TasteState,
} from '../../engine/index.js';
import { toSongCandidate } from '../music/mapper.js';

/**
 * Applies a signed learning weight to both long-term (slow, long half-life) and short-term
 * (fast, 1-day half-life) taste. Time decay is applied inside updateTaste.
 */
export async function applyLearning(prisma: PrismaClient, userId: string, songId: string, weight: number): Promise<void> {
  if (weight === 0) return;
  const song = await prisma.song.findUnique({ where: { id: songId }, include: { artist: true, features: true } });
  if (!song) return;
  const c = toSongCandidate(song);
  const tv = await prisma.userTasteVector.findUnique({ where: { userId } });
  const long = updateTaste((tv?.longTerm as unknown as TasteState) ?? emptyTaste(), c, weight, {
    rate: TASTE_RATES.longTerm,
    halfLifeDays: DEFAULT_RANKING_CONFIG.decay.halfLifeDays,
  });
  const short = updateTaste((tv?.shortTerm as unknown as TasteState) ?? emptyTaste(), c, weight, {
    rate: TASTE_RATES.shortTerm,
    halfLifeDays: SHORT_TERM_HALF_LIFE_DAYS,
  });
  const data = {
    longTerm: long as unknown as Prisma.InputJsonValue,
    shortTerm: short as unknown as Prisma.InputJsonValue,
  };
  await prisma.userTasteVector.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

export const weightForEvent = (type: string): number => EVENT_WEIGHTS[type] ?? 0;

export const FEEDBACK_RATING_WEIGHT: Record<string, number> = {
  exactly: EVENT_WEIGHTS['feedback_positive'] ?? 1.5,
  good: 0.7,
  okay: 0,
  not_my_vibe: EVENT_WEIGHTS['feedback_negative'] ?? -1,
};
