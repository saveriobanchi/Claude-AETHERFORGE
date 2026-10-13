// Mid-game touch playtest: grant materials, then build a small powered line via the UI.
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5199/';
const out = process.argv[3] ?? '/tmp/claude-0/mid';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.evaluate(() => indexedDB.deleteDatabase('aetherforge'));
await page.reload();
await page.waitForFunction(() => window.gameReady === true, null, { timeout: 60000 });
let n = 0;
const shot = (name) => page.screenshot({ path: `${out}-${String(n++).padStart(2, '0')}-${name}.png` });
const ev = (fn, a) => page.evaluate(fn, a);
const xy = (x, y) => ev(([x, y]) => window.game.view.tileToScreen(x, y), [x, y]);
const tapTile = async (x, y) => { const [sx, sy] = await xy(x, y); await page.touchscreen.tap(sx, sy - 3); await page.waitForTimeout(100); };
// one-finger drag using CDP touch events
const cdp = await ctx.newCDPSession(page);
const drag = async (a, b) => {
  const [x0, y0] = await xy(...a), [x1, y1] = await xy(...b);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 12, y: y0 + ((y1 - y0) * i) / 12 }] }); await page.waitForTimeout(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
};
await ev(() => {
  const g = window.game, s = g.s;
  for (const id of ['compost', 'land', 'plank', 'sapling', 'fiber', 'sieve', 'stone', 'clay', 'kiln', 'copper', 'automation', 'belts', 'storage', 'wind', 'dispatch']) s.known.add(id);
  Object.assign(s.stash, { wood: 50, plank: 50, stone: 50, gear: 30, copper: 20, twine: 20, loam: 50, leaf: 40 });
  Object.assign(s.stats.obtained, { wood: 50, plank: 50, stone: 50, gear: 30, copper: 20, twine: 20, loam: 50, leaf: 40 });
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 4; x++) if (!s.tiles.has((x + 2048) * 4096 + (y + 2048))) { s.tiles.set((x + 2048) * 4096 + (y + 2048), { x, y, floor: 'grass', seed: x * 31 + y }); }
  s.tileRev++; s.topoDirty = true;
  g.view.cam.jump(32, 40, 1.75);
});
await page.waitForTimeout(600);
const build = async (tab, name) => {
  if (!(await page.locator('.sheet.open .tray').count())) await page.click('.main-btn[aria-label=Build]');
  await page.click(`.tab:has-text("${tab}")`);
  if (!(await page.locator(`.card:has-text("${name}")`).count())) { console.log('cards', tab, JSON.stringify(await page.locator('.tab').allTextContents()), JSON.stringify(await page.locator('.card').allTextContents()), await ev(() => window.game.mode)); await shot('fail'); }
  await page.click(`.card:has-text("${name}")`);
  await page.waitForTimeout(150);
};
await build('Land', 'Flagstone');
await drag([1, 1], [3, 1]);
await build('Make', 'Wind Sifter').catch(async () => { await page.click('.placing .close'); await build('Make', 'Wind Sifter'); });
await tapTile(2, 1);
await page.click('.placing .close');
await build('Move', 'Dispatcher');
await tapTile(-1, 1);
await page.click('.placing .close');
await build('Move', 'Conveyor');
await drag([0, 1], [1, 1]);
await page.click('.placing .close');
await build('Move', 'Depot');
await tapTile(3, 1);
await page.click('.placing .close');
await build('Power', 'Windmill');
await tapTile(2, 3);
await shot('built');
await page.click('.placing .btn.primary');
// configure the dispatcher
await tapTile(-1, 1);
await page.waitForTimeout(300);
await shot('dispatcher-panel');
await page.click('.side .rchip[title=Loam]');
await page.click('.side .close');
await ev(() => window.game.advance(20));
await page.waitForTimeout(800);
console.log(await ev(() => ({ b: [...window.game.s.buildings.values()].map((b) => `${b.type}@${b.x},${b.y}d${b.dir}:${b.status}`).join(' '), stash: window.game.s.stash.pebble, power: window.game.s.power })));
await shot('running');
await tapTile(2, 1);
await page.waitForTimeout(300);
await shot('sifter-panel');
console.log('errors', errors);
await browser.close();
