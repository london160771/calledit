import {createEngine} from '@calledit/engine';
import {createEventSub} from './eventsub.js';
import {createSummarySender} from './summary.js';
import {logEvent} from './log.js';
import {readLiveConfig} from './live-config.js';
import {createLiveRounds} from './live-rounds.js';

/** One live Node session owns calibration, chat calls, round timers and summaries. */
export function createRuntime({auth, clock = Date.now, eventSubOptions = {}, config = readLiveConfig(), engine = createEngine(config), log = logEvent, setTimer = setTimeout, clearTimer = clearTimeout, summaryOptions = {}}) {
  const users = new Set();
  let status = 'disconnected', sync = null, subscription = null;
  const liveLog = (event, details) => log(event, event === 'sync.rejected' ? {...details, syncWindowMs: config.syncWindowMs, maxDelayMs: config.maxDelayMs} : details);
  const sendSummary = createSummarySender({clock, ...summaryOptions, send: async message => {
    const {userId} = auth.getIdentity();
    const response = await auth.helix('chat/messages', {broadcaster_id: userId, sender_id: userId, message});
    if (!response.data?.[0]?.is_sent) throw new Error('Twitch did not send the summary.');
  }});
  const rounds = createLiveRounds({engine, config, clock, sendSummary, log, setTimer, clearTimer});
  const client = createEventSub({engine: rounds.eventEngine, clock, log: liveLog, ...eventSubOptions,
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
      if (verdict) return;
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
      else if (details.delayMs > config.syncWindowMs) reason = 'SYNC_WINDOW_EXPIRED';
      else if (details.delayMs > config.maxDelayMs) reason = 'MAX_DELAY_EXCEEDED';
      else if (sample) reason = 'ALREADY_SAMPLED_THIS_SYNC';
      else reason = 'ENGINE_IGNORED';
      liveLog('sync.rejected', {...details, reason, reasonText: reason === 'SYNC_WINDOW_EXPIRED' ? `Reply delay ${details.delayMs} ms exceeds live sync window ${config.syncWindowMs} ms.` : reason === 'MAX_DELAY_EXCEEDED' ? `Reply delay ${details.delayMs} ms exceeds live delay cap ${config.maxDelayMs} ms.` : reason});
    }
  });
  return {
    engine, sendSummary,
    async start() {await auth.validate(); client.stop(); status = 'connecting'; log('twitch.start', {account: auth.getIdentity()?.login}); client.start();},
    stop() {rounds.stop(); client.stop(); status = 'disconnected';},
    openRound() {if (status !== 'connected') throw new Error('Connect to Twitch before opening a round.'); return rounds.openRound();},
    markEvent(input) {if (status !== 'connected') throw new Error('Twitch is disconnected. This round cannot be scored.'); return rounds.markEvent(input);},
    voidRound(input) {return rounds.voidRound(input);},
    startSync() {
      if (status !== 'connected') throw new Error('Connect to Twitch before syncing.');
      const shownAt = clock();
      sync = {syncId: `sync-${shownAt}`, word: ['MANGO', 'PAPAYA', 'PEACH'][Math.floor(shownAt / 1000) % 3], shownAt, syncWindowMs: config.syncWindowMs, maxDelayMs: config.maxDelayMs, expiresAt: shownAt + config.syncWindowMs};
      engine.startSync(sync); log('sync.started', sync); return {...sync};
    },
    snapshot() {
      const now = clock();
      return {...rounds.snapshot(now), status, account: auth.getIdentity()?.login ?? null, subscription, sync, syncActive: !!sync && now <= sync.expiresAt, syncRemainingMs: sync ? Math.max(0, sync.expiresAt - now) : 0, viewers: [...users].map(id => engine.getViewer(id)).filter(Boolean)};
    }
  };
}
