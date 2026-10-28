import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createApp} from '../src/app.js';
import {liveSession, flush} from '../test-support/live-session.js';

async function localApi(t, f) {
  const app = createApp({auth: f.auth, runtime: f.runtime});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  return (path, body, origin = 'http://localhost:3000') => new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port: server.address().port, path, method: body === undefined ? 'GET' : 'POST', headers: {Host: 'localhost:3000', Origin: origin, 'Content-Type': 'application/json'}}, res => {
      let data = '';res.on('data', chunk => {data += chunk;});res.on('end', () => {try {resolve({status: res.statusCode, body: JSON.parse(data)});} catch (error) {reject(error);}});
    });req.on('error', reject);req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test('full live round: server controls, provisional recheck, fast late / slow accepted, automatic final and exactly one Helix summary', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());const api = await localApi(t, f);
  await f.calibrate();await f.advance(110000);
  const opened = await api('/api/round/open', {openedAt: 0, options: ['fake', 'choice']});assert.equal(opened.status, 200);
  const id = opened.body.roundId;assert.equal(opened.body.openedAt, 110000);assert.deepEqual(opened.body.options, ['land', 'miss']);
  assert.equal((await api('/api/round/open', {})).status, 409);
  await f.advance(119500);f.chat('early', '!miss', 'early-call');
  assert.equal(f.runtime.snapshot().verdicts[0].code, 'ACCEPTED');assert.equal('result' in f.runtime.snapshot().verdicts[0], false);
  await f.advance(120000);const marked = await api('/api/round/event', {roundId: id, outcome: 'land', pressedAt: 1});
  assert.equal(marked.status, 200);assert.equal(marked.body.eventAt, 120000);assert.equal(f.runtime.snapshot().round.finalizeAt, 165000);
  assert.equal(f.runtime.snapshot().verdicts[0].result, 'WRONG');assert.equal(f.summaries().length, 0);
  await f.advance(123000);f.chat('fast', '!land', 'fast-call');
  await f.advance(126000);f.chat('slow', ' !land ', 'slow-call');f.chat('slow', ' !land ', 'slow-call');
  await f.advance(127000);f.chat('slow', '!miss', 'duplicate-choice');
  const state = (await api('/api/state')).body;
  assert.deepEqual(state.verdicts.map(v => v.code), ['ACCEPTED', 'LATE_SAW_IT', 'ACCEPTED', 'DUPLICATE_CALL']);
  assert.deepEqual(state.verdicts[1], {messageId: 'fast-call', userLogin: 'fast', roundId: id, code: 'LATE_SAW_IT', retryable: false, nextAction: 'Call before you see the result.', numbers: {receivedAt: 123000, eventAt: 120000, dViewer: 2000, marginMs: 300, cutoff: 121700}});
  assert.deepEqual(state.verdicts[2].numbers, {receivedAt: 126000, eventAt: 120000, dViewer: 8000, marginMs: 300, cutoff: 127700});assert.equal(state.verdicts[2].result, 'CORRECT');
  assert.equal(state.calls.length, 4);
  // No browser request is needed to finalize or send the summary.
  await f.advance(164999);assert.equal(f.runtime.snapshot().round.status, 'OPEN');assert.equal(f.summaries().length, 0);
  await f.advance(165000);await flush();assert.equal(f.runtime.snapshot().round.status, 'FINALIZED');assert.equal(f.runtime.snapshot().summary.status, 'sent');
  assert.equal(f.summaries().length, 1);assert.match(f.summaries()[0].body.message, /1 correct, 1 wrong/);
  assert.equal(f.summaries()[0].body.broadcaster_id, 'owner');assert.equal(f.summaries()[0].body.sender_id, 'owner');
  for (let n = 0; n < 4; n++) await api('/api/state');
  f.chat('fast', '!land', 'after-final');await flush();assert.equal(f.runtime.snapshot().verdicts.at(-1).code, 'ROUND_NOT_OPEN');assert.equal(f.summaries().length, 1);
  assert.equal((await api('/api/round/event', {roundId: id, outcome: 'miss'})).status, 409);
  for (const event of ['round.opened', 'call.received', 'verdict', 'event.marked', 'round.finalized', 'summary.sent']) assert.ok(f.logs.some(row => row.event === event), event);
  assert.equal(f.logs.filter(row => row.event === 'summary.sent').length, 1);
});

test('connection gap after mark voids scored calls, cancels finalization and sends one unscored VOID summary', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());await f.calibrate();await f.advance(110000);
  const round = f.runtime.openRound();await f.advance(119000);f.chat('fast', '!land');f.chat('slow', '!land');
  await f.advance(120000);f.runtime.markEvent({roundId: round.roundId, outcome: 'land'});assert.ok(f.runtime.snapshot().verdicts.every(v => v.result === 'CORRECT'));
  await f.advance(121000);f.disconnect();await flush();
  const state = f.runtime.snapshot();assert.equal(state.round.status, 'VOID');assert.equal(state.round.voidReason, 'CONNECTION_GAP');assert.equal(state.status, 'disconnected');
  assert.ok(state.verdicts.every(v => v.code === 'ROUND_VOID_GAP' && !('result' in v)));assert.equal(f.timers.size, 0);
  assert.equal(f.summaries().length, 1);assert.match(f.summaries()[0].body.message, /VOID/);assert.doesNotMatch(f.summaries()[0].body.message, /correct|wrong/);
  await f.advance(200000);assert.equal(f.summaries().length, 1);assert.equal(f.runtime.snapshot().round.status, 'VOID');
  assert.ok(f.logs.some(row => row.event === 'round.voided' && row.reason === 'CONNECTION_GAP'));
});

