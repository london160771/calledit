# Local Twitch: sync and live rounds

No deployment is needed. The live dashboard controls syncs and rounds; the live OBS overlay shows their words, calls and verdicts. The normal dashboard and `/overlay` still use the simulated feed.

1. Enable 2FA on your main Twitch account. Register a confidential application at https://dev.twitch.tv/console/apps.
2. Register `http://localhost:3000/auth/callback` as its OAuth redirect URL.
3. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep the default redirect URL. Access and refresh tokens are optional; local sign-in obtains them.
4. Run `npm install`, `npm run build -w web`, then `npm start` at the project root. After updating the code, rebuild and restart the local server, then refresh the OBS browser source.
5. Open http://localhost:3000/dashboard?liveSync=1. Connect with Twitch using the same account as broadcaster and bot. The request asks for `user:read:chat`, `user:write:chat`, and `user:bot`.
6. In OBS, add a Browser Source with URL **`http://localhost:3000/overlay?live=1`**, width **1280**, height **720**. Keep this source visible in the scene being streamed. It has a transparent background and shows **LIVE (Twitch)**. OBS uses its own browser storage, so the live overlay reads the server session directly.
7. Wait for Connected on the dashboard, then press Sync. The overlay shows the same word large and centered on stream. Have each viewer type that word in ayyoweb3 Twitch chat when they see it on the stream, before the visible countdown ends (45 seconds by default). Watch their measured delays appear on the dashboard. Repeat three times.
8. Capture notes showing the real delays. A delay includes overlay delivery, viewer reaction time and chat delivery; the minimum of the last three samples is used.

The live overlay polls `/api/state` every 100 ms after each successful request; the dashboard polls every 500 ms. Both retry failed requests with backoff (500 ms, 1 s, 2 s, 4 s, 8 s, then 10 s maximum), time out stalled requests after 5 seconds, and immediately refresh when the browser tab becomes visible or the network returns. A browser-only outage shows **Reconnecting to CalledIt server...**, not **Twitch: disconnected**. Twitch status comes only from the Node server. It uses the server's existing `syncId`, word and `shownAt`; loading or refreshing OBS does not start a sync or change its timestamp. Polling and rendering add a small delay to the measured sample. If Twitch disconnects or the server cannot be reached, the overlay hides the old word and shows connection status; it resumes automatically when the connection returns. `/overlay` without `?live=1` remains simulated. Both live surfaces show the same seconds-left countdown from server state. Expired sync words are hidden after the configured live window (45 seconds by default); press Sync again for a fresh word. Pure engine defaults and Seed-7 remain unchanged.

The Phase 3 server listens only on loopback. Use the exact localhost addresses above. Tokens stay in server memory and are never returned to the browser or logged. Sign in again after a restart; optional .env tokens may be supplied instead. Rotated refresh tokens remain in memory, so sign in again if saved tokens stop working.

Fake-message tests cover authorization, chat subscriptions, server-clock timestamps, duplicate deliveries, keepalive timeouts, connection loss, reconnect handoff, and summary limits. Overlay regression tests cover live mode selection, following new server syncs, unchanged timestamps, disconnection recovery and cleanup. A real Twitch/OBS connection still needs the owner's live check above.

