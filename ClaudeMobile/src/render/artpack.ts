import { Rectangle, Texture } from 'pixi.js';

/**
 * Runtime side of the baked art pack (public/art, produced by
 * scripts/bake-art.mjs). Sheets become GPU textures; every image is a
 * sub-texture with its anchor. The interface gets data URLs of crops.
 */

export interface ArtImage { tex: Texture; ax: number; ay: number; w: number; h: number }

export interface ArtSprite {
  fps: number;
  lamp: boolean;
  main: string;
  /** Night glows relative to the anchor in world px: [x, y, colour, radius]. */
  lights: [number, number, number, number][];
  smoke?: [number, number];
  variants: Record<string, ArtImage[]>;
  frames: ArtImage[];
}

type Rect = [number, number, number, number, number, number, number];
interface Manifest {
  version: string;
  R: number;
  sheets: number;
  depths: number[];
  colVariants: number;
  decorKinds: string[];
  decorVariants: number;
  sprites: Record<string, { fps: number; main: string; lamp: boolean; variants: Record<string, number>; lights: [number, number, number, number][]; smoke?: [number, number] }>;
  rects: Record<string, Rect>;
}

class Art {
  ready = false;
  R = 2;
  depths: number[] = [];
  colVariants = 1;
  decorKinds: string[] = [];
  decorVariants = 1;
  sprites = new Map<string, ArtSprite>();
  private man: Manifest | null = null;
  private sheets: (HTMLImageElement | ImageBitmap)[] = [];
  private textures: Texture[] = [];
  private cache = new Map<string, ArtImage>();
  private urls = new Map<string, string>();

  has(key: string): boolean {
    return !!this.man?.rects[key];
  }

  img(key: string): ArtImage {
    let a = this.cache.get(key);
    if (a) return a;
    const r = this.man?.rects[key];
    if (!r) throw new Error('missing art: ' + key);
    const [s, x, y, w, h, ax, ay] = r;
    a = { tex: new Texture({ source: this.textures[s].source, frame: new Rectangle(x, y, w, h) }), ax, ay, w, h };
    this.cache.set(key, a);
    return a;
  }

  /** PNG data URL of an image (for the DOM interface). */
  url(key: string): string {
    let u = this.urls.get(key);
    if (u) return u;
    const r = this.man?.rects[key];
    if (!r) return '';
    const [s, x, y, w, h] = r;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(this.sheets[s] as CanvasImageSource, x, y, w, h, 0, 0, w, h);
    u = c.toDataURL();
    this.urls.set(key, u);
    return u;
  }

  async load(base = './art/'): Promise<void> {
    const res = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('art pack missing — run `npm run art`');
    const man = (await res.json()) as Manifest;
    this.man = man;
    this.R = man.R;
    this.depths = man.depths;
    this.colVariants = man.colVariants;
    this.decorKinds = man.decorKinds;
    this.decorVariants = man.decorVariants;
    this.sheets = await Promise.all(Array.from({ length: man.sheets }, (_, i) => new Promise<HTMLImageElement>((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => fail(new Error('art sheet failed to load'));
      im.src = `${base}sheet${i}.png?v=${man.version}`;
    })));
    this.textures = this.sheets.map((im) => {
      const t = Texture.from(im as HTMLImageElement);
      t.source.scaleMode = 'nearest';
      return t;
    });
    for (const [type, sp] of Object.entries(man.sprites)) {
      const variants: Record<string, ArtImage[]> = {};
      for (const [v, n] of Object.entries(sp.variants)) variants[v] = Array.from({ length: n }, (_, i) => this.img(`${type}:${v}:${i}`));
      this.sprites.set(type, { fps: sp.fps, lamp: sp.lamp, main: sp.main, lights: sp.lights, smoke: sp.smoke, variants, frames: variants[sp.main] });
    }
    this.ready = true;
  }
}

export const art = new Art();
