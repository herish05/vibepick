# ML service

FastAPI (`ml-service/`). The backend talks to it only through the `MlClient` interface (`backend/src/lib/ml.ts`, `HttpMlClient`). If it errors or times out (`ML_TIMEOUT_MS`), the backend stores a neutral vibe via `fallbackAnalysis()`, marks the media `FAILED` and enqueues an `image_analysis` retry. Recommendations still work (taste, language, occasion, trends).

## Endpoints
`GET /health` · `POST /image/analyze` · `POST /image/embed` · `POST /video/analyze` (**501**: Phase 8) · `POST /music/embed` · `POST /user/embed` · `POST /recommend/rank` · `POST /feedback/process`.

## Providers (`AI_PROVIDER`)
- `heuristic` (default, shipped): Pillow/NumPy features (brightness, saturation, warmth, contrast, colour distribution) mapped to a 13-dim vibe vector (`happy, sad, romantic, energetic, chill, party, aesthetic, cinematic, nostalgic, confident, peaceful, funny, emotional`). **It cannot recognise people, places or scenes.** It reports `confidence: 0.35` and `semantic_understanding: false`; the app tells users when confidence is low and invites chips or text.
- Semantic provider (planned): CLIP or a vision LLM behind `app/providers/base.py`. Selecting one requires its dependencies and `AI_API_KEY`. Any provider must output the same `{structured, vibe, confidence, embedding?}` schema. Send only content the user permitted (`allowMlUse`).

## Roadmap
Phase 3 embeddings for images/songs/users; Phase 4 learned ranker trained from `UserInteraction` + `RecommendationItem.signals` (logistic regression baseline → LightGBM, target P(select), offline NDCG/AUC with a time-based split, versions tracked in `ModelVersion`, rollout via `Experiment`). Not enough real data exists yet to train honestly; the linear model is the baseline to beat.

## Tests
`cd ml-service && .venv/bin/python -m pytest -q` (9 tests: health, full vibe vector + embedding, bright-warm vs dark-cool sanity, determinism, corrupt-image rejection, video 501, shared music/user embedding space, ranking order, feedback processing).
