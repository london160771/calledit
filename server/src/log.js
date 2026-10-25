/** Structured console logs keep chat text escaped on one line. Never pass OAuth credentials. */
export function logEvent(event, details = {}) {
  console.log('[CalledIt]', JSON.stringify({event, ...details}));
}
