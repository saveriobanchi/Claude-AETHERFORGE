// Render HD models to PNG for review.
// Usage: node scripts/hd-preview.mjs <out.png> [job ...]
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { encodePNG } from './png.mjs';

const root = process.cwd();
const tmp = join(root, 'node_modules', '.cache', 'hd');
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, 'preview.mjs');
await build({ entryPoints: [join(root, 'src/render/hd/preview.ts')], bundle: true, format: 'esm', platform: 'node', outfile: entry, logLevel: 'warning' });
const [out, ...names] = process.argv.slice(2);
const { JOBS } = await import(pathToFileURL(entry).href + '?' + Date.now());
const list = names.length ? names : Object.keys(JOBS);

const workerSrc = `
import { parentPort, workerData } from 'node:worker_threads';
const { JOBS } = await import(workerData.entry);
parentPort.on('message', (name) => { const t = Date.now(); const img = JOBS[name](); parentPort.postMessage({ name, img, ms: Date.now() - t }); });
`;
const wfile = join(tmp, 'worker.mjs');
writeFileSync(wfile, workerSrc);
const results = {};
const queue = [...list];
const n = Math.min(cpus().length, queue.length);
await Promise.all(Array.from({ length: n }, () => new Promise((res) => {
  const w = new Worker(wfile, { workerData: { entry: pathToFileURL(entry).href + '?' + Date.now() } });
  const next = () => { const j = queue.shift(); if (j) w.postMessage(j); else { w.terminate(); res(); } };
  w.on('message', ({ name, img, ms }) => { results[name] = img; console.log(`${name}: ${img.w}×${img.h} ${ms} ms`); next(); });
  w.on('error', (e) => { console.error(e); res(); });
  next();
})));
// contact sheet on a warm sky background
const pad = 24;
const S = Number(process.env.SCALE ?? 3);
const up = (img) => {
  if (S === 1) return img;
  const w = img.w * S, h = img.h * S, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (((y / S) | 0) * img.w + ((x / S) | 0)) * 4, t = (y * w + x) * 4; d[t] = img.data[s]; d[t + 1] = img.data[s + 1]; d[t + 2] = img.data[s + 2]; d[t + 3] = img.data[s + 3]; }
  return { w, h, data: d };
};
const imgs = list.map((k) => results[k]).filter(Boolean).map(up);
const W = imgs.reduce((s, i) => s + i.w + pad, pad), H = Math.max(...imgs.map((i) => i.h)) + pad * 2;
const sheet = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = y / H, k = (y * W + x) * 4;
  sheet[k] = 120 + t * 110; sheet[k + 1] = 150 + t * 50; sheet[k + 2] = 200 - t * 40; sheet[k + 3] = 255;
}
let ox = pad;
for (const img of imgs) {
  const oy = H - pad - img.h;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const s = (y * img.w + x) * 4, d = ((oy + y) * W + ox + x) * 4, a = img.data[s + 3] / 255;
    for (let c = 0; c < 3; c++) sheet[d + c] = sheet[d + c] * (1 - a) + img.data[s + c] * a;
  }
  ox += img.w + pad;
}
writeFileSync(out, encodePNG(W, H, sheet, 6));
console.log('wrote', out);
