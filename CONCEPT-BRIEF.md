# Concept Brief: CalledIt

> Codex x TwitchCon Hackathon (Devpost). Deadline **Nov 2, 2026, 2:00 PM PT**. The FAQ converts this to 21:00 UTC (22:00 Lagos). US daylight saving ends Nov 1, so it may actually be 22:00 UTC. Plan for the **earlier** time.
> Internal cutoff: **Nov 2, 12:00 UTC**. After that, only fix links, video access, README errors, secrets and outages.

---

## One-liner
CalledIt is a chat game layer for Twitch streamers. It lets chat call what happens next ("land it" or "miss it") and judges every call fairly, even though each viewer watches the stream with a different delay.

## Tagline
**Chat calls it. Lag can't cheat it.**

## Problem (with a tiny numbers scenario)
On Twitch, every viewer sees the stream late, and each one by a different amount. A Twitch staff member on the developer forum says you can't rely on latency, either in amount or in consistency between viewers.

Three viewers are watching a trick-shot stream:
- **Ada** is on low-latency mode. She sees things 2 s late.
- **Ben** is on normal mode. He sees things 6 s late.
- **Cy** is on mobile. He sees things 9 s late.

The streamer lands the shot at **t = 0** (server time). Every streamer tool today uses one rule for everyone, and one rule is always wrong for someone:
- **Rule "lock when the streamer clicks"** (the streamer clicks at t = 5): Ada saw the shot at t = 2, typed "LAND" at t = 3, and gets **counted as correct**. She cheated without even trying.
- **Rule "lock at the moment it happened"** (t = 0): Cy honestly called "LAND" at t = 7, before he could see it at t = 9. He gets **rejected**.

Same round, two wrong verdicts. Chat notices, and the game stops being fun.

## Insight
**You cannot remove stream delay. But you can guarantee that no call counts after that viewer could have seen the result.**

You can't read a viewer's delay from chat. You can measure it: show a code on stream and time how long each viewer takes to type it back. Twitch Extensions get the viewer's latency directly from Twitch, but Extensions need 5–14 days of review, and judges can't install an unreviewed one. CalledIt gets the same fairness with chat alone.

## Solution
1. **SYNC.** The overlay flashes a word, for example "SAY: MANGO". Each viewer who types it back gets a personal delay `D_v`. That time covers stream delay, reaction time and chat delivery, measured on one server clock.
2. **OPEN.** The streamer opens a round with two outcomes, like `!land` or `!miss`.
3. **CALL.** Chatters call it. One call per viewer per round.
4. **IT HAPPENED.** The streamer presses LANDED or MISSED on the dashboard, or a hotkey. That press time is `T_event`.
5. **JUDGE.** Each call is checked against that viewer's own clock. The overlay shows every verdict with a reason and the numbers behind it.
6. **BLOCK THE TIME TRAVELER.** A late call from someone who already saw the result is rejected on screen with proof. For example: "@ada saw it at +2.0s, called at +3.1s → LATE_SAW_IT".

## Core Guarantee
> **A call from viewer v at time t is accepted only if `t < T_event + D_v − m`.** `D_v` is v's most recent (minimum-of-recent) sync time and `m` is a safety margin.
> Every call is judged exactly once. Each viewer gets one call per round. A round with a chat-connection gap is VOID and never scored.

## Key Differentiators
- **Per-viewer clock from chat alone.** No Extension, no install for viewers, no channel points or affiliate status needed.
- **Every verdict shows its proof.** Each verdict carries a reason code and the timing numbers, so chat can see it's fair.
- **It fails honestly.** If the EventSub connection drops during a round, the round is VOID, not guessed. Twitch does not replay lost events.
- **Built to stay inside unverified-bot limits.** The overlay is the output. The bot sends one summary message per round, not one reply per call.
- **A pure, tested engine.** The same judge code runs on the server and in the judge replay page.

## Target Users (including the judge)
- **Small and mid streamers** (IRL, challenge, speedrun, party-game streams) who want a "call it" moment without being affiliates.
- **Viewers on slow connections or mobile.** Today they lose every call-out game by default.
- **Mods** who are tired of arguing in chat over who called it first.
- **The judge.** They need to get it in 10 seconds, see a seeded replay with no signup, read short instructions and honest limits, and get the same numbers in the video, README and replay.

