import React, {createElement as h, useEffect, useState} from 'react';
import {watchLiveState, liveConnectionLabel} from './live-state.js';
import {LiveSyncWord} from './LiveSyncWord.js';

/** Only the current live server sync is shown; disconnected sessions hide old words. */
export function LiveSyncOverlay({state, error = ''}) {
  const sync = !error && state?.status === 'connected' && state.syncActive !== false ? state.sync : null;
  return h('main', {className: 'live-overlay'},
    h('p', {className: 'badge'}, 'LIVE (Twitch)'),
    sync ? h(LiveSyncWord, {sync, remainingMs: state.syncRemainingMs}) : h('p', {className: 'live-overlay-status', role: 'status'},
      error ? liveConnectionLabel(state, error) : state?.status === 'connected' ? (state.syncActive === false && state.sync ? 'Sync window ended. Waiting for a new sync.' : 'Waiting for a live sync') : liveConnectionLabel(state))
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
