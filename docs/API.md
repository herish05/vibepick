# API (v1)

Base path `/api/v1`. JSON, UTF-8. Auth: `Authorization: Bearer <accessToken>` (15 min). Operational endpoints sit at the root: `GET /health`, `GET /ready` (DB + Redis), `GET /metrics` (Prometheus text).

Errors: `{ "error": "<code>", "message": "<safe text>" }`. Validation → 400, auth → 401/403, missing/other-user resource → 404, too large → 413, bad file type → 415, rate limit → 429. 500s never leak internals.

## Auth (rate limited: `AUTH_RATE_LIMIT_MAX`/min)

| Method | Path | Body → Response |
| --- | --- | --- |
| POST | `/auth/register` | `{email,password(8-128)}` → 201 `{user,accessToken,refreshToken}` |
| POST | `/auth/login` | same → 200. Identical error for unknown user and wrong password |
| POST | `/auth/refresh` | `{refreshToken}` → new pair. **Rotating:** the old token is revoked; reuse fails |
| POST | `/auth/logout` | `{refreshToken}` → 204 |
| POST | `/auth/forgot-password` | `{email}` → 202 always (no enumeration). Email delivery is not implemented yet |

## Me

`GET /me` · `PATCH /me/profile {displayName}` · `GET|PUT /me/preferences {languages,vibes,favoriteArtists,allowMlUse?,retentionDays?}` (PUT cold-starts the taste vector) · `POST /me/preferences/quiz {songIds}` · `GET /me/taste` · `GET /me/export` · `DELETE /me` (hard delete incl. stored files, 204).

## Media

`POST /media`: multipart; text fields **before** the file: `contentTarget` (`instagram_story|instagram_post|instagram_reel|whatsapp_status|youtube_short|other`), `origin` (`instagram_share|gallery|camera|other_share`), `receivedAt` (ISO; trusted only if within the last hour). Type is detected from magic bytes (JPEG/PNG/WebP/MP4/MOV), not the declared type. → 201 `{id,type,contentTarget,receivedAt,analysis:{structured,vibe,confidence,provider}}`.
`GET /media/:id` · `GET /media/:id/url` (5-min HMAC-signed URL) · `GET /media/:id/file?exp&sig` · `DELETE /media/:id`.

## Recommendations

`POST /recommendations`

```json
{ "media_id": "uuid?", "content_type": "instagram_reel", "occasion": "birthday",
  "language_preferences": ["punjabi"], "mood": "happy",
  "natural_language_context": "Punjabi, not too popular", "session_id": "..." }
```

`media_id` or `natural_language_context` is required. Response:

```json
{ "recommendation_id": "uuid", "algorithm": "v1-default", "content_received_at": "…", "latency_ms": 49,
  "items": [{ "song_id": "…", "rank": 1, "score": 0.81,
    "category": "best_match|trending_match|your_taste|social_match|hidden_gem|good_match",
    "source": "visual", "reasons": ["Fits the visual mood"],
    "why_this_song": { "visual_match": .8, "taste_match": .6, "mood_match": .7, "language_match": 1,
                       "occasion_match": .9, "trend_score": .2, "social_score": 0 },
    "song": { "id","title","artist","language","genres","previewUrl","coverUrl","releaseYear" } }] }
```

`why_this_song` is the real scoring signal breakdown; `reasons` is derived from it only. `GET /recommendations/:id` · `GET /history?limit=` (includes `time_to_selection_ms`).

## Learning signals

`POST /interactions {events:[{type,songId?,recommendationId?,sessionId?,position?,source?,context?:{previewMs,query,filter},occurredAt?}]}` (≤50 per call). Types: `recommendation_impression, song_open, song_preview_start, song_preview_complete, song_selected, song_saved, song_shared, song_skipped, song_rejected, feedback_positive, feedback_negative, search, filter_used`. The first `song_selected` on a recommendation sets `selectedAt` and `timeToSelectionMs`. A `recommendationId` must belong to the caller.

`POST /feedback {recommendationId,songId?,rating: exactly|good|okay|not_my_vibe, reasons[]}`.

## Music

`GET /songs?q&language&limit` · `GET /songs/:id` · `GET /favorites` · `PUT|DELETE /favorites/:songId` · `GET /trends?scope=global&limit` (only `global` is computed today).

## Instagram (optional)

`GET /instagram/status` → `{available,connected,…}` · `POST /instagram/connect` → `{url}` (official authorize URL, signed state) · `GET /instagram/callback` · `DELETE /instagram`. Returns `available:false` unless configured.

## Admin (role `ADMIN`; never exposes user media)

`GET /admin/stats` · `POST /admin/trends/recompute` · `GET|POST /admin/songs`, `PATCH /admin/songs/:id` · `GET|PUT /admin/ranking-config` · `GET|POST /admin/experiments` · `GET /admin/failed-media`.
