# PROJECT_STATE — CalledIt

## Current phase
- **Phase 0** (owner): manual Gate 0 delay test remains pending.
- **Phase 1** (Codex): complete.
- **Phase 2** (Codex): next, simulated web surfaces and Attack Lab.

## Done
- Docs and .gitignore committed and pushed (1fe9f35).
- Phase 1: npm workspaces; pure dependency-free engine; Seed-7 fixture; prefix replay; baseline comparison; Node 22 CI workflow.
- `npm install`: passed. `npm test`: 19 passed, 0 failed, including 10,000 seeded rounds, exact Seed-7 totals, 2/2/0 comparison and purity check.

## Decisions
- Factory API: `createEngine(config)` returns the PRD methods; queries return copies.
- Sync replies count once per viewer per sync word ID; repeated replies cannot replace a sample.
- Delay is captured at call time, so later syncs cannot change an earlier call's cutoff.
- Only recognized option commands get verdicts; default land/miss are recognized before a round exists.
- A gap during an open round voids it immediately; late gap reports also void overlapping finalized rounds.
- Explicit Void uses ROUND_VOID_GAP, the PRD's only void reason code.

## Pending (owner)
- Enable 2FA, install OBS, create viewer accounts, run Gate 0.
- Write fast-tab vs iPhone delay measurements to `evidence/gate0.md`.

## Log
- 2026-10-24: Phase 1 complete; 19 tests passed, 0 failed. Phase 2 next.

## Phase 2 complete
- React + Vite, plain CSS: /judge, /dashboard, /overlay.
- Seed-7 browser replay and final totals; 2/2/0 comparison; Attack Lab covers every reason code.
- Dashboard simulated Sync/Open/Call/LANDED/MISSED/Void controls; local storage shares its feed with the overlay.
- `npm test`: 23 passed, 0 failed; Vite production build passed.
- Browser checks: Run the demo reached 25/25 with exact totals; all attacks displayed; dashboard Sync/Open/Call/LANDED yielded 2 correct and 2 wrong; overlay displayed those calls and MANGO.
- Desktop and 390px mobile layouts inspected. Overlay HTML/body computed backgrounds both transparent.
- Decision: simulated dashboard uses a deterministic clock and fake sync replies; production live wiring stays in Phase 4.
- Current phase: Phase 3 next. Owner's Phase 0 remains pending.
