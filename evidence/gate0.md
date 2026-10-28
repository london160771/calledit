# Gate 0 and Phase 3 live evidence

## Phase 3: PASSED (owner report, 2026-10-28)

Channel: **ayyoweb3**. Real Twitch sync replies were recorded and confirmed by `sync.recorded` logs:

| Viewer | Measured delay | Samples |
|---|---:|---:|
| london1607 | 11337 ms | 3 |
| becca160771 | 11208 ms | 3 |

These are owner-reported live results. They prove calibration through the Twitch pipeline; they are not a measurement of pure video lag because sync delay includes reaction time and chat delivery.

## Gate 0 viewer spread: PASSED (owner report, 2026-10-28)

Live test on **ayyoweb3**, after a fresh server restart, using three syncs in order: **PEACH, PAPAYA, MANGO**, with the **45 s live window**.

| Viewer | Device / demo role | PEACH | PAPAYA | MANGO | D_v (minimum) | Same-viewer variation (max - min) |
|---|---|---:|---:|---:|---:|---:|
| london1607 | iPhone / fast viewer | 12366 ms | 13065 ms | 13325 ms | 12366 ms | 959 ms (0.96 s) |
| becca160771 | Laptop, Low Latency OFF / slow viewer | 20574 ms | 19111 ms | 18374 ms | 18374 ms | 2200 ms (2.2 s) |

Spread: **18374 - 12366 = 6008 ms (6.0 s)**, exceeding the **at least 2 s** target: **PASS**. This supersedes the earlier pending spread: the previous Phase 3 calibration values above differed by only 129 ms.

Honest limit: the laptop's **2.2 s** same-viewer variation exceeds the **1.0 s** target. Human reaction time is the owner's likely explanation, not a verified cause. D_v includes reaction time and chat delivery as well as stream delay; passing the spread check does not establish stable pure video lag.

An unrelated real viewer, **mashaliahbratha**, chatted during the test and was correctly ignored with **NO_ACTIVE_SYNC**, according to the owner report.

Owner-confirmed demo roles follow the measured delays, reversing the original device assumption in PRD §9:
- **iPhone / london1607 = fast viewer**: expected **LATE_SAW_IT** when calling after seeing the result.
- **Laptop / becca160771 = slow viewer**: expected **ACCEPTED** when calling before the result shows there and before the personal cutoff.

These were expected demo verdicts at this sync test, not observed round verdicts from calibration alone. A later Phase 4 live money shot PASSED with sammiedfab slow and london1607 fast; see [money-shot.md](money-shot.md). Recording/link and the separate live gap check remain pending.
