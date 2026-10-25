import React, {useEffect, useState} from 'react';
import {watchLiveState, liveConnectionLabel} from './live-state.js';
import {ViewerDelays} from './ViewerDelays.js';
import {LiveSyncWord} from './LiveSyncWord.js';
/** Phase 3 checks real calibration only; chat processing always runs in Node. */
export function LiveSync() {
  const [state, setState] = useState(null), [connectionError, setConnectionError] = useState(''), [syncError, setSyncError] = useState('');
  useEffect(() => watchLiveState({intervalMs: 1000,
    onState: next => {setState(next); setConnectionError('');}, onError: setConnectionError
  }), []);
  async function sync() {
    try {
      const response = await fetch('/api/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(current => ({...current, sync: data, syncActive: true, syncRemainingMs: data.syncWindowMs})); setSyncError('');
    } catch (error) {setSyncError(error.message);}
  }
  return <main><div className="hero"><div><p className="eyebrow">PHASE 3 · LIVE SYNC CHECK</p><h1>Measure your chat.</h1><p className="intro">Connect your broadcaster account, then show the sync word on stream. Viewers type it back in Twitch chat.</p></div></div>
    <section className="panel"><div className="section-head"><h2 role="status">{liveConnectionLabel(state, connectionError)}</h2><a href="/auth/twitch">Connect with Twitch ↗</a></div>
      {state?.account && <p>Channel: {state.account}</p>}
      <button className="primary" disabled={!!connectionError || state?.status !== 'connected'} onClick={sync}>Sync</button>
      {!connectionError && state?.sync && (state.syncActive === false ? <p>Sync window ended. Press Sync again.</p> : <LiveSyncWord sync={state.sync} remainingMs={state.syncRemainingMs}/>)}
      {syncError && <p role="alert">{syncError}</p>}
    </section>
    <ViewerDelays viewers={state?.viewers ?? []}/>
    <p>OBS sync overlay: <a href="/overlay?live=1">/overlay?live=1</a>. Live round controls will be connected in Phase 4.</p><a href="/judge">Open simulated replay ↗</a>
  </main>;
}