test('manual Void endpoint is terminal, preserves one summary and rejects stale controls / foreign writes', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());const api = await localApi(t, f);
  for (const path of ['/api/round/open', '/api/round/event', '/api/round/void']) assert.equal((await api(path, {}, 'https://foreign.example')).status, 403);
  const opened = await api('/api/round/open', {}), id = opened.body.roundId;
  assert.equal((await api('/api/round/event', {roundId: 'old-round', outcome: 'land'})).status, 409);
  assert.equal((await api('/api/round/event', {roundId: id, outcome: 'other'})).status, 409);
  assert.equal((await api('/api/round/void', {roundId: id})).status, 200);await flush();
  assert.equal(f.runtime.snapshot().round.voidReason, 'MANUAL_VOID');assert.equal(f.summaries().length, 1);
  assert.equal((await api('/api/round/void', {roundId: id})).status, 409);assert.equal(f.summaries().length, 1);
  await f.advance(101000);assert.equal((await api('/api/round/open', {})).status, 200);
});

test('late messages cannot sneak into an overdue round when the Node timer callback is delayed', async t => {
  const f = await liveSession();t.after(() => f.runtime.stop());await f.calibrate();await f.advance(110000);
  const round = f.runtime.openRound();await f.advance(120000);f.runtime.markEvent({roundId: round.roundId, outcome: 'miss'});
  await f.advance(165000, false);f.chat('slow', '!miss');await flush();
  assert.equal(f.runtime.snapshot().round.status, 'FINALIZED');assert.equal(f.runtime.snapshot().verdicts[0].code, 'ROUND_NOT_OPEN');assert.equal(f.summaries().length, 1);
});

test('summary failure is logged once, never retried or falsely reported as sent', async t => {
  const f = await liveSession({failSummary: true});t.after(() => f.runtime.stop());const round = f.runtime.openRound();
  await f.advance(101000);f.runtime.markEvent({roundId: round.roundId, outcome: 'miss'});await f.advance(146000);await flush();
  assert.equal(f.runtime.snapshot().summary.status, 'failed');assert.equal(f.logs.filter(row => row.event === 'summary.failed').length, 1);assert.equal(f.logs.some(row => row.event === 'summary.sent'), false);
  f.chat('nobody', '!land');await f.advance(150000);assert.equal(f.summaries().length, 1);
});


test('own broadcaster/bot messages never reach sync or call handling', async t => {
  const f = await liveSession(); t.after(() => f.runtime.stop());
  const sync = f.runtime.startSync(); await f.advance(102000);
  f.chat('owner', sync.word); f.chat('owner', '!land'); f.chat('owner', 'CalledIt round: land. 1 correct, 0 wrong.');
  assert.equal(f.runtime.engine.getViewer('owner'), undefined);
  assert.deepEqual(f.runtime.engine.getVerdicts(), []);
  assert.equal(f.logs.filter(row => row.event === 'chat.ignored' && row.reason === 'OWN_ACCOUNT').length, 3);
  assert.equal(f.logs.some(row => ['sync.rejected', 'sync.recorded', 'call.received', 'verdict'].includes(row.event)), false);
  f.chat('viewer', sync.word); assert.equal(f.runtime.snapshot().viewers[0].userLogin, 'viewer');
});

test('final summary counts direct blocked verdicts and overlay retains the final cards until sync/open', async t => {
  const f = await liveSession(); t.after(() => f.runtime.stop()); await f.calibrate(); await f.advance(110000);
  const round = f.runtime.openRound(); await f.advance(120000); f.runtime.markEvent({roundId: round.roundId, outcome: 'land'});
  await f.advance(123000); f.chat('fast', '!land'); await f.advance(126000); f.chat('slow', '!land');
  await f.advance(165000); await flush();
  assert.equal(f.summaries().length, 1);
  assert.match(f.summaries()[0].body.message, /land\. 1 correct, 0 wrong, 1 blocked \(LATE_SAW_IT\)\./);
  const cards = f.runtime.snapshot().overlayVerdicts;
  f.chat('latecomer', '!land'); assert.deepEqual(f.runtime.snapshot().overlayVerdicts, cards);
  assert.equal(f.runtime.snapshot().verdicts.at(-1).code, 'ROUND_NOT_OPEN');
  f.runtime.startSync(); assert.equal(f.runtime.snapshot().overlayRoundId, null);
  await f.advance(211000); assert.deepEqual(f.runtime.snapshot().overlayVerdicts, []);
  const next = f.runtime.openRound(); assert.equal(f.runtime.snapshot().overlayRoundId, next.roundId); assert.deepEqual(f.runtime.snapshot().overlayVerdicts, []);
});

test('stale sync age is captured at call time separately from the unchanged engine verdict', async t => {
  const f = await liveSession(); t.after(() => f.runtime.stop()); await f.calibrate(); await f.advance(888000);
  f.runtime.openRound(); f.chat('slow', '!land', 'stale-call');
  let state = f.runtime.snapshot(); assert.equal(state.verdicts[0].code, 'STALE_SYNC');
  assert.deepEqual(state.verdictContext['stale-call'], {syncAgeMs: 780000});
  assert.deepEqual(Object.keys(state.verdicts[0]).sort(), ['code', 'messageId', 'nextAction', 'numbers', 'retryable', 'roundId', 'userLogin']);
  const sync = f.runtime.startSync(); await f.advance(889000); f.chat('slow', sync.word);
  state = f.runtime.snapshot(); assert.equal(state.verdictContext['stale-call'].syncAgeMs, 780000);
});
