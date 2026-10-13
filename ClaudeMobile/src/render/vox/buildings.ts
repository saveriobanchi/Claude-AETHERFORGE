import { hash2 } from '../art/pixel';
import { PixelCanvas as PixelCanvasCtor } from '../art/pixel';
import type { SpriteDef } from '../art/sprite';
import { M } from './mats';
import { bakeFrames } from './nature';
import { band, barrel, bricks, chimney, crate, lantern, pile, planks, plinth, post, roofU, roofV, stones } from './kit';
import { type Mat, Vol } from './vox';

type Make = (f: number) => Vol;

/** Pixel offset (from the ground-centre anchor) of a voxel position. */
function px(w: number, i: number, j: number, k: number): [number, number] {
  const u = (i - w / 2) * 2, v = (j - w / 2) * 2, z = k * 2;
  return [Math.round(u - v), Math.round((u + v) / 2 - z)];
}

function def(make: Make, n: number, fps: number, extra: Partial<SpriteDef> = {}): SpriteDef {
  const b = bakeFrames(make, n);
  return { frames: b.frames, ax: b.ax, ay: b.ay, fps, ...extra };
}

const P = 3; // default overhang padding
const W = 16 + P * 2;
const c = W / 2; // centre coordinate
const L = (n: number) => n + P; // local tile coord → volume coord

// ───────────────────────── early crafting ─────────────────────────

export function workbench(): SpriteDef {
  return def(() => {
    const v = new Vol(W, W, 24);
    // legs and stretchers
    for (const [i, j] of [[2, 3], [13, 3], [2, 12], [13, 12]]) post(v, L(i), L(j), 0, 8, M.woodDark);
    v.box(L(2), L(3), 3, L(13), L(3), 3, M.woodDark);
    v.box(L(2), L(12), 3, L(13), L(12), 3, M.woodDark);
    // shelf with planks stacked
    planks(v, L(3), L(4), 3, L(12), L(11), 3, 'u', M.plank, null);
    v.box(L(4), L(5), 4, L(9), L(8), 5, M.plank, (i) => (i % 2 ? 0.08 : -0.04));
    // thick top
    planks(v, L(1), L(2), 9, L(14), L(13), 10, 'u');
    // vise, saw, hammer, nails
    v.box(L(11), L(3), 11, L(13), L(5), 13, M.iron);
    v.box(L(12), L(2), 12, L(12), L(6), 12, M.ironDark);
    v.box(L(3), L(9), 11, L(9), L(9), 11, M.iron);
    v.box(L(9), L(9), 11, L(10), L(10), 11, M.wood);
    for (let q = 0; q < 6; q++) v.set(L(3 + q), L(8), 11, q % 2 ? M.iron : null);
    v.box(L(5), L(4), 11, L(5), L(7), 11, M.wood);
    v.box(L(4), L(3), 11, L(6), L(4), 12, M.ironDark);
    // little lantern on a hook
    v.box(L(14), L(13), 11, L(14), L(13), 16, M.woodDark);
    lantern(v, L(14), L(13) - 1, 13);
    return v;
  }, 1, 1, { lights: [lightAt(W, L(14), L(12), 14, 0xffc060, 16)] });
}

function lightAt(w: number, i: number, j: number, k: number, col: number, r: number): [number, number, number, number] {
  const [x, y] = px(w, i, j, k);
  return [x, y, col, r];
}

export function composter(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 20);
    planks(v, L(1), L(1), 0, L(14), L(14), 10, 'k');
    // hollow it and fill with dark soil + leaves
    v.box(L(2), L(2), 2, L(13), L(13), 10, M.dirt, (i, j) => (hash2(i, j, 4) - 0.5) * 0.3 - 0.1);
    v.box(L(2), L(2), 10, L(13), L(13), 10, M.dirt, (i, j) => (hash2(i, j, 5) - 0.5) * 0.3);
    for (let q = 0; q < 22; q++) {
      const i = L(2 + Math.floor(hash2(q, 1, f) * 12)), j = L(2 + Math.floor(hash2(q, 2, f) * 12));
      v.set(i, j, 11, q % 3 === 0 ? M.autumn : M.leaf, (hash2(q, 3) - 0.5) * 0.3);
    }
    // corner posts poking up and iron bands
    for (const [i, j] of [[1, 1], [14, 1], [1, 14], [14, 14]]) post(v, L(i), L(j), 0, 12, M.woodDark);
    band(v, L(1), L(1), L(14), L(14), 3);
    band(v, L(1), L(1), L(14), L(14), 8);
    // a pitchfork leaning on the side
    v.line([L(15), L(6), 1], [L(16), L(4), 14], M.wood, 0.4);
    return v;
  }, 2, 1, { smoke: [0, -26] });
}

export function sieve(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 22);
    const sh = [0, 1, -1][f];
    for (const [i, j] of [[2, 2], [13, 2], [2, 13], [13, 13]]) post(v, L(i), L(j), 0, 9, M.woodDark);
    // frame tray with mesh
    const i0 = L(1 + sh), i1 = L(14 + sh);
    planks(v, i0, L(1), 10, i1, L(14), 11, 'u');
    v.box(i0 + 1, L(2), 10, i1 - 1, L(13), 10, M.iron, (i, j) => ((i + j) % 2 ? null : 0));
    v.box(i0 + 1, L(2), 11, i1 - 1, L(13), 11, M.iron, () => null);
    pile(v, c + sh, c, 11, 4.5, M.dirt, 3);
    // grains falling and a pile of pebbles beneath
    for (let q = 0; q < 4; q++) v.set(L(4 + q * 2), L(6 + (q % 2) * 3), 3 + ((f * 3 + q * 2) % 6), M.dirt);
    pile(v, c, c, 0, 4, M.stone, 7);
    return v;
  }, 3, 10);
}

