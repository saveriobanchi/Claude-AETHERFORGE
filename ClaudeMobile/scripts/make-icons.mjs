// App icons, rendered by the game itself: a small floating island at golden
// hour — an old oak, a windmill, a humming resonance pylon and a lantern.
//
//   npm run dev            (in another terminal; or set BASE to a running build)
//   npm run icons
//
// Writes public/icons/{icon-512,icon-192,apple-touch-icon,favicon-32,icon-maskable-512}.png
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5181/';
const OUT = new URL('../public/icons/', import.meta.url);
const SIZE = 1024;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: SIZE / 2, height: SIZE / 2 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(BASE + '?demo=1&t=0.6');
await page.waitForFunction(() => window.gameReady === true, null, { timeout: 120000 });

/** Stage the scene and frame it; `zoom` controls how much sky surrounds the island. */
async function shoot(zoom) {
  await page.evaluate(async (zoom) => {
    const st = await import('/src/core/state.ts');
    const { rebuildCache } = await import('/src/core/sim.ts');
    const { tileCenter } = await import('/src/render/art/terrain.ts');
    const g = window.game;
    const s = st.createState(20261027);
    s.tiles.clear(); s.buildings.clear(); s.occ.clear();
    // a rounded 4×4 island: grass, with a flagstone corner for the pylon
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if ((x === 0 || x === 3) && (y === 0 || y === 3) && !(x === 3 && y === 3)) continue;
      st.addTile(s, x, y, x >= 2 && y >= 2 ? 'stone' : 'grass');
    }
    const put = (type, x, y, dir = 0) => { const b = st.addBuilding(s, type, x, y, dir); b.stock = 5; b.status = 'working'; return b; };
    // tall things at the back, the glowing pylon in front, one old oak
    put('windmill', 2, 0);
    put('tree', 0, 1);
    put('pylon', 2, 2);
    put('lantern', 1, 2);
    s.time = 0.6 * 600; // golden hour
    rebuildCache(s);
    g.replaceWorld(s);
    g.observe = false;
    document.getElementById('ui').style.display = 'none';
    // a clean sky: no distant islets drifting behind the subject
    for (const f of g.view.sky.far) if (f.bob > 0 && f.haze === 0.2) f.s.renderable = false;
    const [cx, cy] = tileCenter(1.5, 1.5);
    g.view.cam.jump(cx, cy - 24, zoom);
  }, zoom);
  await page.waitForTimeout(2500);
  return page.screenshot({ type: 'png' });
}

/** Downscale a PNG in the browser (high-quality smoothing) and return PNG bytes. */
async function resize(png, size) {
  const b64 = await page.evaluate(async ({ src, size }) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + src;
    await im.decode();
    // halve repeatedly for a clean result at small sizes
    let c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    c.getContext('2d').drawImage(im, 0, 0);
    while (c.width / 2 >= size) {
      const n = document.createElement('canvas'); n.width = c.width / 2; n.height = c.height / 2;
      const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height);
      c = n;
    }
    if (c.width !== size) {
      const n = document.createElement('canvas'); n.width = size; n.height = size;
      const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, size, size);
      c = n;
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { src: png.toString('base64'), size });
  return Buffer.from(b64, 'base64');
}

const full = await shoot(1.3); // the island fills the tile
const safe = await shoot(0.98); // maskable: everything inside the central safe circle
const files = [['icon-512.png', full, 512], ['icon-192.png', full, 192], ['apple-touch-icon.png', full, 180], ['favicon-32.png', full, 32], ['icon-maskable-512.png', safe, 512]];
for (const [name, src, size] of files) {
  writeFileSync(new URL(name, OUT), await resize(src, size));
  console.log('wrote', name);
}
await browser.close();
