import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {readServerConfig} from '../src/server-config.js';
import {createApp} from '../src/app.js';

async function api(t, options = {}) {
  const runtime = {snapshot: () => ({status: 'disconnected', viewers: []}), startSync: () => ({word: 'MANGO'}), openRound: () => ({roundId: 'round'})};
  const auth = {authorizeUrl: state => `https://id.twitch.tv/oauth2/authorize?state=${state}`};
  const server = createApp({auth, runtime, origin: 'https://calledit.example', ...options}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  return (path, {method = 'GET', host = 'calledit.example', origin = 'https://calledit.example', authorization} = {}) => new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port: server.address().port, path, method, headers: {Host: host, Origin: origin, 'Content-Type': 'application/json', ...(authorization ? {Authorization: authorization} : {})}}, res => {
      let body = ''; res.on('data', chunk => {body += chunk;}); res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body}));
    }); req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
  });
}

test('server config runs locally without Twitch and uses Render origin, port and bind address', () => {
  assert.deepEqual(readServerConfig({}), {origin: 'http://localhost:3000', redirectUri: 'http://localhost:3000/auth/callback', port: 3000, host: '127.0.0.1', twitchEnabled: false, dashboardPassword: ''});
  const hosted = readServerConfig({RENDER: 'true', RENDER_EXTERNAL_URL: 'https://calledit.example', PORT: '10000'});
  assert.equal(hosted.host, '0.0.0.0'); assert.equal(hosted.port, 10000); assert.equal(hosted.redirectUri, 'https://calledit.example/auth/callback'); assert.equal(hosted.twitchEnabled, false);
  assert.equal(readServerConfig({TWITCH_REDIRECT_URI: 'http://localhost:3100/auth/callback'}).port, 3100);
});

test('hosted live setup requires HTTPS, matching callback, complete credentials and owner password', () => {
  for (const env of [{APP_ORIGIN: 'http://public.example'}, {APP_ORIGIN: 'https://public.example/path'}, {APP_ORIGIN: 'https://public.example', TWITCH_REDIRECT_URI: 'http://localhost:3000/auth/callback'}, {TWITCH_CLIENT_ID: 'client'}, {PORT: 'bad'}, {APP_ORIGIN: 'https://public.example', TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret'}]) assert.throws(() => readServerConfig(env));
  const result = readServerConfig({APP_ORIGIN: 'https://public.example', TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret', DASHBOARD_PASSWORD: 'fake-password'});
  assert.equal(result.twitchEnabled, true); assert.equal(result.host, '0.0.0.0');
});

test('replay-only server exposes health/state and declines unconfigured Twitch without any API calls', async t => {
  const get = await api(t, {twitchEnabled: false});
  assert.equal((await get('/healthz')).status, 200); assert.equal((await get('/api/state')).status, 200);
  assert.equal((await get('/auth/twitch')).status, 503); assert.equal((await get('/api/sync', {method: 'POST'})).status, 503);
  assert.equal((await get('/healthz', {host: 'foreign.example'})).status, 403);
});

test('hosted OBS reads stay public; all OAuth and live writes require owner credentials and same origin', async t => {
  const get = await api(t, {dashboardPassword: 'fake-password'});
  const authorization = `Basic ${Buffer.from('owner:fake-password').toString('base64')}`;
  assert.equal((await get('/api/state')).status, 200); assert.equal((await get('/healthz')).status, 200);
  for (const path of ['/auth/twitch', '/AUTH/twitch', '/auth/callback', '/dashboard?liveSync=1', '/dashboard/?liveSync=1']) assert.equal((await get(path)).status, 401);
  for (const path of ['/api/sync', '/API/sync', '/api/round/open', '/API/ROUND/OPEN', '/api/round/event', '/api/round/void']) assert.equal((await get(path, {method: 'POST'})).status, 401);
  assert.equal((await get('/api/sync', {method: 'POST', authorization: 'Basic invalid'})).status, 401);
  assert.equal((await get('/api/sync', {method: 'POST', authorization})).status, 200);
  assert.equal((await get('/api/sync', {method: 'POST', authorization, origin: 'https://foreign.example'})).status, 403);
  const auth = await get('/auth/twitch', {authorization}); assert.equal(auth.status, 302); assert.match(auth.headers['set-cookie'][0], /Secure/);
});
