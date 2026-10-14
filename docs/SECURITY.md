# Security

## Principles
- Instagram is optional, official OAuth only. No scraping, no stored Instagram passwords, no assumed follower/audio data.
- Collect the minimum; let the user export (`GET /me/export`) and hard-delete (`DELETE /me`) everything.
- No copyrighted audio is bundled; previews come from `previewUrl` of a licensed provider (none wired yet).

## Controls (implemented and tested in `backend/test/*.test.ts`)
| Area | Control |
| --- | --- |
| Passwords | scrypt with per-user salt, constant-time compare; same error for unknown user and wrong password |
| Sessions | 15-min JWT access tokens; refresh tokens stored hashed, **rotated on use**, reuse rejected, revoked on logout/delete |
| Secrets at rest | Instagram tokens encrypted with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`); tampering fails authentication |
| Media | magic-byte type sniffing (JPEG/PNG/WebP/MP4/MOV), size cap (`MAX_UPLOAD_MB`), server-generated file names, no path from user input |
| Media access | owner-only API; files served only via short-lived HMAC-signed URLs (constant-time verify) |
| Authorization | every user resource is scoped by `userId`; other users' ids return 404; admin routes require role `ADMIN` |
| Input | zod validation on every route and on environment config |
| Abuse | global rate limit; stricter limit on auth routes (`AUTH_RATE_LIMIT_MAX`/min) |
| Logging | pino with redaction of `authorization`, `cookie`, `password`, `refreshToken`; no media content in logs |
| Privacy | `allowMlUse` and `retentionDays` per user; daily sweep deletes expired media |
| Mobile | tokens in `expo-secure-store`; shared content is never fetched from links; no analytics SDKs |
| Production guard | with `NODE_ENV=production` startup **fails** if `TOKEN_ENCRYPTION_KEY` is missing, `MEDIA_URL_SECRET` is the default, `CORS_ORIGINS=*`, or `JWT_SECRET` looks like a placeholder |

## Known gaps (do before a public launch)
- Forgot-password sends no email yet (endpoint is non-enumerating but inert).
- `LocalStorage` only; use an S3-compatible bucket with private ACLs and SSE in production.
- No malware scanning of uploads, and no EXIF stripping.
- No dependency/image scanning in CI yet (add `npm audit`, Trivy).
- Instagram OAuth is untested against a real Meta app (needs app review and credentials).
- The container image runs as non-root, but compose is a development topology (no TLS). Terminate TLS at a reverse proxy.
- Rotate JWT/encryption keys: not automated (re-encrypt tokens on key change).

Report vulnerabilities privately to the maintainers rather than in a public issue.
