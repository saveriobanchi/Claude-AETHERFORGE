import './ui/style.css';
import { boot } from './game';

// iOS Safari ignores user-scalable=no: block page pinch/double-tap zoom and
// rubber-band scrolling so gestures always belong to the game.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !(e.target as HTMLElement)?.closest?.('input, textarea')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => {
  if (!(e.target as HTMLElement)?.closest?.('.scroll, .cards, .tabs, textarea, input')) e.preventDefault();
}, { passive: false });

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot');
  if (el) el.innerHTML = `<div class="boot-title">Something went wrong</div><pre class="boot-err">${String(e?.message ?? e)}</pre>`;
});
