# Environment variables

Backend and worker read the process environment (validated by zod in `backend/src/config/env.ts`). Docker Compose reads the root `.env`. `.env*` files are git-ignored; only `.env.example` is committed.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `production` enables the safety guard below |
| `PORT` | no | `3000` | |
| `DATABASE_URL` | yes | | Postgres (pgvector image in compose) |
| `REDIS_URL` | no | | Enables BullMQ jobs; without it the API still runs |
| `JWT_SECRET` | yes | | ≥32 chars. `openssl rand -base64 48` |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS` | no | `15m` / `30` | Refresh tokens rotate on use |
| `TOKEN_ENCRYPTION_KEY` | prod | | 32 random bytes, base64: encrypts Instagram tokens (AES-256-GCM) |
| `MEDIA_URL_SECRET` | prod | dev value | HMAC key for 5-minute signed media URLs |
| `UPLOAD_DIR` | no | `./uploads` | Local storage driver |
| `MAX_UPLOAD_MB` | no | `15` | |
| `MEDIA_RETENTION_DAYS` | no | `30` | Daily sweep deletes expired media |
| `ML_SERVICE_URL` / `ML_TIMEOUT_MS` | no | `http://localhost:8000` / `8000` | On ML failure, a neutral vibe is used and a retry job is queued |
| `AI_PROVIDER` / `AI_API_KEY` | no | `heuristic` | ML service provider selection |
| `INSTAGRAM_CLIENT_ID/SECRET/REDIRECT_URI` | no | | All three enable the optional connector; otherwise `available:false` |
| `CORS_ORIGINS` | prod | `*` | Comma-separated origins. Wildcard is rejected in production |
| `AUTH_RATE_LIMIT_MAX` | no | `10` | Per minute, per IP, on auth endpoints |
| `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `REDIS_PORT` | compose | `vibepick`, `5432`, `6379` | Host-port overrides when ports are busy |

**Production guard:** with `NODE_ENV=production` the API refuses to start if `TOKEN_ENCRYPTION_KEY` is missing, `MEDIA_URL_SECRET` is the dev default, `CORS_ORIGINS` is `*`, or `JWT_SECRET` contains `change-me`.

**Mobile:** `EXPO_PUBLIC_API_URL` (build-time). Falls back to `expo.extra.apiUrl` in `app.json` (`http://10.0.2.2:3000`, the Android emulator's host alias).