export function dewCatcher(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 46);
    post(v, L(1), L(10), 0, 40, M.wood, 2);
    post(v, L(10), L(1), 0, 40, M.wood, 2);
    v.line([L(1), L(10), 40], [L(10), L(1), 40], M.woodDark, 0.5);
    // mesh between posts
    for (let k = 14; k <= 39; k++) for (let s = 1; s <= 8; s++) {
      if (k % 3 === 0 || s % 3 === 0) v.set(L(1 + s), L(10 - s), k, M.cloth, 0.12);
    }
    // droplets sliding down
    for (let q = 0; q < 3; q++) v.set(L(3 + q * 3), L(8 - q * 3), 38 - ((f * 6 + q * 9) % 22), M.water, 0.25);
    // collection basin with water
    v.cyl(L(9), L(9), 0, 5, 5.5, M.clay, (_i, _j, k) => (k === 5 ? 0.1 : 0));
    v.cyl(L(9), L(9), 5, 5, 4.5, M.water, (i) => (Math.sin(i * 1.3 + f) > 0.6 ? 0.15 : 0));
    return v;
  }, 4, 4, { lights: [lightAt(W, L(9), L(9), 6, 0x8adcff, 12)] });
}

export function clayTub(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 22);
    barrel(v, c, c, 0, 10, 7);
    v.cyl(c, c, 10, 10, 6, M.clay, (i, j) => Math.sin((i - j) * 0.6 + f * 1.5) * 0.1);
    const a = (f / 4) * Math.PI * 2;
    const pi = c + Math.cos(a) * 3, pj = c + Math.sin(a) * 3;
    v.line([pi, pj, 9], [pi + 1, pj - 1, 20], M.wood, 0.5);
    v.line([pi, pj, 9], [pi, pj, 11], M.plank, 1);
    // small sacks of loam beside
    v.sphere(L(14), L(13), 2, 2.5, M.cloth, () => 0, 0.9);
    return v;
  }, 4, 5);
}

export function kiln(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 36);
    plinth(v, P, 2);
    // beehive dome of brick
    for (let k = 2; k < 24; k++) {
      const t = (k - 2) / 22;
      const r = 7 * Math.sqrt(Math.max(0, 1 - t * t * 0.95));
      v.cyl(c, c, k, k, r, M.brick, (i, j, kk, a) => {
        const row = Math.floor(kk / 2);
        return (kk % 2 === 1 || Math.cos(a * 10 + row) > 0.92 ? -0.22 : 0) + (hash2(i, j + kk) - 0.5) * 0.14;
      });
    }
    // glowing arched mouth facing +v
    for (let k = 3; k <= 9; k++) for (let i = c - 2; i <= c + 1; i++) {
      if (k === 9 && (i === c - 2 || i === c + 1)) continue;
      v.set(i, c + 6, k, M.fire, ((hash2(i, k, f) - 0.5) * 0.4) + (k < 5 ? 0.1 : -0.1));
      v.set(i, c + 7, k, null);
    }
    // stacked logs as fuel
    for (let q = 0; q < 3; q++) v.cylU(L(1), L(5), L(15) - q * 2, 2 + (q % 2) * 2, 1, M.log);
    chimney(v, L(10), L(4), 18, 29);
    return v;
  }, 4, 7, { lights: [lightAt(W, c, c + 7, 6, 0xff8a3a, 26)], smoke: px(W, L(11), L(5), 31) });
}

export function harvester(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 44);
    plinth(v, P, 1, M.cobble);
    // timber hut
    planks(v, L(1), L(6), 1, L(9), L(14), 11, 'k');
    v.box(L(4), L(14), 2, L(6), L(14), 7, M.woodDark);
    v.box(L(2), L(14), 6, L(3), L(14), 8, M.glass);
    roofV(v, L(5), L(15), L(0), L(10), 12, M.red, 1);
    // crane mast and swinging arm with claw
    post(v, L(12), L(3), 1, 30, M.wood, 2);
    const a = Math.sin((f / 6) * Math.PI * 2) * 0.8 - 0.6;
    const ex = L(13) + Math.cos(a) * 12, ey = L(4) + Math.sin(a) * 12;
    v.line([L(13), L(4), 30], [ex, ey, 26], M.wood, 0.6);
    v.line([ex, ey, 26], [ex, ey, 20], M.ironDark, 0.4);
    v.box(ex - 1, ey - 1, 18, ex + 1, ey + 1, 19, M.iron);
    v.gearU(L(14), L(4), 28, 2.5, M.brass, f * 0.5, 6);
    // basket of timber
    planks(v, L(11), L(9), 1, L(15), L(13), 5, 'k');
    for (let q = 0; q < 3; q++) v.cylU(L(11), L(15), L(10) + q, 6 + (q % 2), 0.9, M.log);
    lantern(v, L(1), L(5), 8);
    return v;
  }, 6, 8, { lamp: [0, 0], lights: [lightAt(W, L(1), L(5), 9, 0xffc060, 14)] });
}

export function windSifter(): SpriteDef {
  const n = 8;
  return def((f) => {
    const v = new Vol(W, W, 50);
    plinth(v, P, 2);
    planks(v, L(1), L(1), 2, L(14), L(14), 16, 'u');
    band(v, L(1), L(1), L(14), L(14), 9, M.iron);
    // hopper of loam on top
    v.cone(c, c, 17, 21, 7, 4.5, M.plank, true);
    pile(v, c, c, 21, 3.5, M.dirt, 2);
    // mast + four sails turning
    post(v, c - 1, c - 1, 22, 34, M.woodDark, 2);
    const rot = (f / n) * (Math.PI / 2);
    for (let s = 0; s < 4; s++) {
      const a = rot + (s * Math.PI) / 2;
      for (let r = 2; r <= 9; r++) {
        const i = c + Math.cos(a) * r, k = 34 + Math.sin(a) * r;
        v.set(i, c + 3, k, r % 3 === 0 ? M.woodDark : M.cloth, 0.05);
        v.set(i + Math.cos(a + Math.PI / 2), c + 3, k + Math.sin(a + Math.PI / 2), M.cloth, -0.05);
      }
    }
    v.box(c - 1, c + 2, 33, c, c + 3, 34, M.iron);
    // chute with pebbles
    v.box(L(15), L(6), 6, L(16), L(9), 7, M.wood);
    v.set(L(17), L(7), 5 - (f % 3), M.stone);
    return v;
  }, n, 12, { lamp: [0, 0] });
}

