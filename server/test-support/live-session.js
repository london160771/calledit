import {EventEmitter} from 'node:events';
import {createRuntime} from '../src/runtime.js';
export const flush = () => new Promise(resolve => setImmediate(resolve));
class Socket extends EventEmitter {close() {this.emit('close', 1000, Buffer.from('test close'));}}

/** Real-shaped chat envelopes, fake server clock, and independently controlled Node timers. */
export async function liveSession({config, failSummary = false} = {}) {
  let now = 100000, messageNumber = 0;
  const sockets = [], logs = [], apiCalls = [], timers = new Set(), eventTimers = new Set();
  const auth = {validate: async () => {}, getIdentity: () => ({userId: 'owner', login: 'ayyoweb3'}), helix: async (path, body) => {
    apiCalls.push({path, body: structuredClone(body)});
    if (path === 'eventsub/subscriptions') return {data: [{id: 'subscription-id', status: 'enabled', type: body.type, version: '1', condition: body.condition, transport: body.transport, cost: 0}]};
    if (failSummary) throw new Error('Fake Helix send failure.');
    return {data: [{message_id: 'summary-id', is_sent: true, drop_reason: null}]};
  }};
  const runtime = createRuntime({auth, config, clock: () => now, log: (event, details) => logs.push({event, ...details}),
    setTimer: (fn, ms) => {const timer = {fn, at: now + ms}; timers.add(timer); return timer;}, clearTimer: timer => timers.delete(timer), summaryOptions: {wait: async () => {}},
    eventSubOptions: {makeSocket: () => {const socket = new Socket(); sockets.push(socket); return socket;}, setTimer: (fn, ms) => {const timer = {fn, ms}; eventTimers.add(timer); return timer;}, clearTimer: timer => eventTimers.delete(timer)}
  });
  function welcome(socket = sockets.at(-1)) {
    socket.emit('message', JSON.stringify({metadata: {message_id: 'welcome-id', message_type: 'session_welcome', message_timestamp: '2026-10-28T12:00:00Z'}, payload: {session: {id: 'session-id', status: 'connected', connected_at: '2026-10-28T12:00:00Z', keepalive_timeout_seconds: 10, reconnect_url: null}}}));
  }
  await runtime.start(); welcome(); await flush();
  function chat(user, text, messageId = `chat-${++messageNumber}`) {
    sockets.at(-1).emit('message', JSON.stringify({metadata: {message_id: `notification-${messageId}`, message_type: 'notification', message_timestamp: '2026-10-28T12:00:02.123456789Z', subscription_type: 'channel.chat.message', subscription_version: '1'}, payload: {
      subscription: {id: 'subscription-id', status: 'enabled', type: 'channel.chat.message', version: '1', condition: {broadcaster_user_id: 'owner', user_id: 'owner'}, transport: {method: 'websocket', session_id: 'session-id'}, created_at: '2026-10-28T12:00:00Z', cost: 0},
      event: {broadcaster_user_id: 'owner', broadcaster_user_login: 'ayyoweb3', broadcaster_user_name: 'Ayyoweb3', chatter_user_id: user, chatter_user_login: user, chatter_user_name: user, message_id: messageId, message: {text, fragments: [{type: 'text', text, cheermote: null, emote: null, mention: null}]}, message_type: 'text', color: '', badges: [], cheer: null, reply: null, channel_points_custom_reward_id: null, source_broadcaster_user_id: null, source_broadcaster_user_login: null, source_broadcaster_user_name: null, source_message_id: null, source_badges: null, is_source_only: false}
    }}));
    return messageId;
  }
  async function advance(to, runTimers = true) {
    if (to < now) throw new Error('Test clock must move forward.');
    if (runTimers) {
      for (;;) {
        const next = [...timers].filter(timer => timer.at <= to).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at; timers.delete(next); next.fn(); await flush();
      }
    }
    now = to;
  }
  async function calibrate() {
    const sync = runtime.startSync();
    await advance(sync.shownAt + 2000); chat('fast', sync.word);
    await advance(sync.shownAt + 4000); chat('early', sync.word);
    await advance(sync.shownAt + 8000); chat('slow', sync.word);
    return sync;
  }
  return {runtime, auth, logs, apiCalls, timers, eventTimers, sockets, chat, advance, calibrate, welcome, now: () => now,
    summaries: () => apiCalls.filter(call => call.path === 'chat/messages'),
    disconnect: () => sockets.at(-1).emit('close', 4005, Buffer.from('fake network gap'))};
}
