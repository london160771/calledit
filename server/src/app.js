import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
/** Loopback-only Phase 3 sync check. Tokens never cross into the web app. */
export function createApp({auth,runtime,origin='http://localhost:3000',clock=Date.now}) {
  const app=express(),pending=new Map(),expected=new URL(origin);
  app.disable('x-powered-by');
  app.use((req,res,next)=>{if(req.headers.host!==expected.host)return res.status(403).json({error:'Use the configured local address.'});res.set('Cache-Control','no-store');next();});
  app.use(express.json({limit:'4kb'}));
  app.get('/auth/twitch',(req,res)=>{
    const state=randomBytes(32).toString('hex');
    for(const [key,value] of pending)if(value<clock())pending.delete(key);
    pending.set(state,clock()+600000);
    res.cookie('calledit_oauth',state,{httpOnly:true,sameSite:'lax',secure:expected.protocol==='https:',maxAge:600000,path:'/auth'});
    res.redirect(auth.authorizeUrl(state));
  });
  app.get('/auth/callback',async(req,res)=>{
    const state=typeof req.query.state==='string'?req.query.state:'';
    const cookie=(req.headers.cookie??'').split('; ').find(part=>part.startsWith('calledit_oauth='))?.slice('calledit_oauth='.length)??'';
    const expires=pending.get(state);pending.delete(state);res.clearCookie('calledit_oauth',{path:'/auth'});
    if(!expires||expires<clock()||cookie.length!==state.length||!timingSafeEqual(Buffer.from(cookie),Buffer.from(state))||typeof req.query.code!=='string')return res.status(400).send('Authorization was not completed. Connect again.');
    try{runtime.stop();await auth.exchange(req.query.code);await runtime.start();res.redirect('/dashboard?liveSync=1');}catch{auth.clear();runtime.stop();res.status(502).send('Twitch authorization failed. Connect again.');}
  });
  app.get('/api/state',(req,res)=>res.json(runtime.snapshot()));
  app.post('/api/sync',(req,res)=>{
    if(req.headers.origin!==origin||!req.is('application/json'))return res.status(403).json({error:'Open the local dashboard to sync.'});
    try{res.json(runtime.startSync());}catch(error){res.status(409).json({error:error.message});}
  });
  const dist=fileURLToPath(new URL('../../web/dist/',import.meta.url));
  app.use(express.static(dist));
  app.get(['/','/judge','/dashboard','/overlay'],(req,res)=>res.sendFile(`${dist}/index.html`));
  app.use((error,req,res,next)=>res.status(400).json({error:'Invalid request.'}));
  return app;
}