**Primary user story:** As a streamer, I want chat to call my next attempt and have it judged fairly for every viewer, so I can run call-out games without my chat fighting about lag.

## Why This Sponsor
- **Why Twitch:** stream delay is a Twitch-shaped problem. EventSub gives us every chat message as it happens, so we can time calls and syncs on one server clock. The Twitch API lets the bot post one result per round.
- **Why Codex:** Codex builds and tests the timing engine (the invariant property tests), the EventSub client, and the reconnect and gap handling. It all happens in one main thread, which we record for the video.

### Twitch integration (planned file map)
| Twitch piece | Job in the core path | Planned file |
|---|---|---|
| OAuth user token (`user:read:chat`, `user:write:chat`, `user:bot`) | Read and send chat as the bot or broadcaster | `server/twitch/auth.js` |
| EventSub WebSocket `channel.chat.message` | Receive syncs and calls, stamp them on the server clock | `server/twitch/eventsub.js` |
| EventSub keepalive, reconnect and close handling | Detect gaps, VOID affected rounds | `server/twitch/eventsub.js`, `engine/round.js` |
| Helix Send Chat Message | One round summary per round | `server/twitch/chat.js` |
| (P1) Create Stream Marker | Mark each event in the VOD for clipping | `server/twitch/markers.js` |

**Evaluated and rejected:**
- **Extension:** review takes 5–14 days and judges can't install an unreviewed one.
- **Channel Points, Predictions and Polls:** these need affiliate or partner status, and native Predictions already own "betting".

**Upstream contribution (optional, P1):** a short write-up or example on measuring per-viewer delay over chat for TwitchDev forum or Discord. Only post it if it's genuinely useful.

## Territory Map and What We Must Not Be
- **Crowd Control** owns chat changing your game for Bits or coins.
- **Marbles on Stream and Stream Raiders** own chat-joins-a-game-on-the-overlay.
- **Twitch Predictions and Polls** own native betting and voting with channel points.
- **Streamer.bot, Mix It Up and Nightbot** own general bot commands and alerts.
- **Overlay Expert and Live Bingo** own Stream Together and Shared Chat combined overlays (2024 Streamer Tools Hackathon winners).
- **StreamRoll** owns chat dice rolls. The hackathon examples (Twitch Plays, polls, dice roller, sports overlay) are off-limits.

**Our project must not compete as:** another prediction or poll clone, another chat minigame, another alert overlay, another general-purpose bot, or an AI chat summarizer.

**Our layer:** a **fair clock for chat**, which none of the above has.

## Demo Story (under 3 minutes) and Memorable Flow
**SYNC → OPEN → CALL → IT HAPPENED → JUDGE → BLOCK THE TIME TRAVELER**

| Time | Act | What the viewer of the video sees |
|---|---|---|
| 0:00–0:20 | **1. The dangerous default** | Three real viewer screens side by side with visibly different delays. Caption: "Who actually called it?" |
| 0:20–0:50 | **2. Sync** | The overlay flashes "SAY: MANGO". Three chatters type it. The overlay shows their delays (for example 2.1 s, 5.8 s, 8.7 s). |
| 0:50–1:30 | **3. Real round on live Twitch** | An IRL trick shot. The streamer opens LAND/MISS, calls appear, the streamer hits LANDED. Cy's honest +6 s call is **ACCEPTED**. Ada's +3 s call is **REJECTED – LATE_SAW_IT** with the numbers. *Money shot.* |
| 1:30–1:55 | **4. Break it** | A duplicate call, an uncalibrated call, a call before the round opens, then a forced connection drop. Each one is refused with a reason code, and the dropped round is VOID. |
| 1:55–2:30 | **5. Built with Codex** | The Codex thread, the invariant test suite running, and the seeded replay matching the live verdict board. |
| 2:30–2:50 | **6. Close** | "Twitch already has polls and predictions. What it lacked was a fair clock for chat. CalledIt is that clock." |

### Solo Demo Plan (no streamer needed)
- **Streamer:** you, on your own free Twitch channel (laptop + OBS + webcam).
- **Fast viewer:** extra account #1 in a second browser profile on the laptop, with Low Latency ON.
- **Slow viewer:** extra account #2 on a phone on mobile data, with Low Latency OFF.
- **Optional:** extra account #3 on a second phone, or a housemate holding it.
- **Money shot:**
  1. Open the round and do the trick.
  2. Press LANDED.
  3. Type `!land` on the fast tab after seeing it → ❌ LATE_SAW_IT.
  4. Type `!land` on the slow phone before it shows there → ✅ ACCEPTED.
