import { z } from 'zod';
import { VIBE_KEYS } from '../engine/types.js';

export const analysisSchema = z.object({
  structured: z.record(z.unknown()),
  vibe: z.record(z.number()),
  embedding: z.array(z.number()).default([]),
  provider: z.string(),
  confidence: z.number().min(0).max(1),
});
export type MediaAnalysisResult = z.infer<typeof analysisSchema>;

export interface MlClient {
  analyzeImage(data: Buffer, mime: string): Promise<MediaAnalysisResult>;
}

export class HttpMlClient implements MlClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async analyzeImage(data: Buffer, mime: string): Promise<MediaAnalysisResult> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)], { type: mime }), 'upload');
    const res = await fetch(`${this.baseUrl}/image/analyze`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`ML service responded ${res.status}`);
    return analysisSchema.parse(await res.json());
  }
}

/** Neutral fallback used when the ML service times out, so users are never blocked. */
export function fallbackAnalysis(): MediaAnalysisResult {
  const vibe = Object.fromEntries(VIBE_KEYS.map((k) => [k, 0.3]));
  return { structured: { fallback: true }, vibe, embedding: [], provider: 'fallback', confidence: 0.1 };
}
