# CalledIt

**Chat calls it. Lag can't cheat it.**

CalledIt judges Twitch chat's `!land` / `!miss` calls against each viewer's measured delay. One streamer-wide lock can admit a fast viewer who has already seen the result or reject a slow viewer who has not. A personal cutoff shows why each call counts or is blocked.

## Try it without Twitch

Requires **Node 22+** and npm. From a clean clone:

```sh
git clone https://github.com/london160771/calledit.git
cd calledit
npm install
npm test
npm run build -w web
npm start
```

Open **http://localhost:3000/judge**, click **Run the demo**, then **Run the attacks**. No .env or Twitch account is needed. This page says **REPLAY (simulated)**; it is not a live stream. Tests also build the web app. Express serves that build and starts in replay-only mode when both Twitch client values are absent.

The loaded replay runs the shared engine entirely in the browser and needs no Twitch or live server API. First load still needs the server to serve its files: a sleeping Render service must wake up. This is not an offline-installable app.

## Guarantee and how it works

```text
ACCEPTED only if receivedAt < eventAt + D_v - marginMs
```

All times are milliseconds on one server clock. Equality is late. `D_v` is the minimum of the viewer's last three recorded sync samples; the default margin is **300 ms**. ACCEPTED before the event is provisional: marking rechecks those calls and supplies CORRECT or WRONG. Each viewer gets one counted call per round. Lost EventSub coverage voids overlapping rounds instead of guessing a score.

1. **SYNC:** OBS shows a word. Viewers type it when they see it on stream; Node measures shown-to-received time.
2. **OPEN:** the streamer opens land/miss. Chat arrives through a Node EventSub WebSocket, independently of browser tabs.
3. **CALL:** `!land` / `!miss` enter the pure engine. The broadcaster/bot's own messages are excluded.
4. **IT HAPPENED:** LANDED/MISSED supplies the Node press time, minus `eventOffsetMs` (default 0).
5. **JUDGE:** OBS shows codes and numeric reasons; dashboard details preserve exact engine numbers. A Node timer finalizes at `eventAt + maxDelayMs`.
6. **SUMMARY:** one Helix send attempt per terminal round, spaced at least 1600 ms apart. Example: `land. 1 correct, 0 wrong, 1 blocked (LATE_SAW_IT).` VOID is unscored; ambiguous failures are logged without retry.

