# PROJECT_STATE — CalledIt

## Current phase
- **Phase 0** (owner): pending Gate 0 delay test. Codex skipped it as instructed.
- **Phase 1** (Codex): complete, pushed as `47e017a`.
- **Phase 2** (Codex): complete, pushed as `c851944`.
- **Phase 3** (Codex, then owner): code complete and tested; waiting for owner credentials and a real channel sync.
- **Phases 4 and 5**: not started. Resume Phase 4 after the owner verifies Phase 3.

## Done
- Docs setup and .gitignore pushed as `1fe9f35`.
- Phase 1: npm workspaces; pure dependency-free engine; fixed Seed-7 fixture; prefix replay; baseline comparison; Node 22 GitHub Actions workflow.
- Phase 2: React + Vite and plain CSS; /judge browser replay; simulated /dashboard and transparent /overlay; Attack Lab for all eight reason codes.
- Phase 3: Express local server; authorization-code OAuth with state cookie; scope/client validation; token refresh; hourly validation; EventSub chat subscription; server-clock arrival timestamps; chat message ID deduplication; close/timeout gap reporting and recovery; reconnect handoff; one summary attempt per finished round with rate spacing.
- /dashboard?liveSync=1 provides the owner's local Phase 3 calibration check. Full live round controls and live OBS overlay wiring remain Phase 4.
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
1. Enable Twitch 2FA and register a confidential Developer Console app with redirect `http://localhost:3000/auth/callback`.
2. Copy .env.example to .env and set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET. Keep the default TWITCH_REDIRECT_URI; access/refresh tokens are optional.
3. Run `npm run build -w web` and `npm start`, then open `http://localhost:3000/dashboard?liveSync=1`.
4. Connect using the broadcaster account, press Sync, show the word on stream, and have viewers type it back. Repeat three times and confirm real per-viewer delays appear. See server/LOCAL_TWITCH.md.
5. Finish Gate 0: OBS test stream, fast viewer tab and iPhone on mobile data. Record at least a 2-second extra iPhone delay in evidence/gate0.md.
6. Report the live sync result so work can resume at Phase 4.

## Log
- 2026-10-24: Docs initialized and pushed; Phases 1 and 2 completed and pushed.
- 2026-10-24: Phase 3 Codex portion complete, 36 tests passed. Stopping for owner credentials and manual Twitch sync as required by AGENTS.md and PRD §10.
