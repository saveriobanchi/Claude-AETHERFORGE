import { P } from './palette';
import { type RGBA, PixelCanvas, box, hash2, iso, mix, noise2, rgb, shadeRamp, bayer } from './pixel';
import { type SpriteDef, anchorOf, canvasFor } from './sprite';
import { blocks, flat } from './materials';

/** A cluster of lit foliage blobs. */
function foliage(c: PixelCanvas, blobs: [number, number, number][], sway: number, seed: number, r: RGBA[] = P.leaf, buds = 0, budColor: RGBA = P.cream[2]): void {
  // dark backing for depth
  for (const [bx, by, br] of blobs) c.ellipse(bx + sway, by + 1, br + 0.5, br * 0.86 + 0.5, r[0]);
  for (const [bx, by, br] of blobs) {
    c.ellipse(bx + sway, by, br, br * 0.86, (x, y) => {
      const dx = (x + 0.5 - bx - sway) / br, dy = (y + 0.5 - by) / (br * 0.86);
      let l = 0.62 - dx * 0.28 - dy * 0.34;
      const n = noise2(x / 2.6, y / 2.2, seed);
      l += (n - 0.5) * 0.3;
      if (hash2(x, y, seed) > 0.93) l += 0.25;
      return shadeRamp(r, l, x, y, 0.35);
    });
  }
  // buds / blossoms
  for (let i = 0; i < buds; i++) {
    const b = blobs[i % blobs.length];
    const ang = hash2(i, seed, 3) * Math.PI * 2;
    const rr = b[2] * 0.6 * hash2(i, seed, 4);
    const x = Math.round(b[0] + sway + Math.cos(ang) * rr), y = Math.round(b[1] + Math.sin(ang) * rr * 0.8);
    c.set(x, y, budColor);
    c.set(x + 1, y, mix(budColor, rgb(0xffffff), 0.35));
    c.set(x, y + 1, mix(budColor, P.ink, 0.35));
  }
}

function trunk(c: PixelCanvas, x: number, yBase: number, height: number, width: number, lean: number): void {
  for (let y = 0; y < height; y++) {
    const cx = x + Math.round((lean * y) / height);
    const w = width + (y < 3 ? 2 - Math.floor(y / 2) : 0);
    for (let i = 0; i < w; i++) {
      const px = cx - Math.floor(w / 2) + i;
      const l = 0.75 - (i / Math.max(1, w - 1)) * 0.5 + (hash2(px, yBase - y, 9) > 0.8 ? -0.15 : 0);
      c.set(px, yBase - y, shadeRamp(P.wood, l * 0.85, px, y, 0.3));
    }
  }
  // root flares
  c.set(x - Math.ceil(width / 2) - 2, yBase, P.wood[1]);
  c.set(x + Math.ceil(width / 2) + 1, yBase, P.wood[1]);
}

export function treeSprite(): SpriteDef {
  const H = 112;
  const [ax, ay] = anchorOf(1, H);
  const draw = (sway: number, buds: number, seed: number) => {
    const { c } = canvasFor(1, H);
    trunk(c, ax, ay - 1, 34, 4, 1);
    // branch stubs
    c.line(ax + 1, ay - 26, ax + 7, ay - 33, P.wood[2]);
    c.line(ax, ay - 22, ax - 6, ay - 29, P.wood[2]);
    foliage(c, [
      [ax - 11, ay - 40, 11], [ax + 11, ay - 42, 11], [ax, ay - 50, 13], [ax - 6, ay - 62, 10], [ax + 8, ay - 60, 10], [ax + 1, ay - 70, 8],
    ], sway, seed, P.leaf, buds);
    c.outline(0.5, true);
    return c;
  };
  const variants: Record<string, PixelCanvas[]> = {};
  for (let stock = 0; stock <= 5; stock++) variants['s' + stock] = [0, 1, 0, -1].map((sw) => draw(sw === -1 ? 0 : sw, stock * 2, 11));
  return { frames: variants.s5, ax, ay, fps: 2, variants };
}

export function elderTreeSprite(): SpriteDef {
  const H = 150;
  const pad = 14;
  const [ax, ay] = anchorOf(1, H, pad);
  const draw = (sway: number) => {
    const { c } = canvasFor(1, H, pad);
    trunk(c, ax, ay - 1, 40, 9, -1);
    c.line(ax - 3, ay - 30, ax - 18, ay - 44, P.wood[1]);
    c.line(ax - 3, ay - 31, ax - 18, ay - 45, P.wood[2]);
    c.line(ax + 3, ay - 34, ax + 18, ay - 48, P.wood[1]);
    foliage(c, [
      [ax - 22, ay - 52, 13], [ax + 22, ay - 54, 13], [ax, ay - 58, 17], [ax - 13, ay - 74, 15], [ax + 14, ay - 74, 14], [ax, ay - 90, 13], [ax - 28, ay - 66, 9], [ax + 29, ay - 66, 9],
    ], sway, 23, [rgb(0x2a3d22), rgb(0x3d5a2a), rgb(0x5a7a32), rgb(0x86994a), rgb(0xb7b85c)], 12, P.amber[3]);
    // amber drops on trunk
    c.set(ax - 3, ay - 16, P.amber[3]); c.set(ax - 3, ay - 15, P.amber[2]);
    c.set(ax + 3, ay - 24, P.amber[4]); c.set(ax + 3, ay - 23, P.amber[2]);
    c.outline(0.5, true);
    return c;
  };
  return { frames: [0, 1, 0, -1].map((s) => draw(s === -1 ? 0 : s)), ax, ay, fps: 2, lights: [[0, -24, 0xffb84a, 14]] };
}

