import { createTwitchAuth } from './auth.js';
import { createRuntime } from './runtime.js';
import { createApp } from './app.js';
import { readLiveConfig } from './live-config.js';
import { readServerConfig } from './server-config.js';
const settings = readServerConfig(process.env);
const auth = createTwitchAuth({clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET, redirectUri: settings.redirectUri, accessToken: process.env.TWITCH_ACCESS_TOKEN, refreshToken: process.env.TWITCH_REFRESH_TOKEN});
const runtime = createRuntime({auth, config: readLiveConfig(process.env)});
const app = createApp({auth, runtime, ...settings});
const server = app.listen(settings.port, settings.host, () => {
  console.log(`CalledIt: ${settings.origin}/judge`);
  console.log(settings.twitchEnabled ? `Live controls: ${settings.origin}/dashboard?liveSync=1` : 'Replay ready. Set both Twitch client values to enable live controls.');
});
if (settings.twitchEnabled && process.env.TWITCH_ACCESS_TOKEN) runtime.start().catch(() => console.error('Connect with Twitch from the dashboard.'));
const validation = setInterval(() => {if (auth.getIdentity()) auth.validate().catch(() => {runtime.stop(); auth.clear(); console.error('Twitch session ended. Connect again.');});}, 3600000);
function stop() {clearInterval(validation); runtime.stop(); server.close();}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
