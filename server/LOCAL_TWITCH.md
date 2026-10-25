# Phase 3: local Twitch sync check

No deployment is needed. Live sync words are available on the OBS overlay now; Phase 4 will connect live round controls and verdicts. The normal dashboard and `/overlay` still use the simulated feed.

1. Enable 2FA on your main Twitch account. Register a confidential application at https://dev.twitch.tv/console/apps.
2. Register `http://localhost:3000/auth/callback` as its OAuth redirect URL.
3. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep the default redirect URL. Access and refresh tokens are optional; local sign-in obtains them.
4. Run `npm install`, `npm run build -w web`, then `npm start` at the project root. After updating the code, rebuild and restart the local server, then refresh the OBS browser source.
5. Open http://localhost:3000/dashboard?liveSync=1. Connect with Twitch using the same account as broadcaster and bot. The request asks for `user:read:chat`, `user:write:chat`, and `user:bot`.
6. In OBS, add a Browser Source with URL **`http://localhost:3000/overlay?live=1`**, width **1920**, height **1080**. Keep this source visible in the scene being streamed. It has a transparent background and shows **LIVE (Twitch)**. OBS uses its own browser storage, so the live overlay reads the server session directly.
7. Wait for Connected on the dashboard, then press Sync. The overlay shows the same word large and centered on stream. Have each viewer type that word in ayyoweb3 Twitch chat when they see it on the stream, within 15 seconds of pressing Sync. Watch their measured delays appear on the dashboard. Repeat three times.
8. Capture notes showing the real delays. A delay includes overlay delivery, viewer reaction time and chat delivery; the minimum of the last three samples is used.

The live overlay polls `/api/state` every 100 ms after each successful request; the dashboard polls every second. Both retry failed requests with backoff (500 ms, 1 s, 2 s, 4 s, 8 s, then 10 s maximum), time out stalled requests after 5 seconds, and immediately refresh when the browser tab becomes visible or the network returns. A browser-only outage shows **Reconnecting to CalledIt server...**, not **Twitch: disconnected**. Twitch status comes only from the Node server. It uses the server's existing `syncId`, word and `shownAt`; loading or refreshing OBS does not start a sync or change its timestamp. Polling and rendering add a small delay to the measured sample. If Twitch disconnects or the server cannot be reached, the overlay hides the old word and shows connection status; it resumes automatically when the connection returns. `/overlay` without `?live=1` remains simulated. Expired sync words are hidden after the 15-second sync window; press Sync again for a fresh word. The sync window and engine rules are unchanged.

The Phase 3 server listens only on loopback. Use the exact localhost addresses above. Tokens stay in server memory and are never returned to the browser or logged. Sign in again after a restart; optional .env tokens may be supplied instead. Rotated refresh tokens remain in memory, so sign in again if saved tokens stop working.

Fake-message tests cover authorization, chat subscriptions, server-clock timestamps, duplicate deliveries, keepalive timeouts, connection loss, reconnect handoff, and summary limits. Overlay regression tests cover live mode selection, following new server syncs, unchanged timestamps, disconnection recovery and cleanup. A real Twitch/OBS connection still needs the owner's live check above.

Protocol references: [OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [chat](https://dev.twitch.tv/docs/chat/send-receive-messages/).

## Next live test: watch the Node terminal

After updating, stop and restart `npm start`, refresh the dashboard and OBS source, then reconnect Twitch as **ayyoweb3**. Keep Node running; closing or backgrounding every browser tab does not close its EventSub socket or stop chat processing.

Expect these `[CalledIt]` JSON log events:

1. `eventsub.connect`, `eventsub.open`, `eventsub.welcome`: includes the session ID and advertised keepalive timeout.
2. `subscription.creating`, then `subscription.created`: check `channel` is `ayyoweb3`, `subscription.type` is `channel.chat.message`, and `subscription.status` is `enabled`. The server also checks the returned channel/user IDs and WebSocket session ID before reporting connected.
3. `eventsub.connected`, followed by `eventsub.keepalive` while chat is quiet. The watchdog allows 1.5 seconds of transport/scheduler jitter beyond the advertised deadline; real loss still reports a gap from the last healthy receipt.
4. On pressing Sync: `sync.started` with `syncId`, word, server `shownAt`, and `expiresAt` (15 seconds later).
5. On a viewer reply: `eventsub.notification`, then `chat.received` with `userLogin` (london1607 or becca160771), channel and exact text. Chat text is JSON-escaped on one line.
6. `sync.recorded` with the active sync ID, arrival time, delay and sample count. A row should then appear on the dashboard, even if it was closed when the reply arrived.

If a row does not appear:

- `subscription.failed` / `twitch.api_error`: inspect HTTP status and `body` for the actual Twitch API error. Known OAuth credentials are redacted. A subscription that is not enabled is not reported as connected.
- `eventsub.keepalive` but no `chat.received`: Twitch is not delivering those chat messages to this session. Check the logged channel and subscription condition against the channel you are watching. Ordinary chat is logged too, so you can test delivery without a sync.
- `chat.received` followed by `sync.rejected`: inspect `reason`, `syncId`, word, `delayMs` and `syncWindowMs`. `NO_ACTIVE_SYNC` means press Sync; `WORD_MISMATCH` means it differs from the current word (case and outer spaces are ignored); `SYNC_WINDOW_EXPIRED` means it arrived after 15000 ms; `ALREADY_SAMPLED_THIS_SYNC` allows only one reply per viewer per sync ID; `REPLAYED_MESSAGE` is a duplicate chat delivery; `BEFORE_SYNC` indicates an arrival timestamp before the sync started.
- `eventsub.lost`: inspect `reason` (`KEEPALIVE_TIMEOUT`, `SOCKET_CLOSED`, `SOCKET_ERROR`, or `PROCESSING_FAILED`), close code, last receipt and current time. Actual loss causes the Node server to reconnect and resubscribe. A Twitch `revocation` requires signing in again.

These logs begin after restarting the updated Node server. The previous version did not retain chat or rejection logs, so a past missing reply cannot be retrospectively assigned a definite cause. Tokens from browser OAuth are held only inside that Node process; the running session cannot be inspected by a separate diagnostic process when no access token is saved in .env.
