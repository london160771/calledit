import React, {useEffect, useState} from 'react';
import {watchLiveState, liveConnectionLabel} from './live-state.js';
import {ViewerDelays} from './ViewerDelays.js';
import {LiveSyncWord} from './LiveSyncWord.js';
import {LiveRoundControls, LiveVerdicts, LiveCallFeed} from './LiveRoundView.js';

/** The browser sends controls only; Node owns all game state, times and finalization. */
export function LiveSync() {
  const [state, setState] = useState(null), [connectionError, setConnectionError] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => watchLiveState({intervalMs: 500,
    onState: next => {setState(next); setConnectionError('');}, onError: setConnectionError
  }), []);
  async function action(command) {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      const path = command === 'sync' ? '/api/sync' : command === 'open' ? '/api/round/open' : command === 'void' ? '/api/round/void' : '/api/round/event';
      const body = ['land', 'miss'].includes(command) ? {roundId: state?.round?.roundId, outcome: command} : command === 'void' ? {roundId: state?.round?.roundId} : {};
      const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      // Read the canonical snapshot so rechecked verdicts and round state arrive together.
      const fresh = await fetch('/api/state', {cache: 'no-store'});
      if (!fresh.ok) throw new Error('Control sent. Reconnecting to CalledIt server…');
      setState(await fresh.json()); setConnectionError('');
    } catch (error) {setActionError(error.message);} finally {setBusy(false);}
  }
  return <main className="live-dashboard"><header className="live-dashboard-header"><a className="brand" href="/judge">CalledIt ↗</a><div><p className="eyebrow">CHAT CALLS IT. LAG CAN’T CHEAT IT.</p><h1>Live control room</h1></div><span className="badge">LIVE (Twitch)</span></header>
    <section className="panel"><div className="section-head"><h2 role="status">{liveConnectionLabel(state, connectionError)}</h2><a href="/auth/twitch">Connect with Twitch ↗</a></div>
      {state?.account && <p>Channel: {state.account}</p>}
      <button disabled={busy || !!connectionError || state?.status !== 'connected'} onClick={() => action('sync')}>Sync</button>
      {!connectionError && state?.sync && (state.syncActive === false ? <p>Sync window ended. Press Sync again when needed.</p> : <LiveSyncWord sync={state.sync} remainingMs={state.syncRemainingMs}/>)}
      {actionError && <p className="control-error" role="alert">{actionError}</p>}
    </section>
    <LiveRoundControls state={state} onAction={action} busy={busy} error={connectionError}/>
    <div className="columns"><section className="panel"><h2>Live verdicts</h2><LiveVerdicts verdicts={state?.verdicts}/><LiveCallFeed calls={state?.calls}/></section><ViewerDelays viewers={state?.viewers ?? []}/></div>
    <p>OBS: <a href="/overlay?live=1">/overlay?live=1</a> · <a href="/judge">Simulated replay ↗</a></p>
  </main>;
}
