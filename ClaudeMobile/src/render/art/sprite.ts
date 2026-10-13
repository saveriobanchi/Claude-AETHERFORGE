import { type IsoOrigin, PixelCanvas } from './pixel';

/** A building/nature sprite: animation frames plus anchor and light hints. */
export interface SpriteDef {
  frames: PixelCanvas[];
  /** Anchor pixel: the footprint centre on the ground. */
  ax: number;
  ay: number;
  fps: number;
  /** Status lamp position relative to anchor (pixels). */
  lamp?: [number, number];
  /** Night glows relative to anchor: [x, y, colour 0xRRGGBB, radius]. */
  lights?: [number, number, number, number][];
  /** Smoke/steam emitter relative to anchor. */
  smoke?: [number, number];
  /** Extra decorative frames keyed by state name (e.g. stock levels). */
  variants?: Record<string, PixelCanvas[]>;
}

export interface Canvas { c: PixelCanvas; o: IsoOrigin }

/** New canvas for an n×n footprint, `h` pixels tall, ground centre at the bottom. */
export function canvasFor(size: number, h: number, pad = 0): Canvas {
  const w = 64 * size + pad * 2;
  const c = new PixelCanvas(w, h);
  return { c, o: { x: w / 2, y: h - 16 * size } };
}

export function anchorOf(size: number, h: number, pad = 0): [number, number] {
  return [32 * size + pad, h - 16 * size];
}

export function frames(n: number, draw: (f: number) => PixelCanvas): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  for (let i = 0; i < n; i++) out.push(draw(i));
  return out;
}
