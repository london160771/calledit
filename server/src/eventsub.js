import WebSocket from 'ws';
import {logEvent} from './log.js';
export const eventSubUrl = 'wss://eventsub.wss.twitch.tv/ws';
export const keepaliveGraceMs = 1500;

/** All sockets, watchdogs and message handling run in Node, independent of browser tabs. */
export function createEventSub({engine, subscribe, clock = Date.now, makeSocket = url => new WebSocket(url), setTimer = setTimeout, clearTimer = clearTimeout, onStatus = () => {}, onMessage = () => {}, ignoreMessage = () => false, log = logEvent}) {
  let active, candidate, retry, gapFrom = null, stopped = true;
  const sockets = new Set(), seen = new Set();
  function gap(from) {
    gapFrom = gapFrom == null ? from : Math.min(gapFrom, from);
    engine.reportGap({from: gapFrom, to: clock()});
    onStatus('disconnected');
  }
  function close(ctx) {
    ctx.retired = true;
    clearTimer(ctx.timer);
    ctx.ws.close();
    sockets.delete(ctx);
  }
  function scheduleRetry() {
    if (!stopped && !retry) retry = setTimer(() => {retry = null; connect(eventSubUrl, false);}, 1000);
  }
  function lost(ctx, reason, details = {}) {
    if (ctx.retired || stopped) return;
    if (ctx.handoff && active && active !== ctx && !active.retired) {
      // A failed replacement socket does not take the still-healthy old socket down.
      log('eventsub.handoff_failed', {reason, activeSessionId: active.sessionId, ...details});
      close(ctx);
      if (candidate === ctx) candidate = null;
      return;
    }
    log('eventsub.lost', {reason, sessionId: ctx.sessionId ?? null, lastReceivedAt: ctx.lastAt, at: clock(), ...details});
    gap(active?.lastAt ?? ctx.lastAt);
    close(ctx);
    if (active === ctx) active = null;
    if (candidate === ctx) candidate = null;
    if (!active && !candidate) scheduleRetry();
  }
  function arm(ctx) {
    clearTimer(ctx.timer);
    // Twitch sends keepalives at the timeout boundary. Allow transport/scheduler jitter.
    // Any actual loss still reports a gap starting at the last healthy receipt.
    const deadline = ctx.lastAt + ctx.timeout + (ctx.sessionId ? keepaliveGraceMs : 0);
    ctx.timer = setTimer(() => {
      if (clock() < deadline) return arm(ctx);
      lost(ctx, ctx.sessionId ? 'KEEPALIVE_TIMEOUT' : 'WELCOME_TIMEOUT', {timeoutMs: ctx.timeout});
    }, Math.max(1, deadline - clock()));
  }
  function connect(url, handoff) {
    log('eventsub.connect', {handoff});
    const ctx = {ws: makeSocket(url), lastAt: clock(), timeout: 10000, retired: false, handoff};
    sockets.add(ctx); candidate = ctx; arm(ctx);
    ctx.ws.on('open', () => log('eventsub.open', {handoff}));
    ctx.ws.on('message', raw => {
      const receivedAt = clock();
      void receive(ctx, raw, receivedAt).catch(error => {
        log('eventsub.processing_failed', {message: error.message});
        lost(ctx, 'PROCESSING_FAILED');
      });
    });
    ctx.ws.on('close', (code, reason) => lost(ctx, 'SOCKET_CLOSED', {code, closeReason: reason?.toString()}));
    ctx.ws.on('error', error => lost(ctx, 'SOCKET_ERROR', {message: error.message}));
  }
  async function receive(ctx, raw, receivedAt) {
    if (ctx.retired || stopped) return;
    const message = JSON.parse(String(raw)), type = message.metadata?.message_type;
    if (type === 'session_welcome') {
      const session = message.payload.session;
      ctx.lastAt = receivedAt; ctx.sessionId = session.id;
      ctx.timeout = (session.keepalive_timeout_seconds ?? 10) * 1000; arm(ctx);
      log('eventsub.welcome', {sessionId: session.id, timeoutMs: ctx.timeout, handoff: ctx.handoff});
      if (!ctx.handoff) await subscribe(session.id);
      if (ctx.retired || stopped) return;
      const old = active; active = ctx; candidate = null;
      if (old && old !== ctx) close(old);
      if (gapFrom != null) {engine.reportGap({from: gapFrom, to: clock()}); gapFrom = null;}
      log('eventsub.connected', {sessionId: session.id});
      onStatus('connected'); return;
    }
    if (type === 'notification' || type === 'session_keepalive') {
      ctx.lastAt = receivedAt; arm(ctx);
      log(type === 'notification' ? 'eventsub.notification' : 'eventsub.keepalive', {sessionId: ctx.sessionId, subscriptionType: message.metadata?.subscription_type ?? message.payload?.subscription?.type, receivedAt});
    }
    if (type === 'session_reconnect') {
      const url = new URL(message.payload.session.reconnect_url);
      if (url.protocol !== 'wss:' || url.hostname !== 'eventsub.wss.twitch.tv') throw new Error('Invalid reconnect URL.');
      if (!candidate) connect(url.href, true);
    } else if (type === 'notification' && (message.metadata.subscription_type ?? message.payload.subscription?.type) === 'channel.chat.message') {
      const e = message.payload.event;
      if (!e?.message_id || !e.chatter_user_id || typeof e.message?.text !== 'string') {
        log('chat.rejected', {reason: 'INVALID_CHAT_PAYLOAD'}); return;
      }
      const input = {messageId: e.message_id, userId: e.chatter_user_id, userLogin: e.chatter_user_login, text: e.message.text, receivedAt};
      log('chat.received', {...input, channel: e.broadcaster_user_login, broadcasterUserId: e.broadcaster_user_id});
      if (ignoreMessage(input)) {log('chat.ignored', {user: input.userLogin, messageId: input.messageId, reason: 'OWN_ACCOUNT'}); return;}
      if (seen.has(e.message_id)) {
        log('sync.rejected', {user: input.userLogin, messageId: input.messageId, reason: 'REPLAYED_MESSAGE'}); return;
      }
      seen.add(e.message_id);
      const beforeViewer = engine.getViewer(input.userId);
      const verdict = engine.handleMessage(input);
      onMessage(input, verdict, {beforeViewer});
    } else if (type === 'revocation') {
      log('eventsub.revoked', {status: message.payload.subscription?.status});
      gap(ctx.lastAt); stop(); onStatus('authorization-required');
    }
  }
  function stop() {
    stopped = true; clearTimer(retry); retry = null;
    for (const ctx of sockets) close(ctx);
    active = null; candidate = null;
  }
  return {start() {if (!stopped) return; stopped = false; connect(eventSubUrl, false);}, stop};
}
