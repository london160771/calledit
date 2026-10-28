/** Live round orchestration. The engine still owns every verdict and cutoff calculation. */
export function createLiveRounds({engine, config, clock, sendSummary, log, setTimer = setTimeout, clearTimer = clearTimeout}) {
  const ids = [], previousStatus = new Map(), previousVerdicts = new Map(), timers = new Map(), summaries = new Map(), voidReasons = new Map();
  const calls = [];
  let currentId, sequence = 0;
  function publishVerdicts() {
    engine.getVerdicts().forEach((verdict, index) => {
      const encoded = JSON.stringify(verdict);
      if (previousVerdicts.get(index) !== encoded) {
        log('verdict', {...verdict, updated: previousVerdicts.has(index)});
        previousVerdicts.set(index, encoded);
      }
    });
  }
  function reconcile(reason = 'CONNECTION_GAP') {
    publishVerdicts();
    for (const roundId of ids) {
      const round = engine.getRound(roundId), prior = previousStatus.get(roundId);
      if (round.status === prior) continue;
      previousStatus.set(roundId, round.status);
      if (!['FINALIZED', 'VOID'].includes(round.status)) continue;
      clearTimer(timers.get(roundId)); timers.delete(roundId);
      if (round.status === 'VOID') {
        voidReasons.set(roundId, reason);
        log('round.voided', {roundId, reason});
      } else log('round.finalized', {roundId, eventAt: round.eventAt, finalizedAt: clock(), dueAt: round.eventAt + config.maxDelayMs});
      if (summaries.has(roundId)) continue;
      summaries.set(roundId, {status: 'pending'});
      void sendSummary(round).then(sent => {
        if (!sent) return;
        summaries.set(roundId, {status: 'sent'});
        log('summary.sent', {roundId, roundStatus: round.status});
      }).catch(error => {
        summaries.set(roundId, {status: 'failed', error: error.message});
        log('summary.failed', {roundId, message: error.message});
      });
    }
  }
  function finalizeDue(now = clock()) {engine.finalizeDue(now); reconcile();}
  function arm(roundId) {
    clearTimer(timers.get(roundId));
    const round = engine.getRound(roundId);
    if (round.status !== 'OPEN' || round.eventAt == null) return;
    const dueAt = round.eventAt + config.maxDelayMs;
    const timer = setTimer(() => {
      timers.delete(roundId);
      finalizeDue();
      if (engine.getRound(roundId).status === 'OPEN') arm(roundId);
    }, Math.min(2147483647, Math.max(0, dueAt - clock())));
    timer?.unref?.(); timers.set(roundId, timer);
  }
  const eventEngine = {...engine,
    handleMessage(input) {
      finalizeDue(input.receivedAt);
      if (['!land', '!miss'].includes(input.text.trim().toLowerCase())) log('call.received', {...input, roundId: currentId ?? null});
      const verdict = engine.handleMessage(input);
      if (verdict) calls.push({messageId: input.messageId, userLogin: input.userLogin, text: input.text, receivedAt: input.receivedAt, roundId: verdict.roundId});
      reconcile(); return verdict;
    },
    reportGap(gap) {engine.reportGap(gap); reconcile('CONNECTION_GAP');}
  };
  function requireOpen(roundId) {
    finalizeDue();
    const round = engine.getRound(roundId);
    if (!round || roundId !== currentId || round.status !== 'OPEN') throw new Error('This round is not open.');
    return round;
  }
  return {
    eventEngine,
    openRound() {
      finalizeDue();
      const openedAt = clock(), roundId = `round-${openedAt}-${++sequence}`;
      engine.openRound({roundId, options: ['land', 'miss'], openedAt});
      currentId = roundId; ids.push(roundId);
      log('round.opened', {roundId, options: ['land', 'miss'], openedAt}); reconcile();
      return engine.getRound(roundId);
    },
    markEvent({roundId, outcome}) {
      const round = requireOpen(roundId);
      if (round.eventAt != null) throw new Error('The event is already marked.');
      const pressedAt = clock();
      engine.markEvent({roundId, outcome, pressedAt});
      log('event.marked', {roundId, outcome, pressedAt, eventAt: engine.getRound(roundId).eventAt});
      reconcile(); arm(roundId); return engine.getRound(roundId);
    },
    voidRound({roundId}) {
      requireOpen(roundId); engine.voidRound({roundId}); reconcile('MANUAL_VOID'); return engine.getRound(roundId);
    },
    stop() {
      const now = clock(); eventEngine.reportGap({from: now, to: now});
      for (const timer of timers.values()) clearTimer(timer);
      timers.clear();
    },
    snapshot(now = clock()) {
      const round = engine.getRound(currentId);
      return {
        round: round ? {...round, finalizeAt: round.eventAt == null ? null : round.eventAt + config.maxDelayMs, remainingMs: round.eventAt == null ? null : Math.max(0, round.eventAt + config.maxDelayMs - now), voidReason: voidReasons.get(currentId) ?? null} : null,
        calls: calls.filter(call => call.roundId === (currentId ?? null)).slice(-20),
        verdicts: engine.getVerdicts().filter(verdict => verdict.roundId === (currentId ?? null)).slice(-20),
        summary: summaries.get(currentId) ?? null
      };
    }
  };
}
