import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {request} from 'node:http';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRuntime} from '../../server/src/runtime.js';
import {createApp} from '../../server/src/app.js';
import {ViewerDelays} from '../src/ViewerDelays.js';
import {createEngine} from '@calledit/engine';
import {readLiveConfig} from '../../server/src/live-config.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Socket extends EventEmitter {close(){this.emit('close',1000,Buffer.from('test close'));}}
async function fixture(subscriptionStatus='enabled', config) {
  let now=123000;const sockets=[],logs=[];
  const auth={validate:async()=>{},getIdentity:()=>({userId:'owner-id',login:'ayyoweb3'}),helix:async(path,body)=>({data:[{id:'0b7f3361-672b-4d39-b307-dd5b576c9b27',status:subscriptionStatus,type:'channel.chat.message',version:'1',condition:body.condition,transport:body.transport,cost:0,created_at:'2026-10-25T21:00:00Z'}]})};
  const runtime=createRuntime({auth,config,clock:()=>now,log:(event,details)=>logs.push({event,...details}),eventSubOptions:{makeSocket:()=>{const socket=new Socket();sockets.push(socket);return socket;},setTimer:()=>0,clearTimer:()=>{}}});
  await runtime.start();
  sockets[0].emit('message',JSON.stringify({metadata:{message_id:'welcome-id',message_type:'session_welcome',message_timestamp:'2026-10-25T21:00:00Z'},payload:{session:{id:'session-id',status:'connected',connected_at:'2026-10-25T21:00:00Z',keepalive_timeout_seconds:10,reconnect_url:null}}}));
  await flush();
  function chat(user,text,id) {
    // Full channel.chat.message envelope and fields, including text fragments.
    sockets[0].emit('message',JSON.stringify({metadata:{message_id:`notification-${id}`,message_type:'notification',message_timestamp:'2026-10-25T21:00:02.123456789Z',subscription_type:'channel.chat.message',subscription_version:'1'},payload:{
      subscription:{id:'0b7f3361-672b-4d39-b307-dd5b576c9b27',status:'enabled',type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:'owner-id',user_id:'owner-id'},transport:{method:'websocket',session_id:'session-id'},created_at:'2026-10-25T21:00:00Z',cost:0},
      event:{broadcaster_user_id:'owner-id',broadcaster_user_login:'ayyoweb3',broadcaster_user_name:'Ayyoweb3',chatter_user_id:`id-${user}`,chatter_user_login:user,chatter_user_name:user,message_id:id,message:{text,fragments:[{type:'text',text,cheermote:null,emote:null,mention:null}]},color:'#00FF00',badges:[],message_type:'text',cheer:null,reply:null,channel_points_custom_reward_id:null,source_broadcaster_user_id:null,source_broadcaster_user_login:null,source_broadcaster_user_name:null,source_message_id:null,source_badges:null,is_source_only:false}
    }}));
  }
  return {runtime,auth,logs,chat,time:value=>{now=value;}};
}

test('real-shaped EventSub sync replies reach /api/state and rows in the actual dashboard table without a browser',async t=>{
  const f=await fixture();t.after(()=>f.runtime.stop());
  const app=createApp({auth:f.auth,runtime:f.runtime});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
  const send=(path,method='GET')=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'localhost:3000',Origin:'http://localhost:3000','Content-Type':'application/json'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(body)});}catch(error){reject(error);}});});req.on('error',reject);req.end(method==='POST'?'{}':undefined);
  });
  const first=await send('/api/sync','POST');assert.equal(first.status,200);assert.equal(first.body.word,'MANGO');
  // No browser polling or UI callbacks run while Node processes these notifications.
  f.time(125000);f.chat('london1607','  mango  ','chat-1');
  f.time(126000);f.chat('becca160771','MaNgO','chat-2');
  f.time(127000);const second=await send('/api/sync','POST');assert.equal(second.body.word,'PAPAYA');
  f.time(129000);f.chat('london1607',' PAPAYA ','chat-3');
  f.time(130000);f.chat('becca160771','papaya','chat-4');
  const response=await send('/api/state');assert.equal(response.body.status,'connected');assert.equal(response.body.subscription.status,'enabled');
  assert.deepEqual(response.body.viewers.map(v=>[v.userLogin,v.dViewer,v.samples.length]),[['london1607',2000,2],['becca160771',3000,2]]);
  const html=renderToStaticMarkup(createElement(ViewerDelays,{viewers:response.body.viewers}));
  assert.match(html,/<td>london1607<\/td><td>2000 ms<\/td>/);assert.match(html,/<td>becca160771<\/td><td>3000 ms<\/td>/);assert.doesNotMatch(html,/Waiting for sync replies/);
  assert.equal(f.logs.filter(row=>row.event==='chat.received').length,4);assert.equal(f.logs.filter(row=>row.event==='sync.recorded').length,4);
  assert.ok(f.logs.some(row=>row.event==='subscription.created'&&row.subscription.status==='enabled'));
});