export function sawmill(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 36);
    plinth(v, P, 2);
    for (const [i, j] of [[1, 2], [14, 2], [1, 13], [14, 13]]) post(v, L(i), L(j), 2, 10, M.woodDark);
    planks(v, L(1), L(2), 11, L(14), L(13), 12, 'u');
    // log being cut
    v.cylU(L(1), L(9), c, 15.5, 3, M.log, (_i, _j, _k, a) => Math.cos(a * 5) * 0.06);
    v.box(L(1), c - 2, 13, L(1), c + 2, 17, M.wood, (_i, j, k) => (Math.hypot(j - c, k - 15.5) % 2 < 1 ? 0.15 : -0.05));
    // spinning saw blade (in the u-k plane, visible on the left face)
    const rot = f * 0.5;
    for (let k = 9; k <= 22; k++) for (let i = L(9); i <= L(15); i++) {
      const dx = i + 0.5 - L(12), dz = k + 0.5 - 15;
      const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx) + rot;
      if (d > 6.2) continue;
      if (d > 5.2 && Math.cos(a * 12) < 0) continue;
      v.set(i, c, k, d < 1.5 ? M.ironDark : M.iron, d > 5 ? 0.2 : Math.cos(a * 3) > 0.8 ? 0.15 : 0);
    }
    // sawdust and roof
    for (let q = 0; q < 3; q++) v.set(L(15) + q % 2, c + 2 + q, 12 + ((f + q) % 3), M.sand);
    post(v, L(1), L(2), 13, 26, M.woodDark);
    post(v, L(14), L(13), 13, 26, M.woodDark);
    roofU(v, L(0), L(15), L(1), L(14), 27, M.plank, 0.6);
    return v;
  }, 6, 12, { lamp: [0, 0] });
}

export function press(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 46);
    plinth(v, P, 2);
    stones(v, L(2), L(2), 2, L(13), L(13), 7);
    post(v, L(1), L(7), 2, 36, M.iron, 2);
    post(v, L(13), L(7), 2, 36, M.iron, 2);
    v.box(L(1), L(7), 36, L(14), L(8), 38, M.iron);
    const z = [26, 20, 9, 20][f];
    v.box(c - 1, c - 1, z + 6, c, c, 35, M.brass);
    v.box(c - 4, c - 4, z, c + 3, c + 3, z + 5, M.ironDark, (i, j, k) => (k === z ? -0.1 : (i + j) % 5 === 0 ? 0.1 : 0));
    v.box(c - 3, c - 3, 8, c + 2, c + 2, f === 2 ? 8 : 9, M.stone);
    if (f === 2) for (let q = 0; q < 6; q++) v.set(L(3 + q * 2), L(14), 8, M.stone, 0.15);
    v.gearV(L(4), L(9), 31, 3, M.brass, f * 0.7, 6);
    return v;
  }, 4, 6, { lamp: [0, 0] });
}

export function millstone(): SpriteDef {
  const n = 8;
  return def((f) => {
    const v = new Vol(W, W, 36);
    plinth(v, P, 2);
    v.cyl(c, c, 2, 7, 7.5, M.stone, (_i, _j, k) => (k === 7 ? 0.08 : 0));
    const rot = (f / n) * Math.PI;
    v.cyl(c, c, 8, 12, 6.5, M.stone, (_i, _j, _k, a) => (Math.cos((a + rot) * 6) > 0.75 ? -0.25 : 0.05));
    post(v, c - 1, c - 1, 13, 24, M.wood, 2);
    // turning beam
    const bx = Math.cos(rot) * 10, by = Math.sin(rot) * 10;
    v.line([c - bx, c - by, 21], [c + bx, c + by, 21], M.woodDark, 0.8);
    // gravel pile and sacks
    pile(v, L(15), L(14), 0, 3.5, M.stone, 11);
    v.sphere(L(1), L(14), 2, 2.5, M.cloth, () => 0, 0.9);
    return v;
  }, n, 10, { lamp: [0, 0] });
}

export function furnace(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 54);
    plinth(v, P, 2);
    bricks(v, L(1), L(1), 2, L(14), L(14), 24);
    bricks(v, L(3), L(3), 25, L(12), L(12), 31);
    chimney(v, L(6), L(4), 32, 46);
    // glowing mouth facing +v
    for (let k = 3; k <= 11; k++) for (let i = L(5); i <= L(10); i++) {
      if (k > 9 && (i === L(5) || i === L(10))) continue;
      v.set(i, L(14), k, M.fire, (hash2(i, k, f) - 0.5) * 0.4 + (k < 6 ? 0.12 : -0.08));
    }
    // bellows pumping on the right (+u) side
    const sq = [0, 1, 2, 1][f];
    v.box(L(15), L(5), 3, L(18) - sq, L(11), 8, M.cloth, (_i, _j, k) => (k % 2 ? -0.12 : 0.04));
    v.box(L(18) - sq, L(5), 3, L(19) - sq, L(11), 9, M.wood);
    v.line([L(19) - sq, c, 9], [L(20), c, 14], M.wood, 0.5);
    // copper pipe
    v.line([L(14), L(10), 20], [L(17), L(10), 20], M.copper, 0.7);
    v.line([L(17), L(10), 20], [L(17), L(10), 8], M.copper, 0.7);
    return v;
  }, 4, 7, { lamp: [0, 0], lights: [lightAt(W, c, L(14), 7, 0xff7a2a, 30)], smoke: px(W, L(7), L(5), 48) });
}

