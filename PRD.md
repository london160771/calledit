# PRD — CalledIt

**Chat calls it. Lag can't cheat it.**
Single source of truth for requirements. Replaces CONCEPT-BRIEF.md (kept only as background).

- Hackathon: Codex x TwitchCon (Devpost). Deadline Nov 2, 2026, 2:00 PM PT. Plan for 21:00 UTC. Internal cutoff Nov 2, 12:00 UTC.
- Builder: solo. Demo: solo, using your own channel, a laptop and an iPhone (see §9).

---

## 1. Problem
Every Twitch viewer sees the stream late, and each one by a different amount. Any "call it" game that uses one lock time for everyone is wrong for someone:
- **Fast viewers** can call after they have already seen the result, and get counted.
- **Slow viewers** call honestly but arrive "late", and get rejected.

## 2. Solution (one loop)
**SYNC → OPEN → CALL → IT HAPPENED → JUDGE → BLOCK THE TIME TRAVELER**

1. **Sync:** the overlay shows a word. Each viewer who types it back gets a personal delay `D_v` (time from shown to received, on the server clock).
2. **Open:** the streamer opens a round with 2 options (default `land` / `miss`). Viewers call with `!land` or `!miss`.
3. **It happened:** the streamer presses the outcome. That press time minus `eventOffsetMs` is `eventAt`.
4. **Judge:** each call is judged against that viewer's own delay.

## 3. Core guarantee (the invariant)
> A call from viewer v received at time t is **ACCEPTED only if `t < eventAt + D_v − marginMs`**.
> Every message gets **exactly one** verdict. Each viewer gets **one** counted call per round. A round with a connection gap is **VOID** and is never scored.

## 4. Engine rules (pure, deterministic)
The engine never reads the clock or random numbers itself. All times come in as input, in **milliseconds** on one server clock.

### Config defaults
| Key | Default | Meaning |
|---|---|---|
| `marginMs` | 300 | Safety margin (stricter) |
| `syncWindowMs` | 15000 | How long after a sync word is shown a reply counts |
| `syncFreshMs` | 600000 | A sync older than this (at call time) is stale |
| `syncSamples` | 3 | `D_v` = **minimum** of the viewer's last N sync samples |
| `maxDelayMs` | 20000 | Sync samples above this are ignored. A round finalizes at `eventAt + maxDelayMs`. |
| `eventOffsetMs` | 0 | Subtracted from the streamer's press time to get `eventAt` |

### Inputs (engine API)
- `startSync({ syncId, word, shownAt })`
- `handleMessage({ messageId, userId, userLogin, text, receivedAt })`
  - Text matching the active sync word (case-insensitive, trimmed, inside the window) records a sync sample.
  - Text `!<option>` is a call.
  - Anything else is ignored. It is not a verdict.
- `openRound({ roundId, options, openedAt })` (only one round can be open at a time)
- `markEvent({ roundId, outcome, pressedAt })` (sets `eventAt = pressedAt − eventOffsetMs`)
- `reportGap({ from, to })`. Any round whose window `[openedAt, eventAt + maxDelayMs]` overlaps the gap becomes VOID.
- `finalizeDue(now)`. Finalizes rounds where `now ≥ eventAt + maxDelayMs`.
- `voidRound({ roundId })`
- `getRound(roundId)` / `getVerdicts()` / `getViewer(userId)`

### Verdict order (first match wins)
1. `REPLAYED_MESSAGE`: this `messageId` was already seen.
2. `ROUND_NOT_OPEN`: no open round, or the round is already finalized.
3. `NOT_CALIBRATED`: the viewer has no valid sync sample.
4. `STALE_SYNC`: the viewer's latest sync is older than `syncFreshMs` at `receivedAt`.
5. `DUPLICATE_CALL`: the viewer already has a counted call in this round.
6. `LATE_SAW_IT`: the event is known and `receivedAt ≥ eventAt + D_v − marginMs`.
7. `ACCEPTED`: provisional until the event is marked. On `markEvent`, re-check rule 6 for every provisional call.

After the event, each `ACCEPTED` call also gets `result: CORRECT | WRONG`.
When a round goes VOID, every counted call in it becomes `ROUND_VOID_GAP`.

### Verdict shape
```js
{ messageId, userLogin, roundId, code, result,          // result only for ACCEPTED
  retryable, nextAction,                                  // short plain-English hint
  numbers: { receivedAt, eventAt, dViewer, marginMs, cutoff } }
```

## 5. Seed-7 (fixed scenario; the numbers must match everywhere)
Simulated true view lag (used **only** for baseline comparison):
- ada 1500
- ben 5000
- cy 8000
- eve 1800

**Syncs**
- S0 `PAPAYA` shown at 0. fay replies at 3000.
- S1 `MANGO` shown at 700000. Replies:
  - ada 702000 → D 2000
  - eve 702400 → D 2400
  - ben 705800 → D 5800
  - cy 708700 → D 8700

**Round R1** (`land`/`miss`): opens at 720000. Event `land` pressed at 740000. Finalizes at 760000.

| # | at | user | text | msgId | Expected |
|---|---|---|---|---|---|
| 1 | 715000 | ada | !miss | m1 | ROUND_NOT_OPEN |
| 2 | 738000 | dee | !land | m2 | NOT_CALIBRATED |
| 3 | 739000 | fay | !land | m3 | STALE_SYNC |
| 4 | 739500 | eve | !land | m4 | ACCEPTED · CORRECT (cutoff 742100) |
| 5 | 741000 | ben | !miss | m5 | ACCEPTED · WRONG (cutoff 745500) |
| 6 | 742000 | ben | !land | m6 | DUPLICATE_CALL |
| 7 | 743100 | ada | !land | m7 | LATE_SAW_IT (cutoff 741700) |
| 8 | 746000 | cy | !land | m8 | ACCEPTED · CORRECT (cutoff 748400) |
| 9 | 746000 | cy | !land | m8 | REPLAYED_MESSAGE |

