// Scripted playtest at phone landscape size, through the first tier.
// Uses real touch taps for interactions and dev speed-up for waiting.
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5199/';
const out = process.argv[3] ?? '/tmp/claude-0/play';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.evaluate(() => indexedDB.deleteDatabase('aetherforge'));
await page.reload();
await page.waitForFunction(() => window.gameReady === true, null, { timeout: 60000 });
await page.waitForTimeout(500);
let n = 0;
const shot = async (name) => page.screenshot({ path: `${out}-${String(n++).padStart(2, '0')}-${name}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
const tileXY = (x, y) => ev(([x, y]) => window.game.view.tileToScreen(x, y), [x, y]);
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(90); };
const tapTile = async (tx, ty, dy = -4) => { const [x, y] = await tileXY(tx, ty); await tap(x, y + dy); };
const st = () => ev(() => ({ stash: Object.fromEntries(Object.entries(window.game.s.stash).filter(([, n]) => n > 0)), known: [...window.game.s.known].join(','), tiles: window.game.s.tiles.size, b: [...window.game.s.buildings.values()].map((b) => `${b.type}@${b.x},${b.y}`).join(' '), note: document.querySelector('.note')?.textContent }));
const wait = async (sec) => { await ev((s) => window.game.advance(s), sec); await page.waitForTimeout(150); };
const stash = (k) => ev((k) => window.game.s.stash[k], k);
const harvestAll = async () => { const trees = await ev(() => [...window.game.s.buildings.values()].filter((b) => b.type === 'tree' || b.type === 'tuft').map((b) => [b.x, b.y, b.type === 'tuft' ? 1 : b.stock])); for (const [x, y, k] of trees) for (let i = 0; i < k; i++) await tapTile(x, y, -14); };
const build = async (name, x, y) => {
  if (!(await page.locator('.sheet.open').count())) await page.click('.main-btn[aria-label=Build]');
  await page.waitForTimeout(250);
  const tabs = await page.locator('.tab').allTextContents();
  for (const t of tabs) {
    if (!t.trim()) continue;
    await page.click(`.tab >> text=${t.trim()}`);
    await page.waitForTimeout(120);
    if (await page.locator(`.card:has-text("${name}")`).count()) break;
  }
  await page.click(`.card:has-text("${name}")`);
  await page.waitForTimeout(200);
  if (Array.isArray(x)) for (const [a, b] of x) await tapTile(a, b); else await tapTile(x, y);
  await page.waitForTimeout(150);
  if (await page.locator('.placing').count()) await page.click('.placing .btn.primary');
  await page.waitForTimeout(200);
};
const gatherUntil = async (pred, label, max = 40) => { for (let i = 0; i < max && !(await ev(pred)); i++) { await harvestAll(); await wait(6); } console.log('gathered for', label, JSON.stringify((await st()).stash)); };

await shot('start');
await gatherUntil(() => window.game.s.stash.wood >= 6, 'workbench');
await build('Workbench', 1, 0);
await shot('workbench');
await gatherUntil(() => window.game.s.stash.wood >= 8 && window.game.s.known.has('compost'), 'composter');
await build('Compost Bin', -1, 0);
// load and collect the bin by tapping it
await tapTile(-1, 0);
await page.waitForTimeout(300);
await shot('bin-panel');
await page.click('.side .btn:has-text("Load")');
await wait(18);
await page.click('.side .btn:has-text("Collect")').catch(() => undefined);
console.log('after bin', JSON.stringify(await st()));
await shot('after-bin');
// expand the island
for (let k = 0; k < 6; k++) {
  await harvestAll(); await wait(6); await harvestAll();
  await tapTile(-1, 0); await page.waitForTimeout(150);
  await page.click('.side .btn:has-text("Load")').catch(() => undefined);
  await wait(14);
  await page.click('.side .btn:has-text("Collect")').catch(() => undefined);
}
console.log('loam', JSON.stringify(await st()));
await page.click('.side .close').catch(() => undefined);
await build('Loam Plot', [[2, 0], [2, 1], [2, -1], [-2, 0]]);
console.log('after expand', JSON.stringify(await st()));
await shot('expanded');
console.log('errors', errors);
await browser.close();
