import type { ItemId } from '../core/content/items';
import { PixelCanvas } from './art/pixel';
import type { SpriteDef } from './art/sprite';

/** [sheet, x, y, w, h] */
export type Rect = [number, number, number, number, number];

export interface ArtManifest {
  version: number;
  sheets: number;
  sprites: Record<string, Omit<SpriteDef, 'frames' | 'variants'> & { frames: Rect[]; variants?: Record<string, Rect[]>; framesVariant?: string }>;
  belt: Rect[][];
  express: Rect[][];
  icons: Record<string, Rect>;
  iconsSmall: Record<string, Rect>;
}

/** Art loaded from the pre-baked pack (production builds). Empty in dev. */
export const pack = {
  sprites: new Map<string, SpriteDef>(),
  belt: [] as PixelCanvas[][],
  express: [] as PixelCanvas[][],
  icons: new Map<ItemId, PixelCanvas>(),
  iconsSmall: new Map<ItemId, PixelCanvas>(),
};

/** Load public/art/*. Returns false (and leaves the pack empty) if unavailable. */
export async function loadArtPack(base = './art/'): Promise<boolean> {
  try {
    const res = await fetch(base + 'manifest.json');
    if (!res.ok) return false;
    const m = (await res.json()) as ArtManifest;
    const sheets = await Promise.all(Array.from({ length: m.sheets }, async (_, i) => {
      const blob = await (await fetch(`${base}sheet${i}.png`)).blob();
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const cv = document.createElement('canvas');
      cv.width = bmp.width; cv.height = bmp.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    }));
    const cut = ([s, x, y, w, h]: Rect): PixelCanvas => {
      const pc = new PixelCanvas(w, h);
      const src = sheets[s];
      for (let yy = 0; yy < h; yy++) pc.data.set(src.data.subarray(((y + yy) * src.width + x) * 4, ((y + yy) * src.width + x + w) * 4), yy * w * 4);
      return pc;
    };
    for (const t in m.sprites) {
      const d = m.sprites[t];
      const variants = d.variants ? Object.fromEntries(Object.entries(d.variants).map(([k, r]) => [k, r.map(cut)])) : undefined;
      const frames = d.framesVariant && variants ? variants[d.framesVariant] : d.frames.map(cut);
      pack.sprites.set(t, { frames, ax: d.ax, ay: d.ay, fps: d.fps, lamp: d.lamp, lights: d.lights, smoke: d.smoke, variants });
    }
    pack.belt = m.belt.map((r) => r.map(cut));
    pack.express = m.express.map((r) => r.map(cut));
    for (const id in m.icons) pack.icons.set(id as ItemId, cut(m.icons[id]));
    for (const id in m.iconsSmall) pack.iconsSmall.set(id as ItemId, cut(m.iconsSmall[id]));
    return true;
  } catch {
    return false;
  }
}
