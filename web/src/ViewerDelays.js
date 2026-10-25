import React, {createElement as h} from 'react';

/** The live dashboard renders only viewer samples supplied by the Node engine. */
export function ViewerDelays({viewers}) {
  return h('section', {className: 'panel'},
    h('h2', null, 'Real viewer delays'),
    h('table', null,
      h('thead', null, h('tr', null, ...['Viewer', 'Delay', 'Samples'].map(title => h('th', {key: title}, title)))),
      h('tbody', null, ...viewers.map(viewer => h('tr', {key: viewer.userId},
        h('td', null, viewer.userLogin), h('td', null, `${viewer.dViewer} ms`), h('td', null, viewer.samples.length))))),
    !viewers.length && h('p', null, 'Waiting for sync replies.'));
}
