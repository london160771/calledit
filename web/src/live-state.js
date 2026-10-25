/** Explicit live mode keeps the simulated overlay available at /overlay. */
export function isLiveOverlay(url) {
  return url.pathname === '/overlay' && url.searchParams.get('live') === '1';
}

/** Follow the server session, including syncs started from another browser (OBS).
 * Polls are sequential. Server sync timestamps are passed through unchanged.
 */
export function watchLiveState({onState, onError, fetchImpl = fetch, setTimer = setTimeout, clearTimer = clearTimeout}) {
  let stopped = false, timer;
  const controller = new AbortController();
  async function poll() {
    try {
      const response = await fetchImpl('/api/state', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('Live server unavailable.');
      const state = await response.json();
      if (!stopped) onState(state);
    } catch {
      if (!stopped) onError('Live server unavailable. Reconnecting…');
    } finally {
      if (!stopped) timer = setTimer(poll, 100);
    }
  }
  void poll();
  return () => { stopped = true; clearTimer(timer); controller.abort(); };
}
