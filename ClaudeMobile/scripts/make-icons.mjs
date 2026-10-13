// Renders PWA icons from the game's own pixel art (dev server must be running).
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await chromium.launch();
const jobs = [['icon-512.png', 512, 14], ['icon-192.png', 192, 14], ['icon-maskable-512.png', 512, 26], ['apple-touch-icon.png', 180, 16], ['favicon-32.png', 32, 6]];
for (const [name, size, safe] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.goto(`${base}/icon.html?size=${size}&safe=${safe}`);
  await page.waitForFunction(() => window.artReady === true);
  await page.locator('#c').screenshot({ path: `public/icons/${name}` });
  await page.close();
}
await browser.close();
