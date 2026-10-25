import {createEngine, defaults} from '@calledit/engine';
import {createEventSub} from './eventsub.js';
import {createSummarySender} from './summary.js';
import {logEvent} from './log.js';

/** Twitch adapter; live round controls are wired in Phase 4. */
export function createRuntime({auth, clock = Date.now, eventSubOptions = {}, engine = createEngine(), log = logEvent}) {
  const users = new Set();
  let status = 'disconnected', sync = null, subscription = null;
  const client = createEventSub({engine, clock, log, ...eventSubOptions,
    subscribe: async sessionId => {
      const {userId, login} = auth.getIdentity();
      const request = {type: 'channel.chat.message', version: '1', condition: {broadcaster_user_id: userId, user_id: userId}, transport: {method: 'websocket', session_id: sessionId}};
      log('subscription.creating', {channel: login, userId, sessionId});
      try {
        const response = await auth.helix('eventsub/subscriptions', request);
        const created = response.data?.[0];
        subscription = created ? {id: created.id, status: created.status, channel: login} : null;
        log('subscription.created', {sessionId, channel: login, subscription: created ?? null});
        if (created?.status !== 'enabled' || created.type !== request.type || created.condition?.broadcaster_user_id !== userId || created.condition?.user_id !== userId || created.transport?.session_id !== sessionId) {
          throw new Error('Chat subscription is not enabled for the expected channel and session.');
        }
      } catch (error) {
        log('subscription.failed', {sessionId, channel: login, status: error.status ?? null, body: error.body ?? null, message: error.message});
        throw error;
      }
    },
    onStatus: next => {status = next;},
    onMessage: (input, verdict, {beforeViewer} = {}) => {
      users.add(input.userId);
      const viewer = engine.getViewer(input.userId);
      const details = {user: input.userLogin, messageId: input.messageId, syncId: sync?.syncId ?? null, word: sync?.word ?? null, shownAt: sync?.shownAt ?? null, receivedAt: input.receivedAt, delayMs: sync ? input.receivedAt - sync.shownAt : null};
      const sample = viewer?.samples.find(sample => sample.syncId === sync?.syncId);
      if (sample && !beforeViewer?.samples.some(previous => previous.syncId === sample.syncId)) {
        log('sync.recorded', {...details, dViewer: viewer.dViewer, samples: viewer.samples.length}); return;
      }
      let reason;
      if (!sync) reason = 'NO_ACTIVE_SYNC';
      else if (input.text.trim().toLowerCase() !== sync.word.trim().toLowerCase()) reason = 'WORD_MISMATCH';
      else if (details.delayMs < 0) reason = 'BEFORE_SYNC';
      else if (details.delayMs > defaults.syncWindowMs) reason = 'SYNC_WINDOW_EXPIRED';
      else if (details.delayMs > defaults.maxDelayMs) reason = 'MAX_DELAY_EXCEEDED';
      else if (sample) reason = 'ALREADY_SAMPLED_THIS_SYNC';
      else reason = 'ENGINE_IGNORED';
      log('sync.rejected', {...details, reason, syncWindowMs: defaults.syncWindowMs});
    }
  });
  const sendSummary = createSummarySender({clock, send: async message => {
    const {userId} = auth.getIdentity();
    const response = await auth.helix('chat/messages', {broadcaster_id: userId, sender_id: userId, message});
    if (!response.data?.[0]?.is_sent) throw new Error('Twitch did not send the summary.');
  }});
  return {
    engine, sendSummary,
    async start() {await auth.validate(); client.stop(); status = 'connecting'; log('twitch.start', {account: auth.getIdentity()?.login}); client.start();},
    stop() {engine.reportGap({from: clock(), to: clock()}); client.stop(); status = 'disconnected';},
    startSync() {
      if (status !== 'connected') throw new Error('Connect to Twitch before syncing.');
      const shownAt = clock();
      sync = {syncId: `sync-${shownAt}`, word: ['MANGO', 'PAPAYA', 'PEACH'][Math.floor(shownAt / 1000) % 3], shownAt, expiresAt: shownAt + defaults.syncWindowMs};
      engine.startSync(sync); log('sync.started', sync); return {...sync};
    },
    snapshot() {return {status, account: auth.getIdentity()?.login ?? null, subscription, sync, syncActive: !!sync && clock() <= sync.expiresAt, viewers: [...users].map(id => engine.getViewer(id)).filter(Boolean)};}
  };
}
