import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isLiveOverlay, watchLiveState} from '../src/live-state.js';
import {LiveSyncOverlay} from '../src/LiveOverlay.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
const render = (state, error) => renderToStaticMarkup(createElement(LiveSyncOverlay, {state, error}));

test('only the documented explicit overlay URL selects live mode', () => {
  assert.equal(isLiveOverlay(new URL('http://localhost:3000/overlay?live=1')), true);
  for (const path of ['/overlay', '/judge?live=1', '/dashboard?liveSync=1', '/overlay?live=0']) {
    assert.equal(isLiveOverlay(new URL(path, 'http://localhost:3000')), false);
  }
});

test('overlay follows server syncs across browsers and preserves server shownAt', async () => {
  let state = {status: 'connected', account: 'owner', sync: null};
  let next, options, calls = 0, html;
  const stop = watchLiveState({
    fetchImpl: async (url, init) => {assert.equal(url, '/api/state'); options = init; calls++; return {ok: true, json: async () => structuredClone(state)};},
    onState: value => { html = render(value); }, onError: error => assert.fail(error),
    setTimer: (fn, ms) => {assert.equal(ms, 100); next = fn; return fn;}, clearTimer: () => {}
  });
  await flush();
  assert.match(html, /LIVE \(Twitch\)/);
  assert.match(html, /Waiting for a live sync/);
  // A different browser posts Sync; OBS only reads the resulting server state.
  state.sync = {syncId: 'sync-123000', word: 'MANGO', shownAt: 123000};
  await next();
  assert.match(html, /SAY: MANGO/);
  assert.match(html, /data-shown-at="123000"/);
  assert.doesNotMatch(html, /SIMULATED FEED|Waiting for a round/);
  state.sync = {syncId: 'sync-129000', word: 'PAPAYA', shownAt: 129000};
  await next();
  assert.match(html, /SAY: PAPAYA/);
  assert.doesNotMatch(html, /SAY: MANGO/);
  assert.equal(calls, 3);
  assert.equal(options.cache, 'no-store');
  stop();
  assert.equal(options.signal.aborted, true);
});

test('live overlay hides stale sync on disconnect or request failure and recovers', async () => {
  const sync = {syncId: 's', word: 'MANGO', shownAt: 123000};
  assert.doesNotMatch(render({status: 'disconnected', sync}), /SAY:/);
  assert.doesNotMatch(render({status: 'connected', sync}, 'Live server unavailable.'), /SAY:/);
  let fail = true, next, html;
  const stop = watchLiveState({fetchImpl: async () => {if (fail) throw new Error('offline'); return {ok: true, json: async () => ({status: 'connected', sync})};},
    onState: value => {html = render(value);}, onError: error => {html = render(null, error);},
    setTimer: fn => {next = fn;}, clearTimer: () => {}});
  await flush();
  assert.match(html, /Reconnecting/);
  fail = false;
  await next();
  assert.match(html, /SAY: MANGO/);
  stop();
});

test('unmounted overlay ignores in-flight responses and stops polling', async () => {
  let finish, updates = 0, timers = 0;
  const stop = watchLiveState({fetchImpl: () => new Promise(resolve => {finish = resolve;}),
    onState: () => updates++, onError: () => updates++, setTimer: () => timers++, clearTimer: () => {}});
  stop();
  finish({ok: true, json: async () => ({status: 'connected'})});
  await flush();
  assert.equal(updates, 0);
  assert.equal(timers, 0);
});
