import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayView,simulationView,simulationCommand,attackCodes,runAttack} from '../src/model.js';
import {seed7,runScenario} from '@calledit/engine';
test('browser replay uses exact Seed-7 totals and baseline comparison',()=>{const state=replayView(seed7.steps.length);assert.deepEqual(state.totals,runScenario().totals);assert.deepEqual(Object.values(state.comparison),[2,2,0]);assert.equal(state.viewers.length,5);});
test('all attack buttons produce their named real engine reason',()=>{for(const code of attackCodes){const verdicts=runAttack(code);assert.ok(verdicts.length);assert.ok(verdicts.every(v=>v.code===code));}});
test('dashboard simulated flow syncs viewers, scores and opens next round',()=>{let steps=[];for(const command of ['sync','open','call','land'])steps=simulationCommand(steps,command);const s=simulationView(steps);assert.equal(s.viewers.length,4);assert.equal(s.round.status,'FINALIZED');assert.equal(s.verdicts.filter(v=>v.result==='CORRECT').length,2);assert.equal(s.verdicts.filter(v=>v.result==='WRONG').length,2);steps=simulationCommand(steps,'open');steps=simulationCommand(steps,'call');steps=simulationCommand(steps,'void');assert.equal(simulationView(steps).round.status,'VOID');});
test('every replay prefix can render and shows no final comparison early',()=>{for(let n=0;n<seed7.steps.length;n++){assert.equal(replayView(n).comparison,null);}});
