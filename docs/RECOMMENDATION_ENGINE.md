# Recommendation engine

Pure TypeScript in `backend/src/engine/` (no I/O; unit tested). The service (`modules/recommendations/service.ts`) loads data, calls `recommend()`, persists the result.

```
context (media vibe + user + NL/chips + trends)
 → retrieve (8 sources, ≤80 each, ≤500 unique)
 → filter (rejected/blocked, explicit-language hard filter) → keep 100
 → score (weighted linear model, config-driven)
 → re-rank (diversity, discovery slot) → 8
 → explain (from the real signals)
```

## Retrieval sources
`visual` (media vibe ↔ song mood/aesthetic) · `taste` (user vector) · `occasion` · `language` · `trending` · `history` (past selections) · `discovery` (low-popularity, relevant) · `collaborative` (ranks by `socialScore`; there is no social graph yet, so it is ~0).

## Scoring
`score = Σ wᵢ · signalᵢ`, each signal in [0,1]. Default weights (`DEFAULT_RANKING_CONFIG`, version `v1-default`):

| Signal | Weight |
| --- | --- |
| visual_match | 0.30 |
| taste_match | 0.25 |
| mood_match | 0.15 |
| language_match | 0.10 |
| occasion_match | 0.10 |
| trend_score | 0.05 |
| social_score | 0.05 |

Taste = 0.6 · long-term + 0.4 · short-term vector. Weights live in the `RankingConfig` table, editable through `PUT /admin/ranking-config` (validated), and can be varied per `Experiment` (deterministic variant assignment per user).

## Re-ranking
Max 1 song per artist, genre-repeat penalty (0.04), popularity diversity, one **discovery** slot (`hiddenGem`: popularity ≤ 0.4 and relevance ≥ 0.55). Categories: rank 1 is `best_match`; otherwise `hidden_gem` (low popularity, high relevance), `social_match` (social ≥ 0.5), `trending_match` (trend ≥ 0.7), `your_taste` (strong taste match), else `good_match`.

## Natural-language context
`modules/search/nl.ts` is a deterministic parser: languages, occasion, mood, energy, "not too popular / hidden gem" (prefers popularity ≤ 0.6 inside the requested language pool when ≥5 exist), "trending". Chips and NL are merged; an LLM parser can replace it behind the same `ParsedIntent` interface.
An explicitly requested language is a **hard filter once ≥ `strictLanguageMin` (3) songs match**; otherwise it is a soft score.

## Learning
Each interaction updates taste vectors (`taste.ts`): event weights `song_selected 1`, `song_saved 1.2`, `feedback_positive 1.5`, `preview_complete 0.4`, `skipped −0.3`, `rejected/feedback_negative −1`. Rates: long-term 0.05, short-term 0.3. Half-lives: short 1 day, long 30 days. Feedback reasons (`dislike_artist`, `wrong_language`) amplify the update 1.5×.

## Limits (honest)
Quality depends on (a) the visual provider, today a colour heuristic, and (b) Song DNA, today illustrative seed values. The architecture is ready for both to be replaced; the ranker will be replaced by a learned model (Phase 4) once enough real selection data exists.
