# Phase 4 live money shot: PASSED

Owner-reported live result on **2026-10-28**, channel **ayyoweb3**, round **round-1793192469925-3**.

| Viewer | Role | Measured delay | Call after event | Personal cutoff after event | Verdict |
|---|---|---:|---:|---:|---|
| sammiedfab | Slow viewer | 22.3 s | +2.3 s | +22.0 s | ACCEPTED · CORRECT |
| london1607 | Fast viewer | 8.9 s | +9.3 s | +8.6 s | LATE_SAW_IT |

The slow call satisfied **2.3 < 22.0**. The fast call satisfied **9.3 ≥ 8.6** and was blocked. Cutoffs include the engine's **0.3 s margin**. These are rounded owner-reported display values, not exported raw millisecond logs.

The owner confirmed **round.finalized** and exactly **one summary.sent**, reporting **"1 correct, 0 wrong"**. This was the summary format before the follow-up fix added blocked counts.

Earlier takes also behaved correctly:
- All calls in one take were **STALE_SYNC** because calibrations were older than **10 minutes**.
- A round with calls before **LANDED** correctly showed **ACCEPTED**; these are provisional until the event is marked and rechecked.

## Gap test: PENDING

No live gap-test result was supplied. **VOID / ROUND_VOID_GAP** is covered by fake EventSub tests, but is not claimed as owner-verified live evidence. Owner still needs a separate live round with an EventSub interruption.

## Evidence limits

This document records the owner's report. No recording/VOD URL or raw log attachment was supplied. The owner still needs to record or link the demo for submission. D_v includes reaction and chat delivery; it is not pure video lag. See [Gate 0](gate0.md) for calibration samples, measured spread and the laptop's 2.2 s variation limit.
