# PROJECT_STATE — CalledIt

## Current phase
- **Phase 0** (owner): Gate 0 PASSED, owner-reported 2026-10-28 on ayyoweb3. Measured fast/slow spread 6008 ms (6.0 s); iPhone is fast and laptop is slow. Evidence and variation limit are in evidence/gate0.md.
- **Phase 1** (Codex): complete, pushed as `47e017a`.
- **Phase 2** (Codex): complete, pushed as `c851944`.
- **Phase 3** (Codex, then owner): PASSED. Owner confirmed real live syncs on ayyoweb3: london1607 11337 ms and becca160771 11208 ms, three samples each, with sync.recorded logs.
- **Phase 4** (Codex, then owner): PASSED, owner-reported live round round-1793192469925-3 on 2026-10-28. Slow ACCEPTED · CORRECT, fast LATE_SAW_IT, finalization and one summary confirmed. Recording/link and separate live gap test remain pending; see evidence/money-shot.md.
- **Phase 5**: Codex documentation and single-service hosting configuration in progress, as explicitly requested after the Phase 4 live pass. No deployment authorized.

## Done
- Docs setup and .gitignore pushed as `1fe9f35`.
- Phase 1: npm workspaces; pure dependency-free engine; fixed Seed-7 fixture; prefix replay; baseline comparison; Node 22 GitHub Actions workflow.
- Phase 2: React + Vite and plain CSS; /judge browser replay; simulated /dashboard and transparent /overlay; Attack Lab for all eight reason codes.
- Phase 3: Express local server; authorization-code OAuth with state cookie; scope/client validation; token refresh; hourly validation; EventSub chat subscription; server-clock arrival timestamps; chat message ID deduplication; close/timeout gap reporting and recovery; reconnect handoff; one summary attempt per finished round with rate spacing.
- /dashboard?liveSync=1 provides live calibration and Open/LANDED/MISSED/Void controls. /overlay?live=1 follows server rounds, calls, exact engine verdicts and final/VOID states.
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
- Summary sends use one attempt per round, even after an ambiguous network failure, to avoid duplicate chat messages. They serialize at least 1600 ms apart and are wired to live finalization and voiding.
- Local Phase 3 server binds to loopback and checks Host and write Origin. Hosting configuration remains Phase 5.

## Pending (owner)
1. Rebuild with `npm run build -w web`, restart `npm start`, refresh OBS and reconnect Twitch as ayyoweb3.
2. Use `http://localhost:3000/overlay?live=1` at 1280x720 in OBS and `http://localhost:3000/dashboard?liveSync=1` for controls.
3. Use the verified demo roles: london1607 on iPhone is fast; becca160771 on laptop with Low Latency OFF is slow. Gate 0 passed with 6.0 s spread. Recalibrate after a restart or setup change; laptop sample variation was 2.2 s, above the 1.0 s target.
4. Follow the Phase 4 money-shot steps in server/LOCAL_TWITCH.md. Record fast LATE_SAW_IT / slow ACCEPTED, automatic Final, one summary, and a separate gap/VOID check.
5. Report the live result and recording. Phase 5 waits for this manual handoff; no deployment is authorized.
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

## Phase 3 live timing overrides — 2026-10-25
- Owner confirmed the pipeline works: enabled subscription and chat.received, followed by sync.rejected because receivedAt ...836661 minus shownAt ...819156 = 17505 ms exceeded the old 15000 ms window.
- Scope: live Node runtime only. Added LIVE_SYNC_WINDOW_MS and LIVE_MAX_DELAY_MS, each defaulting to 45000 ms and validated as positive whole milliseconds. The root server startup reads both from .env and passes them into the live engine; no engine/ files, engine defaults, Seed-7 values, /judge or simulation behavior changed.
- Live sync expiry, diagnostic rejection rules and engine config now use the same settings. sync.started logs both values; all live sync.rejected events include both, with explicit limits in timing rejection text.
- Dashboard and live overlay share a sync-word component with visible seconds left from server syncRemainingMs. They retain the word for the configured live window and keep the original server shownAt. A fresh Sync resets the countdown; reloading the browser does not.
- Updated .env.example (one-line explanations), the exact requested PRD §4 line, and server/LOCAL_TWITCH.md configuration and live-test instructions.
- Final `npm test`: **56 passed, 0 failed** (engine 19, server 19, web 18), plus Vite production build. Tests cover a 17500 ms reply recorded by the live engine and ignored by the unchanged default engine, a 35000 ms live sample above the old cap, inclusive 45000 ms boundary, rejection after expiry, independent environment overrides, invalid values, log limits, countdowns and the existing Seed-7 / 10k-round suite.
- Files: server/src/live-config.js, server/src/index.js, server/src/runtime.js, server/test/live-config.test.js, server/test/twitch.test.js, web/src/LiveSyncWord.js, web/src/LiveSync.jsx, web/src/LiveOverlay.js, web/src/style.css, web/test/live-chat.test.js, web/test/live-overlay.test.js, .env.example, PRD.md, server/LOCAL_TWITCH.md, PROJECT_STATE.md.
- Decision: countdowns round remaining server milliseconds up to whole seconds. The engine keeps its inclusive sync-window boundary. No live account was reconnected or deployment performed. Stop after commit/push as requested; owner restarts the server and refreshes dashboard/OBS for another live test.


