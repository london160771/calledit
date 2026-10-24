import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createEngine, runScenario, seed7, compareBaselines } from '../src/index.js';
const sync = (e, id = 'u', delay = 2000, shownAt = 0, syncId = String(shownAt)) => {
  e.startSync({ syncId, word: 'MANGO', shownAt });
  e.handleMessage({ messageId: `sync-${id}-${syncId}`, userId: id, userLogin: id, text: ' mango ', receivedAt: shownAt + delay });
};
const call = (e, id = 'm', at = 10000, user = 'u', text = '!land') => e.handleMessage({ messageId: id, userId: user, userLogin: user, text, receivedAt: at });
const open = e => e.openRound({ roundId: 'R', openedAt: 5000 });
const mark = (e, pressedAt = 10000) => e.markEvent({ roundId: 'R', outcome: 'land', pressedAt });
test('Seed-7 exact verdicts, numbers, results, totals and void round', () => {
  const r = runScenario();
  assert.deepEqual(r.verdicts.map(v => v.code), ['ROUND_NOT_OPEN','NOT_CALIBRATED','STALE_SYNC','ACCEPTED','ACCEPTED','DUPLICATE_CALL','LATE_SAW_IT','ACCEPTED','REPLAYED_MESSAGE','ROUND_VOID_GAP','ROUND_VOID_GAP']);
  assert.deepEqual(r.totals, { ROUND_NOT_OPEN:1, NOT_CALIBRATED:1, STALE_SYNC:1, ACCEPTED:3, DUPLICATE_CALL:1, LATE_SAW_IT:1, REPLAYED_MESSAGE:1, ROUND_VOID_GAP:2 });
  assert.deepEqual(r.verdicts.filter(v => v.code === 'ACCEPTED').map(v => [v.result, v.numbers.cutoff]), [['CORRECT',742100],['WRONG',745500],['CORRECT',748400]]);
  assert.equal(r.verdicts[6].numbers.cutoff,741700);
  assert.equal(r.engine.getRound('R2').status,'VOID');
  assert.equal(r.engine.getRound('R1').status,'FINALIZED');
});
test('baselines produce 2 / 2 / 0 wrong verdicts', () => assert.deepEqual(compareBaselines(), { 'Lock-at-click':2, 'Lock-at-event':2, CalledIt:0 }));
test('REPLAYED_MESSAGE precedes no round and missing calibration', () => { const e=createEngine(); call(e); assert.equal(call(e).code,'REPLAYED_MESSAGE'); });
test('ROUND_NOT_OPEN before open and after finalization', () => { const e=createEngine(); assert.equal(call(e).code,'ROUND_NOT_OPEN'); open(e); mark(e); e.finalizeDue(30000); assert.equal(call(e,'m2').code,'ROUND_NOT_OPEN'); });
test('NOT_CALIBRATED precedes lateness', () => { const e=createEngine(); open(e); mark(e); assert.equal(call(e,'m',50000).code,'NOT_CALIBRATED'); });
test('STALE_SYNC boundary and priority over duplicate', () => { const e=createEngine(); sync(e); open(e); assert.equal(call(e,'m',602000).code,'ACCEPTED'); assert.equal(call(e,'m2',602001).code,'STALE_SYNC'); });
test('DUPLICATE_CALL precedes late and counts only first choice', () => { const e=createEngine(); sync(e); open(e); call(e); mark(e); assert.equal(call(e,'m2',15000).code,'DUPLICATE_CALL'); assert.equal(e.getRound('R').calls.length,1); });
test('LATE_SAW_IT at equality; before cutoff accepted', () => { const e=createEngine(); sync(e); sync(e,'v'); open(e); mark(e); assert.equal(call(e,'m',11700).code,'LATE_SAW_IT'); assert.equal(call(e,'m2',11699,'v').code,'ACCEPTED'); });
test('ACCEPTED provisional calls are rechecked, results set on mark', () => { const e=createEngine(); sync(e); sync(e,'v'); open(e); call(e,'m',11700); call(e,'m2',10000,'v','!miss'); assert.equal('result' in e.getVerdicts()[0],false); mark(e); assert.equal(e.getVerdicts()[0].code,'LATE_SAW_IT'); assert.equal(e.getVerdicts()[1].result,'WRONG'); });
test('ROUND_VOID_GAP from connection gap; no scores and no new calls', () => { const e=createEngine(); sync(e); open(e); call(e); e.reportGap({from:11000,to:12000}); mark(e); assert.equal(e.getVerdicts()[0].code,'ROUND_VOID_GAP'); assert.equal('result' in e.getVerdicts()[0],false); assert.equal(call(e,'m2').code,'ROUND_NOT_OPEN'); });
test('explicit void removes scores', () => { const e=createEngine(); sync(e); open(e); call(e); mark(e); e.voidRound({roundId:'R'}); assert.equal(e.getVerdicts()[0].code,'ROUND_VOID_GAP'); });
test('gap boundaries inclusive, outside gaps do not void, late gap report voids finalized round', () => {
  for (const [from,to,expected] of [[0,4999,'FINALIZED'],[30001,40000,'FINALIZED'],[0,5000,'VOID'],[30000,40000,'VOID']]) {
    const e=createEngine(); sync(e); open(e); mark(e); e.finalizeDue(30000); e.reportGap({from,to}); assert.equal(e.getRound('R').status,expected);
  }
});
test('sync window, max delay, min of last N, freshness and repeated sync protections', () => {
  const e=createEngine({syncWindowMs:30000,syncSamples:2});
  sync(e,'u',20001); assert.equal(e.getViewer('u'),undefined);
  sync(e,'u',20000,30000); sync(e,'u',1000,60000); sync(e,'u',3000,90000);
  assert.equal(e.getViewer('u').dViewer,1000);
  sync(e,'u',4000,120000); assert.equal(e.getViewer('u').dViewer,3000);
  sync(e,'u',1,120000); assert.equal(e.getViewer('u').dViewer,3000);
  const f=createEngine(); sync(f,'u',15001); assert.equal(f.getViewer('u'),undefined); sync(f,'u',15000,20000); assert.equal(f.getViewer('u').dViewer,15000);
});
test('irrelevant text ignored, no verdict; duplicate sync message cannot calibrate again', () => { const e=createEngine(); assert.equal(call(e,'x',0,'u','hello'),null); sync(e); assert.equal(e.getVerdicts().length,0); });
test('event offset, finalization boundary and captured delay', () => { const e=createEngine({eventOffsetMs:500}); sync(e); open(e); call(e,'m',10000); sync(e,'u',1000,10500); mark(e); assert.equal(e.getVerdicts()[0].numbers.cutoff,11200); e.finalizeDue(29499); assert.equal(e.getRound('R').status,'OPEN'); e.finalizeDue(29500); assert.equal(e.getRound('R').status,'FINALIZED'); });
test('single open round, unique IDs, valid outcome and one event', () => { const e=createEngine(); open(e); assert.throws(()=>e.openRound({roundId:'other',openedAt:6000})); assert.throws(()=>e.markEvent({roundId:'R',outcome:'other',pressedAt:10000})); mark(e); assert.throws(()=>mark(e)); e.finalizeDue(30000); assert.throws(()=>open(e)); });
test('queries and inputs cannot mutate engine state', () => { const e=createEngine(); sync(e); const viewer=e.getViewer('u'); viewer.dViewer=999; assert.equal(e.getViewer('u').dViewer,2000); open(e); call(e); e.getVerdicts()[0].code='bad'; assert.equal(e.getVerdicts()[0].code,'ACCEPTED'); });
test('10,000 seeded rounds: strict invariant, one counted call, every call one verdict, void never scores', () => {
  let seed=7; const rand=n=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed%n; };
  for(let i=0;i<10000;i++) {
    const e=createEngine({marginMs:rand(1000),eventOffsetMs:rand(500)});
    for(let u=0;u<4;u++) sync(e,String(u),rand(15001));
    open(e);
    for(let u=0;u<4;u++) call(e,`a${u}`,rand(20000),String(u));
    mark(e);
    for(let u=0;u<4;u++) call(e,`b${u}`,rand(25000),String(u));
    if(i%7===0) e.reportGap({from:7000,to:8000});
    e.finalizeDue(40000);
    const vs=e.getVerdicts(); assert.equal(vs.length,8);
    for(const v of vs) if(v.code==='ACCEPTED') assert.ok(v.numbers.receivedAt<v.numbers.cutoff);
    const counted=vs.filter(v=>v.code==='ACCEPTED'); assert.equal(new Set(counted.map(v=>v.userLogin)).size,counted.length);
    if(e.getRound('R').status==='VOID') assert.equal(counted.length,0);
  }
});
test('engine src is pure and dependency free', () => {
  for(const file of readdirSync(new URL('../src/',import.meta.url))) {
    const src=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(src,/Date\.now\s*\(|Math\.random\s*\(|node:|from\s+['"](?:https?:|fs|path|net)/);
  }
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')); assert.equal(Object.keys(pkg.dependencies??{}).length,0);
});
