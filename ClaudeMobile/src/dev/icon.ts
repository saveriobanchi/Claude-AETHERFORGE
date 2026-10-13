import { addTile, createState, key } from '../core/state';
import { P } from '../render/art/palette';
import { PixelCanvas, bayer, mix, rgb } from '../render/art/pixel';
import { spriteFor } from '../render/art/registry';
import { chunkOrigin, renderChunk } from '../render/art/terrain';

/** Renders the app icon from the game's own art: a seed of land in the sky. */
function icon(px: number, safe: number): HTMLCanvasElement {
  const art = 128; // art pixels across
  const c = new PixelCanvas(art, art);
  for (let y = 0; y < art; y++) for (let x = 0; x < art; x++) {
    const t = y / art;
    const top = rgb(0x1d5866), hor = rgb(0xcfe4d4);
    const v = t * t * 0.9 + (bayer(x, y) - 0.5) * 0.08;
    c.set(x, y, mix(top, hor, Math.max(0, Math.min(1, v))));
  }
  // soft cloud band
  for (let i = 0; i < 7; i++) c.ellipse(8 + i * 20, 104 + (i % 2) * 5, 16, 9, (xx, yy) => mix(P.cloud[3], P.cloud[4], bayer(xx, yy) > 0.5 ? 0.6 : 0.2));
  const s = createState();
  s.tiles.clear();
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) addTile(s, x, y, 'grass');
  const get = (x: number, y: number) => s.tiles.get(key(x, y));
  const chunks: [number, number][] = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
  const scale = (art - safe * 2) / 200;
  const off = { x: art / 2, y: art / 2 - 8 * ((art - safe * 2) / 200) };
  const layer = new PixelCanvas(400, 400);
  for (const [cx, cy] of chunks) {
    const pc = renderChunk(get, cx, cy);
    if (!pc) continue;
    const [ox, oy] = chunkOrigin(cx, cy);
    for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
      const col = pc.get(x, y);
      if (col & 255) layer.set(ox + x + 200, oy + y + 120, col);
    }
  }
  const tree = spriteFor('tree');
  const tf = tree.variants!.s5[0];
  layer.blit(tf, 200 - tree.ax, 120 - tree.ay);
  // downsample the 400×400 layer by `1/scale` with nearest sampling
  for (let y = 0; y < art; y++) for (let x = 0; x < art; x++) {
    const lx = Math.floor((x - off.x) / scale + 200), ly = Math.floor((y - off.y) / scale + 120);
    const col = layer.get(lx, ly);
    if (col & 255) c.set(x, y, col);
  }
  const out = document.createElement('canvas');
  out.width = out.height = px;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c.toCanvas(), 0, 0, px, px);
  return out;
}

const p = new URLSearchParams(location.search);
const size = Number(p.get('size') ?? 512);
const safe = Number(p.get('safe') ?? 14);
const cv = icon(size, safe);
const target = document.getElementById('c') as HTMLCanvasElement;
target.width = size;
target.height = size;
target.getContext('2d')!.drawImage(cv, 0, 0);
(window as unknown as { artReady: boolean }).artReady = true;
