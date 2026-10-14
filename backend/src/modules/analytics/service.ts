import type { PrismaClient } from '@prisma/client';

export async function computeStats(prisma: PrismaClient, sinceDays = 7) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const [recs, selected, impressions, previews, saves, feedback, users, tts] = await Promise.all([
    prisma.recommendation.count({ where: { createdAt: { gte: since } } }),
    prisma.recommendation.count({ where: { createdAt: { gte: since }, selectedAt: { not: null } } }),
    prisma.userInteraction.count({ where: { createdAt: { gte: since }, type: 'recommendation_impression' } }),
    prisma.userInteraction.count({ where: { createdAt: { gte: since }, type: 'song_preview_start' } }),
    prisma.userInteraction.count({ where: { createdAt: { gte: since }, type: 'song_saved' } }),
    prisma.feedback.groupBy({ by: ['rating'], where: { createdAt: { gte: since } }, _count: true }),
    prisma.user.count(),
    prisma.recommendation.aggregate({ where: { createdAt: { gte: since }, timeToSelectionMs: { not: null } }, _avg: { timeToSelectionMs: true }, _count: true }),
  ]);
  const fb = Object.fromEntries(feedback.map((f) => [f.rating, f._count]));
  const fbTotal = Object.values(fb).reduce((a, b) => a + b, 0);
  const positive = (fb['exactly'] ?? 0) + (fb['good'] ?? 0);
  const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : 0);
  return {
    windowDays: sinceDays,
    users,
    recommendations: recs,
    impressions,
    selectionRate: ratio(selected, recs),
    previewRate: ratio(previews, impressions),
    saveRate: ratio(saves, recs),
    positiveFeedbackRate: ratio(positive, fbTotal),
    negativeFeedbackRate: ratio(fb['not_my_vibe'] ?? 0, fbTotal),
    avgTimeToSelectionMs: Math.round(tts._avg.timeToSelectionMs ?? 0),
    selectionsMeasured: tts._count,
  };
}

/** Trend score = recent usage + growth + velocity over selections/saves (own-app signals only). */
export async function computeTrendSnapshots(prisma: PrismaClient): Promise<number> {
  const now = Date.now();
  const d = (n: number) => new Date(now - n * 86_400_000);
  const types = ['song_selected', 'song_saved', 'song_shared'] as const;
  const [recent, prior, day] = await Promise.all([
    prisma.userInteraction.groupBy({ by: ['songId'], where: { type: { in: [...types] }, songId: { not: null }, createdAt: { gte: d(7) } }, _count: true }),
    prisma.userInteraction.groupBy({ by: ['songId'], where: { type: { in: [...types] }, songId: { not: null }, createdAt: { gte: d(14), lt: d(7) } }, _count: true }),
    prisma.userInteraction.groupBy({ by: ['songId'], where: { type: { in: [...types] }, songId: { not: null }, createdAt: { gte: d(1) } }, _count: true }),
  ]);
  const priorMap = new Map(prior.map((p) => [p.songId, p._count]));
  const dayMap = new Map(day.map((p) => [p.songId, p._count]));
  const maxUsage = Math.max(1, ...recent.map((r) => r._count));
  const rows = recent.flatMap((r) => {
    if (!r.songId) return [];
    const before = priorMap.get(r.songId) ?? 0;
    const growth = (r._count - before) / Math.max(1, before);
    const velocity = (dayMap.get(r.songId) ?? 0) / Math.max(1, r._count / 7);
    const score = Math.min(1, 0.5 * (r._count / maxUsage) + 0.3 * Math.min(1, Math.max(0, growth) / 2) + 0.2 * Math.min(1, velocity / 3));
    return [{ songId: r.songId, scope: 'global', usage: r._count, growthRate: growth, velocity, score }];
  });
  if (rows.length) await prisma.trendSnapshot.createMany({ data: rows });
  return rows.length;
}
