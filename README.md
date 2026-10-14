# VibePick

Companion app for Instagram creators: **share your content to VibePick, get the songs most likely to fit it and *you*, pick one in seconds, and go back to Instagram to publish.** It is not a music player or a social network.

```
Instagram / Gallery → Share → VibePick → Understand → Recommend → Select → Return to Instagram
```

Key metric: **time to song selection** (`content_received_at → song_selected_at`), recorded per recommendation.

## What is real, and what is not (read this first)

| Area | Status |
| --- | --- |
| Share-sheet intake (Android `SEND`/`SEND_MULTIPLE`, iOS Share Extension) | Implemented via `expo-share-intent`; **needs a dev build (not Expo Go)**. Android intent filters verified with `expo prebuild`; **not yet run on a physical device or iOS simulator** |
| Auth, preferences, media upload, recommendations, interactions, feedback, favorites, admin API | Implemented, tested (30 backend tests) |
| Multi-stage recommender (retrieve → filter → score → re-rank → explain) | Implemented, deterministic, config-driven, tested |
| Visual understanding | **Baseline only.** `heuristic` provider = colour/brightness/saturation features. Honest `confidence` (0.35) and `semantic_understanding: false`. A semantic provider (CLIP / vision LLM) plugs into the same interface (`AI_PROVIDER`) |
| Song catalog | **47 seed songs; metadata is real, "Song DNA" values (mood, energy, occasions) are illustrative**, not measured audio features. No audio is bundled. Previews need a licensed provider (field exists, empty in seed) |
| Trends | Computed hourly from in-app interactions (no external trend ingestion yet: Phase 5) |
| Instagram | Optional, official OAuth only, off unless `INSTAGRAM_*` is set. It never provides follower or audio-library data; the app does not assume either |
| Video | Upload accepted and stored; **understanding returns 501** (Phase 8). Videos get a neutral vibe plus your context chips |
| Learned ranker (LogReg/LightGBM), embeddings + pgvector, social graph | Planned (Phases 3, 4, 6). Embeddings are stored as `Float[]` today |
| Admin dashboard UI | API only (`/api/v1/admin/*`) |

## Quick start (backend + ML + infra)

```bash
cp .env.example .env            # root .env is read by docker compose
# set JWT_SECRET, TOKEN_ENCRYPTION_KEY, MEDIA_URL_SECRET (see docs/ENVIRONMENT.md)
# if 5432/6379 are taken: POSTGRES_PORT=5433 REDIS_PORT=6380 in .env
docker compose up -d --build    # postgres, redis, ml-service, backend, worker
curl localhost:3000/ready       # {"status":"ready",...}
```

First-time database (when running the backend outside Docker):

```bash
cd backend && npm ci && cp ../.env.example .env   # edit DATABASE_URL/REDIS_URL ports
npx prisma migrate deploy && npx prisma db seed
npm run dev        # API on :3000
npm run worker     # background jobs
```

## Mobile

```bash
cd mobile && npm ci --legacy-peer-deps
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000 npx expo run:android   # dev build; see docs/MOBILE_BUILD.md
```

## Tests and checks

```bash
cd backend && DATABASE_URL=postgresql://vibepick:vibepick@localhost:5433/vibepick_test npx vitest run
cd ml-service && .venv/bin/python -m pytest -q
cd mobile && npm run lint && npm run typecheck && npm test
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit/API tests, ML tests, mobile checks, a prebuild of the share-intent config, and Docker builds.

## Docs

[ARCHITECTURE](ARCHITECTURE.md) · [API](docs/API.md) · [DATABASE](docs/DATABASE.md) · [ML](docs/ML.md) · [RECOMMENDATION_ENGINE](docs/RECOMMENDATION_ENGINE.md) · [DATA_PIPELINE](docs/DATA_PIPELINE.md) · [SECURITY](docs/SECURITY.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [MOBILE_BUILD](docs/MOBILE_BUILD.md) · [ENVIRONMENT](docs/ENVIRONMENT.md) · [CONTRIBUTING](CONTRIBUTING.md)

## Roadmap

0 Architecture ✅ · 1 MVP rule-based engine + API + app ✅ (device testing pending) · 2 Personalization (taste vectors, decay, feedback learning) ✅ · 3 Embeddings + pgvector ⏳ · 4 ML ranker ⏳ · 5 Trend ingestion ⏳ · 6 Social graph ⏳ · 7 Instagram (OAuth connector ✅, insights ⏳) · 8 Video ⏳ · 9 Advanced AI ⏳
