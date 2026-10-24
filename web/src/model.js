import { runScenario, seed7, compareBaselines } from '@calledit/engine';
export const attackCodes = ['REPLAYED_MESSAGE','ROUND_NOT_OPEN','NOT_CALIBRATED','STALE_SYNC','DUPLICATE_CALL','LATE_SAW_IT','ACCEPTED','ROUND_VOID_GAP'];
export function runAttack(code) {
  if (!attackCodes.includes(code)) throw new Error('Unknown attack.');
  return runScenario().verdicts.filter(verdict => verdict.code === code);
}
export function replayView(count = 0) {
  const replay = runScenario(seed7, count);
  const viewers = ['ada','ben','cy','eve','fay'].map(id => replay.engine.getViewer(id)).filter(Boolean);
  return { verdicts: replay.verdicts, totals: replay.totals, viewers, comparison: count === seed7.steps.length ? compareBaselines(replay) : null, round: replay.engine.getRound('R2') ?? replay.engine.getRound('R1'), sync: seed7.steps.slice(0,count).filter(step => step.type === 'startSync').at(-1)?.input };
}
/** Simulated dashboard commands are recorded and replayed through the same engine. */
export function simulationView(steps) {
  const {engine,verdicts,totals}=runScenario({steps});
  const roundId=steps.filter(step=>step.type==='openRound').at(-1)?.input.roundId;
  return {verdicts,totals,round:engine.getRound(roundId),viewers:['ada','ben','cy','eve'].map(id=>engine.getViewer(id)).filter(Boolean),sync:steps.filter(step=>step.type==='startSync').at(-1)?.input};
}
export function simulationCommand(steps, command) {
  const next=structuredClone(steps);
  const state=simulationView(steps);
  const lastTime=steps.reduce((max,step)=>Math.max(max,typeof step.input==='number'?step.input:step.input.receivedAt??step.input.pressedAt??step.input.openedAt??step.input.shownAt??0),700000);
  const now=lastTime+1000;
  if(command==='sync') {
    next.push({type:'startSync',input:{syncId:`S${now}`,word:'MANGO',shownAt:now}});
    for(const [user,delay] of Object.entries({ada:2000,eve:2400,ben:5800,cy:8700})) next.push({type:'handleMessage',input:{messageId:`s-${now}-${user}`,userId:user,userLogin:user,text:'MANGO',receivedAt:now+delay}});
  } else if(command==='open') next.push({type:'openRound',input:{roundId:`R${now}`,openedAt:now}});
  else if(command==='land'||command==='miss') { next.push({type:'markEvent',input:{roundId:state.round.roundId,outcome:command,pressedAt:now}}); next.push({type:'finalizeDue',input:now+20000}); }
  else if(command==='void') next.push({type:'voidRound',input:{roundId:state.round.roundId}});
  else if(command==='call') {
    for(const [index,user] of ['eve','ben','ada','cy'].entries()) next.push({type:'handleMessage',input:{messageId:`m-${now}-${user}`,userId:user,userLogin:user,text:index%2?'!miss':'!land',receivedAt:now+index*100}});
  } else throw new Error('Unknown command.');
  simulationView(next);
  return next;
}
export function reason(verdict) {
  const n=verdict.numbers;
  if(verdict.code==='ACCEPTED' && n.cutoff == null) return 'Call received. Waiting for the event to set your cutoff.';
  if(verdict.code==='ACCEPTED'||verdict.code==='LATE_SAW_IT') return `Received ${n.receivedAt} ms ${n.receivedAt<n.cutoff?'<':'≥'} cutoff ${n.cutoff??'pending'} ms · delay ${n.dViewer} − margin ${n.marginMs} ms`;
  return verdict.nextAction;
}

