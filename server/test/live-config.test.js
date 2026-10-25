import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLiveConfig} from '../src/live-config.js';
import {defaults} from '@calledit/engine';

test('live timing defaults to 45000 without changing engine defaults', () => {
  assert.deepEqual(readLiveConfig(), {syncWindowMs:45000, maxDelayMs:45000});
  assert.equal(defaults.syncWindowMs,15000);assert.equal(defaults.maxDelayMs,20000);
});
test('each live timing setting can be overridden independently from environment values', () => {
  assert.deepEqual(readLiveConfig({LIVE_SYNC_WINDOW_MS:'60000',LIVE_MAX_DELAY_MS:'55000'}),{syncWindowMs:60000,maxDelayMs:55000});
  assert.deepEqual(readLiveConfig({LIVE_SYNC_WINDOW_MS:'30000'}),{syncWindowMs:30000,maxDelayMs:45000});
  assert.deepEqual(readLiveConfig({LIVE_SYNC_WINDOW_MS:'',LIVE_MAX_DELAY_MS:' '}),{syncWindowMs:45000,maxDelayMs:45000});
});
test('invalid live timings fail rather than silently fall back', () => {
  for(const name of ['LIVE_SYNC_WINDOW_MS','LIVE_MAX_DELAY_MS'])for(const value of ['0','-1','1.5','nope','Infinity','9007199254740992'])assert.throws(()=>readLiveConfig({[name]:value}),new RegExp(name));
});
