# Data pipeline

```
Share/gallery ─► app (receivedAt = now) ─► POST /media ─► magic-byte check ─► Storage (LocalStorage)
      │                                                        │
      │                                              ML /image/analyze ─► MediaAnalysis
      │                                                        │ (fail → neutral vibe + retry job)
      └► POST /recommendations ─► engine ─► Recommendation(+Items)
                         ▲                         │
 taste vectors ◄─ POST /interactions, /feedback ◄──┘ (impressions, previews, selection, feedback)
```

## What is collected
Uploaded media (retention-limited), declared preferences, in-app interaction events, explicit feedback, and, only if the user connects it, data from Instagram's official API. **Not collected:** passwords for third parties, scraped data, follower lists, audio from Instagram, contacts, location.

## Jobs (BullMQ, `backend/src/worker`)
| Job | Schedule | Purpose |
| --- | --- | --- |
| `image_analysis` | on failure | Retry analysis for `FAILED` media |
| trend calculation | hourly | global `TrendSnapshot` from selected/saved/shared events: 0.5·usage(7d, normalised) + 0.3·growth vs prior week + 0.2·24h velocity |
| media retention sweep | daily | Delete files and rows past `expiresAt` |

Without Redis, the API runs but jobs do not.

## Client-side event queue
`mobile/src/lib/eventQueue.ts` stores learning events with their true timestamps in AsyncStorage (cap 500), sends in batches of 50, and flushes on reconnect. Events are never required for the core flow.

## Trend data (future)
Phase 5 adds ingestion from licensed/permitted sources; today trends reflect VibePick usage only.

## Training data (future)
`UserInteraction` joined to `RecommendationItem.signals` gives (features, outcome) rows: impression → preview → select, with `song_selected` as the positive label and impressions without selection as negatives. Export/anonymisation tooling is a Phase 4 task.
