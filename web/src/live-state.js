/** Explicit live mode keeps the simulated overlay available at /overlay. */
export function isLiveOverlay(url) {
  return url.pathname === '/overlay' && url.searchParams.get('live') === '1';
}

/** Browser transport failure is separate from the Node server's Twitch status. */
export function liveConnectionLabel(state, error = '') {
  return error ? 'Reconnecting to CalledIt server…' : state ? `Twitch: ${state.status}` : 'Connecting to CalledIt server…';
}

/** Sequential polling with capped exponential retry, request timeout and wake-up refresh.
 * No browser event opens, closes or reconnects the server's EventSub WebSocket.
 */
export function watchLiveState({onState, onError, fetchImpl = fetch, setTimer = setTimeout, clearTimer = clearTimeout, intervalMs = 100, documentRef = globalThis.document, windowRef = globalThis.window}) {
  let stopped = false, timer, timeout, controller, version = 0, failures = 0;
  async function poll() {
    if (stopped) return;
    const requestVersion = ++version;
    clearTimer(timer); clearTimer(timeout); controller?.abort();
    const request = new AbortController(); controller = request;
    timeout = setTimer(() => request.abort(), 5000);
    let delay = intervalMs;
    try {
      const response = await fetchImpl('/api/state', {cache: 'no-store', signal: request.signal});
      if (!response.ok) throw new Error('CalledIt server unavailable.');
      const state = await response.json();
      if (!stopped && requestVersion === version) {failures = 0; onState(state);}
    } catch {
      if (!stopped && requestVersion === version) {
        delay = Math.min(10000, 500 * 2 ** Math.min(failures++, 5));
        onError('Reconnecting to CalledIt server…');
      }
    } finally {
      if (!stopped && requestVersion === version) {
        clearTimer(timeout); controller = null;
        timer = setTimer(poll, delay);
      }
    }
  }
  const visible = () => {if (!documentRef?.hidden) void poll();};
  const online = () => {void poll();};
  documentRef?.addEventListener('visibilitychange', visible);
  windowRef?.addEventListener('online', online);
  void poll();
  return () => {
    stopped = true; version++;
    clearTimer(timer); clearTimer(timeout); controller?.abort();
    documentRef?.removeEventListener('visibilitychange', visible);
    windowRef?.removeEventListener('online', online);
  };
}
