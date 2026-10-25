import React, {createElement as h, useEffect, useState} from 'react';
import {watchLiveState} from './live-state.js';

/** Only the current live server sync is shown; disconnected sessions hide old words. */
export function LiveSyncOverlay({state, error = ''}) {
  const sync = !error && state?.status === 'connected' ? state.sync : null;
  return h('main', {className: 'live-overlay'},
    h('p', {className: 'badge'}, 'LIVE (Twitch)'),
    sync ? h('section', {className: 'sync-flash', 'data-sync-id': sync.syncId, 'data-shown-at': sync.shownAt, 'aria-live': 'polite'},
      h('small', null, 'TYPE THIS WORD IN TWITCH CHAT'),
      h('h1', null, `SAY: ${sync.word}`)
    ) : h('p', {className: 'live-overlay-status', role: 'status'},
      error || (state?.status === 'connected' ? 'Waiting for a live sync' : `Twitch: ${state?.status ?? 'connecting'}`))
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
