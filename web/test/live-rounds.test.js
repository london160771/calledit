import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LiveSyncOverlay} from '../src/LiveOverlay.js';
import {LiveRoundControls, LiveVerdicts, roundStage, liveReason} from '../src/LiveRoundView.js';
import {liveSession, flush} from '../../server/test-support/live-session.js';
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test('live overlay renders real engine late/accepted verdicts, call feed, mark and final states', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());await f.calibrate();await f.advance(110000);
  const round = f.runtime.openRound();assert.equal(roundStage(round), 'Open');
  assert.match(render(LiveSyncOverlay, {state: f.runtime.snapshot()}), /Call !land or !miss/);
  await f.advance(120000);f.runtime.markEvent({roundId: round.roundId, outcome: 'land'});
  await f.advance(123000);f.chat('fast', '!land');await f.advance(126000);f.chat('slow', '!land');
  const state = f.runtime.snapshot(), html = render(LiveSyncOverlay, {state});
  assert.match(html, /Event marked/);assert.match(html, /Final in 39s/);assert.match(html, /❌ @fast/);assert.match(html, /✅ @slow/);
  assert.match(html, /LATE_SAW_IT/);assert.match(html, /ACCEPTED/);assert.match(html, /Call \+3\.0s ≥ cutoff \+1\.7s/);assert.match(html, /Call \+6\.0s &lt; cutoff \+7\.7s/);
  assert.match(html, /Chat calls/);assert.match(html, /CORRECT/);assert.doesNotMatch(html, /SAY:|SIMULATED FEED/);
  const exact = render(LiveVerdicts, {verdicts: state.verdicts});assert.match(exact, /121700/);assert.match(exact, /127700/);assert.match(exact, /marginMs/);
  await f.advance(165000);await flush();assert.match(render(LiveSyncOverlay, {state: f.runtime.snapshot()}), /data-stage="Final"/);
});

test('gap VOID stays visible on the overlay while Twitch is disconnected and no scored result remains', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());await f.calibrate();await f.advance(110000);
  f.runtime.openRound();f.chat('fast', '!land');f.chat('slow', '!miss');await f.advance(111000);f.disconnect();await flush();
  const html = render(LiveSyncOverlay, {state: f.runtime.snapshot()});
  assert.match(html, /Twitch: disconnected/);assert.match(html, /data-stage="VOID"/);assert.match(html, /ROUND_VOID_GAP/);assert.match(html, /Connection gap · no score/);assert.doesNotMatch(html, /CORRECT|WRONG/);
});

test('controls disable unsafe actions for waiting, marked, final, disconnected and pending requests', () => {
  const check = (state, expected, busy = false) => {
    const html = render(LiveRoundControls, {state, busy, onAction: () => {}});
    const buttons = [...html.matchAll(/<button([^>]*)>([^<]+)<\/button>/g)];
    assert.equal(buttons.length, 4);assert.deepEqual(buttons.map(match => /disabled/.test(match[1])), expected);
  };
  check({status: 'connected', round: null}, [false, true, true, true]);
  check({status: 'connected', round: {status: 'OPEN', eventAt: null}}, [true, false, false, false]);
  check({status: 'connected', round: {status: 'OPEN', eventAt: 120000, remainingMs: 45000}}, [true, true, true, false]);
  check({status: 'connected', round: {status: 'FINALIZED', eventAt: 120000}}, [false, true, true, true]);
  check({status: 'disconnected', round: null}, [true, true, true, true]);
  check({status: 'connected', round: {status: 'OPEN', eventAt: null}}, [true, true, true, true], true);
});

test('provisional and other rejection cards explain state without inventing event/cutoff numbers', () => {
  const pending = {code: 'ACCEPTED', numbers: {receivedAt: 119000, eventAt: null}};
  assert.match(liveReason(pending), /Waiting for the event/);
  assert.match(liveReason({code: 'NOT_CALIBRATED', numbers: {receivedAt: 1000}, nextAction: 'Reply to the sync word.'}), /1000 ms/);
  assert.equal(roundStage({status: 'VOID'}), 'VOID');assert.equal(roundStage(null), 'Waiting for a round');
});