Verdict priority: REPLAYED_MESSAGE, ROUND_NOT_OPEN, NOT_CALIBRATED, STALE_SYNC, DUPLICATE_CALL, LATE_SAW_IT, ACCEPTED. Gaps change counted calls to ROUND_VOID_GAP. See [PRD §4](PRD.md#4-engine-rules-pure-deterministic) for the exact API and shape.

Engine defaults: **syncWindowMs 15000**, **maxDelayMs 20000**, **syncFreshMs 600000**, **syncSamples 3**, **marginMs 300**, **eventOffsetMs 0**. Only the live server overrides the window/cap to **45000 ms**, independently configurable in .env. The engine has zero dependencies, clocks, random numbers or I/O.

## Solo/live demo

Follow [LOCAL_TWITCH.md](server/LOCAL_TWITCH.md) for credentials, scopes and logs. Set TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET in an ignored .env, register `http://localhost:3000/auth/callback`, rebuild/restart and connect as **ayyoweb3**, the broadcaster/bot.

- Controls: **http://localhost:3000/dashboard?liveSync=1**.
- OBS Browser Source: **http://localhost:3000/overlay?live=1**, **1280x720**, transparent and visible in the streamed scene.
- `/dashboard` and `/overlay` without live flags are simulated. `/judge` contains replay and Attack Lab.

Use measured roles, not device assumptions. Gate 0 verified **iPhone / london1607 fast**, **laptop / becca160771 with Low Latency OFF slow**. The later money shot used **sammiedfab** as slow. These reverse the original device assumption in PRD §9.

After a restart/setup change, show three syncs and have both viewers reply as words appear on their stream, not on the control dashboard. Recalibrate within ten minutes. Open a fresh round; for the money shot, do not pre-call from the two demonstration accounts. Mark LANDED at the event. Fast calls after seeing the outcome; slow calls before seeing it and before their cutoff. Wait the live 45-second horizon. OBS retains the last two final cards until the next round or sync; dashboard exposes the latest twenty verdicts with exact details.

A separate live gap check remains pending: interrupt Node's network during an open round while leaving Node running. Expect eventsub.lost, round.voided and VOID / ROUND_VOID_GAP. Automated fake-payload gap tests pass; that is not a live recording.

## Seed-7 contract

Fixed simulated inputs, not observed live delays. True lags for baseline comparison: ada **1500**, ben **5000**, cy **8000**, eve **1800** ms.

- S0: PAPAYA shown **0**; fay reply **3000**.
- S1: MANGO shown **700000**; ada **702000 → D 2000**, eve **702400 → D 2400**, ben **705800 → D 5800**, cy **708700 → D 8700**.
- R1 opens **720000**; land pressed **740000**; final **760000**.

| At (ms) | Viewer / message | Verdict |
|---:|---|---|
| 715000 | ada !miss (m1) | ROUND_NOT_OPEN |
| 738000 | dee !land (m2) | NOT_CALIBRATED |
| 739000 | fay !land (m3) | STALE_SYNC |
| 739500 | eve !land (m4) | ACCEPTED · CORRECT; cutoff 742100 |
| 741000 | ben !miss (m5) | ACCEPTED · WRONG; cutoff 745500 |
| 742000 | ben !land (m6) | DUPLICATE_CALL |
| 743100 | ada !land (m7) | LATE_SAW_IT; cutoff 741700 |
| 746000 | cy !land (m8) | ACCEPTED · CORRECT; cutoff 748400 |
| 746000 | cy !land (same m8) | REPLAYED_MESSAGE |

R2 opens **780000**: eve !land **785000** (m9), cy !miss **786000** (m10), gap **787000–790000**, miss pressed **795000**. Both calls become ROUND_VOID_GAP; round VOID.

Totals: **3 ACCEPTED (2 CORRECT, 1 WRONG)**; **1 each** LATE_SAW_IT / DUPLICATE_CALL / NOT_CALIBRATED / STALE_SYNC / ROUND_NOT_OPEN / REPLAYED_MESSAGE; **2 ROUND_VOID_GAP**.

Compare the same counted R1 calls (eve, ben m5, ada m7, cy). Simulated honest means `receivedAt < eventAt + trueLag`:

| Rule | Wrong admission verdicts | Why |
|---|---:|---|
| Lock-at-click, 745000 | **2** | Ada admitted after seeing; honest Cy rejected |
| Lock-at-event, 740000 | **2** | Honest Ben and Cy rejected |
| CalledIt | **0** | Personal cutoffs match all four simulated admission labels |

The **2 / 2 / 0** result is a fixed fixture comparison, not a universal live accuracy claim.

## Live evidence and rubric map

Owner reports dated **2026-10-28**, channel **ayyoweb3**:

- [Gate 0](evidence/gate0.md): D_v **12366 / 18374 ms**, spread **6008 ms → PASS**. Laptop variation **2.2 s** exceeds the **1.0 s** target; retained as a limit.
- [Money shot](evidence/money-shot.md): **round-1793192469925-3**. Slow sammiedfab **+2.3 s < +22.0 s → ACCEPTED · CORRECT**; fast london1607 **+9.3 s ≥ +8.6 s → LATE_SAW_IT**. Finalization and one summary.sent confirmed. Earlier stale take rejected calls; pre-event calls were provisionally accepted.
- No video/VOD or raw log attachment supplied. Live gap check **pending**. [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md) separates real reports, simulation and fake-service tests.

Categories follow the [official criteria](https://twitchcon-codex.devpost.com/rules); this is an evidence map, not a judge's score.

| Criterion | Evidence to inspect | Owner evidence still needed |
|---|---|---|
| Innovation/Idea | Personal cutoffs; Seed-7 2/2/0; engine/src/scenario.js | Explain the timing problem in the submission |
| Potential Impact | Slow accepted / fast blocked in evidence/money-shot.md | Demo footage; no broad user-study claim |
| Technological implementation | Pure engine, 10k-round property test, fake EventSub/auth/gap/summary tests, Codex history | Actual Codex session ID/build footage; hosted smoke check |
| Design | Three surfaces, numeric OBS cards, plain rejection reasons, replay/Attack Lab | Final OBS/phone recording after follow-up fixes |

## Honest limits

- D_v includes reaction time, chat delivery and overlay polling/rendering, not pure video lag. Laptop variation was 2.2 s; reaction time is an owner hypothesis, not a verified cause.
- The streamer's press adds reaction time. The engine supports eventOffsetMs (default 0); live UI has no offset control.
- A viewer can intentionally reply slowly to sync. Minimum-of-recent samples and maxDelayMs reduce that risk but do not remove it. The guarantee concerns measured D_v, not unknowable true lag.
- Lost EventSub events are not replayed. A late gap report can correct a finalized round to VOID; an already-sent summary cannot be recalled and no second one is sent.
- Tokens, calibrations and rounds live in one Node process's memory. Restart/redeploy loses them: reconnect and resync. Logs go to stdout; there is no application database, shared state or multi-channel support. Use one instance/process.
- Summary failures are not retried: Helix failure may leave no chat summary while OBS still shows the result.
- Render Free can sleep; first load needs a wake-up. The loaded replay needs no API. Actual Render deployment and hosted Twitch/OBS remain owner checks.

## How Codex was used

The owner supplied PRD/AGENTS, controlled scope, configured Twitch/OBS and performed the live tests. In this Codex chat, Codex implemented the pure engine/property tests, replay/UI, OAuth/EventSub adapters, gap handling, summaries and live orchestration. Owner reports drove the live 45-second override, diagnostics, reconnect fixes, bot filtering and verdict presentation changes. Git history and PROJECT_STATE.md record phases and checks.

The owner must supply the actual Codex session ID and accessible demo/build footage. Codex did not deploy, operate the owner's Twitch accounts or record the reported live results. No session recording is fabricated here.

## Project and checks

- `engine/`: dependency-free judge, fixed replay and baselines.
- `server/`: Express, OAuth, EventSub, Node rounds and rate-spaced Helix summaries.
- `web/`: React/Vite, plain CSS, replay and live dashboard/OBS views.
- `npm test`: workspace node:test suites plus web build. `npm test -w engine`: engine only. `npm run build -w web`: production build. CI runs npm ci and npm test on Node 22.

[PROJECT_STATE.md](PROJECT_STATE.md) records actual check counts. [DEPLOY.md](DEPLOY.md) and [render.yaml](render.yaml) describe the **owner-run**, single-service deployment. Codex has created no hosting service or deployment.