export function assembler(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 40);
    plinth(v, P, 2, M.iron);
    v.box(L(1), L(1), 2, L(14), L(14), 16, M.iron, (i, j, k) => ((i + j) % 5 === 0 && k % 4 === 0 ? 0.2 : k === 16 ? 0.06 : 0));
    // window into the works with turning gears
    v.box(L(3), L(14), 6, L(11), L(14), 13, M.glass, () => -0.05);
    v.gearV(L(6), L(13), 9.5, 3, M.brass, f * 0.6, 7);
    v.gearV(L(10), L(13), 9, 2, M.copper, -f * 0.9, 6);
    // copper work surface
    v.box(L(3), L(3), 17, L(12), L(12), 17, M.copper);
    // articulated arm
    post(v, L(12), L(3), 17, 27, M.ironDark);
    const t = [0, 0.33, 0.66, 1, 0.66, 0.33][f];
    const ex = L(12) - 4 - t * 4, ey = L(4) + 3 + t * 5;
    v.line([L(12), L(3), 27], [ex, ey, 24], M.brass, 0.6);
    v.box(ex - 1, ey - 1, 21, ex + 1, ey + 1, 23, M.iron);
    // the part being made
    v.gearV(L(7), L(8), 20, 2, M.gold, 0, 6);
    // indicator lamp
    v.set(L(14), L(14), 15, M.aether);
    return v;
  }, 6, 8, { lamp: [0, 0], lights: [lightAt(W, L(7), L(14), 10, 0x8adcff, 12)] });
}

// ───────────────────────── aether ─────────────────────────

export function condenser(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 54);
    plinth(v, P, 2, M.iron);
    v.cyl(c, c, 2, 38, 5.5, M.glass, (_i, _j, k) => (k % 6 === 0 ? 0.12 : 0), 1);
    // mist filling the glass column
    v.cyl(c, c, 2, 8 + f * 4, 4.4, M.aether, (i, j, k) => (hash2(i, j + k, 2) > 0.5 ? -0.2 : 0.05));
    for (const [i, j] of [[2, 2], [13, 2], [2, 13], [13, 13]]) post(v, L(i), L(j), 2, 40, M.copper);
    v.box(L(1), L(1), 40, L(14), L(14), 41, M.copper);
    v.cone(c, c, 42, 46, 4, 1, M.copper);
    // intake fan on the +u side, spinning
    v.gearU(L(15), c, 22, 5, M.iron, f * 0.5, 3, M.brass);
    // clouds being drawn in
    for (let q = 0; q < 4; q++) v.set(L(17) + ((f * 2 + q * 3) % 6), c - 3 + q * 2, 20 + q, M.snow, 0.1);
    return v;
  }, 6, 8, { lamp: [0, 0], lights: [lightAt(W, c, c, 20, 0x8fd0ff, 20)] });
}

export function distiller(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 44);
    plinth(v, P, 2);
    bricks(v, L(1), L(1), 2, L(14), L(14), 8);
    v.cyl(L(5), L(9), 9, 18, 4.5, M.copper, (_i, _j, k) => (k === 18 ? 0.1 : 0));
    v.cone(L(5), L(9), 19, 22, 4, 1, M.copper);
    // glass coil to a glowing flask
    for (let k = 10; k <= 22; k += 3) v.cyl(L(11), L(4), k, k, 2.2, M.glass, () => 0, 0.8);
    v.line([L(5), L(9), 23], [L(11), L(4), 24], M.copper, 0.5);
    v.sphere(L(11), L(12), 13, 3.6, M.aether, (_i, _j, k) => (k > 14 ? 0.1 : -0.05));
    v.box(L(11), L(12), 16, L(11), L(12), 19, M.glass);
    for (let q = 0; q < 3; q++) v.set(L(10 + q), L(12), 12 + ((f + q * 2) % 5), M.snow, 0.2);
    return v;
  }, 4, 6, { lamp: [0, 0], lights: [lightAt(W, L(11), L(12), 13, 0x8fd0ff, 16)] });
}

export function starNet(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 60);
    plinth(v, P, 1, M.cobble);
    post(v, L(1), L(13), 1, 50, M.woodDark, 2);
    post(v, L(13), L(1), 1, 54, M.woodDark, 2);
    // sagging net between the posts
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      const top = 50 + t * 4 - Math.sin(t * Math.PI) * 7;
      for (let q = 0; q < 14; q++) {
        if ((s + q) % 3 && q % 3) continue;
        v.set(L(1 + s), L(13 - s), top - q, M.cloth, 0.1);
      }
      if (hash2(s, f, 7) > 0.7) v.set(L(1 + s), L(13 - s), top - 4 - Math.floor(hash2(s, 9) * 8), M.star);
    }
    // collecting jar
    v.cyl(L(6), L(7), 1, 7, 2.8, M.glass, () => 0, 1);
    v.cyl(L(6), L(7), 2, 2 + (f % 2) + 2, 2, M.star);
    return v;
  }, 4, 5, { lamp: [0, 0], lights: [lightAt(W, L(6), L(7), 4, 0xffe08a, 14)] });
}

export function resonator(): SpriteDef {
  const n = 8;
  return def((f) => {
    const v = new Vol(W, W, 50);
    plinth(v, P, 2, M.iron);
    v.box(L(2), L(2), 2, L(13), L(13), 9, M.iron, (i, j) => ((i + j) % 4 === 0 ? 0.12 : 0));
    v.cyl(c, c, 10, 11, 5, M.brass);
    const bob = Math.round(Math.sin((f / n) * Math.PI * 2) * 1.5);
    const ck = 24 + bob;
    // octahedral crystal
    for (let k = -8; k <= 8; k++) {
      const r = 4.5 * (1 - Math.abs(k) / 8.5);
      v.cyl(c, c, ck + k, ck + k, r, M.crystal, () => (k > 0 ? 0.08 : -0.06));
    }
    // two orbiting brass rings
    const a0 = (f / n) * Math.PI;
    for (let q = 0; q < 28; q++) {
      const a = (q / 28) * Math.PI * 2;
      v.set(c + Math.cos(a) * 9, c + Math.sin(a) * 9 * Math.cos(a0), ck + Math.sin(a) * 9 * Math.sin(a0) * 0.5, M.gold);
      v.set(c + Math.cos(a) * 7 * Math.cos(a0), c + Math.sin(a) * 7, ck + Math.cos(a) * 7 * Math.sin(a0) * 0.5, M.brass);
    }
    return v;
  }, n, 10, { lamp: [0, 0], lights: [lightAt(W, c, c, 24, 0x6cb8f2, 30)] });
}

