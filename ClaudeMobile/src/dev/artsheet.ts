import { addTile, createState, key } from '../core/state';
import { CHUNK, chunkOrigin } from '../render/art/terrain';
import { renderVoxChunk as renderChunk } from '../render/vox/terrain';

const s = createState();
s.tiles.clear();
const shape = [
  '....##....',
  '..######..',
  '.########.',
  '##########',
  '.#####SS#.',
  '..##SSSS##',
  '...#KKSS#.',
  '....##....',
];
shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') addTile(s, x - 4, y - 3, ch === 'S' ? 'stone' : ch === 'K' ? 'sky' : 'grass'); }));
addTile(s, 7, 4, 'grass');
const get = (x: number, y: number) => s.tiles.get(key(x, y));
const scale = 2;
const cv = document.getElementById('c') as HTMLCanvasElement;
cv.width = Number(new URLSearchParams(location.search).get('w') ?? 1400); cv.height = Number(new URLSearchParams(location.search).get('h') ?? 900);
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#3f7f84'; ctx.fillRect(0, 0, cv.width, cv.height);
const offX = 700, offY = 250;
const chunks = new Set<string>();
for (const t of s.tiles.values()) chunks.add(`${Math.floor(t.x / CHUNK)},${Math.floor(t.y / CHUNK)}`);
const list = [...chunks].map((c) => c.split(',').map(Number)).sort((a, b) => a[0] + a[1] - b[0] - b[1]);
for (const [cx, cy] of list) {
  const pc = renderChunk(get, cx, cy);
  if (!pc) continue;
  const [ox, oy] = chunkOrigin(cx, cy);
  const tmp = pc.toCanvas();
  ctx.drawImage(tmp, offX + ox * scale / 1, offY + oy * scale, pc.w * scale, pc.h * scale);
}
(window as unknown as { artReady: boolean }).artReady = true;

// ── sprite gallery ──
import { SPRITE_TYPES, spriteFor } from '../render/art/registry';
const params = new URLSearchParams(location.search);
if (params.has('sprites')) {
  const t0 = performance.now();
  ctx.fillStyle = '#2c6470'; ctx.fillRect(0, 0, cv.width, cv.height);
  let gx = 10, gy = 10, rowH = 0;
  const sc = Number(params.get('scale') ?? 2);
  const frame = Number(params.get('frame') ?? 0);
  for (const t of SPRITE_TYPES) {
    const sp = spriteFor(t);
    const f = sp.frames[Math.min(frame, sp.frames.length - 1)];
    const w = f.w * sc, h = f.h * sc;
    if (gx + w > cv.width) { gx = 10; gy += rowH + 16; rowH = 0; }
    ctx.drawImage(f.toCanvas(), gx, gy, w, h);
    ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText(t, gx + 2, gy + h + 10);
    gx += w + 8; rowH = Math.max(rowH, h);
  }
  ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`${(performance.now() - t0).toFixed(0)} ms`, 10, cv.height - 10);
}

import { ITEM_IDS } from '../core/content/items';
import { iconFor } from '../render/art/icons';
if (params.has('icons')) {
  ctx.fillStyle = '#1c2a2e'; ctx.fillRect(0, 0, cv.width, cv.height);
  ITEM_IDS.forEach((id, i) => {
    const x = 10 + (i % 9) * 150, y = 10 + Math.floor(i / 9) * 90;
    ctx.drawImage(iconFor(id).toCanvas(), x, y, 64, 64);
    ctx.drawImage(iconFor(id).toCanvas(), x + 72, y + 24, 16, 16);
    ctx.fillStyle = '#ddd'; ctx.font = '11px monospace'; ctx.fillText(id, x, y + 78);
  });
}

import * as VN from '../render/vox/nature';
if (params.has('vox')) {
  ctx.fillStyle = '#5a7f9a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const sc = Number(params.get('scale') ?? 3);
  let x = 20;
  const t0 = performance.now();
  for (const sp of [VN.treeSprite(), VN.elderTreeSprite()]) {
    const f = sp.frames[0];
    ctx.drawImage(f.toCanvas(), x, 20, f.w * sc, f.h * sc);
    x += f.w * sc + 30;
  }
  ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`${(performance.now() - t0).toFixed(0)} ms`, 10, cv.height - 10);
}