export function saplingSprite(): SpriteDef {
  const H = 64;
  const [ax, ay] = anchorOf(1, H);
  const variants: Record<string, PixelCanvas[]> = {};
  for (let stage = 0; stage < 3; stage++) {
    variants['g' + stage] = [0, 1].map((sw) => {
      const { c } = canvasFor(1, H);
      // little soil mound
      c.ellipse(ax, ay, 6, 2.5, P.soil[3]);
      c.ellipse(ax - 1, ay - 0.5, 4, 1.5, P.soil[4]);
      const h = 6 + stage * 6;
      c.line(ax, ay - 1, ax + sw, ay - h, P.wood[3]);
      foliage(c, stage === 0 ? [[ax + sw, ay - h, 3]] : stage === 1 ? [[ax - 3 + sw, ay - h + 2, 4], [ax + 3 + sw, ay - h, 4]] : [[ax - 5 + sw, ay - h + 3, 5], [ax + 5 + sw, ay - h + 2, 5], [ax + sw, ay - h - 3, 6]], 0, 31);
      c.outline(0.5, true);
      return c;
    });
  }
  return { frames: variants.g0, ax, ay, fps: 1.5, variants };
}

export function tuftSprite(): SpriteDef {
  const H = 48;
  const [ax, ay] = anchorOf(1, H);
  const fr = [0, 1, 0, -1].map((sw) => {
    const { c } = canvasFor(1, H);
    const blades = [[-6, 9, -2], [-3, 13, -1], [0, 15, 0], [3, 12, 1], [6, 10, 2], [-1, 11, 1], [2, 14, -1], [-5, 7, 0], [5, 8, 0]];
    blades.forEach(([dx, h, lean], i) => {
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const x = ax + dx + Math.round((lean + sw) * t * t);
        const col = shadeRamp([rgb(0x3a5a2a), rgb(0x5e7a36), rgb(0x8c9a46), rgb(0xc4b860), rgb(0xe6d78a)], 0.3 + t * 0.7 - (i % 3) * 0.08, x, y, 0.2);
        c.set(x, ay - y, col);
      }
    });
    c.outline(0.45, true);
    return c;
  });
  return { frames: fr, ax, ay, fps: 2 };
}

export function nodeSprite(type: string): SpriteDef {
  const H = 80;
  const [ax, ay] = anchorOf(1, H);
  const fr = [0, 1, 2, 3].map((f) => {
    const { c, o } = canvasFor(1, H);
    if (type === 'node_vein') {
      // a craggy outcrop shot through with metal
      for (let i = 0; i < 3; i++) {
        const [px, py] = iso(o, [-6, 6, 0][i], [4, -4, -2][i], 0);
        const hgt = [14, 18, 26][i];
        c.poly([[px - 9, py], [px - 5, py - hgt], [px + 2, py - hgt - 3], [px + 9, py - hgt + 6], [px + 10, py]], (x, y) => {
          const l = 0.62 - (x - px) / 20 + (noise2(x / 3, y / 3, 5 + i) - 0.5) * 0.4;
          const vein = Math.abs(noise2(x / 5, y / 7, 50 + i) - 0.5) < 0.06;
          if (vein) return (x + y + f) % 4 === 0 ? P.copper[5] : (x + y) % 3 ? P.copper[3] : P.iron[4];
          return shadeRamp(P.rock, l, x, y, 0.4);
        });
      }
      c.outline(0.5);
    } else if (type === 'node_spring') {
      // a stone-rimmed pool, welling up
      box(c, o, 0, 0, 13, 13, 0, 3, { top: blocks('top', 3, 3, P.stone, 4), left: flat(P.stone, 'left'), right: flat(P.stone, 'right') });
      const [cx, cy] = iso(o, 0, 0, 3);
      c.ellipse(cx, cy, 17, 8.5, (x, y, d) => shadeRamp(P.water, 0.8 - d * 0.5 + (Math.sin((x + y) * 0.7 + f * 1.6) > 0.8 ? 0.3 : 0), x, y, 0.3));
      const rr = 3 + f * 2;
      c.ellipse(cx, cy, rr, rr / 2, (_x, _y, d) => (d > 0.6 ? P.water[4] : 0));
      for (let i = 0; i < 4; i++) c.set(cx - 6 + i * 4, cy - 6 - ((f + i) % 4) * 3, P.cloud[4]);
    } else {
      // fallen star: a golden crystal half-buried
      c.ellipse(ax, ay, 12, 5, P.rock[2]);
      c.ellipse(ax - 1, ay - 1, 9, 3.5, P.rock[3]);
      const tip = ay - 30 - (f % 2);
      c.poly([[ax - 8, ay - 2], [ax - 3, tip + 6], [ax + 1, tip], [ax + 8, ay - 3], [ax + 2, ay + 1]], (x, y) => {
        const l = 0.8 - (x - ax + 8) / 22 + (bayer(x, y) - 0.5) * 0.2;
        return shadeRamp(P.star, l, x, y, 0.2);
      });
      c.line(ax - 2, ay - 6, ax + 0, tip + 4, P.star[3]);
      if (f % 2 === 0) { c.set(ax + 6, tip + 2, P.star[3]); c.set(ax - 7, tip + 10, P.star[2]); }
      c.outline(0.45);
    }
    return c;
  });
  const lights: SpriteDef['lights'] = type === 'node_vein' ? [[0, -10, 0xffa050, 14]] : type === 'node_spring' ? [[0, -4, 0x8adcff, 16]] : [[0, -16, 0xffe08a, 24]];
  return { frames: fr, ax, ay, fps: type === 'node_spring' ? 5 : 3, lights };
}

export { noise2 };
