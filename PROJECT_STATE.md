# PROJECT_STATE — CalledIt

## Current phase
- **Phase 0** (owner): pending Gate 0 delay test. Codex skipped it as instructed.
- **Phase 1** (Codex): complete, pushed as `47e017a`.
- **Phase 2** (Codex): complete, pushed as `c851944`.
- **Phase 3** (Codex, then owner): live overlay verified by owner; chat diagnostics and reconnect fixes complete, awaiting another live calibration test.
- **Phases 4 and 5**: not started. Resume Phase 4 after the owner verifies Phase 3.

## Done
- Docs setup and .gitignore pushed as `1fe9f35`.
- Phase 1: npm workspaces; pure dependency-free engine; fixed Seed-7 fixture; prefix replay; baseline comparison; Node 22 GitHub Actions workflow.
- Phase 2: React + Vite and plain CSS; /judge browser replay; simulated /dashboard and transparent /overlay; Attack Lab for all eight reason codes.
- Phase 3: Express local server; authorization-code OAuth with state cookie; scope/client validation; token refresh; hourly validation; EventSub chat subscription; server-clock arrival timestamps; chat message ID deduplication; close/timeout gap reporting and recovery; reconnect handoff; one summary attempt per finished round with rate spacing.
- /dashboard?liveSync=1 provides the owner's local Phase 3 calibration check. Live sync words now reach OBS at /overlay?live=1. Live round controls and verdict wiring remain Phase 4.
- .env.example and server/LOCAL_TWITCH.md explain the exact required values and manual steps. No credentials were created or committed. Nothing was deployed.

## Verification
- Phase 1: `npm install`, `npm ci`, `npm test` passed; 19 tests passed, 0 failed. Exact Seed-7 verdicts/totals, 2/2/0 comparison, 10,000 seeded rounds, boundary cases and purity checked.
- Phase 2: `npm test` passed; 23 tests passed, 0 failed, plus Vite production build.
- Phase 2 browser: Run the demo reached 25/25 with 3 accepted, 1 late and 2 void calls, comparison 2/2/0. Run the attacks displayed every reason. Dashboard Sync/Open/Call/LANDED gave 2 correct and 2 wrong calls. Overlay showed MANGO and those verdicts; computed HTML/body backgrounds were transparent. Desktop and 390px mobile layouts inspected.
- Phase 3 final: `npm ci` passed (88 packages added, 0 audit vulnerabilities); `npm test` passed with **36 passed, 0 failed**: engine 19, server 13, web 4. Vite production build passed.
- Server tests use fake sockets and HTTP responses, plus local HTTP requests: auth state/cookie/single use, scopes, refresh, subscription, timestamps, sync replies, deduplication, disconnects, timeout, reconnect without a gap, revocation, summary content/deduplication/spacing.
- Phase 3 browser: built page served through Express using a disconnected test fixture; showed Connect with Twitch, disabled Sync, and empty viewer table. No real Twitch connection was attempted.
- Earlier local checks failed because dependencies were unavailable in the network sandbox, because test fixtures used a clock before the round opened and a Host header not honored by fetch, and because Vite held a Windows file lock during npm ci. Dependency installation, corrected fixtures and stopping the preview resolved these; the final clean install and suite passed.
- The CI workflow has been added; remote Actions success has not been verified.

## Decisions
- `createEngine(config)` returns the PRD API. Inputs and query results are copied.
- Sync replies count once per viewer per sync ID. Delay is captured at call time, so later syncs cannot change earlier cutoffs.
- Only recognized option commands get verdicts; default land/miss are recognized before any round exists.
- A gap during an open round voids it immediately; late gap reports also void overlapping finalized rounds. Explicit Void uses ROUND_VOID_GAP, the PRD's only void code.
- Simulated dashboard uses a deterministic clock and local storage to share its feed across tabs. /judge has no runtime server dependency after its static files load.
- Phase 3 uses one account as broadcaster and bot, derived from the validated user token. Tokens remain in server memory; restart requires sign-in again unless optional .env tokens work.
- Summary sends use one attempt per round, even after an ambiguous network failure, to avoid duplicate chat messages. They serialize at least 1600 ms apart. Phase 4 will wire them to live round finalization.
- Local Phase 3 server binds to loopback and checks Host and write Origin. Hosting configuration remains Phase 5.

## Pending (owner)
1. Restart the updated Node server with `npm start`, refresh the dashboard and OBS source, and reconnect Twitch as ayyoweb3 if needed.
2. Keep OBS at `http://localhost:3000/overlay?live=1` (1920x1080). Open `http://localhost:3000/dashboard?liveSync=1`.
3. Watch the Node terminal for an enabled chat subscription on ayyoweb3, start a fresh sync and have london1607 / becca160771 reply within 15 seconds. Follow server/LOCAL_TWITCH.md to inspect recorded/rejected sample logs and report the results.
4. Finish Gate 0: record at least a 2-second extra iPhone delay versus the fast tab in evidence/gate0.md.
5. Resume Phase 4 only after the live calibration is verified. No deployment is authorized.
## Log
- 2026-10-24: Docs initialized and pushed; Phases 1 and 2 completed and pushed.
- 2026-10-24: Phase 3 Codex portion complete, 36 tests passed. Stopping for owner credentials and manual Twitch sync as required by AGENTS.md and PRD §10.

