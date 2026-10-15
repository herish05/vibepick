import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { importHits, searchCatalog } from '../../lib/catalog.js';
import { toSongDto } from './mapper.js';

const BOOTSTRAP: [string, string][] = [
  ['bollywood hits', 'Hindi'],
  ['punjabi hits', 'Punjabi'],
  ['english pop hits', 'English'],
];
let bootstrapUntil = 0;
let bootstrapping: Promise<void> | null = null;

export async function musicRoutes(app: FastifyInstance): Promise<void> {
  const { prisma } = app.deps;
  const auth = { onRequest: [app.authenticate] };
  const include = { artist: true, features: true } as const;

  /** Pull real tracks from the public catalogue into our DB. Never throws: search must still answer from local data. */
  async function enrich(term: string, language: string): Promise<void> {
    try {
      await importHits(prisma, await searchCatalog(term, 25), language);
    } catch (err) {
      app.log.warn({ err: String(err), term }, 'catalogue lookup failed');
    }
  }

  async function bootstrap(language?: string): Promise<void> {
    if (Date.now() < bootstrapUntil) return;
    bootstrapping ??= (async () => {
      const jobs = BOOTSTRAP.filter(([, l]) => !language || l.toLowerCase() === language.toLowerCase());
      await Promise.all((jobs.length ? jobs : BOOTSTRAP).map(([term, l]) => enrich(term, l)));
      bootstrapUntil = Date.now() + 5 * 60_000;
    })().finally(() => {
      bootstrapping = null;
    });
    await bootstrapping;
  }

  app.get('/songs', auth, async (req) => {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        language: z.string().max(30).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);
    const tokens = (q.q ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
    const find = () =>
      prisma.song.findMany({
        where: {
          active: true,
          ...(q.language ? { language: { equals: q.language, mode: 'insensitive' } } : {}),
          AND: tokens.map((t) => ({
            OR: [{ title: { contains: t, mode: 'insensitive' as const } }, { artist: { name: { contains: t, mode: 'insensitive' as const } } }],
          })),
        },
        include,
        orderBy: [{ popularity: 'desc' }, { createdAt: 'desc' }],
        take: q.limit,
      });

    let songs = await find();
    if (tokens.length > 0 && songs.length < Math.min(q.limit, 10)) {
      await enrich(tokens.join(' '), q.language ?? 'Other');
      songs = await find();
    } else if (tokens.length === 0 && songs.length < 10) {
      await bootstrap(q.language);
      songs = await find();
    }
    return { items: songs.map(toSongDto) };
  });

  app.get('/songs/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const song = await prisma.song.findUnique({ where: { id }, include });
    if (!song) throw notFound('Song not found');
    return { ...toSongDto(song), features: song.features };
  });

  app.get('/favorites', auth, async (req) => {
    const favs = await prisma.favorite.findMany({
      where: { userId: req.user.sub },
      include: { song: { include } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: favs.map((f) => toSongDto(f.song)) };
  });

  app.put('/favorites/:songId', auth, async (req, reply) => {
    const { songId } = z.object({ songId: z.string().uuid() }).parse(req.params);
    if (!(await prisma.song.findUnique({ where: { id: songId } }))) throw notFound('Song not found');
    await prisma.favorite.upsert({
      where: { userId_songId: { userId: req.user.sub, songId } },
      create: { userId: req.user.sub, songId },
      update: {},
    });
    await prisma.userInteraction.create({ data: { userId: req.user.sub, songId, type: 'song_saved', source: 'favorites' } });
    return reply.status(204).send();
  });

  app.delete('/favorites/:songId', auth, async (req, reply) => {
    const { songId } = z.object({ songId: z.string().uuid() }).parse(req.params);
    await prisma.favorite.deleteMany({ where: { userId: req.user.sub, songId } });
    return reply.status(204).send();
  });

  // Latest trend snapshot per song for a scope (global | language:x | occasion:x)
  app.get('/trends', auth, async (req) => {
    const { scope, limit } = z
      .object({ scope: z.string().max(60).default('global'), limit: z.coerce.number().int().min(1).max(30).default(10) })
      .parse(req.query);
    const snaps = await prisma.trendSnapshot.findMany({
      where: { scope },
      orderBy: [{ capturedAt: 'desc' }, { score: 'desc' }],
      distinct: ['songId'],
      take: limit,
      include: { song: { include } },
    });
    return { scope, items: snaps.map((s) => ({ ...toSongDto(s.song), trendScore: s.score })) };
  });
}
