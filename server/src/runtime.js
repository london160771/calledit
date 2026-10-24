import { createEngine } from '@calledit/engine';
import { createEventSub } from './eventsub.js';
import { createSummarySender } from './summary.js';
/** Twitch adapter; live round controls are wired in Phase 4. */
export function createRuntime({auth,clock=Date.now,eventSubOptions={},engine=createEngine()}) {
  const users=new Set();let status='disconnected',sync=null;
  const client=createEventSub({engine,clock,...eventSubOptions,
    subscribe:async sessionId=>{const {userId}=auth.getIdentity();await auth.helix('eventsub/subscriptions',{type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:userId,user_id:userId},transport:{method:'websocket',session_id:sessionId}});},
    onStatus:next=>{status=next;},onMessage:input=>users.add(input.userId)
  });
  const sendSummary=createSummarySender({clock,send:async message=>{const {userId}=auth.getIdentity();const response=await auth.helix('chat/messages',{broadcaster_id:userId,sender_id:userId,message});if(!response.data?.[0]?.is_sent)throw new Error('Twitch did not send the summary.');}});
  return {
    engine,sendSummary,
    async start(){await auth.validate();client.stop();status='connecting';client.start();},
    stop(){engine.reportGap({from:clock(),to:clock()});client.stop();status='disconnected';},
    startSync(){if(status!=='connected')throw new Error('Connect to Twitch before syncing.');const shownAt=clock();sync={syncId:`sync-${shownAt}`,word:['MANGO','PAPAYA','PEACH'][Math.floor(shownAt/1000)%3],shownAt};engine.startSync(sync);return {...sync};},
    snapshot(){return {status,account:auth.getIdentity()?.login??null,sync,viewers:[...users].map(id=>engine.getViewer(id)).filter(Boolean)};}
  };
}
