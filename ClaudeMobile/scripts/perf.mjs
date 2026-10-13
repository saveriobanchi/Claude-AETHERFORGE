import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:5199/?demo';
const [w, h, dpr] = [+(process.argv[3] ?? 844), +(process.argv[4] ?? 390), +(process.argv[5] ?? 2)];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
await page.goto(url);
await page.waitForFunction(() => window.gameReady === true, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const g = window.game;
  // measure our own CPU work per frame (excluding GPU raster) by timing render pieces
  const t0 = performance.now();
  let frames = 0;
  await new Promise((res) => { const f = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const fps = frames / 3;
  // sim cost
  const s0 = performance.now();
  g.advance(60);
  const simMs = (performance.now() - s0) / (60 * 20);
  return { fps, frameMs: g.view.frameMs, updateMs: g.view.updateMs, simMsPerTick: simMs, stats: g.view.stats(), buildings: g.s.buildings.size, tiles: g.s.tiles.size };
});
console.log(JSON.stringify(r));
await browser.close();
