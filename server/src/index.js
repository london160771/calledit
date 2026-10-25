import { createTwitchAuth } from './auth.js';
import { createRuntime } from './runtime.js';
import { createApp } from './app.js';
import { readLiveConfig } from './live-config.js';
const {TWITCH_CLIENT_ID:clientId,TWITCH_CLIENT_SECRET:clientSecret}=process.env;
if(!clientId||!clientSecret){console.error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env. See .env.example.');process.exitCode=1;}
else {
  const redirectUri=process.env.TWITCH_REDIRECT_URI??'http://localhost:3000/auth/callback';
  const url=new URL(redirectUri);
  if(url.hostname!=='localhost'||url.protocol!=='http:')throw new Error('Phase 3 uses http://localhost for the local sync check.');
  const auth=createTwitchAuth({clientId,clientSecret,redirectUri,accessToken:process.env.TWITCH_ACCESS_TOKEN,refreshToken:process.env.TWITCH_REFRESH_TOKEN});
  const runtime=createRuntime({auth,config:readLiveConfig(process.env)});
  const app=createApp({auth,runtime,origin:url.origin});
  const server=app.listen(Number(url.port)||80,'127.0.0.1',()=>console.log(`CalledIt: ${url.origin}/dashboard?liveSync=1`));
  if(process.env.TWITCH_ACCESS_TOKEN)runtime.start().catch(()=>console.error('Connect with Twitch from the local dashboard.'));
  const validation=setInterval(()=>{if(auth.getIdentity())auth.validate().catch(()=>{runtime.stop();auth.clear();console.error('Twitch session ended. Connect again.');});},3600000);
  function stop(){clearInterval(validation);runtime.stop();server.close();}
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