test('sync diagnostic reasons explain no active word, mismatch, duplicate, wrong sync and expired timing',async t=>{
  const f=await fixture();t.after(()=>f.runtime.stop());
  f.chat('london1607','MANGO','no-sync');
  f.runtime.startSync();
  f.time(124000);f.chat('london1607','PAPAYA','wrong-word');
  f.time(125000);f.chat('london1607','MANGO','first');
  f.chat('london1607','MANGO','first');
  f.chat('london1607','MANGO','duplicate');
  f.time(169001);f.chat('becca160771','MANGO','expired');
  assert.equal(f.runtime.snapshot().syncActive,false);
  f.time(171000);const next=f.runtime.startSync();assert.equal(next.word,'MANGO');
  f.time(172000);f.chat('london1607','MANGO','new-sync');
  assert.equal(f.runtime.snapshot().viewers[0].samples.length,2);
  assert.deepEqual(f.logs.filter(row=>row.event==='sync.rejected').map(row=>row.reason),['NO_ACTIVE_SYNC','WORD_MISMATCH','REPLAYED_MESSAGE','ALREADY_SAMPLED_THIS_SYNC','SYNC_WINDOW_EXPIRED']);
  assert.equal(f.runtime.snapshot().viewers.some(v=>v.userLogin==='becca160771'),false);
  assert.equal(f.runtime.snapshot().status,'connected');
});

test('a non-enabled chat subscription fails closed and is logged, not reported as connected',async t=>{
  const f=await fixture('authorization_revoked');t.after(()=>f.runtime.stop());
  assert.equal(f.runtime.snapshot().status,'disconnected');assert.throws(()=>f.runtime.startSync(),/Connect/);
  assert.ok(f.logs.some(row=>row.event==='subscription.failed'));
});

test('a real-shaped reply at 17.5 seconds is recorded live but rejected by engine defaults', async t => {
  const f=await fixture();t.after(()=>f.runtime.stop());
  const sync=f.runtime.startSync();
  assert.equal(sync.syncWindowMs,45000);assert.equal(sync.maxDelayMs,45000);assert.equal(sync.expiresAt,sync.shownAt+45000);
  f.time(sync.shownAt+17500);f.chat('london1607',sync.word,'late-for-old-window');
  assert.equal(f.runtime.snapshot().viewers[0].dViewer,17500);
  assert.equal(f.runtime.snapshot().syncActive,true);assert.equal(f.runtime.snapshot().syncRemainingMs,27500);
  const engine=createEngine();engine.startSync(sync);
  engine.handleMessage({messageId:'same-delay',userId:'viewer',userLogin:'london1607',text:sync.word,receivedAt:sync.shownAt+17500});
  assert.equal(engine.getViewer('viewer'),undefined);
  f.time(sync.shownAt+35000);f.chat('becca160771',sync.word,'above-old-cap');
  assert.equal(f.runtime.snapshot().viewers[1].dViewer,35000);
  f.time(sync.shownAt+45000);f.chat('boundary',sync.word,'boundary');
  assert.equal(f.runtime.snapshot().viewers[2].dViewer,45000);
  f.time(sync.shownAt+45001);f.chat('expired',sync.word,'outside-live-window');
  assert.equal(f.runtime.snapshot().viewers.length,3);assert.equal(f.runtime.snapshot().syncActive,false);assert.equal(f.runtime.snapshot().syncRemainingMs,0);
  const started=f.logs.find(row=>row.event==='sync.started');assert.equal(started.syncWindowMs,45000);assert.equal(started.maxDelayMs,45000);
  const rejected=f.logs.find(row=>row.event==='sync.rejected');assert.equal(rejected.reason,'SYNC_WINDOW_EXPIRED');assert.equal(rejected.syncWindowMs,45000);assert.equal(rejected.maxDelayMs,45000);assert.match(rejected.reasonText,/45000/);
});

test('live environment overrides reach the engine, expiry, countdown and rejection diagnostics', async t => {
  const config=readLiveConfig({LIVE_SYNC_WINDOW_MS:'60000',LIVE_MAX_DELAY_MS:'30000'});
  const f=await fixture('enabled',config);t.after(()=>f.runtime.stop());
  const sync=f.runtime.startSync();assert.equal(sync.expiresAt,sync.shownAt+60000);
  f.time(sync.shownAt+25000);f.chat('london1607',sync.word,'allowed');assert.equal(f.runtime.snapshot().viewers[0].dViewer,25000);
  f.time(sync.shownAt+35000);f.chat('becca160771',sync.word,'over-custom-cap');
  assert.equal(f.runtime.snapshot().viewers.length,1);assert.equal(f.runtime.snapshot().syncActive,true);assert.equal(f.runtime.snapshot().syncRemainingMs,25000);
  const rejection=f.logs.find(row=>row.event==='sync.rejected');assert.equal(rejection.reason,'MAX_DELAY_EXCEEDED');assert.equal(rejection.syncWindowMs,60000);assert.equal(rejection.maxDelayMs,30000);assert.match(rejection.reasonText,/30000/);
  f.chat('becca160771',sync.word,'over-custom-cap');
  const replay=f.logs.filter(row=>row.event==='sync.rejected').at(-1);assert.equal(replay.reason,'REPLAYED_MESSAGE');assert.equal(replay.syncWindowMs,60000);
});
