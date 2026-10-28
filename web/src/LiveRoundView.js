import React, {createElement as h} from 'react';

export function roundStage(round) {
  if (!round) return 'Waiting for a round';
  if (round.status === 'VOID') return 'VOID';
  if (round.status === 'FINALIZED') return 'Final';
  return round.eventAt == null ? 'Open' : 'Event marked';
}
const seconds = ms => `${ms < 0 ? '-' : '+'}${(Math.abs(ms) / 1000).toFixed(1)}s`;
/** Human-readable comparisons use engine numbers; exact milliseconds remain in the verdict. */
export function liveReason(verdict) {
  const n = verdict.numbers;
  if (verdict.code === 'ROUND_VOID_GAP') return 'This round is void. No calls count.';
  if (['ACCEPTED', 'LATE_SAW_IT'].includes(verdict.code)) {
    if (n.eventAt == null) return `Call received at ${n.receivedAt} ms. Waiting for the event.`;
    return `Call ${seconds(n.receivedAt - n.eventAt)} ${n.receivedAt < n.cutoff ? '<' : '≥'} cutoff ${seconds(n.cutoff - n.eventAt)} (delay ${(n.dViewer / 1000).toFixed(1)}s − margin ${(n.marginMs / 1000).toFixed(1)}s).`;
  }
  return `${verdict.nextAction} Received ${n.receivedAt} ms.`;
}
export function LiveRoundBanner({round, summary}) {
  return h('section', {className: `live-round-banner ${round?.status === 'VOID' ? 'is-void' : ''}`, 'data-stage': roundStage(round)},
    h('div', null, h('small', null, round?.roundId ?? 'CALLED IT'), h('h2', null, roundStage(round))),
    h('div', {className: 'round-info'},
      round?.outcome && h('strong', null, `Outcome: ${round.outcome.toUpperCase()}`),
      round?.status === 'OPEN' && round.eventAt != null && h('span', null, `Final in ${Math.ceil(round.remainingMs / 1000)}s`),
      round?.status === 'OPEN' && round.eventAt == null && h('span', null, 'Call !land or !miss'),
      round?.status === 'VOID' && h('span', null, round.voidReason === 'MANUAL_VOID' ? 'Voided by the host · no score' : 'Connection gap · no score'),
      summary && h('span', {role: 'status'}, `Chat summary: ${summary.status}`)));
}
export function LiveVerdicts({verdicts = [], compact = false}) {
  const visible = compact ? verdicts.slice(-2) : verdicts;
  return h('div', {className: `live-verdicts ${compact ? 'overlay-verdicts' : ''}`, 'aria-live': 'polite'},
    !visible.length && h('p', {className: 'empty'}, 'Waiting for chat calls.'),
    ...visible.map((verdict, index) => h('article', {key: `${verdict.messageId}-${index}`, className: `live-verdict-card ${verdict.code === 'ACCEPTED' ? 'is-accepted' : 'is-rejected'}`},
      h('div', {className: 'live-verdict-title'}, h('strong', null, `${verdict.code === 'ACCEPTED' ? '✅' : '❌'} @${verdict.userLogin}`), h('b', null, verdict.code)),
      h('p', null, liveReason(verdict)),
      verdict.result && h('span', {className: 'live-result'}, verdict.result),
      !compact && h('details', null, h('summary', null, 'Exact verdict and numbers'), h('pre', null, JSON.stringify(verdict, null, 2))))));
}
export function LiveCallFeed({calls = []}) {
  return h('section', {className: 'live-calls'}, h('h2', null, 'Chat calls'),
    calls.length ? h('ul', null, ...calls.slice(-4).map((call, index) => h('li', {key: `${call.messageId}-${index}`}, h('strong', null, `@${call.userLogin}`), ' ', h('span', null, call.text)))) : h('p', null, 'No calls yet.'));
}
export function LiveRoundControls({state, onAction, busy = false, error = ''}) {
  const round = state?.round, active = round?.status === 'OPEN', canMark = active && round.eventAt == null;
  const disabled = busy || !!error || state?.status !== 'connected';
  return h('section', {className: 'panel live-controls'},
    h('p', {className: 'eyebrow'}, 'ROUND CONTROLS'), h(LiveRoundBanner, {round, summary: state?.summary}),
    h('div', {className: 'controls'},
      h('button', {className: 'primary', disabled: disabled || active, onClick: () => onAction('open')}, 'Open round (land / miss)'),
      h('button', {className: 'primary', disabled: disabled || !canMark, onClick: () => onAction('land')}, 'LANDED'),
      h('button', {disabled: disabled || !canMark, onClick: () => onAction('miss')}, 'MISSED'),
      h('button', {disabled: busy || !!error || !active, onClick: () => onAction('void')}, 'Void')),
    h('p', null, active && round.eventAt != null ? 'Calls still arrive until the round is final. Each viewer has a personal cutoff.' : 'Open a round, let chat call it, then mark what happened.'));
}
