// A single shared page-visibility signal for the sync layer.
//
// Every synced store detaches its Realtime Database listener while the tab is
// hidden — this releases the RTDB connection (a scarce resource: background
// tabs would otherwise each hold a socket and eat into the per-project
// simultaneous-connection budget). Rather than have each store install its own
// `visibilitychange` listener, they subscribe to this one shared source.

const subscribers = new Set();
let visible = typeof document === 'undefined' || document.visibilityState === 'visible';

export function isPageVisible() {
  return visible;
}

export function onVisibilityChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const next = document.visibilityState === 'visible';
    if (next === visible) return;
    visible = next;
    for (const fn of subscribers) fn(visible);
  });
}
