import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5199/?demo');
await page.waitForFunction(() => window.gameReady === true);
for (const [btn, name] of [['Journal', 'journal'], ['Menu', 'settings'], ['Stash', 'stash']]) {
  await page.click(`[aria-label=${btn}]`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/claude-0/m-${name}.png` });
  await page.click('.modal .close');
  await page.waitForTimeout(300);
}
// away summary: pretend we left 3 hours ago with automated flow
await page.evaluate(async () => {
  const g = window.game;
  g.s.flow.hist = [{ dt: 300, inn: { plank: 90, pebble: 160, stone: 30 }, out: { loam: 80 } }];
  g.s.savedAt = Date.now() - 3 * 3600 * 1000;
  const { serialize } = await import('/src/core/save.ts');
  const db = await new Promise((r) => { const q = indexedDB.open('aetherforge', 1); q.onsuccess = () => r(q.result); });
  await new Promise((r) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(serialize(g.s), 'save'); tx.oncomplete = r; });
});
await page.goto('http://localhost:5199/');
await page.waitForFunction(() => window.gameReady === true);
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/claude-0/m-away.png' });
await browser.close();
