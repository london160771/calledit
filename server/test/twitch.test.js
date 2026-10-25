import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {request} from 'node:http';
import {createEngine} from '@calledit/engine';
import {createEventSub,eventSubUrl} from '../src/eventsub.js';
import {createTwitchAuth,scopes} from '../src/auth.js';
import {createSummarySender} from '../src/summary.js';
import {createRuntime} from '../src/runtime.js';
import {createApp} from '../src/app.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Socket extends EventEmitter{constructor(url){super();this.url=url;}close(){this.closed=true;this.emit('close');}message(type,payload={},extra={}){this.emit('message',JSON.stringify({metadata:{message_type:type,...extra},payload}));}}
function fixture(subscribe=async()=>{}){
 let now=0;const sockets=[],timers=new Set(),statuses=[],messages=[];const engine=createEngine();
 const client=createEventSub({engine,subscribe,clock:()=>now,makeSocket:url=>{const s=new Socket(url);sockets.push(s);return s;},setTimer:(fn,ms)=>{const timer={fn,ms};timers.add(timer);return timer;},clearTimer:id=>timers.delete(id),onStatus:s=>statuses.push(s),onMessage:(input,verdict)=>messages.push({input,verdict})});
 const welcome=(s=sockets.at(-1))=>s.message('session_welcome',{session:{id:'session',keepalive_timeout_seconds:10}});
 return {engine,client,sockets,timers,statuses,messages,welcome,time:value=>{now=value;},fire(ms){const t=[...timers].find(t=>t.ms===ms);assert.ok(t);timers.delete(t);t.fn();}};
}
const notification=(socket,id='m',text='!land')=>socket.message('notification',{event:{message_id:id,chatter_user_id:'u',chatter_user_login:'ada',message:{text}}},{subscription_type:'channel.chat.message'});
function calibrated(e){e.startSync({syncId:'s',word:'MANGO',shownAt:0});e.handleMessage({messageId:'s',userId:'u',userLogin:'ada',text:'MANGO',receivedAt:1000});e.openRound({roundId:'R',openedAt:2000});}
test('welcome subscribes; chat uses server clock and deduplicates actual chat message_id',async()=>{
 const subs=[];const f=fixture(async id=>subs.push(id));f.client.start();f.welcome();await flush();assert.deepEqual(subs,['session']);calibrated(f.engine);f.time(3000);notification(f.sockets[0]);notification(f.sockets[0]);assert.equal(f.engine.getVerdicts().length,1);assert.equal(f.engine.getVerdicts()[0].numbers.receivedAt,3000);assert.equal(f.messages[0].input.userLogin,'ada');f.client.stop();
});
test('real sync text passes to engine and produces personal delay',async()=>{const f=fixture();f.client.start();f.welcome();await flush();f.engine.startSync({syncId:'s',word:'PEACH',shownAt:2000});f.time(4500);notification(f.sockets[0],'sync',' peach ');assert.equal(f.engine.getViewer('u').dViewer,2500);assert.equal(f.engine.getVerdicts().length,0);f.client.stop();});
test('socket close voids current round, reconnect resubscribes and reports whole gap',async()=>{
 const f=fixture();f.client.start();f.welcome();await flush();calibrated(f.engine);f.time(3000);notification(f.sockets[0]);f.time(4000);f.sockets[0].emit('close');assert.equal(f.engine.getRound('R').status,'VOID');assert.equal(f.engine.getVerdicts()[0].code,'ROUND_VOID_GAP');f.fire(1000);f.time(9000);f.welcome();await flush();assert.equal(f.statuses.at(-1),'connected');f.client.stop();
});
test('keepalive timeout voids round; notification and keepalive reset timer',async()=>{
 const f=fixture();f.client.start();f.welcome();await flush();calibrated(f.engine);const prior=[...f.timers][0];f.time(5000);f.sockets[0].message('session_keepalive');assert.equal(f.timers.has(prior),false);f.time(15001);f.fire(10000);assert.equal(f.engine.getRound('R').status,'VOID');f.client.stop();
});
test('session_reconnect keeps old socket until new welcome, preserves subscriptions and has no gap',async()=>{
 let subscriptions=0;const f=fixture(async()=>subscriptions++);f.client.start();f.welcome();await flush();calibrated(f.engine);
 f.sockets[0].message('session_reconnect',{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=abc'}});assert.equal(f.sockets.length,2);assert.equal(f.sockets[0].closed,undefined);f.time(3000);notification(f.sockets[0]);f.welcome(f.sockets[1]);await flush();assert.equal(f.sockets[0].closed,true);assert.equal(subscriptions,1);assert.equal(f.engine.getRound('R').status,'OPEN');assert.equal(f.statuses.includes('disconnected'),false);f.client.stop();
});
test('broken subscription, malformed messages and revocation fail closed without unhandled errors',async()=>{
 const f=fixture(async()=>{throw new Error('subscription failed');});f.client.start();f.welcome();await flush();assert.equal(f.statuses.at(-1),'disconnected');f.client.stop();
 const g=fixture();g.client.start();g.welcome();await flush();calibrated(g.engine);g.time(3000);g.sockets[0].message('revocation');assert.equal(g.engine.getRound('R').status,'VOID');assert.equal(g.statuses.at(-1),'authorization-required');assert.equal(g.timers.size,0);
 const h=fixture();h.client.start();h.sockets[0].emit('message','not JSON');await flush();assert.equal(h.statuses.at(-1),'disconnected');h.client.stop();
});
test('socket errors and missing welcome trigger recovery, stop does not create a gap',async()=>{const f=fixture();f.client.start();f.time(10001);f.fire(10000);assert.equal(f.statuses.at(-1),'disconnected');f.fire(1000);f.sockets.at(-1).emit('error',new Error('offline'));assert.equal(f.statuses.at(-1),'disconnected');f.client.stop();assert.equal(f.timers.size,0);const g=fixture();g.client.start();g.welcome();await flush();calibrated(g.engine);g.client.stop();assert.equal(g.engine.getRound('R').status,'OPEN');});
const json=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const valid={client_id:'client',user_id:'owner',login:'owner-login',scopes};
test('OAuth requests exact scopes, exchanges code and validates broadcaster identity',async()=>{
 const requests=[];const auth=createTwitchAuth({clientId:'client',clientSecret:'secret',redirectUri:'http://localhost:3000/auth/callback',fetchImpl:async(url,opts)=>{requests.push([url,opts]);return url.endsWith('/token')?json({access_token:'access',refresh_token:'refresh'}):json(valid);}});
 const url=new URL(auth.authorizeUrl('state'));assert.equal(url.searchParams.get('scope'),scopes.join(' '));assert.equal(url.searchParams.get('state'),'state');assert.equal(url.searchParams.get('response_type'),'code');
 await auth.exchange('code');assert.equal(requests[0][1].body.get('grant_type'),'authorization_code');assert.deepEqual(auth.getIdentity(),{userId:'owner',login:'owner-login'});assert.equal(JSON.stringify(auth.getIdentity()).includes('access'),false);auth.clear();assert.equal(auth.getIdentity(),null);
});
test('401 refreshes token and retries; missing scopes or wrong client fail validation',async()=>{
 let calls=0;const requests=[];const auth=createTwitchAuth({clientId:'client',clientSecret:'secret',accessToken:'old',refreshToken:'r',fetchImpl:async(url,opts)=>{requests.push([url,opts]);if(url.endsWith('/token'))return json({access_token:'new',refresh_token:'r2'});calls++;return calls===1?json({},401):json(valid);}});
 await auth.validate();assert.equal(requests[2][1].headers.Authorization,'Bearer new');
 for(const data of [{...valid,scopes:[]},{...valid,client_id:'wrong'}]){const bad=createTwitchAuth({clientId:'client',accessToken:'a',fetchImpl:async()=>json(data)});await assert.rejects(()=>bad.validate(),/scopes/);}
});
test('Helix requests use one owner for broadcaster and bot and exact subscription transport',async()=>{
 const calls=[];let now=2000;const sockets=[];
 const auth={validate:async()=>{},getIdentity:()=>({userId:'owner',login:'owner-login'}),helix:async(path,body)=>{calls.push([path,body]);return {data:[{is_sent:true}]};}};
 const runtime=createRuntime({auth,clock:()=>now,eventSubOptions:{makeSocket:url=>{const s=new Socket(url);sockets.push(s);return s;},setTimer:()=>0,clearTimer:()=>{}}});
 await runtime.start();sockets[0].message('session_welcome',{session:{id:'session',keepalive_timeout_seconds:10}});await flush();assert.deepEqual(calls[0],['eventsub/subscriptions',{type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:'owner',user_id:'owner'},transport:{method:'websocket',session_id:'session'}}]);
 const sync=runtime.startSync();assert.equal(sync.shownAt,2000);assert.deepEqual(runtime.snapshot().sync,sync);now=4500;notification(sockets[0],'s',sync.word);assert.equal(runtime.snapshot().viewers[0].dViewer,2500);
 runtime.engine.openRound({roundId:'R',openedAt:5000});runtime.engine.markEvent({roundId:'R',outcome:'land',pressedAt:6000});runtime.engine.finalizeDue(26000);await runtime.sendSummary(runtime.engine.getRound('R'));await runtime.sendSummary(runtime.engine.getRound('R'));assert.equal(calls.length,2);assert.equal(calls[1][1].sender_id,'owner');assert.equal(calls[1][1].broadcaster_id,'owner');runtime.stop();assert.throws(()=>runtime.startSync(),/Connect/);
});
test('summaries serialize at 1600ms spacing, one attempt per round even after send failure',async()=>{
 let now=0;const sent=[];const send=createSummarySender({clock:()=>now,wait:async ms=>{now+=ms;},send:async text=>sent.push([now,text])});
 const round={status:'FINALIZED',calls:[],outcome:'land'};await Promise.all(Array.from({length:22},(_,i)=>send({...round,roundId:String(i)})));assert.ok(sent.every((row,i)=>i===0||row[0]-sent[i-1][0]>=1600));assert.ok(sent.filter(([t])=>t<30000).length<=20);await send({...round,roundId:'1'});assert.equal(sent.length,22);
 let tries=0;const broken=createSummarySender({send:async()=>{tries++;throw new Error('unknown outcome');},wait:async()=>{}});await assert.rejects(()=>broken({...round,roundId:'R'}));assert.equal(await broken({...round,roundId:'R'}),false);assert.equal(tries,1);await assert.rejects(()=>send({...round,status:'OPEN'}));
});
test('void summary never scores calls',async()=>{let message;const send=createSummarySender({send:async text=>{message=text;},wait:async()=>{}});await send({roundId:'R',status:'VOID',calls:[]});assert.match(message,/VOID/);assert.doesNotMatch(message,/correct/);});
test('local auth callback requires matching single-use state cookie; API rejects foreign writes',async t=>{
 let exchanged=0,syncs=0;const auth={authorizeUrl:state=>`https://id.twitch.tv/oauth2/authorize?state=${state}`,exchange:async()=>exchanged++,clear:()=>{}};
 const runtime={start:async()=>{},stop:()=>{},snapshot:()=>({status:'connected',viewers:[]}),startSync:()=>{syncs++;return {word:'MANGO'};}};
 const app=createApp({auth,runtime});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());const url=`http://127.0.0.1:${server.address().port}`;
 const fetch=(url,options={})=>new Promise((resolve,reject)=>{const req=request(url,{method:options.method??'GET',headers:options.headers},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:{get:key=>{const value=res.headers[key.toLowerCase()];return Array.isArray(value)?value.join(';'):value;}},text:async()=>body,json:async()=>JSON.parse(body)}));});req.on('error',reject);req.end(options.body);});
 const headers={Host:'localhost:3000'};
 const start=await fetch(`${url}/auth/twitch`,{headers,redirect:'manual'});assert.equal(start.status,302,await start.text());const state=new URL(start.headers.get('location')).searchParams.get('state');const cookie=start.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(`${url}/auth/callback?state=${state}&code=c`,{headers,redirect:'manual'})).status,400);
 const again=await fetch(`${url}/auth/twitch`,{headers,redirect:'manual'});const s2=new URL(again.headers.get('location')).searchParams.get('state');const c2=again.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(`${url}/auth/callback?state=${s2}&code=c`,{headers:{...headers,Cookie:c2},redirect:'manual'})).status,302);assert.equal(exchanged,1);
 assert.equal((await fetch(`${url}/auth/callback?state=${s2}&code=c`,{headers:{...headers,Cookie:c2}})).status,400);
 assert.equal((await fetch(`${url}/api/sync`,{method:'POST',headers:{...headers,Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(`${url}/api/sync`,{method:'POST',headers:{...headers,Origin:'http://localhost:3000','Content-Type':'application/json'},body:'{}'})).status,200);assert.equal(syncs,1);
 assert.equal((await fetch(`${url}/api/state`)).status,403);
 assert.deepEqual(await(await fetch(`${url}/api/state`,{headers})).json(),{status:'connected',viewers:[]});
});
