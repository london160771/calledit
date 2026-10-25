import React, {createElement as h} from 'react';

/** Both live surfaces show the same word and countdown from the server clock. */
export function LiveSyncWord({sync, remainingMs}) {
  const remaining = remainingMs ?? sync.syncWindowMs;
  return h('section', {className: 'sync-flash', 'data-sync-id': sync.syncId, 'data-shown-at': sync.shownAt, 'aria-live': 'polite'},
    h('small', null, 'TYPE THIS WORD IN TWITCH CHAT'),
    h('h1', null, `SAY: ${sync.word}`),
    Number.isFinite(remaining) && h('p', {className: 'sync-countdown', role: 'timer', 'aria-live': 'off'}, `${Math.ceil(Math.max(0, remaining) / 1000)} seconds left`));
}
