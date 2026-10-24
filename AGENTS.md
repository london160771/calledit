# AGENTS.md — rules for Codex on CalledIt

## Read first
1. `PRD.md`: the only source of truth for requirements and phases (§10).
2. `PROJECT_STATE.md`: what is done and what is next.
3. Inspect the current code and git log before changing anything. Do not rebuild completed phases.

## How to work: phase by phase, continuously
- Work through the phases in PRD §10 **in order**, one at a time, starting from the first unfinished phase in `PROJECT_STATE.md`.
- Phase 0 belongs to the owner. Skip it. For phases marked "Codex, then owner", finish your part, commit, push, then stop and list what the owner must do.
- When a phase meets **all** of its "Done when" checks and `npm test` passes:
  1. Update `PROJECT_STATE.md` (status, what was built, test results).
  2. Commit with a clear message, for example `phase 1: pure engine + tests`.
  3. Push to `origin main`.
  4. Start the next phase right away. Do not wait for approval.
- **Never commit or push a phase that fails its checks or tests.** Fix it first.

## Only stop when
- The owner tells you to stop.
- You need the owner's manual input. Examples: Twitch accounts, a live stream, testing on the iPhone, recording, or a decision the docs don't answer.
- You need values in `.env` such as Twitch Client ID, secret, tokens or a MongoDB URI.
  - Add the variable names to `.env.example` with a one-line explanation each.
  - Then stop and list exactly what the owner must set.

When you stop, say why in one line and list the exact steps the owner must take.

## Hard limits
- **No deployment.** Do not deploy, create hosting services, or run deploy commands. The owner deploys. You may add deploy-ready config files and README deploy steps, but only if the PRD phase asks for them.
- **No scope creep.** Build only what PRD.md describes for the current phase. New ideas go in `ROADMAP.md`, not into code.
- Make the smallest change that meets the phase goal. Keep working code working.
- **Never commit secrets.** `.env` stays gitignored. Keep `.env.example` up to date.
- The engine (`engine/`) must stay pure:
  - no `Date.now()`, no `Math.random()`, no I/O
  - zero dependencies
  - times come in as input, in milliseconds
- Seed-7 numbers in PRD §5 are a contract. If the code disagrees with them, stop and explain the math. Don't change the numbers silently.
- Use plain JavaScript (ESM) with JSDoc. Use plain CSS, not Tailwind. Use simple words in UI text, comments and docs.

## Commands
- Install: `npm install`
- Test everything: `npm test`
- Test the engine only: `npm test -w engine`

## Report after each phase (in the thread)
- Phase finished, and the commit hash
- Files changed
- Commands and tests run, with their actual results (pass/fail counts)
- Any decision you made that the docs didn't cover
- Never claim something works unless a test or check proved it.