export function crucible(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 40);
    plinth(v, P, 2);
    bricks(v, L(1), L(1), 2, L(14), L(14), 12);
    v.cyl(c, c, 13, 20, 6, M.ironDark, () => 0, 1.5);
    v.cyl(c, c, 19, 19, 4.6, M.hot, (i, j) => Math.sin(i * 0.8 + j + f * 1.5) * 0.25 + 0.2);
    post(v, L(0), c - 1, 2, 24, M.iron, 2);
    post(v, L(14), c - 1, 2, 24, M.iron, 2);
    v.box(L(0), c - 1, 24, L(15), c, 25, M.iron);
    for (let q = 0; q < 2; q++) v.set(c - 2 + q * 4, c, 21 + ((f + q * 2) % 4), M.gold);
    // glowing ingots cooling
    for (let q = 0; q < 3; q++) v.box(L(1 + q * 3), L(15), 2, L(2 + q * 3), L(16), 3, M.gold);
    return v;
  }, 4, 6, { lamp: [0, 0], lights: [lightAt(W, c, c, 20, 0xffc04a, 30)], smoke: px(W, c, c, 26) });
}

export function drill(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 60);
    plinth(v, P, 2, M.iron);
    // derrick legs
    for (const [i, j] of [[1, 1], [14, 1], [1, 14], [14, 14]]) v.line([L(i), L(j), 2], [c + (i - 7.5) * 0.25, c + (j - 7.5) * 0.25, 46], M.iron, 0.6);
    for (const k of [14, 28, 40]) {
      const r = 6.5 * (1 - k / 56);
      v.box(c - r, c - r, k, c + r, c + r, k, M.ironDark, (i, j) => (Math.abs(i - c) > r - 1 || Math.abs(j - c) > r - 1 ? 0 : null));
    }
    v.box(c - 2, c - 2, 44, c + 1, c + 1, 47, M.brass);
    // spinning bit
    for (let k = 2; k <= 43; k++) {
      const s = (k + f * 2) % 4 < 2;
      v.set(c - 1, c - 1, k, s ? M.iron : M.ironDark, s ? 0.15 : 0);
      v.set(c, c - 1, k, s ? M.ironDark : M.iron);
    }
    // crystal core on top
    for (let k = 0; k <= 4; k++) v.cyl(c - 0.5, c - 0.5, 48 + k, 48 + k, 2.2 - Math.abs(k - 2) * 0.6, M.crystal);
    return v;
  }, 4, 12, { lamp: [0, 0], lights: [lightAt(W, c, c, 50, 0x6cb8f2, 16)] });
}

// ───────────────────────── logistics ─────────────────────────

/** Conveyor tile frames for a direction (0:+u 1:+v 2:−u 3:−v). Flat, floor layer. */
export function beltVox(dir: number, express: boolean): { frames: import('../art/pixel').PixelCanvas[]; ax: number; ay: number } {
  return bakeFrames((f) => {
    const v = new Vol(16, 16, 6);
    const alongU = dir % 2 === 0;
    const sign = dir < 2 ? 1 : -1;
    const rail = express ? M.skystone : M.wood;
    const bed = express ? M.aether : M.ink;
    for (let a = 0; a < 16; a++) for (let b = 3; b <= 12; b++) {
      const i = alongU ? a : b, j = alongU ? b : a;
      // rollers every 4 voxels, dark rubber belt with moving chevron marks
      const s = ((a * sign - f * 1 + 64) % 4);
      const chev = (s + Math.abs(b - 7.5) * 0.5) % 4 < 1;
      v.set(i, j, 1, bed, chev ? (express ? 0.25 : 0.35) : express ? -0.1 : 0.15);
      v.set(i, j, 0, M.iron, -0.2);
    }
    for (let a = 0; a < 16; a++) for (const b of [1, 2, 13, 14]) {
      const i = alongU ? a : b, j = alongU ? b : a;
      v.set(i, j, 0, rail, 0);
      v.set(i, j, 1, rail, a % 4 === 0 ? -0.1 : 0.05);
      if (b === 1 || b === 14) v.set(i, j, 2, rail, 0.1);
    }
    return v;
  }, 4, { outline: false });
}

export function depot(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 30);
    planks(v, L(1), L(1), 0, L(14), L(14), 11, 'u');
    band(v, L(1), L(1), L(14), L(14), 3, M.iron);
    band(v, L(1), L(1), L(14), L(14), 8, M.iron);
    // copper funnel on top
    for (let k = 12; k <= 17; k++) {
      const r = 3 + (k - 12) * 1.1;
      v.box(c - r, c - r, k, c + r - 1, c + r - 1, k, M.copper, (i, j) => (Math.abs(i + 0.5 - c) > r - 1.5 || Math.abs(j + 0.5 - c) > r - 1.5 ? (k === 17 ? 0.12 : 0) : null));
    }
    if (f) v.box(c - 1, c - 1, 13, c, c, 14, M.gold);
    // brass plaque and a lantern
    v.box(L(6), L(15), 5, L(9), L(15), 7, M.brass);
    lantern(v, L(15), L(15), 12);
    post(v, L(15), L(15), 0, 11, M.woodDark);
    return v;
  }, 2, 1, { lights: [lightAt(W, L(15), L(15), 13, 0xffc060, 14)] });
}

export function dispatcher(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 30);
    stones(v, L(2), L(2), 0, L(13), L(13), 8);
    v.cyl(c, c, 9, 15, 5.5, M.copper, () => 0, 1.5);
    v.cyl(c, c, 9, 14, 4, M.ink);
    // outlet chute toward +u
    v.box(L(14), c - 2, 3, L(17), c + 1, 6, M.brass);
    v.gearV(c, L(13) + 1, 4, 2.5, M.gold, f * 0.8, 6);
    return v;
  }, 4, 8, { lamp: [0, 0] });
}

