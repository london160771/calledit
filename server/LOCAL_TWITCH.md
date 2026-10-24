# Phase 3: local Twitch sync check

No deployment is needed. Phase 4 will connect live round controls and the OBS overlay. The normal dashboard and overlay still use the simulated feed.

1. Enable 2FA on your main Twitch account. Register a confidential application at https://dev.twitch.tv/console/apps.
2. Register `http://localhost:3000/auth/callback` as its OAuth redirect URL.
3. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep the default redirect URL. Access and refresh tokens are optional; local sign-in obtains them.
4. Run `npm install`, `npm run build -w web`, then `npm start` at the project root.
5. Open http://localhost:3000/dashboard?liveSync=1. Connect with Twitch using the same account as broadcaster and bot. The request asks for `user:read:chat`, `user:write:chat`, and `user:bot`.
6. Wait for Connected, then press Sync. Show the displayed word to viewers through your stream, and have each viewer type it in Twitch chat. Watch their measured delays appear. Repeat three times.
7. Capture notes showing the real delays. A delay includes the time to show the word, viewer reaction time and chat delivery; the minimum of the last three samples is used. Phase 4 adds the OBS sync flash.

The Phase 3 server listens only on loopback. Use the exact localhost address above. Tokens stay in server memory and are never returned to the browser or logged. Sign in again after a restart; optional .env tokens may be supplied instead. Rotated refresh tokens remain in memory, so sign in again if saved tokens stop working.

Fake-message tests cover authorization, chat subscriptions, server-clock timestamps, duplicate deliveries, keepalive timeouts, connection loss, reconnect handoff, and summary limits. A real Twitch connection is not verified until you run the steps above.

Protocol references: [OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [chat](https://dev.twitch.tv/docs/chat/send-receive-messages/).
