/** One attempt per round, including ambiguous network failures. Serial spacing respects chat limits. */
export function createSummarySender({send,clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  const attempted=new Set();let queue=Promise.resolve(),lastAt=-Infinity;
  return function sendSummary(round, verdicts = round?.calls.map(call => call.verdict) ?? []) {
    if(!round||!['FINALIZED','VOID'].includes(round.status))return Promise.reject(new Error('Round is not finished.'));
    if(attempted.has(round.roundId))return Promise.resolve(false);
    attempted.add(round.roundId);
    const correct=round.calls.filter(c=>c.verdict.code==='ACCEPTED'&&c.verdict.result==='CORRECT').length;
    const wrong=round.calls.filter(c=>c.verdict.code==='ACCEPTED'&&c.verdict.result==='WRONG').length;
    const blocked = verdicts.filter(verdict => verdict.code !== 'ACCEPTED');
    const codes = [...new Set(blocked.map(verdict => verdict.code))].join(', ');
    const blockedText = `, ${blocked.length} blocked${codes ? ` (${codes})` : ''}`;
    const message=round.status==='VOID'?`CalledIt ${round.roundId}: VOID. This round does not count.`:`CalledIt ${round.roundId}: ${round.outcome}. ${correct} correct, ${wrong} wrong${blockedText}.`;
    const task=queue.then(async()=>{await wait(Math.max(0,lastAt+1600-clock()));lastAt=clock();await send(message);return true;});
    queue=task.catch(()=>{});return task;
  };
}
