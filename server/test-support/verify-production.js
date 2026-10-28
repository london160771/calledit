import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {request} from 'node:http';

// Run after a production build. No .env, token or real Twitch session is loaded.
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const env = {...process.env};
for (const key of Object.keys(env)) if (/^(TWITCH_|LIVE_|RENDER|APP_ORIGIN|DASHBOARD_PASSWORD|PORT$)/.test(key)) delete env[key];
env.PORT = String(port); env.APP_ORIGIN = `http://localhost:${port}`;
const child = spawn(process.execPath, ['server/src/index.js'], {env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
let output = '';
child.stdout.on('data', chunk => {output += chunk;});
child.stderr.on('data', chunk => {output += chunk;});
const get = (path, method = 'GET') => new Promise((resolve, reject) => {
  const req = request({hostname: '127.0.0.1', port, path, method, headers: {Host: `localhost:${port}`, Origin: `http://localhost:${port}`, 'Content-Type': 'application/json'}}, res => {
    let body = ''; res.on('data', chunk => {body += chunk;}); res.on('end', () => resolve({status: res.statusCode, body}));
  }); req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 15000);
    child.once('error', error => {clearTimeout(timer); reject(error);});
    child.once('exit', () => {clearTimeout(timer); reject(new Error(output));});
    child.stdout.on('data', () => {if (output.includes('Replay ready.')) {clearTimeout(timer); resolve();}});
  });
  const judge = await get('/judge'); assert.equal(judge.status, 200); assert.match(judge.body, /id="root"/);
  const assets = [...judge.body.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith('.js'))); assert.ok(assets.some(asset => asset.endsWith('.css')));
  for (const path of [...assets, '/dashboard', '/overlay?live=1', '/healthz', '/api/state']) assert.equal((await get(path)).status, 200, path);
  assert.equal(JSON.parse((await get('/api/state')).body).status, 'disconnected');
  assert.equal((await get('/auth/twitch')).status, 503); assert.equal((await get('/api/sync', 'POST')).status, 503);
  console.log('PASS: real replay-only Node startup, built judge/assets/routes, health/state and disabled Twitch controls.');
} finally {
  child.kill();
}
