import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isLiveOverlay, watchLiveState, liveConnectionLabel} from '../src/live-state.js';
import {LiveSyncOverlay} from '../src/LiveOverlay.js';
import {LiveSyncWord} from '../src/LiveSyncWord.js';
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
    setTimer: (fn, ms) => {if(ms !== 5000) {assert.equal(ms, 100); next = fn;} return fn;}, clearTimer: () => {}
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
  // Completed requests do not need abort; cleanup cancels future polling.
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
    onState: () => updates++, onError: () => updates++, setTimer: (fn, ms) => {if(ms !== 5000)timers++;}, clearTimer: () => {}});
  stop();
  finish({ok: true, json: async () => ({status: 'connected'})});
  await flush();
  assert.equal(updates, 0);
  assert.equal(timers, 0);
});

test('browser retries use capped backoff and never turn transport errors into Twitch disconnected', async () => {
  const delays=[],errors=[];let next,fail=true,lastState;
  const stop=watchLiveState({documentRef:null,windowRef:null,fetchImpl:async()=>{if(fail)throw new Error('offline');return {ok:true,json:async()=>({status:'connected'})};},
    onState:s=>{lastState=s;},onError:e=>errors.push(e),setTimer:(fn,ms)=>{if(ms!==5000){delays.push(ms);next=fn;}},clearTimer:()=>{}});
  await flush();for(let i=0;i<6;i++)await next();
  assert.deepEqual(delays,[500,1000,2000,4000,8000,10000,10000]);
  assert.ok(errors.every(e=>e==='Reconnecting to CalledIt server…'));
  assert.equal(liveConnectionLabel({status:'connected'},errors[0]),'Reconnecting to CalledIt server…');
  fail=false;await next();assert.equal(lastState.status,'connected');assert.equal(delays.at(-1),100);
  assert.equal(liveConnectionLabel(lastState),'Twitch: connected');
  assert.equal(liveConnectionLabel({status:'disconnected'}),'Twitch: disconnected');stop();
});

test('visibility and online events immediately refetch state and ignore old requests', async () => {
  const doc=new EventTarget(),win=new EventTarget();doc.hidden=true;
  let pending,requests=0,updates=[],next;
  const stop=watchLiveState({documentRef:doc,windowRef:win,fetchImpl:async()=>{requests++;if(requests===1)return new Promise(resolve=>{pending=resolve;});return {ok:true,json:async()=>({status:'connected',version:requests})};},
    onState:s=>updates.push(s),onError:()=>assert.fail('old request should be ignored'),setTimer:(fn,ms)=>{if(ms!==5000)next=fn;},clearTimer:()=>{}});
  doc.dispatchEvent(new Event('visibilitychange'));assert.equal(requests,1);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(requests,2);assert.equal(updates[0].version,2);
  pending({ok:true,json:async()=>({status:'disconnected',version:1})});await flush();assert.equal(updates.length,1);
  win.dispatchEvent(new Event('online'));await flush();assert.equal(requests,3);
  stop();doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('online'));await flush();assert.equal(requests,3);
});

test('expired sync word is hidden without claiming Twitch is down', () => {
  const html=render({status:'connected',syncActive:false,sync:{word:'MANGO',shownAt:123000}});
  assert.match(html,/Sync window ended/);assert.doesNotMatch(html,/SAY:|disconnected/);
});

test('a stalled browser request times out and retries with backoff', async () => {
  let timeout,next,error;
  const stop=watchLiveState({documentRef:null,windowRef:null,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),
    onState:()=>assert.fail('no response'),onError:e=>{error=e;},setTimer:(fn,ms)=>{if(ms===5000)timeout=fn;else next=fn;},clearTimer:()=>{}});
  timeout();await flush();assert.equal(error,'Reconnecting to CalledIt server…');assert.equal(typeof next,'function');stop();
});

test('both live surfaces share a visible countdown for the full configured window', () => {
  const sync={syncId:'live',word:'MANGO',shownAt:123000,expiresAt:168000,syncWindowMs:45000,maxDelayMs:45000};
  for(const [remainingMs,seconds] of [[45000,45],[27500,28],[1000,1],[0,0]]) {
    const state={status:'connected',syncActive:true,sync,syncRemainingMs:remainingMs};
    const overlay=render(state);
    const dashboardWord=renderToStaticMarkup(createElement(LiveSyncWord,{sync,remainingMs}));
    for(const html of [overlay,dashboardWord]){assert.match(html,/SAY: MANGO/);assert.match(html,new RegExp(`${seconds} seconds left`));assert.match(html,/role="timer"/);}
  }
  assert.doesNotMatch(render({status:'connected',syncActive:false,sync,syncRemainingMs:0}),/SAY:/);
});
