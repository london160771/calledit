import express from 'express';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
/** Local live controls. OAuth credentials never cross into the web app. */
export function createApp({auth,runtime,origin='http://localhost:3000',clock=Date.now,twitchEnabled=true,dashboardPassword=''}) {
  const app=express(),pending=new Map(),expected=new URL(origin);
  app.disable('x-powered-by');
  app.use((req,res,next)=>{if(req.headers.host!==expected.host)return res.status(403).json({error:'Use the configured address.'});res.set('Cache-Control','no-store');next();});
  // Public OBS/state reads remain open. Only the owner can authorize Twitch or write live state.
  app.use((req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const control = path.startsWith('/auth/') || (path.startsWith('/api/') && req.method !== 'GET') || (path === '/dashboard' && 'liveSync' in req.query);
    if (!twitchEnabled && (path.startsWith('/auth/') || (path.startsWith('/api/') && req.method !== 'GET'))) return res.status(503).json({error: 'Twitch is not configured. The simulated judge is available at /judge.'});
    if (!dashboardPassword || !control) return next();
    const supplied = Buffer.from((req.headers.authorization ?? '').startsWith('Basic ') ? req.headers.authorization.slice(6) : '', 'base64').toString('utf8');
    const hash = value => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(hash(supplied), hash(`owner:${dashboardPassword}`))) {
      res.set('WWW-Authenticate', 'Basic realm="CalledIt owner", charset="UTF-8"');
      return res.status(401).send('Sign in as owner to control the live session.');
    }
    next();
  });
  app.get('/healthz', (req, res) => res.json({ok: true}));
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
    if(req.headers.origin!==origin||!req.is('application/json'))return res.status(403).json({error:'Open the dashboard to sync.'});
    try{res.json(runtime.startSync());}catch(error){res.status(409).json({error:error.message});}
  });
  for (const [path, action] of [['/api/round/open', () => runtime.openRound()], ['/api/round/event', body => runtime.markEvent(body)], ['/api/round/void', body => runtime.voidRound(body)]]) {
    app.post(path, (req, res) => {
      if (req.headers.origin !== origin || !req.is('application/json')) return res.status(403).json({error: 'Open the dashboard to control rounds.'});
      try {res.json(action(req.body ?? {}));} catch (error) {res.status(409).json({error: error.message});}
    });
  }
  const dist=fileURLToPath(new URL('../../web/dist/',import.meta.url));
  app.use(express.static(dist));
  app.get(['/','/judge','/dashboard','/overlay'],(req,res)=>res.sendFile('index.html', {root: dist}));
  app.use((error,req,res,next)=>res.status(400).json({error:'Invalid request.'}));
  return app;
}
