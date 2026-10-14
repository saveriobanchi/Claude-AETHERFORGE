// Renders the block-art preview island. Usage: node scripts/blocks-preview.mjs <out.png> [scale]
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { encodePNG } from './png.mjs';
const root = process.cwd();
const tmp = join(root, 'node_modules', '.cache', 'blocks');
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, 'preview.mjs');
await build({ entryPoints: [join(root, 'src/render/blocks/preview.ts')], bundle: true, format: 'esm', platform: 'node', outfile: entry, logLevel: 'warning' });
const mod = await import(pathToFileURL(entry).href + '?' + Date.now());
const load = (rel) => { const p = PNG.sync.read(readFileSync(join(root, 'art/cc0', rel))); return { w: p.width, h: p.height, data: p.data }; };
const [out, sc = '2'] = process.argv.slice(2);
const S = Number(sc);
const c = mod.island(load);
const W = c.w * S, H = c.h * S, img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const s = (((y / S) | 0) * c.w + ((x / S) | 0)) * 4, d = (y * W + x) * 4, a = c.col[s + 3] / 255, t = y / H;
  const bg = [120 + t * 110, 160 + t * 50, 210 - t * 40];
  for (let k = 0; k < 3; k++) img[d + k] = bg[k] * (1 - a) + c.col[s + k] * a;
  img[d + 3] = 255;
}
writeFileSync(out, encodePNG(W, H, img, 6));
console.log('wrote', out);
