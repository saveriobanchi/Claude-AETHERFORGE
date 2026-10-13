import './ui/style.css';
import { boot } from './game';

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot');
  if (el) el.innerHTML = `<div class="boot-title">Something went wrong</div><pre class="boot-err">${String(e?.message ?? e)}</pre>`;
});
