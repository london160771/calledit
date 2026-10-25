# Phase 3: local Twitch sync check

No deployment is needed. Live sync words are available on the OBS overlay now; Phase 4 will connect live round controls and verdicts. The normal dashboard and `/overlay` still use the simulated feed.

1. Enable 2FA on your main Twitch account. Register a confidential application at https://dev.twitch.tv/console/apps.
2. Register `http://localhost:3000/auth/callback` as its OAuth redirect URL.
3. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep the default redirect URL. Access and refresh tokens are optional; local sign-in obtains them.
4. Run `npm install`, `npm run build -w web`, then `npm start` at the project root. After updating the code, rebuild and restart the local server, then refresh the OBS browser source.
5. Open http://localhost:3000/dashboard?liveSync=1. Connect with Twitch using the same account as broadcaster and bot. The request asks for `user:read:chat`, `user:write:chat`, and `user:bot`.
6. In OBS, add a Browser Source with URL **`http://localhost:3000/overlay?live=1`**, width **1920**, height **1080**. Keep this source visible in the scene being streamed. It has a transparent background and shows **LIVE (Twitch)**. OBS uses its own browser storage, so the live overlay reads the server session directly.
7. Wait for Connected on the dashboard, then press Sync. The overlay shows the same word large and centered on stream. Have each viewer type that word in Twitch chat when they see it on the stream. Watch their measured delays appear on the dashboard. Repeat three times.
8. Capture notes showing the real delays. A delay includes overlay delivery, viewer reaction time and chat delivery; the minimum of the last three samples is used.

The live overlay polls `/api/state` every 100 ms after each completed request. It uses the server's existing `syncId`, word and `shownAt`; loading or refreshing OBS does not start a sync or change its timestamp. Polling and rendering add a small delay to the measured sample. If Twitch disconnects or the server cannot be reached, the overlay hides the old word and shows connection status; it resumes automatically when the connection returns. `/overlay` without `?live=1` remains simulated.

The Phase 3 server listens only on loopback. Use the exact localhost addresses above. Tokens stay in server memory and are never returned to the browser or logged. Sign in again after a restart; optional .env tokens may be supplied instead. Rotated refresh tokens remain in memory, so sign in again if saved tokens stop working.

Fake-message tests cover authorization, chat subscriptions, server-clock timestamps, duplicate deliveries, keepalive timeouts, connection loss, reconnect handoff, and summary limits. Overlay regression tests cover live mode selection, following new server syncs, unchanged timestamps, disconnection recovery and cleanup. A real Twitch/OBS connection still needs the owner's live check above.

Protocol references: [OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [chat](https://dev.twitch.tv/docs/chat/send-receive-messages/).
