# What is real, simulated, and unverified

| Surface / result | What actually runs | Evidence / limit |
|---|---|---|
| /judge and Attack Lab | Real shared pure engine; simulated fixed chat/clock/lag inputs | Seed-7 exact tests; 2/2/0 is simulated, not a live accuracy measurement |
| /dashboard and /overlay without live flags | Simulated feed, deterministic local clock and browser storage | Explicit labels; no Twitch traffic |
| /dashboard?liveSync=1 and /overlay?live=1 | Node state, authenticated Twitch EventSub chat and Helix summary API | Owner reports real sync and round pass on ayyoweb3 |
| D_v | Server time from showing a word to receiving the viewer reply; minimum of last three samples | Includes reaction/chat/polling, not pure video latency |
| Event time | Node clock at LANDED/MISSED press | Not extracted from video; streamer reaction time remains |
| Verdicts | Same pure engine in Node and browser | Display rounds seconds; dashboard details/logs retain exact engine milliseconds |
| Automated Twitch tests | Fake HTTP responses/sockets and full real-shaped EventSub envelopes | Checks adapter/engine/UI behavior, not live uptime or hosted deployment |
| Gap → VOID | Implemented and covered by fake-payload tests | Live gap test PENDING; no recorded live disconnect pass claimed |
| One summary | Real Helix send in live mode; fake sender in tests | Owner confirmed one summary.sent for money-shot round; failures not retried |
| Blocked counts, bot filtering, final-card retention | Follow-up fixes covered by regression tests | Owner needs to rebuild/restart and verify updated live presentation |
| Render | One Node web service config; Express serves built web | Not deployed or tested against a real Render service by Codex |
| Storage | Process memory, stdout logs | No database, persisted rounds/calibration, shared state or restart recovery |

## Owner-reported live evidence

- [Gate 0](evidence/gate0.md): fresh-server PEACH/PAPAYA/MANGO syncs, 45-second window, **6.008 s spread**. Actual roles: iPhone fast, laptop slow. Laptop variation **2.2 s** exceeds the 1-second target; documented as a limit.
- [Money shot](evidence/money-shot.md): ayyoweb3, 2026-10-28, round-1793192469925-3. sammiedfab accepted/correct (+2.3 s vs +22.0 s cutoff); london1607 blocked (+9.3 s vs +8.6 s cutoff); finalization and one summary.sent confirmed.
- Earlier take correctly returned STALE_SYNC after ten minutes; calls before LANDED were provisionally accepted. An unrelated viewer's ordinary chat was ignored during calibration.

These files record the owner's reports. No raw log export, VOD URL, public video, deployment URL or Codex session ID was supplied. These remain owner submission work, not synthetic evidence.

## Not implemented

Twitch Extension, channel points/Bits/Predictions, AI judging, multi-channel accounts, mobile app, MongoDB logging and stream-marker creation are not implemented. See PRD.md and ROADMAP.md. No deployment was performed.
