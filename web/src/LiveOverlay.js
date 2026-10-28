import React, {createElement as h, useEffect, useState} from 'react';
import {watchLiveState, liveConnectionLabel} from './live-state.js';
import {LiveSyncWord} from './LiveSyncWord.js';
import {LiveRoundBanner, LiveVerdicts, LiveCallFeed} from './LiveRoundView.js';

/** Only the current live server sync is shown; disconnected sessions hide old words. */
export function LiveSyncOverlay({state, error = ''}) {
  const sync = !error && state?.status === 'connected' && state.syncActive !== false ? state.sync : null;
  const round = state?.round;
  const showSync = sync && (!round || (round.status !== 'OPEN' && sync.shownAt > round.openedAt));
  return h('main', {className: `live-overlay ${round && !showSync ? 'live-game-overlay' : ''}`},
    h('p', {className: 'badge'}, 'LIVE (Twitch)'),
    (error || state?.status !== 'connected') && h('p', {className: 'live-overlay-status', role: 'status'}, liveConnectionLabel(state, error)),
    showSync ? h(LiveSyncWord, {sync, remainingMs: state.syncRemainingMs}) : round ? h(React.Fragment, null,
      h(LiveRoundBanner, {round, summary: state.summary}),
      h(LiveVerdicts, {verdicts: state.verdicts, compact: true}),
      h(LiveCallFeed, {calls: state.calls})
    ) : !error && state?.status === 'connected' && h('p', {className: 'live-overlay-status', role: 'status'}, state.syncActive === false && state.sync ? 'Sync window ended. Waiting for a new sync.' : 'Waiting for a live sync')
  );
}

export function LiveOverlay() {
  const [state, setState] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.classList.add('overlay');
    document.body.classList.add('overlay');
    const stop = watchLiveState({onState: next => {setState(next); setError('');}, onError: setError});
    return () => {
      stop();
      document.documentElement.classList.remove('overlay');
      document.body.classList.remove('overlay');
    };
  }, []);
  return h(LiveSyncOverlay, {state, error});
}
