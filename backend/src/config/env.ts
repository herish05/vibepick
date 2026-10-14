import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  MEDIA_URL_SECRET: z.string().min(16).default('dev-media-secret-change-me-please'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(15),
  MEDIA_RETENTION_DAYS: z.coerce.number().default(30),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  ML_TIMEOUT_MS: z.coerce.number().default(8000),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  INSTAGRAM_REDIRECT_URI: z.string().optional(),
  CORS_ORIGINS: z.string().default('*'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return enforceProductionSafety(parsed.data);
}

/** Refuse to boot in production with development defaults. */
function enforceProductionSafety(env: Env): Env {
  if (env.NODE_ENV !== 'production') return env;
  const problems: string[] = [];
  if (!env.TOKEN_ENCRYPTION_KEY) problems.push('TOKEN_ENCRYPTION_KEY is required');
  if (env.MEDIA_URL_SECRET === 'dev-media-secret-change-me-please') problems.push('MEDIA_URL_SECRET must be set');
  if (env.CORS_ORIGINS.trim() === '*') problems.push('CORS_ORIGINS must list explicit origins');
  if (/change-me/i.test(env.JWT_SECRET)) problems.push('JWT_SECRET must not be a placeholder');
  if (problems.length) throw new Error(`Unsafe production configuration: ${problems.join('; ')}`);
  return env;
}