- **Recording:** mirror the phone onto the laptop with scrcpy (Android) and screen-record everything in one frame.
- **Backups:** the `/judge` seeded replay and an overlay-driven countdown event (exact `T_event`, no trick skill needed).
- **Pitch line:** "I played all three people, and my own phone was 8 seconds in the past."

**Content rule:** use only our own content. No commercial game footage and no music without permission, per the contest rules. An IRL trick shot or cup tower is the safe and fun choice.

**Recording rule:** record each act the moment it works. Polish never blocks a recording.

## Proof Plan
- **Real vs mocked.** The UI shows a `LIVE (Twitch)` or `REPLAY (simulated)` banner. `REAL_VS_MOCKED.md` lists exactly what is simulated. Only the judge replay uses simulated chatters, and it is labelled.
- **Attack Lab** (dashboard buttons that run real attacks through production engine code), with their reason codes:
  - `LATE_SAW_IT`: a call after the viewer's own cutoff
  - `DUPLICATE_CALL`: a second call in the same round
  - `NOT_CALIBRATED`: a call from a viewer who never synced
  - `STALE_SYNC`: a sync older than the freshness window
  - `ROUND_NOT_OPEN`: a call before the round opens or after it is judged
  - `ROUND_VOID_GAP`: the EventSub connection was lost during the round window
  - `REPLAYED_MESSAGE`: the same EventSub `message_id` delivered twice
- **Error shape.** Every refusal uses the same structure: `{ code, retryable, nextAction, numbers: { tEvent, tCall, dViewer, margin } }`.
- **Seeded scenario.** `Seed-7` replays a fixed set of simulated chatters with fixed delays and calls. Its expected verdict counts are written into a test file and must match the replay page, the README and the video exactly.
- **Tests.**
  - Unit tests for each reason code.
  - A property test: for 10k random rounds, no accepted call ever breaks `t < T_event + D_v − m`, and each call gets exactly one verdict.
  - A gap test: a simulated disconnect leads to a VOID round.
  - Test counts are reported only after they pass. CI runs on GitHub Actions with a badge.
- **Fair comparison.** The same Seed-7 calls are judged three ways: "lock at click", "lock at event" and CalledIt. We show the count of wrong verdicts for each. The baselines are coded honestly, not weakened.
- **Claim boundaries.** See "Honest limits" under Risks.

## Judge Mode Plan
- **Route `/judge`:** no signup, runs fully in the browser with the same engine module, so it works even if the server is asleep.
- **First 10 seconds:** a headline card shows the problem in one line, the guarantee in one line, and "Seed-7: X wrong verdicts with lock-at-click, 0 with CalledIt".
- **First 60 seconds:** the judge clicks **Run the demo**. The replay plays sync, a round and verdicts. Then **Run the attacks** fires all 7 refusals with their reason codes.
- **First 5 minutes:** they watch the video, open the README rubric map, run `npm test`, and read `REAL_VS_MOCKED.md` and the limits.
- **Target:** the judge reaches the money-shot verdict in 90 seconds or less from opening `/judge`.

## Rubric → Evidence Map
| Criterion (equal weight) | Evidence |
|---|---|
| **Innovation / Idea** | Per-viewer delay calibration over plain chat (no Extension). Proof-carrying verdicts. The 3-way comparison on Seed-7. The innovation statement below. |
| **Potential Impact** | Works for any streamer, with no affiliate, channel points or install needed. Fits IRL, speedrun and challenge streams. Makes slow and mobile viewers first-class players. |
| **Technological implementation** (incl. Codex) | Pure engine with invariant property tests and CI. EventSub reconnect and gap handling. Rate-limit-aware bot. One main Codex thread (session ID via `/status`) and Codex footage in the video. |
| **Design (easy, fun to watch)** | Big readable overlay verdicts (✅/❌ plus a one-line reason). A dramatic sync flash. A 3-button streamer dashboard. The "time traveler blocked" moment. |