export function splitter(sorter: boolean): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 16);
    if (sorter) v.box(L(2), L(2), 0, L(13), L(13), 5, M.iron);
    else planks(v, L(2), L(2), 0, L(13), L(13), 5, 'u');
    const arrow = (i: number, j: number, on: boolean) => v.box(i - 1, j - 1, 6, i, j, 6, on ? M.lamp : M.brass);
    arrow(L(13), c, f === 1 || sorter);
    arrow(c, L(2), !sorter && f === 0);
    arrow(c, L(13), f === 2);
    if (sorter) v.sphere(c, c, 7, 2.5, M.glass, () => 0.1);
    else v.gearV(c, c, 8, 2.5, M.gold, f * 0.8, 6);
    return v;
  }, 4, 8);
}

export function storage(kind: 'crate' | 'silo' | 'warehouse'): SpriteDef {
  if (kind === 'crate') {
    const lv = (fill: number) => def(() => {
      const v = new Vol(W, W, 30);
      crate(v, L(0), L(0), 0, 10);
      crate(v, L(10), L(9), 0, 7);
      if (fill >= 1) crate(v, L(1), L(1), 10, 7);
      if (fill >= 2) { crate(v, L(10), L(9), 7, 6); v.sphere(L(4), L(13), 3, 3.2, M.cloth, () => 0, 0.8); v.sphere(L(7), L(14), 2, 2.6, M.cloth, () => -0.06, 0.8); }
      return v;
    }, 1, 1);
    const a = lv(0), b = lv(1), cc = lv(2);
    return { ...b, variants: { f0: a.frames, f1: b.frames, f2: cc.frames } };
  }
  if (kind === 'silo') {
    const lv = (fill: number) => def(() => {
      const v = new Vol(W, W, 66);
      plinth(v, P, 2);
      v.cyl(c, c, 2, 44, 7, M.brick, (_i, _j, k, a) => (k % 3 === 0 || Math.cos(a * 9 + Math.floor(k / 3)) > 0.93 ? -0.2 : 0));
      for (const k of [10, 24, 38]) v.cyl(c, c, k, k, 7.3, M.ironDark);
      // gauge window toward +v showing fullness
      for (let k = 6; k <= 36; k++) v.set(c - 1, c + 7, k, k <= 6 + (fill / 2) * 30 ? M.gold : M.glass, 0);
      v.cone(c, c, 45, 56, 8, 0.5, M.copper, false, (_i, _j, k) => (k % 3 === 0 ? -0.12 : 0.04));
      return v;
    }, 1, 1);
    const a = lv(0), b = lv(1), cc = lv(2);
    return { ...b, variants: { f0: a.frames, f1: b.frames, f2: cc.frames } };
  }
  return def((f) => {
    const v = new Vol(W, W, 46);
    stones(v, L(0), L(0), 0, L(15), L(15), 22, M.skystone);
    v.box(L(-1), L(-1), 23, L(16), L(16), 24, M.cobble);
    // arched door with aether glow toward +v
    for (let k = 1; k <= 12; k++) for (let i = L(5); i <= L(10); i++) {
      if (k > 10 && (i === L(5) || i === L(10))) continue;
      v.set(i, L(15), k, M.aether, (k / 30) + (f ? 0.08 : 0));
    }
    // veins
    for (let q = 0; q < 16; q++) v.set(L(15), L(2 + Math.floor(hash2(q, 1) * 12)), 2 + Math.floor(hash2(q, 2) * 18), M.aether);
    return v;
  }, 2, 1, { lights: [lightAt(W, c, L(15), 6, 0x6cb8f2, 20)] });
}

export function windmill(): SpriteDef {
  const n = 16;
  const P2 = 12, W2 = 16 + P2 * 2, c2 = W2 / 2;
  const L2 = (q: number) => q + P2;
  return { ...(() => {
    const b = bakeFrames((f) => {
      const v = new Vol(W2, W2, 96);
      plinth(v, P2, 2);
      // tapering stone base and timber tower
      for (let k = 2; k < 16; k++) v.box(L2(1), L2(1), k, L2(14), L2(14), k, M.stone, (i, j) => ((i + j + Math.floor(k / 3)) % 5 === 0 || k % 3 === 2 ? -0.18 : (hash2(i, j + k) - 0.5) * 0.12));
      for (let k = 16; k < 58; k++) {
        const r = 6.5 - (k - 16) * 0.06;
        v.box(c2 - r, c2 - r, k, c2 + r - 1, c2 + r - 1, k, M.plank, (i) => (i % 3 === 0 ? -0.1 : 0.02));
      }
      // door and window
      v.box(c2 - 2, c2 + 6, 3, c2, c2 + 6, 10, M.woodDark);
      v.box(c2 - 1, c2 + 5, 30, c2, c2 + 5, 33, M.lamp);
      // cap
      roofU(v, c2 - 6, c2 + 5, c2 - 6, c2 + 6, 58, M.red, 1);
      // hub and four sails in the plane facing +v
      const rot = (f / n) * (Math.PI / 2);
      const hk = 54, hj = c2 + 8;
      v.box(c2 - 1, c2 + 6, hk - 1, c2, hj, hk, M.ironDark);
      for (let s = 0; s < 4; s++) {
        const a = rot + (s * Math.PI) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let r = 2; r <= 22; r++) {
          const i = c2 + ca * r, k = hk + sa * r;
          v.set(i, hj, k, M.woodDark);
          if (r > 5) for (let w = 1; w <= 4; w++) {
            const lat = r % 4 === 0 || w === 4;
            v.set(i - sa * w, hj, k + ca * w, lat ? M.wood : M.cloth, lat ? 0 : 0.06 - w * 0.02);
          }
        }
      }
      return v;
    }, n);
    return { frames: b.frames, ax: b.ax, ay: b.ay };
  })(), fps: 12, lights: [[...px(W2, c2, c2 + 6, 32), 0xffc060, 14] as [number, number, number, number]] };
}

