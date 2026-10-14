# Database

PostgreSQL 16 (`pgvector/pgvector` image) via Prisma. Schema: `backend/prisma/schema.prisma`; migrations in `backend/prisma/migrations`. Apply with `npx prisma migrate deploy`, seed with `npx prisma db seed` (47 songs).

| Group | Tables |
| --- | --- |
| Identity | `User`, `RefreshToken` (hashed, rotating), `UserProfile` (`onboarded`), `UserPreference`, `UserTasteVector` (`longTerm`, `shortTerm` JSON) |
| Content | `Media` (`origin`, `contentTarget`, `receivedAt`, `status`, `expiresAt`), `MediaAnalysis` (`structured`, `vibe`, `confidence`, `provider`, `embedding Float[]`) |
| Catalog | `Artist`, `Album`, `Song`, `SongFeatures` (mood, aesthetic, occasions, energy, tempo, danceability, embedding `Float[]`) |
| Recommendations | `Recommendation` (`contentReceivedAt`, `selectedAt`, `selectedSongId`, `timeToSelectionMs`, `algorithm`), `RecommendationItem` (rank, score, category, source, `signals` JSON) |
| Learning | `UserInteraction` (typed events, `context` JSON), `Feedback`, `Favorite`, `AnalyticsEvent` |
| Trends / social | `TrendSnapshot` (has a `scope` column; only `global` is computed today), `SocialConnection` |
| Integrations | `InstagramConnection` (token encrypted at rest) |
| ML ops | `ModelVersion`, `Experiment`, `ExperimentAssignment`, `RankingConfig` |
| Audit | `AuditLog` (no PII beyond ids; account deletion keeps only a truncated id hash) |

**Time to selection** lives on `Recommendation`: `contentReceivedAt` (client clock, accepted only within a 1-hour sane window, else server time) → `selectedAt` (server time of the first `song_selected`).

**Deletion:** `DELETE /me` removes the user row (cascades to all user-owned tables) and deletes stored files. Expired media is purged by the daily worker sweep (`MEDIA_RETENTION_DAYS`).

**Embeddings:** stored as `Float[]` today. Phase 3 migrates to `vector(n)` columns with an HNSW index for ANN retrieval (the pgvector image is already in compose).
