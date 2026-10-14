# Contributing

## Layout
`backend/` Fastify API + BullMQ worker + Prisma · `ml-service/` FastAPI · `mobile/` Expo app · `docs/` documentation.

## Workflow
1. Branch, make a focused change, add or update tests.
2. Run the checks for the area you touched:
   ```bash
   # backend (needs Postgres; test DB shown)
   cd backend && npm run lint && npm run typecheck && \
     DATABASE_URL=postgresql://vibepick:vibepick@localhost:5433/vibepick_test npx vitest run
   # ml-service
   cd ml-service && .venv/bin/python -m pytest -q
   # mobile
   cd mobile && npm run lint && npm run typecheck && npm test
   ```
3. Update the relevant doc in `docs/` when behaviour, API or schema changes.
4. Open a PR; CI must be green.

## Conventions
- TypeScript strict; validate all external input with zod; keep the recommendation engine (`backend/src/engine`) pure and unit tested.
- Schema changes: `npx prisma migrate dev --name <change>`, commit the migration.
- New recommendation signals need: a signal in the engine, a weight in `RankingConfig`, an explanation reason, and tests.
- Never add scraping, third-party passwords, bundled copyrighted audio, or secrets in the repo.
- Be honest in docs: label heuristic or planned features as such.
- Run Prettier once at the end of your changes.