## Phase 3 live sync overlay fix — 2026-10-25
- Scope: only the reported sync delivery bug; Phase 4 has not started.
- Added explicit live mode at `http://localhost:3000/overlay?live=1`. It reads the server session directly instead of simulated local storage, so OBS can follow dashboard syncs across browser storage boundaries.
- The transparent live overlay shows LIVE (Twitch) and a large centered word. It hides old words on disconnect/request failure and recovers automatically.
- Decision: sequential polling every 100 ms after each completed request; server `shownAt` remains exactly the sync start time. No engine or runtime timing changes. Poll/render overhead remains part of measured delay.
- Changed: web/src/LiveOverlay.js, web/src/live-state.js, web/src/main.jsx, web/src/LiveSync.jsx, web/src/style.css, web/test/live-overlay.test.js, server/test/twitch.test.js, server/LOCAL_TWITCH.md, PROJECT_STATE.md.
- Verification: `npm test` passed, **40 passed, 0 failed** (engine 19, server 13, web 8), plus Vite production build. Four new regression tests cover explicit mode, following new server words with unchanged timestamps, disconnection recovery, and cleanup; the existing runtime test now asserts the same sync timestamp reaches snapshots.
- Browser check used a local fake Twitch session, not the owner's channel: clicked Sync on one dashboard tab; a separately opened overlay tab displayed LIVE (Twitch) / SAY: MANGO with server shownAt 123000. Centered layout inspected; HTML/body computed backgrounds both transparent.
- Owner: rebuild/restart the local server, refresh OBS with the documented live URL, reconnect Twitch if needed, and check a live sync on stream. Stopping after this fix as requested.

## Phase 3 chat diagnostics and connection fixes — 2026-10-25
- Owner reports live sync words reach OBS, but replies from london1607 / becca160771 on ayyoweb3 do not create delay rows; dashboard sometimes reports disconnected after backgrounding.
- Read-only inspection of the running old server returned connected / ayyoweb3 / no viewer samples. No historical message/rejection logs existed. No access token is saved in .env; the current OAuth token is held only in that Node process, so a separate read-only subscription query could not inspect it. The running owner process was not stopped or changed. The exact reason for those past replies remains unverified.
- Confirmed code faults: subscription responses were never checked for enabled status/channel/session; the keepalive watchdog was armed at exactly the advertised timeout, racing normal keepalives and network jitter; failed replacement sockets could mark a still-healthy active session disconnected; expired words stayed visible while the engine silently ignored replies outside the fixed 15-second window. Case/outer-space matching and real payload field mapping were already correct in the engine/adapter.
- Fixes: verify enabled subscription and expected channel/user/session before connected; log connect/open/welcome/subscription result/API errors/notifications/each chat/rejected or recorded sample. API error bodies retain diagnostic details while known OAuth credentials are redacted. Chat text is JSON-escaped.
- Server watchdog allows 1500 ms transport/scheduler jitter and retains gap reporting from the last healthy receipt. Failed reconnect candidates leave a healthy old socket active. All EventSub sockets, clock stamping, sync matching and engine state stay in Node; no browser lifecycle controls them.
- Both live pages use sequential polls, 5-second request timeouts, capped backoff from 500 ms to 10 seconds, and immediate refresh on visibility/online events. Browser-only transport failures display Reconnecting to CalledIt server, without changing the cached server Twitch state. Stale in-flight responses cannot overwrite refreshed data.
- Added server sync expiresAt/syncActive metadata and expired-word prompts. Original server shownAt, 15000 ms sync window, sample minimum and pure engine remain unchanged.
- Tests: final `npm test` passed **50 passed, 0 failed** (engine 19, server 16, web 15) plus Vite production build. Full real-shaped channel.chat.message envelopes for both named viewers pass through Node, /api/state and the actual dashboard table component without browser polling, with case/spaces and two sync IDs. Rejection logs, expired replies, duplicate deliveries, invalid subscription, redaction, keepalive boundary, candidate failure, capped backoff, visibility/online recovery and stale response protection are covered.
- Files: server/src/auth.js, server/src/eventsub.js, server/src/runtime.js, server/src/log.js, server/test/twitch.test.js, web/src/live-state.js, web/src/LiveSync.jsx, web/src/LiveOverlay.js, web/src/ViewerDelays.js, web/test/live-chat.test.js, web/test/live-overlay.test.js, server/LOCAL_TWITCH.md, PROJECT_STATE.md.
- Decision: retain the PRD timing contract; make expiry explicit rather than extend calibration times. No Phase 4 work or deployment. Stop after commit/push for the requested owner live test.
