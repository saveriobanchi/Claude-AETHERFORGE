import { ITEM_IDS } from '../core/content/items';
import type { PixelCanvas } from './art/pixel';
import { SPRITE_TYPES, makeSprite } from './art/registry';
import type { ArtManifest, Rect } from './artpack';
import { beltFrames } from './vox/buildings';
import { voxIcon, voxIconSmall } from './vox/items';

/**
 * Bakes every sprite, belt frame and item icon and shelf-packs them into
 * sheets. Pure (no DOM): runs in Node at build time.
 */
export function bakeArt(sheetW = 2048): { manifest: ArtManifest; sheets: { w: number; h: number; data: Uint8ClampedArray }[] } {
  const pages: { items: [PixelCanvas, number, number][]; x: number; y: number; rowH: number }[] = [];
  const put = (pc: PixelCanvas): Rect => {
    let p = pages[pages.length - 1];
    if (!p) { p = { items: [], x: 0, y: 0, rowH: 0 }; pages.push(p); }
    if (p.x + pc.w > sheetW) { p.x = 0; p.y += p.rowH + 1; p.rowH = 0; }
    if (p.y + pc.h > sheetW) { p = { items: [], x: 0, y: 0, rowH: 0 }; pages.push(p); }
    const r: Rect = [pages.length - 1, p.x, p.y, pc.w, pc.h];
    p.items.push([pc, p.x, p.y]);
    p.x += pc.w + 1;
    p.rowH = Math.max(p.rowH, pc.h);
    return r;
  };
  const manifest: ArtManifest = { version: 1, sheets: 0, sprites: {}, belt: [], express: [], icons: {}, iconsSmall: {} };
  for (const t of SPRITE_TYPES) {
    const d = makeSprite(t);
    const variants: Record<string, Rect[]> = {};
    if (d.variants) for (const k in d.variants) variants[k] = d.variants[k].map(put);
    manifest.sprites[t] = { ax: d.ax, ay: d.ay, fps: d.fps, lamp: d.lamp, lights: d.lights, smoke: d.smoke, frames: d.variants ? [] : d.frames.map(put), variants: d.variants ? variants : undefined };
    // frames that alias a variant are stored once
    if (d.variants) {
      const k = Object.keys(d.variants).find((kk) => d.variants![kk] === d.frames);
      manifest.sprites[t].framesVariant = k;
      if (!k) manifest.sprites[t].frames = d.frames.map(put);
    }
  }
  for (let dir = 0; dir < 4; dir++) {
    manifest.belt.push(beltFrames(dir, false).map(put));
    manifest.express.push(beltFrames(dir, true).map(put));
  }
  for (const id of ITEM_IDS) { manifest.icons[id] = put(voxIcon(id)); manifest.iconsSmall[id] = put(voxIconSmall(id)); }
  manifest.sheets = pages.length;
  const sheets = pages.map((p) => {
    const h = p.y + p.rowH;
    const data = new Uint8ClampedArray(sheetW * h * 4);
    for (const [pc, x, y] of p.items) for (let yy = 0; yy < pc.h; yy++) data.set(pc.data.subarray(yy * pc.w * 4, (yy + 1) * pc.w * 4), ((y + yy) * sheetW + x) * 4);
    return { w: sheetW, h, data };
  });
  return { manifest, sheets };
}
