import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { detectMediaType } from '../../lib/filetype.js';
import { fallbackAnalysis, type MediaAnalysisResult } from '../../lib/ml.js';
import { signValue, verifySignature } from '../../lib/security.js';
import { metrics } from '../../lib/metrics.js';

export const CONTENT_TARGETS = [
  'instagram_story',
  'instagram_post',
  'instagram_reel',
  'whatsapp_status',
  'youtube_short',
  'other',
] as const;
export const ORIGINS = ['share_sheet', 'gallery', 'camera', 'other'] as const;

const fieldsSchema = z.object({
  contentTarget: z.enum(CONTENT_TARGETS).default('instagram_story'),
  origin: z.enum(ORIGINS).default('gallery'),
  receivedAt: z.string().datetime().optional(),
});

function fieldValue(fields: Record<string, unknown>, name: string): string | undefined {
  const f = fields[name] as { value?: unknown } | undefined;
  return typeof f?.value === 'string' ? f.value : undefined;
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, storage, ml, env } = app.deps;
  const auth = { onRequest: [app.authenticate] };

  async function analyze(mediaId: string, data: Buffer, mime: string, isImage: boolean): Promise<MediaAnalysisResult> {
    let result: MediaAnalysisResult;
    let failed = false;
    if (isImage) {
      try {
        result = await ml.analyzeImage(data, mime);
      } catch (err) {
        app.log.warn({ err: String(err), mediaId }, 'image analysis failed; using fallback');
        metrics.inc('ml_analysis_failures_total');
        result = fallbackAnalysis();
        failed = true;
      }
    } else {
      // Video understanding is Phase 8; neutral vibe so user intent/taste drive ranking meanwhile.
      result = fallbackAnalysis();
    }
    await prisma.mediaAnalysis.upsert({
      where: { mediaId },
      create: { mediaId, ...result, structured: result.structured as Prisma.InputJsonValue },
      update: { ...result, structured: result.structured as Prisma.InputJsonValue },
    });
    await prisma.media.update({ where: { id: mediaId }, data: { status: failed ? 'FAILED' : 'READY' } });
    if (failed) await app.deps.enqueue?.('image_analysis', { mediaId });
    return result;
  }

  app.post('/media', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw badRequest('Expected a multipart file upload');
    const fields = fieldsSchema.parse({
      contentTarget: fieldValue(file.fields, 'contentTarget'),
      origin: fieldValue(file.fields, 'origin'),
      receivedAt: fieldValue(file.fields, 'receivedAt'),
    });
    const buffer = await file.toBuffer();
    const type = detectMediaType(buffer);
    if (!type) return reply.status(415).send({ error: 'unsupported_media_type', message: 'Only JPEG, PNG, WebP, MP4 and MOV are supported' });

    const now = Date.now();
    const claimed = fields.receivedAt ? Date.parse(fields.receivedAt) : now;
    // Client clock is only trusted within a sane window (used for time-to-selection)
    const receivedAt = new Date(claimed > now || now - claimed > 3_600_000 ? now : claimed);

    const id = randomUUID();
    const key = `${req.user.sub}/${id}.${type.ext}`;
    await storage.put(key, buffer);
    const media = await prisma.media.create({
      data: {
        id,
        userId: req.user.sub,
        type: type.kind,
        storageKey: key,
        mimeType: type.mime,
        sizeBytes: buffer.length,
        origin: fields.origin,
        contentTarget: fields.contentTarget,
        receivedAt,
        status: 'ANALYZING',
        expiresAt: new Date(now + env.MEDIA_RETENTION_DAYS * 86_400_000),
      },
    });
    const analysis = await analyze(media.id, buffer, type.mime, type.kind === 'IMAGE');
    return reply.status(201).send({
      id: media.id,
      type: media.type,
      contentTarget: media.contentTarget,
      receivedAt: media.receivedAt,
      analysis: { structured: analysis.structured, vibe: analysis.vibe, confidence: analysis.confidence, provider: analysis.provider },
    });
  });

  app.get('/media/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const media = await prisma.media.findFirst({ where: { id, userId: req.user.sub }, include: { analysis: true } });
    if (!media || media.status === 'DELETED') throw notFound('Media not found');
    return {
      id: media.id,
      type: media.type,
      status: media.status,
      contentTarget: media.contentTarget,
      receivedAt: media.receivedAt,
      analysis: media.analysis && { structured: media.analysis.structured, vibe: media.analysis.vibe, confidence: media.analysis.confidence },
    };
  });

  // Short-lived signed URL; the file route verifies the signature (no bearer token needed by <Image>).
  app.get('/media/:id/url', auth, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const media = await prisma.media.findFirst({ where: { id, userId: req.user.sub } });
    if (!media) throw notFound('Media not found');
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = signValue(`${id}.${exp}`, env.MEDIA_URL_SECRET);
    return { url: `/api/v1/media/${id}/file?exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
  });

  app.get('/media/:id/file', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { exp, sig } = z.object({ exp: z.coerce.number(), sig: z.string().max(100) }).parse(req.query);
    if (exp < Date.now() / 1000 || !verifySignature(`${id}.${exp}`, sig, env.MEDIA_URL_SECRET)) {
      return reply.status(403).send({ error: 'forbidden', message: 'Invalid or expired link' });
    }
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media || media.status === 'DELETED') throw notFound('Media not found');
    return reply
      .header('Content-Type', media.mimeType)
      .header('Cache-Control', 'private, max-age=300')
      .header('X-Content-Type-Options', 'nosniff')
      .send(await storage.read(media.storageKey));
  });

  app.delete('/media/:id', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const media = await prisma.media.findFirst({ where: { id, userId: req.user.sub } });
    if (!media) throw notFound('Media not found');
    await storage.remove(media.storageKey);
    await prisma.media.update({ where: { id }, data: { status: 'DELETED' } });
    return reply.status(204).send();
  });
}