**Required submission fields:**
- **Repo:** public GitHub with README, setup and env vars listed. No keys committed.
- **Text description:** features, plus how Codex was used.
- **Codex session ID:** from `/status` in the main thread.
- **Video:** under 3 minutes on YouTube (unlisted is OK). Shows it working on Twitch and the Codex build.

## Innovation Statement
We did not invent latency calibration. Broadcast-TV game patents already describe having viewers mark a known on-screen event to measure delay. Twitch Extensions also expose viewer latency. What's new is joining a **chat-only sync**, a **per-viewer verdict rule with a stated invariant**, and **gap-aware voiding** into one loop that any Twitch streamer can run without an Extension.

## Hackathon Scope
**P0 (must ship for the recorded demo)**
1. Twitch OAuth (broadcaster or bot user token) and an EventSub WebSocket client with keepalive, reconnect and gap detection.
2. A pure engine (`engine/`): sync, open, call, resolve, verdicts with reason codes.
3. An overlay (React browser source for OBS): sync flash, live calls, verdict board.
4. A streamer dashboard with 4 actions: Sync, Open round, It happened (A/B), Void.
5. A bot summary of one chat message per round.
6. Judge replay `/judge` with Seed-7, plus the Attack Lab.
7. Tests and CI, README, and `REAL_VS_MOCKED.md`.

**P1 (only after P0 is deployed and recorded)**
- Stream Marker at each event.
- Auto re-sync prompts when a sync goes stale.
- A season leaderboard stored in MongoDB.
- Overlay-driven events (a countdown reveal) for exact `T_event`.
- Shared Chat badge showing the source community.

**Never (→ ROADMAP.md)**
- Twitch Extension
- Channel points or Bits stakes
- AI features
- Multi-channel SaaS and accounts
- Mobile app

**Surfaces:** 3 screens only, which are the overlay, the dashboard and `/judge`.

**Stack:** React (Vite) and Node/Express with `ws`, plus MongoDB Atlas for the round and verdict log. Deploy as one Render service. The judge replay is static and works offline from the server.

## Day-by-Day Plan (end-of-day gates)
| Day | Date | Work | Gate |
|---|---|---|---|
| 1 | Sat Oct 24 – Sun Oct 25 | **Gate 0** (below) | Real delays measured for 2+ viewers, written to `evidence/gate0.md` |
| 2 | Mon Oct 26 | Engine and tests | All reason codes and the invariant property test pass |
| 3 | Tue Oct 27 | EventSub wired to the engine, overlay sync flash | Live sync on own channel shows per-viewer delays |
| 4 | Wed Oct 28 | Dashboard and full live round | **Record Acts 2–3 raw** |
| 5 | Thu Oct 29 | Attack Lab, gap→VOID, bot summary | **Record Act 4** |
| 6 | Fri Oct 30 | `/judge` replay, deploy, README, 3-way comparison | Clean clone → `npm i && npm test` passes. Deployed URL works. |
| 7 | Sat Oct 31 | Design polish, full rehearsal stream | **Record final acts and Codex footage** |
| 8 | Sun Nov 1 | Edit the video, upload to YouTube, write the Devpost text, **submit early** | Shows as *Submitted* on Devpost |
| 9 | Mon Nov 2 | Buffer only. Freeze at 12:00 UTC. | No feature commits after the deadline |

## Definition of Finished (a stranger can verify)
- A clean clone works: `npm install`, `npm test` passes, and `.env.example` lists every variable.
- A live round on Twitch shows at least one ACCEPTED call from a slow viewer and one LATE_SAW_IT call from a fast viewer.
- All 7 Attack Lab refusals fire, each with its reason code.
- The Seed-7 numbers are identical in the test file, `/judge`, the README and the video.
- The video is under 3:00, shows Twitch and Codex, and contains no third-party copyrighted material.
- Devpost shows *Submitted*, with the Codex session ID filled in.

## Success Criteria
| Metric | Target |
|---|---|
| Delay spread between the fastest and slowest test viewer (Gate 0) | ≥ 2.0 s |
| Repeat-sync variation for the same viewer | ≤ 1.0 s |
| Invariant violations in the 10k-round property test | 0 |
| Seed-7 wrong verdicts with CalledIt vs lock-at-click | 0 vs > 0 |
| Bot chat messages per round | 1 |
| Time from opening `/judge` to the money-shot verdict | ≤ 90 s |
| Video length | < 3:00 |