**Round R2:** opens at 780000.
- eve `!land` at 785000 (m9)
- cy `!miss` at 786000 (m10)
- A gap is reported from 787000 to 790000.
- Event `miss` is pressed at 795000.
- **Expected:** both calls end as ROUND_VOID_GAP. The round is VOID.

**Totals**

| Verdict | Count |
|---|---|
| ACCEPTED | 3 (CORRECT 2, WRONG 1) |
| LATE_SAW_IT | 1 |
| DUPLICATE_CALL | 1 |
| NOT_CALIBRATED | 1 |
| STALE_SYNC | 1 |
| ROUND_NOT_OPEN | 1 |
| REPLAYED_MESSAGE | 1 |
| ROUND_VOID_GAP | 2 |

**Fair comparison (R1).** The 4 counted calls are eve, ben (m5), ada (m7) and cy. A call is "honest" if `t < eventAt + trueLag`.

| Rule | Wrong verdicts |
|---|---|
| Lock-at-click (streamer locks at 745000) | **2** (ada cheat accepted, cy honest rejected) |
| Lock-at-event (lock at 740000) | **2** (ben and cy honest, rejected) |
| CalledIt | **0** |

## 6. Surfaces (only 3)
1. **Overlay** (`/overlay`, OBS browser source, transparent background):
   - a big sync flash ("SAY: MANGO")
   - a live call feed
   - verdict cards (✅/❌ plus a one-line reason with numbers)
2. **Dashboard** (`/dashboard`):
   - Sync, Open round, LANDED/MISSED, Void
   - viewer delays table
   - Attack Lab buttons
3. **Judge** (`/judge`):
   - runs Seed-7 fully in the browser with the same engine
   - "Run the demo" and "Run the attacks" buttons
   - a `REPLAY (simulated)` banner
   - shows the comparison table

## 7. Twitch integration (Phase 3+)
- User access token with scopes `user:read:chat`, `user:write:chat` and `user:bot`. One account acts as broadcaster and bot.
- EventSub WebSocket `channel.chat.message`.
  - Stamp `receivedAt` with the server clock on arrival.
  - Deduplicate by `message_id`.
- Gap detection:
  - The connection closes, or no keepalive/notification arrives within the keepalive timeout → `reportGap`.
  - On a `session_reconnect` message, follow `reconnect_url` without a gap.
- Helix Send Chat Message: **one summary per round** only. Unverified bots are limited to 20 msgs/30 s and 1/s per channel.
- (P1) Create Stream Marker at `markEvent`.

## 8. Stack
- Node 22+, ESM, plain JavaScript with JSDoc.
- npm workspaces: `engine/`, `server/`, `web/`.
- Engine: **zero dependencies**, tests with `node:test`.
- Server: Express plus `ws`. Optional MongoDB Atlas for the round and verdict log (P1).
- Web: React plus Vite, plain CSS (no Tailwind).
- Deploy: one Render service. `/judge` works even if the server is asleep.

## 9. Solo demo setup
- **Laptop:**
  - OBS streaming to your main account
  - Fast viewer: second browser, Low Latency ON
  - Middle viewer (optional): third browser, Low Latency OFF
- **iPhone:** Twitch app as a viewer account, on mobile data with Wi-Fi off. This is the slow viewer.
- **Money shot:** after LANDED, the fast tab's `!land` is ❌ LATE_SAW_IT, and the iPhone's `!land` sent before the result shows there is ✅ ACCEPTED.

## 10. Phases
Codex works through these phases in order, without stopping between them. When a phase passes its checks and `npm test`, Codex commits, pushes and moves on (see AGENTS.md). Codex stops only for the owner's manual input, `.env` values, or when told to stop. The owner does all deployment.

| Phase | Who | Goal | Done when |
|---|---|---|---|
| 0 | Owner | Accounts, OBS, **Gate 0** delay test | The iPhone shows ≥ 2 s more delay than the fast tab. Notes in `evidence/gate0.md`. |
| **1** | Codex | Repo scaffold + pure engine + tests | Seed-7 test, comparison test and 10k-round property test all pass. No deps in the engine. CI workflow added. |
| 2 | Codex | Web: `/judge` replay + overlay and dashboard UI against a simulated feed + Attack Lab | `/judge` plays Seed-7 and shows identical totals. Attack buttons show all reason codes. Tests pass. |
| 3 | Codex, then owner | Twitch: auth, EventSub client, gap detection, send summary | The code is built and tested with fake EventSub messages. Codex then stops for `.env` values. Done once a live sync on the owner's channel shows real per-viewer delays. |
| 4 | Codex, then owner | Live round end to end + overlay in OBS | Codex wires the full live flow and tests it. The owner then runs it live and records the money shot. |
| 5 | Codex, then owner | Codex: README, REAL_VS_MOCKED.md, deploy-ready config (one Render service), and written deploy steps. Owner: deploy, record the video, submit. | The README and docs match the code, and a clean clone passes `npm install && npm test`. Done once the owner deploys and submits on Devpost. |

## 11. Not in scope (see ROADMAP.md)
- Twitch Extension
- Channel points, Bits or Predictions
- AI features
- Multi-channel accounts
- Mobile app

## 12. Honest limits (these go in the README)
- `D_v` includes reaction time and chat delivery.
- The streamer's button press adds their own reaction time (`eventOffsetMs` helps).
- A viewer could reply slowly to a sync on purpose to get a later cutoff. The minimum of several samples and the `maxDelayMs` cap reduce this, but don't remove it.
- Lost EventSub events are not replayed, so that round becomes VOID.