export function engine(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 44);
    plinth(v, P, 2, M.iron);
    v.box(L(1), L(1), 2, L(14), L(14), 12, M.iron, (i, j) => ((i + j) % 4 === 0 ? 0.1 : 0));
    v.cyl(c, c, 13, 26, 6.5, M.copper, (_i, _j, k) => (k % 4 === 0 ? -0.15 : 0.03));
    // aether core window toward +v with spinning turbine
    for (let k = 15; k <= 24; k++) for (let i = c - 3; i <= c + 2; i++) {
      const dx = i + 0.5 - c, dz = k + 0.5 - 19.5;
      if (Math.hypot(dx, dz) > 4) continue;
      const a = Math.atan2(dz, dx) + f * 0.5;
      v.set(i, c + 6, k, Math.cos(a * 3) > 0.6 ? M.ironDark : M.aether);
    }
    post(v, L(11), L(3), 26, 36, M.ironDark, 2);
    post(v, L(3), L(3), 26, 33, M.ironDark, 2);
    return v;
  }, 6, 12, { lamp: [0, 0], lights: [lightAt(W, c, c + 6, 20, 0x6cb8f2, 26)], smoke: px(W, L(12), L(4), 38) });
}

export function pylon(): SpriteDef {
  const n = 8;
  return def((f) => {
    const v = new Vol(W, W, 64);
    plinth(v, P, 3, M.cobble);
    for (let k = 3; k < 36; k++) {
      const r = 5.5 - (k - 3) * 0.12;
      stonesRing(v, c, c, k, r);
    }
    const bob = Math.round(Math.sin((f / n) * Math.PI * 2) * 1.5);
    for (let k = -6; k <= 6; k++) v.cyl(c, c, 46 + bob + k, 46 + bob + k, 3.6 * (1 - Math.abs(k) / 6.5), M.crystal);
    for (let q = 0; q < 4; q++) {
      const a = (q / 4) * Math.PI * 2 + (f / n) * Math.PI;
      v.set(c + Math.cos(a) * 7, c + Math.sin(a) * 7, 46 + bob, M.aether);
    }
    return v;
  }, n, 8, { lights: [lightAt(W, c, c, 46, 0x6cb8f2, 34)] });
}

function stonesRing(v: Vol, ci: number, cj: number, k: number, r: number): void {
  v.box(ci - r, cj - r, k, ci + r - 1, cj + r - 1, k, M.skystone, (i, j) => (k % 4 === 0 ? -0.14 : (hash2(i, j + k, 3) - 0.5) * 0.12));
}

export function beacon(): SpriteDef {
  const n = 8;
  return def((f) => {
    const v = new Vol(W, W, 70);
    plinth(v, P, 3, M.cobble);
    stones(v, L(4), L(4), 3, L(11), L(11), 34);
    v.box(L(2), L(2), 35, L(13), L(13), 37, M.brass);
    const bob = Math.round(Math.sin((f / n) * Math.PI * 2) * 1.5);
    v.sphere(c, c, 50 + bob, 5, M.ironDark, (_i, _j, k) => (k > 51 ? 0.1 : 0));
    v.set(c - 2, c + 2, 53 + bob, M.aether);
    const a0 = (f / n) * Math.PI;
    for (let q = 0; q < 36; q++) {
      const a = (q / 36) * Math.PI * 2 + a0;
      v.set(c + Math.cos(a) * 10, c + Math.sin(a) * 10, 50 + bob + Math.sin(a * 2) * 1.5, Math.sin(a) > 0 ? M.aether : M.crystal);
    }
    return v;
  }, n, 8, { lights: [lightAt(W, c, c, 50, 0x6cb8f2, 32)] });
}

export function roost(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 64);
    plinth(v, P, 3, M.cobble);
    stones(v, L(4), L(4), 3, L(11), L(11), 38, M.skystone);
    // perches with sleeping wisps
    for (const [i, j, k] of [[-4, 10, 26], [12, -3, 32], [14, 12, 20]] as [number, number, number][]) {
      v.line([c, c, k], [L(i), L(j), k], M.woodDark, 0.5);
      v.set(L(i), L(j), k + 1, f % 2 ? M.aether : M.crystal);
    }
    // woven nest with a glowing heart
    v.cyl(c, c, 39, 42, 7, M.wood, (_i, _j, k, a) => (Math.cos(a * 8 + k) > 0.3 ? 0.08 : -0.12), 2);
    v.sphere(c, c, 44, 3.5, M.aether, () => (f % 2) * 0.06);
    return v;
  }, 4, 5, { lamp: [0, 0], lights: [lightAt(W, c, c, 44, 0x6cb8f2, 30)] });
}

/** The Aetherforge: 3×3, one look per construction stage (0..3), awake animation at 3. */
export function forge(): SpriteDef {
  const PF = 4, WF = 48 + PF * 2, cf = WF / 2;
  const LF = (q: number) => q + PF;
  const variants: Record<string, import('../art/pixel').PixelCanvas[]> = {};
  let ax = 0, ay = 0;
  for (let stage = 0; stage <= 3; stage++) {
    const n = stage === 3 ? 12 : 1;
    const b = bakeFrames((f) => {
      const v = new Vol(WF, WF, 130);
      plinth(v, PF, 3, M.cobble, 3);
      if (stage === 0) {
        for (const [i, j] of [[2, 2], [45, 2], [2, 45], [45, 45]]) post(v, LF(i), LF(j), 3, 12, M.wood);
        v.cyl(cf, cf, 3, 3, 16, M.aether, (i, j) => (Math.hypot(i + 0.5 - cf, j + 0.5 - cf) > 14.5 ? 0 : null));
      }
      if (stage >= 1) {
        stones(v, LF(3), LF(3), 3, LF(44), LF(44), 12, M.stone);
        stones(v, LF(8), LF(8), 13, LF(39), LF(39), 20, M.skystone);
      }
      if (stage >= 2) {
        for (const [i, j] of [[10, 10], [35, 10], [10, 35], [35, 35]]) {
          v.box(LF(i), LF(j), 21, LF(i + 3), LF(j + 3), 80, M.iron, (_i, _j, k) => (k % 6 === 0 ? 0.12 : 0));
        }
        v.box(LF(10), LF(10), 81, LF(38), LF(13), 84, M.gold);
        v.box(LF(10), LF(35), 81, LF(38), LF(38), 84, M.gold);
        v.box(LF(10), LF(10), 81, LF(13), LF(38), 84, M.gold);
        v.box(LF(35), LF(10), 81, LF(38), LF(38), 84, M.gold);
        v.box(LF(15), LF(15), 21, LF(33), LF(33), 36, M.glass, (i, j, k) => (i === LF(15) || j === LF(15) || i === LF(33) || j === LF(33) || k === 36 ? 0 : null));
      }
      if (stage >= 3) {
        const t = (f / n) * Math.PI * 2;
        const bob = Math.round(Math.sin(t) * 2);
        const ck = 104 + bob;
        for (let k = -20; k <= 20; k++) v.cyl(cf, cf, ck + k, ck + k, 11 * (1 - Math.abs(k) / 21), M.crystal, () => (k > 0 ? 0.1 : -0.05));
        for (let q = 0; q < 64; q++) {
          const a = (q / 64) * Math.PI * 2 + t * 0.5;
          v.set(cf + Math.cos(a) * 20, cf + Math.sin(a) * 20, ck + Math.sin(a * 2 + t) * 2, M.gold);
          const a2 = (q / 64) * Math.PI * 2 - t * 0.7;
          v.set(cf + Math.cos(a2) * 15, cf + Math.sin(a2) * 15, ck - 6 + Math.cos(a2 * 3) * 1.5, M.star);
        }
        for (const [i, j] of [[11, 11], [36, 11], [11, 36], [36, 36]]) v.sphere(LF(i), LF(j), 87, 2.5, M.star);
      }
      return v;
    }, n);
    variants['st' + stage] = b.frames;
    ax = b.ax; ay = b.ay;
  }
  return { frames: variants.st0, ax, ay, fps: 8, variants, lights: [[0, -200, 0x6cb8f2, 70]] };
}

