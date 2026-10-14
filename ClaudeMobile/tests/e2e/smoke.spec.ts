import { expect, test, type Page } from '@playwright/test';
import type { Game } from '../../src/game';

declare global {
  interface Window { gameReady?: boolean; game: Game }
}

async function fresh(page: Page) {
  await page.goto('./');
  // let the first boot finish so its asset fetches are not cut off by the reload
  await page.waitForFunction(() => window.gameReady === true, null, { timeout: 60_000 });
  await page.evaluate(() => new Promise<void>((r) => { const q = indexedDB.deleteDatabase('aetherforge'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.goto('./');
  await page.waitForFunction(() => window.gameReady === true, null, { timeout: 60_000 });
}

async function tapTile(page: Page, x: number, y: number, dy = -6) {
  const [sx, sy] = await page.evaluate(([x, y]) => window.game.view.tileToScreen(x, y), [x, y]);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
  if (touch) await page.touchscreen.tap(sx, sy + dy);
  else await page.mouse.click(sx, sy + dy);
  await page.waitForTimeout(80);
}

test('boots into the world without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await fresh(page);
  await expect(page.locator('#boot')).toHaveClass(/gone/);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.main-btn[aria-label=Build]')).toBeVisible();
  const tiles = await page.evaluate(() => window.game.s.tiles.size);
  expect(tiles).toBe(9);
  expect(errors).toEqual([]);
});

test('gather, build a workbench, and the world survives a reload', async ({ page }) => {
  await fresh(page);
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 5; i++) await tapTile(page, 0, 0, -20);
    await page.evaluate(() => window.game.advance(6));
  }
  const wood = await page.evaluate(() => window.game.s.stash.wood);
  expect(wood).toBeGreaterThanOrEqual(6);
  await page.click('.main-btn[aria-label=Build]');
  await page.click('.tab:has-text("Make")');
  await page.click('.card:has-text("Workbench")');
  await tapTile(page, 1, 0);
  await expect.poll(() => page.evaluate(() => [...window.game.s.buildings.values()].some((b) => b.type === 'workbench'))).toBe(true);
  await expect(page.locator('.main-btn[aria-label=Craft]')).toBeVisible();
  await page.evaluate(() => window.game.save());
  await page.reload();
  await page.waitForFunction(() => window.gameReady === true);
  const types = await page.evaluate(() => [...window.game.s.buildings.values()].map((b) => b.type));
  expect(types).toContain('workbench');
});

test('panels open and close; observe mode hides the interface', async ({ page }) => {
  await fresh(page);
  await page.click('[aria-label=Journal]');
  await expect(page.locator('.modal-wrap')).toHaveClass(/open/);
  await page.click('.modal .close');
  await expect(page.locator('.modal-wrap')).not.toHaveClass(/open/);
  await page.click('[aria-label=Menu]');
  await expect(page.locator('.modal >> text=Settings')).toBeVisible();
  await page.click('.modal .close');
  await page.click('[aria-label=Observe]');
  await expect(page.locator('body')).toHaveClass(/observe/);
  await expect(page.locator('.hud')).toHaveCSS('opacity', '0');
});

test('is an installable, offline-capable PWA', async ({ page, context }) => {
  await fresh(page);
  const manifest = await (await page.request.get('./manifest.webmanifest')).json();
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration()), null, { timeout: 30_000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => window.gameReady === true);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.gameReady === true, null, { timeout: 30_000 });
  await context.setOffline(false);
});

test('trading post: give goods for Marks, then shop in the market', async ({ page }) => {
  await page.goto('./?demo');
  await page.waitForFunction(() => window.gameReady === true);
  await page.evaluate(() => { const g = window.game; const b = [...g.s.buildings.values()].find((b) => b.type === 'trading_post')!; g.select(b.id); });
  await expect(page.locator('.contract').first()).toBeVisible();
  const before = await page.evaluate(() => window.game.s.trade.done);
  await page.locator('.contract .btn:has-text("Give")').first().click();
  await expect.poll(() => page.evaluate(() => window.game.s.trade.done)).toBeGreaterThan(before);
  await page.click('.btn:has-text("Market")');
  await expect(page.locator('.offer').first()).toBeVisible();
  const marks = await page.evaluate(() => window.game.s.trade.marks);
  await page.locator('.offer .btn').first().click();
  await expect.poll(() => page.evaluate(() => window.game.s.trade.marks)).toBeLessThan(marks);
});