Protocol references: [OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [chat](https://dev.twitch.tv/docs/chat/send-receive-messages/).

## Next live test: watch the Node terminal

After updating, stop and restart `npm start`, refresh the dashboard and OBS source, then reconnect Twitch as **ayyoweb3**. Keep Node running; closing or backgrounding every browser tab does not close its EventSub socket or stop chat processing.

Expect these `[CalledIt]` JSON log events:

1. `eventsub.connect`, `eventsub.open`, `eventsub.welcome`: includes the session ID and advertised keepalive timeout.
2. `subscription.creating`, then `subscription.created`: check `channel` is `ayyoweb3`, `subscription.type` is `channel.chat.message`, and `subscription.status` is `enabled`. The server also checks the returned channel/user IDs and WebSocket session ID before reporting connected.
3. `eventsub.connected`, followed by `eventsub.keepalive` while chat is quiet. The watchdog allows 1.5 seconds of transport/scheduler jitter beyond the advertised deadline; real loss still reports a gap from the last healthy receipt.
4. On pressing Sync: `sync.started` with `syncId`, word, server `shownAt`, `syncWindowMs`, `maxDelayMs`, and `expiresAt` (45 seconds later by default).
5. On a viewer reply: `eventsub.notification`, then `chat.received` with `userLogin` (london1607 or becca160771), channel and exact text. Chat text is JSON-escaped on one line.
6. `sync.recorded` with the active sync ID, arrival time, delay and sample count. A row should then appear on the dashboard, even if it was closed when the reply arrived.

If a row does not appear:

- `subscription.failed` / `twitch.api_error`: inspect HTTP status and `body` for the actual Twitch API error. Known OAuth credentials are redacted. A subscription that is not enabled is not reported as connected.
- `eventsub.keepalive` but no `chat.received`: Twitch is not delivering those chat messages to this session. Check the logged channel and subscription condition against the channel you are watching. Ordinary chat is logged too, so you can test delivery without a sync.
- `chat.received` followed by `sync.rejected`: inspect `reason`, `reasonText`, `syncId`, word, `delayMs`, `syncWindowMs` and `maxDelayMs`. `NO_ACTIVE_SYNC` means press Sync; `WORD_MISMATCH` means it differs from the current word (case and outer spaces are ignored); `SYNC_WINDOW_EXPIRED` means it arrived after the configured live window (45000 ms by default); `MAX_DELAY_EXCEEDED` means it exceeded the independently configured live sample cap; `ALREADY_SAMPLED_THIS_SYNC` allows only one reply per viewer per sync ID; `REPLAYED_MESSAGE` is a duplicate chat delivery; `BEFORE_SYNC` indicates an arrival timestamp before the sync started.
- `eventsub.lost`: inspect `reason` (`KEEPALIVE_TIMEOUT`, `SOCKET_CLOSED`, `SOCKET_ERROR`, or `PROCESSING_FAILED`), close code, last receipt and current time. Actual loss causes the Node server to reconnect and resubscribe. A Twitch `revocation` requires signing in again.

These logs begin after restarting the updated Node server. The owner live test confirmed chat delivery works: the reported reply took 17505 ms and exceeded the previous 15000 ms live window. The new 45000 ms live defaults allow that delay. Tokens from browser OAuth are held only inside that Node process; the running session cannot be inspected by a separate diagnostic process when no access token is saved in .env.

## Live timing configuration

The Node live server passes its own settings to the engine. Both settings default to 45000 ms even if absent from .env. To override them, add or edit these lines in your existing .env, then restart `npm start`:

```dotenv
LIVE_SYNC_WINDOW_MS=45000
LIVE_MAX_DELAY_MS=45000
```

`LIVE_SYNC_WINDOW_MS` controls how long sync replies count and how long the word/countdown remains on the live dashboard and OBS overlay. `LIVE_MAX_DELAY_MS` caps accepted delay samples and controls the engine round finalization horizon in the live runtime. A reply must meet both limits. Use positive whole milliseconds; blank values use the defaults and invalid values stop startup with the variable name.

The server supplies `syncRemainingMs` for the countdown; browser wall clocks do not change the sync start or expiry. The dashboard refreshes it every 500 ms and the overlay every 100 ms. `shownAt` is still the original server sync start time. Reloading a tab does not restart the window.

The pure engine retains syncWindowMs 15000 and maxDelayMs 20000. Seed-7, /judge, and the simulated dashboard/overlay use those unchanged defaults. `sync.started` logs the live settings; every `sync.rejected` log includes them, and timing rejection text states the actual live limit.


## Phase 4: owner money-shot test

Phase 3 live sync PASSED on ayyoweb3: london1607 11337 ms and becca160771 11208 ms, three samples each, confirmed by sync.recorded logs. Gate 0's 2-second viewer spread is still pending owner setup; see evidence/gate0.md. Those two measured delays differ by only 129 ms.

1. Rebuild, restart and sign in using the steps above. Keep the Node terminal visible. Check subscription.created is enabled on ayyoweb3. Set the OBS browser source to http://localhost:3000/overlay?live=1 at 1280x720; refresh it after rebuilding.
2. Set up the fast tab and slow iPhone with at least 2 seconds of measured spread. Press Sync three times; both accounts reply to each new word when they see it on stream. Confirm three samples and valid delays on http://localhost:3000/dashboard?liveSync=1. Calibration includes reaction and chat delivery, so resync after changing viewer setup.
3. Click Open round (land / miss). Look for round.opened and Open on the overlay. For this round, keep the two demonstration accounts from calling before the event: the first counted call per viewer is the one that counts.
4. Perform the event and immediately click LANDED (or MISSED for a separate miss round). The Node server supplies pressedAt/eventAt. Look for event.marked, the outcome and Event marked with the finalization countdown.
5. For the land money shot, the fast account waits until it sees the outcome, then sends !land. The slow account sends !land while it has not yet seen the outcome. Send before that viewer's personal cutoff, not at its last instant. Expect call.received then verdict: fast LATE_SAW_IT, slow ACCEPTED. Each cutoff is eventAt + measured delay - 300 ms; the overlay displays the call/cutoff comparison. The dashboard can expand the exact engine verdict and numbers. A pre-event provisional call is rechecked when the event is marked.
6. Wait 45 seconds after eventAt (or LIVE_MAX_DELAY_MS if overridden), without opening another round. Expect round.finalized, Final on OBS, then summary.sent and exactly one summary in Twitch chat. A summary.failed event includes the error; failures are not automatically retried because an ambiguous send could otherwise duplicate chat. Calls themselves never send chat replies. Summary attempts are serialized at least 1600 ms apart, within PRD limits.
7. In a separate open round, briefly interrupt the Node server's network connection while leaving Node running. Actual EventSub loss must log eventsub.lost and round.voided, change all round verdicts to ROUND_VOID_GAP and show VOID / no score on OBS. Recovery must not revive that round or send a second summary. A normal Twitch session_reconnect handoff without loss must not void it. The Void button is the separate manual cancel path and also gives ROUND_VOID_GAP, with MANUAL_VOID in the round log.
8. Record the money shot, include the final chat summary, and report the observed verdicts and any failures. This is the owner handoff; nothing is deployed.

Open, mark and Void are loopback-only JSON POST actions with the same Origin checks as Sync. Marking uses only the Node clock; browser timestamps are ignored. Node timers finalize at eventAt + the live maxDelayMs even with all browser tabs closed; chat arriving after a due time also triggers finalization before judging. The live engine receives the existing 45000 ms window/cap overrides; engine defaults, Seed-7 and the simulated pages stay unchanged.

The overlay shows the last two verdict cards and last four calls to keep the OBS view readable; the dashboard exposes the latest twenty calls/verdicts and exact numbers. A connection gap remains visible as VOID even while Twitch is disconnected. Browser transport recovery remains separate from Twitch session status.
