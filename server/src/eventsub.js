import WebSocket from 'ws';
export const eventSubUrl='wss://eventsub.wss.twitch.tv/ws';
/** Inject sockets and time for tests. A reconnect handoff keeps the old socket until welcome. */
export function createEventSub({engine,subscribe,clock=Date.now,makeSocket=url=>new WebSocket(url),setTimer=setTimeout,clearTimer=clearTimeout,onStatus=()=>{},onMessage=()=>{}}) {
  let active,candidate,retry,gapFrom=null,stopped=true;
  const sockets=new Set(),seen=new Set();
  function gap(from){gapFrom=gapFrom==null?from:Math.min(gapFrom,from);engine.reportGap({from:gapFrom,to:clock()});onStatus('disconnected');}
  function close(ctx){ctx.retired=true;clearTimer(ctx.timer);ctx.ws.close();sockets.delete(ctx);}
  function scheduleRetry(){if(!stopped&&!retry)retry=setTimer(()=>{retry=null;connect(eventSubUrl,false);},1000);}
  function lost(ctx){
    if(ctx.retired||stopped)return;
    gap(active?.lastAt??ctx.lastAt);
    close(ctx);
    if(active===ctx)active=null;
    if(candidate===ctx)candidate=null;
    if(!active&&!candidate)scheduleRetry();
  }
  function arm(ctx){clearTimer(ctx.timer);ctx.timer=setTimer(()=>lost(ctx),ctx.timeout);}
  function connect(url,handoff){
    const ctx={ws:makeSocket(url),lastAt:clock(),timeout:10000,retired:false,handoff};
    sockets.add(ctx);candidate=ctx;arm(ctx);
    ctx.ws.on('message',raw=>{void receive(ctx,raw).catch(()=>lost(ctx));});
    ctx.ws.on('close',()=>lost(ctx));
    ctx.ws.on('error',()=>lost(ctx));
  }
  async function receive(ctx,raw){
    if(ctx.retired||stopped)return;
    const message=JSON.parse(String(raw)),type=message.metadata?.message_type;
    if(type==='session_welcome') {
      const session=message.payload.session;
      ctx.lastAt=clock();ctx.timeout=(session.keepalive_timeout_seconds??10)*1000;arm(ctx);
      if(!ctx.handoff)await subscribe(session.id);
      if(ctx.retired||stopped)return;
      const old=active;active=ctx;candidate=null;
      if(old&&old!==ctx)close(old);
      if(gapFrom!=null){engine.reportGap({from:gapFrom,to:clock()});gapFrom=null;}
      onStatus('connected');return;
    }
    if(type==='notification'||type==='session_keepalive'){ctx.lastAt=clock();arm(ctx);}
    if(type==='session_reconnect') {
      const url=new URL(message.payload.session.reconnect_url);
      if(url.protocol!=='wss:'||url.hostname!=='eventsub.wss.twitch.tv')throw new Error('Invalid reconnect URL.');
      if(!candidate)connect(url.href,true);
    } else if(type==='notification' && (message.metadata.subscription_type??message.payload.subscription?.type)==='channel.chat.message') {
      const e=message.payload.event;
      if(seen.has(e.message_id))return;
      seen.add(e.message_id);
      const input={messageId:e.message_id,userId:e.chatter_user_id,userLogin:e.chatter_user_login,text:e.message.text,receivedAt:clock()};
      const verdict=engine.handleMessage(input);onMessage(input,verdict);
    } else if(type==='revocation') {
      gap(ctx.lastAt);stop();onStatus('authorization-required');
    }
  }
  function stop(){stopped=true;clearTimer(retry);retry=null;for(const ctx of sockets)close(ctx);active=null;candidate=null;}
  return {start(){if(!stopped)return;stopped=false;connect(eventSubUrl,false);},stop};
}
