import { createEngine } from './index.js';
const msg = (at, user, text, id) => ({ type: 'handleMessage', input: { receivedAt: at, userId: user, userLogin: user, text, messageId: id } });
export const seed7 = {
  trueLag: { ada: 1500, ben: 5000, cy: 8000, eve: 1800 },
  comparisonIds: ['m4', 'm5', 'm7', 'm8'], lockAt: 745000,
  steps: [
    { type: 'startSync', input: { syncId: 'S0', word: 'PAPAYA', shownAt: 0 } }, msg(3000, 'fay', 'PAPAYA', 's0-fay'),
    { type: 'startSync', input: { syncId: 'S1', word: 'MANGO', shownAt: 700000 } },
    msg(702000, 'ada', 'MANGO', 's1-ada'), msg(702400, 'eve', 'MANGO', 's1-eve'), msg(705800, 'ben', 'MANGO', 's1-ben'), msg(708700, 'cy', 'MANGO', 's1-cy'),
    msg(715000, 'ada', '!miss', 'm1'),
    { type: 'openRound', input: { roundId: 'R1', options: ['land', 'miss'], openedAt: 720000 } },
    msg(738000, 'dee', '!land', 'm2'), msg(739000, 'fay', '!land', 'm3'), msg(739500, 'eve', '!land', 'm4'),
    { type: 'markEvent', input: { roundId: 'R1', outcome: 'land', pressedAt: 740000 } },
    msg(741000, 'ben', '!miss', 'm5'), msg(742000, 'ben', '!land', 'm6'), msg(743100, 'ada', '!land', 'm7'), msg(746000, 'cy', '!land', 'm8'), msg(746000, 'cy', '!land', 'm8'),
    { type: 'finalizeDue', input: 760000 },
    { type: 'openRound', input: { roundId: 'R2', options: ['land', 'miss'], openedAt: 780000 } },
    msg(785000, 'eve', '!land', 'm9'), msg(786000, 'cy', '!miss', 'm10'),
    { type: 'reportGap', input: { from: 787000, to: 790000 } },
    { type: 'markEvent', input: { roundId: 'R2', outcome: 'miss', pressedAt: 795000 } }, { type: 'finalizeDue', input: 815000 }
  ]
};

/** Replay any prefix to support a browser playback without clocks in the engine. */
export function runScenario(scenario = seed7, stepCount = scenario.steps.length) {
  const engine = createEngine(scenario.config);
  for (const step of scenario.steps.slice(0, stepCount)) engine[step.type](step.input);
  const verdicts = engine.getVerdicts();
  const totals = {};
  for (const verdict of verdicts) totals[verdict.code] = (totals[verdict.code] ?? 0) + 1;
  return { engine, verdicts, totals };
}

/** Count admission decisions that disagree with true viewer lag. */
export function countWrongVerdicts(calls, accepts, eventAt, trueLag) {
  return calls.filter(call => accepts(call) !== (call.numbers.receivedAt < eventAt + trueLag[call.userLogin])).length;
}
export function compareBaselines(replay = runScenario(), scenario = seed7) {
  const calls = scenario.comparisonIds.map(id => replay.verdicts.find(verdict => verdict.messageId === id));
  const eventAt = replay.engine.getRound('R1').eventAt;
  return {
    'Lock-at-click': countWrongVerdicts(calls, call => call.numbers.receivedAt < scenario.lockAt, eventAt, scenario.trueLag),
    'Lock-at-event': countWrongVerdicts(calls, call => call.numbers.receivedAt < eventAt, eventAt, scenario.trueLag),
    CalledIt: countWrongVerdicts(calls, call => call.code === 'ACCEPTED', eventAt, scenario.trueLag)
  };
}