test('every building places and opens its panel; every recipe and land works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?demo');
  await page.waitForFunction(() => window.gameReady === true);
  const report = await page.evaluate(() => {
    const g = window.game, s = g.s;
    const w = window as unknown as { actions: typeof import('../../src/core/actions'); content: { RECIPES: Record<string, { stations: string[]; unlock: string }> } };
    const A = w.actions;
    const problems: string[] = [];
    for (const id of ['patterns1', 'patterns2', 'patterns3', 'patterns4', 'patterns5', 'farming', 'ranching', 'weaving', 'baking', 'settlers', 'expeditions']) s.known.add(id);
    for (const r of Object.values(w.content.RECIPES) as { unlock: string }[]) if (r.unlock.startsWith('bp_')) s.known.add(r.unlock);
    // try every building type the player can build: find a valid spot by scanning
    const types = [...new Set([...s.buildings.values()].map((b) => b.type))];
    const candidates = ['workbench', 'composter', 'sieve', 'dew_catcher', 'clay_tub', 'kiln', 'harvester', 'wind_sifter', 'sawmill', 'press', 'millstone', 'furnace', 'assembler',
      'condenser', 'distiller', 'star_net', 'resonator', 'crucible', 'belt', 'express', 'depot', 'dispatcher', 'splitter', 'sorter', 'roost', 'crate', 'silo', 'warehouse',
      'windmill', 'engine', 'pylon', 'beacon', 'trading_post', 'hive', 'lantern', 'field', 'sheep_pen', 'chicken_coop', 'loom', 'oven', 'cottage', 'airdock',
      'plank_path', 'fence', 'hedge', 'flower_bed', 'bench', 'stone_path', 'stone_wall', 'planter', 'banner', 'well', 'lamp_post', 'brick_arch', 'fountain', 'gazebo', 'sky_path', 'crystal_lamp', 'statue', 'star_arch', 'monument', 'sapling', 'fruit_sapling', 'cherry_sapling', 'orange_sapling', 'date_sapling', 'pear_sapling', 'plum_sapling'];
    let placed = 0;
    for (const type of candidates) {
      let ok = false;
      for (let r = 0; r < 14 && !ok; r++) for (let y = -r; y <= r && !ok; y++) for (let x = -r; x <= r && !ok; x++) {
        if (A.canPlace(s, type, x, y).ok) { const res = A.place(s, type, x, y); if (res.ok) { ok = true; placed++; g.select(res.id!); } }
      }
      if (!ok && !types.includes(type)) problems.push('could not place ' + type);
    }
    // open every building's panel
    for (const b of s.buildings.values()) { g.select(b.id); g.ui.refreshAll(); }
    g.select(null);
    // every recipe selectable in its station
    for (const b of s.buildings.values()) {
      for (const [id, r] of Object.entries(w.content.RECIPES)) {
        if (!r.stations.includes(b.type)) continue;
        const res = A.setRecipe(s, b.id, id);
        if (!res.ok) problems.push(`recipe ${id} in ${b.type}: ${res.reason}`);
        g.select(b.id); g.ui.refreshAll();
      }
    }
    g.select(null);
    // land: every land type somewhere
    for (const land of ['plot', 'flagstone', 'skytile', 'marsh', 'dunes', 'frost', 'meadow']) {
      let ok = false;
      for (let r = 0; r < 16 && !ok; r++) for (let y = -r; y <= r && !ok; y++) for (let x = -r; x <= r && !ok; x++) if (A.canExpand(s, land, x, y).ok) ok = A.expand(s, land, x, y).ok;
      if (!ok) problems.push('could not lay ' + land);
    }
    // market: buy one of each visible offer
    s.trade.marks = 100000;
    for (const id of ['fruit', 'cherry', 'orange', 'date', 'pear', 'plum', 'copper', 'iron', 'stardust']) if (!A.buy(s, id).ok) problems.push('could not buy ' + id);
    // perks
    s.renown.points = 40;
    for (const id of ['green_thumb', 'well_oiled', 'haggler', 'swift_belts']) if (!A.takePerk(s, id).ok) problems.push('perk ' + id);
    g.advance(120);
    return { problems, placed };
  });
  expect(report.problems).toEqual([]);
  expect(report.placed).toBeGreaterThan(30);
  await page.click('.banner');
  await expect(page.locator('.modal .perk').first()).toBeVisible();
  expect(errors).toEqual([]);
});