// ───────────────────────── nature extras ─────────────────────────

export function sapling(): SpriteDef {
  const variants: Record<string, import('../art/pixel').PixelCanvas[]> = {};
  let ax = 0, ay = 0;
  for (let stage = 0; stage < 3; stage++) {
    const b = bakeFrames((f) => {
      const v = new Vol(W, W, 30);
      v.sphere(c, c, 0, 3.5, M.dirt, () => 0.05, 0.4);
      const h = 4 + stage * 5;
      v.line([c, c, 1], [c + f * 0.5, c, h], M.wood, 0.4);
      const r = 2 + stage * 1.6;
      v.sphere(c + f * 0.5, c, h + r * 0.5, r, M.leaf, (i, j, k) => (hash2(i, j + k, stage) - 0.5) * 0.3 + (k - h) * 0.04, 0.85);
      return v;
    }, 2);
    variants['g' + stage] = b.frames;
    ax = b.ax; ay = b.ay;
  }
  return { frames: variants.g0, ax, ay, fps: 1.5, variants };
}

export function tuft(): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 16);
    for (let q = 0; q < 16; q++) {
      const i = c - 4 + hash2(q, 1) * 8, j = c - 4 + hash2(q, 2) * 8;
      const h = 4 + Math.floor(hash2(q, 3) * 7);
      const lean = (f ? 1 : 0) * (hash2(q, 4) > 0.5 ? 1 : 0);
      for (let k = 0; k < h; k++) v.set(i + (k > h / 2 ? lean : 0), j, k, k > h - 3 ? M.sand : M.grassLight, k / h * 0.2);
    }
    return v;
  }, 2, 2);
}

export function node(type: string): SpriteDef {
  return def((f) => {
    const v = new Vol(W, W, 34);
    if (type === 'node_vein') {
      for (const [i, j, r, h] of [[5, 9, 5, 9], [11, 5, 5, 13], [8, 8, 4, 18]] as [number, number, number, number][]) {
        v.cone(L(i), L(j), 0, h, r, 1.5, M.stone, false, (ii, jj, k) => {
          const vein = Math.abs(Math.sin(ii * 0.9 + k * 0.7) + Math.cos(jj * 0.8 - k * 0.5)) < 0.25;
          return vein ? null : (hash2(ii, jj + k) - 0.5) * 0.2;
        });
      }
      for (let q = 0; q < 18; q++) v.set(L(3 + Math.floor(hash2(q, 1) * 10)), L(3 + Math.floor(hash2(q, 2) * 10)), 2 + Math.floor(hash2(q, 3) * 12), (q + f) % 3 ? M.copper : M.iron, 0.15);
    } else if (type === 'node_spring') {
      stones(v, L(1), L(1), 0, L(14), L(14), 2, M.cobble);
      v.cyl(c, c, 2, 2, 6.5, M.water, (i, j) => Math.sin((i + j) * 0.7 + f * 1.6) * 0.12);
      const rr = 1 + f;
      v.cyl(c, c, 3, 3, rr, M.snow, () => 0, 0.8);
      for (let q = 0; q < 4; q++) v.set(c - 4 + q * 3, c, 5 + ((f + q) % 4) * 2, M.snow, 0.2);
    } else {
      v.sphere(c, c, 0, 5, M.stone, () => -0.05, 0.4);
      for (let k = 0; k <= 16; k++) v.cyl(c - k * 0.15, c + k * 0.1, k, k, 3.5 * (1 - k / 17), M.star, () => (k > 8 ? 0.08 : 0));
      if (f % 2 === 0) { v.set(c + 4, c, 12, M.star); v.set(c - 3, c + 2, 7, M.star); }
    }
    return v;
  }, 4, type === 'node_spring' ? 6 : 4, { lights: [[0, -12, type === 'node_vein' ? 0xffa050 : type === 'node_spring' ? 0x8adcff : 0xffe08a, 22]] });
}

export function lightAtVox(i: number, j: number, k: number): [number, number] {
  return px(W, i, j, k);
}

export type { Mat };

/** Belt frames on the fixed 64×40 canvas (ground centre at 32,24) the renderer expects. */
export function beltFrames(dir: number, express: boolean): import('../art/pixel').PixelCanvas[] {
  const b = beltVox(dir, express);
  return b.frames.map((f) => {
    const out = new PixelCanvasCtor(64, 40);
    const dx = 32 - b.ax, dy = 24 - b.ay;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.alpha(x, y)) out.set(x + dx, y + dy, f.get(x, y));
    return out;
  });
}