## Gate 0 Feasibility Check (Day 1, before any other build)
**Riskiest premise:** syncing over chat produces delays that are clearly different per viewer and stable enough to judge with.

**Option A (ideal)**
- Stream to your own channel from OBS.
- Use 2–3 test viewer accounts on different devices or player settings: low-latency mode on vs off, desktop vs mobile.
- Run the Twitch example chatbot (EventSub `channel.chat.message`) and have the server push a sync word to an overlay.
- Log server receive times for 5 syncs per viewer.

**Option B (fallback if the spread is under 2 s)**
- Keep the guarantee; it still fixes "lock-at-click" for everyone.
- Use a phone on mobile data as the slow viewer.
- In judge replay, show larger delays from the measured range, clearly labelled as simulated.

**Acceptance**
- An EventSub chat event is received with a user token.
- Spread across viewers is ≥ 2 s.
- Same-viewer variation is ≤ 1 s.
- Raw logs are saved to `evidence/gate0.md`.

**If reality contradicts the plan:** update this brief and record why. Never build on a premise known to be false.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Delay spread too small to look dramatic | Weak money shot | Gate 0 day 1. Mobile on cellular as the slow viewer. Option B. |
| The streamer's button press is later than the real event | Lenient cutoff by the streamer's reaction time | Configurable event offset. P1: overlay-driven events for exact time. Stated in limits. |
| Viewer reaction time differs between sync and call | Fast cheaters gain a small window | The sync word uses the same effort as a call (one word). Use the minimum of recent syncs (stricter). Margin `m`. Stated in limits. |
| EventSub disconnect (no replay) | Missed calls | Gap detection leads to a VOID round, with a test. |
| Unverified bot rate limits (20 msgs/30 s; 1/s per channel if not mod) | Bot muted for 1 hour | One message per round, and the overlay carries the output. |
| Not enough live test chatters | Thin live demo | 2–3 own accounts on separate devices. Ask a friend or two. Judge replay covers the rest. |
| Upload bandwidth from Lagos | Choppy stream | 720p30 around 2500 kbps, local recording as backup. |
| Free Codex usage limits | Build stalls | Keep one main thread, small prompts, and headroom for final fixes. |
| Render free tier sleeps | Judge sees a dead server | `/judge` runs fully client-side. |

**Honest limits (these go in the README):**
- `D_v` includes reaction and chat-delivery time.
- The streamer's button adds their own reaction time.
- Delays drift, so syncs expire.
- Calls during a connection drop are lost, and that round is VOID.
- This judges fairness of *timing*, not whether the streamer marked the right outcome.

## Prepared Judge Q&A
- **How is this different from Twitch Predictions?** Predictions lock for everyone at one moment and need channel points or affiliate. CalledIt judges each viewer by their own delay, works for any channel, and shows why each verdict was given.
- **What's real?** Live chat via EventSub on a real Twitch channel, and real measured delays. Only `/judge` uses simulated chatters, and it is labelled.
- **What stops someone who saw the result from calling it?** Their own measured delay. Once `t ≥ T_event + D_v − m`, the call is rejected with LATE_SAW_IT.
- **Can a viewer game the sync by answering slowly on purpose?** A slower sync gives a *later* cutoff, so faking it helps. Mitigations: the sync word is shown for only a short window, we use the minimum of several syncs, flag outliers, and cap `D_v` at a maximum. We state this openly as a limit.
- **What if the connection drops?** Twitch does not replay lost EventSub events, so the round is VOID instead of guessed.
- **Why not an Extension?** Review takes 5–14 days and judges can't install an unreviewed one. CalledIt shows chat alone is enough.
- **How did you use Codex?** One main thread built the engine, the property tests, the EventSub client and the gap handling. Its session ID is in the submission, and the footage is in the video.
- **What didn't you finish?** Whatever is listed in P1. We keep ROADMAP.md honest.

## Open Questions
1. How many separate devices or accounts can join live for Gate 0 and the recording (target 3)?
2. Which IRL challenge to use for the money shot (trick shot, cup tower, coin flip into a cup)?
3. Is your Twitch account ready to stream from OBS? Check stream key access and any required account security settings before Day 1.
4. Final name check: "CalledIt" or an alternative. Run a quick search for clashes before the logo work.
