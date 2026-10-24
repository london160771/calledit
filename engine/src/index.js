export const defaults = Object.freeze({ marginMs: 300, syncWindowMs: 15000, syncFreshMs: 600000, syncSamples: 3, maxDelayMs: 20000, eventOffsetMs: 0 });
const copy = value => structuredClone(value);
const hints = {
  REPLAYED_MESSAGE: [false, 'Send a new message.'], ROUND_NOT_OPEN: [true, 'Wait for a round.'],
  NOT_CALIBRATED: [true, 'Reply to the sync word.'], STALE_SYNC: [true, 'Sync again.'],
  DUPLICATE_CALL: [false, 'Wait for the next round.'], LATE_SAW_IT: [false, 'Call before you see the result.'],
  ACCEPTED: [false, 'Wait for the result.'], ROUND_VOID_GAP: [false, 'This round does not count.']
};

/** Create an isolated deterministic engine. All timestamps are supplied in milliseconds. */
export function createEngine(config = {}) {
  const cfg = { ...defaults, ...config };
  for (const [key, value] of Object.entries(cfg)) {
    if (!Number.isFinite(value) || value < 0 || (key === 'syncSamples' && (!Number.isInteger(value) || value < 1))) throw new Error(`Invalid ${key}`);
  }
  const viewers = new Map(), rounds = new Map(), seen = new Set(), verdicts = [], gaps = [];
  let sync, current;
  function change(verdict, code) {
    verdict.code = code;
    [verdict.retryable, verdict.nextAction] = hints[code];
    if (code !== 'ACCEPTED') delete verdict.result;
  }
  function overlaps(round, gap) { return gap.to >= round.openedAt && gap.from <= (round.eventAt == null ? Infinity : round.eventAt + cfg.maxDelayMs); }
  function makeVoid(round) {
    round.status = 'VOID';
    for (const call of round.calls) if (call.verdict.code === 'ACCEPTED') change(call.verdict, 'ROUND_VOID_GAP');
  }
  function judge(call, round) {
    Object.assign(call.verdict.numbers, { eventAt: round.eventAt, cutoff: round.eventAt + call.verdict.numbers.dViewer - cfg.marginMs });
    if (call.verdict.code !== 'ACCEPTED') return;
    if (call.verdict.numbers.receivedAt >= call.verdict.numbers.cutoff) change(call.verdict, 'LATE_SAW_IT');
    else call.verdict.result = call.option === round.outcome ? 'CORRECT' : 'WRONG';
  }
  const api = {
    startSync(input) { sync = copy(input); },
    handleMessage(message) {
      const { messageId, userId, userLogin, receivedAt } = message;
      const text = message.text.trim().toLowerCase();
      const round = rounds.get(current);
      // Only option commands are calls; sync replies and other chat have no verdict.
      const option = text.startsWith('!') ? text.slice(1) : null;
      const isCall = option && (round?.options ?? ['land', 'miss']).includes(option);
      if (!isCall) {
        if (!seen.has(messageId) && sync && text === sync.word.trim().toLowerCase()) {
          const delay = receivedAt - sync.shownAt;
          if (delay >= 0 && delay <= cfg.syncWindowMs && delay <= cfg.maxDelayMs) {
            const viewer = viewers.get(userId) ?? { userId, userLogin, samples: [] };
            if (!viewer.samples.some(sample => sample.syncId === sync.syncId)) {
              viewer.samples.push({ syncId: sync.syncId, delay, receivedAt });
              viewer.samples = viewer.samples.slice(-cfg.syncSamples);
              viewer.dViewer = Math.min(...viewer.samples.map(sample => sample.delay));
              viewer.latestSyncAt = receivedAt;
              viewer.userLogin = userLogin;
              viewers.set(userId, viewer);
            }
          }
        }
        seen.add(messageId);
        return null;
      }
      const viewer = viewers.get(userId);
      const numbers = { receivedAt, eventAt: round?.eventAt ?? null, dViewer: viewer?.dViewer ?? null, marginMs: cfg.marginMs, cutoff: round?.eventAt != null && viewer ? round.eventAt + viewer.dViewer - cfg.marginMs : null };
      let code = 'ACCEPTED';
      if (seen.has(messageId)) code = 'REPLAYED_MESSAGE';
      else if (!round || round.status !== 'OPEN') code = 'ROUND_NOT_OPEN';
      else if (!viewer) code = 'NOT_CALIBRATED';
      else if (receivedAt - viewer.latestSyncAt > cfg.syncFreshMs) code = 'STALE_SYNC';
      else if (round.calls.some(call => call.userId === userId && ['ACCEPTED', 'ROUND_VOID_GAP'].includes(call.verdict.code))) code = 'DUPLICATE_CALL';
      else if (round.eventAt != null && receivedAt >= numbers.cutoff) code = 'LATE_SAW_IT';
      const verdict = { messageId, userLogin, roundId: round?.roundId ?? null, code, numbers };
      change(verdict, code);
      seen.add(messageId);
      verdicts.push(verdict);
      if (code === 'ACCEPTED') {
        const call = { userId, option, verdict };
        round.calls.push(call);
        if (round.eventAt != null) judge(call, round);
      }
      return copy(verdict);
    },
    openRound({ roundId, options = ['land', 'miss'], openedAt }) {
      if (rounds.get(current)?.status === 'OPEN') throw new Error('A round is already open.');
      if (rounds.has(roundId)) throw new Error('Round ID already used.');
      if (options.length !== 2 || new Set(options).size !== 2 || options.some(option => !/^[a-z]+$/.test(option))) throw new Error('Use two different lowercase options.');
      current = roundId;
      const round = { roundId, options: copy(options), openedAt, eventAt: null, status: 'OPEN', calls: [] };
      rounds.set(roundId, round);
      if (gaps.some(gap => overlaps(round, gap))) makeVoid(round);
    },
    markEvent({ roundId, outcome, pressedAt }) {
      const round = rounds.get(roundId);
      if (!round || round.status === 'FINALIZED' || round.eventAt != null || !round.options.includes(outcome)) throw new Error('Invalid event.');
      round.eventAt = pressedAt - cfg.eventOffsetMs;
      round.outcome = outcome;
      for (const call of round.calls) judge(call, round);
      if (gaps.some(gap => overlaps(round, gap))) makeVoid(round);
    },
    reportGap(gap) {
      if (gap.to < gap.from) throw new Error('Invalid gap.');
      gaps.push(copy(gap));
      for (const round of rounds.values()) if (overlaps(round, gap)) makeVoid(round);
    },
    finalizeDue(now) {
      for (const round of rounds.values()) if (round.eventAt != null && now >= round.eventAt + cfg.maxDelayMs && round.status === 'OPEN') round.status = 'FINALIZED';
    },
    voidRound({ roundId }) { const round = rounds.get(roundId); if (!round) throw new Error('Unknown round.'); makeVoid(round); },
    getRound(roundId) { return copy(rounds.get(roundId)); },
    getVerdicts() { return copy(verdicts); },
    getViewer(userId) { return copy(viewers.get(userId)); }
  };
  return api;
}

export { seed7, runScenario, compareBaselines, countWrongVerdicts } from './scenario.js';