## Phase 3 owner pass and Phase 4 Codex handoff — 2026-10-28
- Owner confirmed real live syncs on ayyoweb3: london1607 11337 ms and becca160771 11208 ms, three samples each, with sync.recorded logs. Recorded in evidence/gate0.md. The required 2-second fast/slow spread is still pending owner setup, not a code failure.
- Phase 4: wired loopback Open/LANDED/MISSED/Void actions to the live server engine, with server timestamps and the existing 45000 ms live config. Real-shaped EventSub chat calls enter that engine; raw verdict codes/numbers are exposed unchanged. Provisional calls are rechecked after marking.
- Node timers finalize at eventAt + maxDelayMs without a browser; overdue incoming chat finalizes before judging. EventSub gaps and manual Void produce ROUND_VOID_GAP. Terminal rounds trigger one rate-spaced summary attempt, with sent/failed status and no duplicate retry after an ambiguous failure.
- Live dashboard has round controls, call feed, verdicts and exact-number details. Transparent live OBS overlay has Open/Event marked/Final/VOID state, final countdown, two large verdict cards and four recent calls. Added all requested round/call/verdict/summary logs.
- Verification: npm test passed **65 passed, 0 failed** (engine 19, server 24, web 22); npm run build -w web passed. New tests cover real-shaped notifications through local HTTP controls, fast LATE_SAW_IT, slow ACCEPTED, provisional recheck, exact numbers, finalization without polling, gap/manual VOID, invalid/stale/foreign controls, delayed timer handling, summary failure/deduplication and rendered round controls/cards. Existing Seed-7 and 10k-round invariant tests pass; engine files are unchanged.
- Visual check: after the browser automation tool timed out twice, an isolated fake Twitch session was captured with headless Chrome at 1280x720. Both fast LATE_SAW_IT and slow ACCEPTED cards, numeric reasons, round state/countdown and call feed fit in the frame. No real Twitch messages were sent. Real OBS/phone readability and the live money shot remain owner checks.
- Files: server/src/app.js, server/src/runtime.js, server/src/live-rounds.js, server/test-support/live-session.js, server/test/live-rounds.test.js, web/src/LiveSync.jsx, web/src/LiveOverlay.js, web/src/LiveRoundView.js, web/src/style.css, web/test/live-rounds.test.js, server/LOCAL_TWITCH.md, evidence/gate0.md, PROJECT_STATE.md.
- Decisions: default options are land/miss; show only the last two verdict cards on OBS to preserve space, with twenty available on the dashboard. A voided terminal round gets one unscored VOID summary. Summary failures are logged without retry, preserving the existing at-most-one-attempt policy. No changes to engine math or deployment.
- STOP: Codex portion complete; owner must run and record the Phase 4 money-shot steps in server/LOCAL_TWITCH.md. Phase 5 has not started.


## Gate 0 owner pass — 2026-10-28
- Docs-only update, following the owner's fresh-server live test on ayyoweb3. Syncs: PEACH, PAPAYA, MANGO; live window: 45 s.
- london1607 (iPhone, fast): 12366 / 13065 / 13325 ms; D_v = 12366 ms; same-viewer variation 959 ms (0.96 s).
- becca160771 (laptop, Low Latency OFF, slow): 20574 / 19111 / 18374 ms; D_v = 18374 ms; same-viewer variation 2200 ms (2.2 s). This exceeds the 1.0 s target. Human reaction time is a likely explanation from the owner, not a proven cause; retain it as an honest limit.
- Gate 0 spread = 18374 - 12366 = 6008 ms (6.0 s), above the 2 s target: PASSED. This supersedes the pending spread recorded at the earlier Phase 4 handoff.
- Owner reports unrelated real viewer mashaliahbratha was correctly ignored with NO_ACTIVE_SYNC.
- Demo roles follow measured delays instead of the original device assumption: iPhone fast, expected LATE_SAW_IT after seeing the result; laptop slow, expected ACCEPTED before it shows and before the personal cutoff. Phase 4 money-shot verdicts and recording remain pending.
- Changed only evidence/gate0.md and PROJECT_STATE.md. Checked sample minima, max-minus-min variation and spread; git diff --check passed. No code changed, so npm test/build were not rerun. No deployment or phase progression.


## Phase 4 owner money shot and follow-up fixes — 2026-10-28
- Owner reports PASSED on ayyoweb3, round round-1793192469925-3: sammiedfab (slow, D_v 22.3 s), call +2.3 s < cutoff +22.0 s, ACCEPTED · CORRECT; london1607 (fast, D_v 8.9 s), call +9.3 s ≥ cutoff +8.6 s, LATE_SAW_IT. round.finalized and exactly one summary.sent (1 correct, 0 wrong) confirmed. Evidence in evidence/money-shot.md; no recording/log attachment supplied.
- Earlier stale take correctly rejected all calls as STALE_SYNC after 10 minutes. Calls before LANDED were correctly provisionally ACCEPTED. Live gap test remains PENDING; fake-payload gap coverage is not live evidence.
- Follow-up scope: ignore the shared broadcaster/bot account before engine handling, replace epoch timestamps with plain rejection guidance and captured sync age, include blocked verdict totals/codes in the one final summary, and retain final OBS cards until the next round or sync. New sync clearing survives expiry/reload. Engine files, verdict shape and Seed-7 remain unchanged.
- Follow-up verification: npm test passed **70 passed, 0 failed** (engine 19, server 27, web 24); production build passed. Added fake-payload coverage for ignored own-account syncs/calls/summary echoes, direct blocked-call summary counts, final-card retention and clearing, and captured stale-sync ages with human-readable reasons.
