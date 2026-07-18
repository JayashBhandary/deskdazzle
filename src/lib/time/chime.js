// A short alarm/timer chime synthesized with the Web Audio API — no asset to
// ship, and it works offline. Best-effort: if audio is unavailable (autoplay
// policy, no AudioContext), the toast + system notification still fire.

let ctx = null;

export function playChime(beeps = 3) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const start = ctx.currentTime;
    for (let i = 0; i < beeps; i++) {
      const t = start + i * 0.6;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(660, t + 0.15);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.47);
    }
  } catch {
    // Audio is a nicety, not a requirement.
  }
}

// Best-effort system notification (used alongside toasts for background firing).
export function notify(body, title = 'Desk Dazzle') {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    // Notifications are best-effort.
  }
}

// Ask once, lazily (called from the first user gesture that arms an alert).
export function requestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    // ignore
  }
}
