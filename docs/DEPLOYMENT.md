# Deployment

## Local (Docker)
```bash
cp .env.example .env      # set secrets; change ports if 5432/6379 are taken
docker compose up --build
```
Services: `postgres` (pgvector), `redis`, `ml-service` (:8000), `backend` (:3000; runs `prisma migrate deploy` on start), `worker`. Seed once: `docker compose exec backend npx prisma db seed`. Health: `curl localhost:3000/ready`.

If host ports 5432/6379 are busy set `POSTGRES_PORT=5433`, `REDIS_PORT=6380` in `.env`. Container-to-container traffic is unaffected.

## Production checklist
1. Build images: `backend/Dockerfile`, `ml-service/Dockerfile`. Run the backend and worker from the same image (different command).
2. Managed Postgres with the `vector` extension (needed from Phase 3) and managed Redis.
3. Set `NODE_ENV=production` plus real secrets: `JWT_SECRET` (`openssl rand -base64 48`), `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), `MEDIA_URL_SECRET`, and `CORS_ORIGINS` to explicit origins. The server refuses to start otherwise.
4. Run migrations as a release step (`npx prisma migrate deploy`), then the app. The image's default `CMD` already does this; for multiple replicas, run migrations from one job.
5. Replace local media storage with S3-compatible storage (uploads on local disk do not survive replicas/redeploys).
6. TLS at a reverse proxy/load balancer; scrape `/metrics` from inside the network only.
7. Scale: API is stateless; run ≥1 worker; ML service scales independently.
8. Set `MEDIA_RETENTION_DAYS` according to your privacy policy; back up Postgres.

## CI
`.github/workflows/ci.yml`: backend (lint, typecheck, test against pgvector, build), ml-service (pytest), mobile (lint, typecheck, test, Android prebuild), Docker image builds. It has not been executed on GitHub yet.

## Not provided
Terraform/Kubernetes manifests, autoscaling, blue/green. Choose per cloud.
