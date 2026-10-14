import type { Canvas, Face, Tex, V3 } from '../iso';
import { Paint, type TexLib } from '../tex';

/**
 * Minecraft-style machines on a one-tile footprint (x, y ∈ [0, 1], z up),
 * built from the CC0 pack textures. Extra faces (furnace mouths, mesh,
 * gears, belts…) are painted here from pack textures and the pack palette.
 * `f` is the animation phase in [0, 1).
 */

type Ctx = { c: Canvas; L: TexLib };
const TAU = Math.PI * 2;
const F = (t: Tex, o: Partial<Face> = {}): Face => ({ tex: t, ...o });

const hsh = (a: number, b: number, c = 0) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Box with one texture name for every face (or top/side). */
function blk({ c, L }: Ctx, a: V3, b: V3, top: string | Tex, side: string | Tex = top, side2: string | Tex = side, id = 5): void {
  const t = (n: string | Tex) => F(typeof n === 'string' ? L.get(n) : n);
  c.box(a, b, t(top), t(side), t(side2), id);
}

// ───────────────────────── painted faces ─────────────────────────

function fireFace(base: Tex, f: number, x = 3, y = 6, w = 10, hgt = 8): Paint {
  const p = new Paint(16, 16, base);
  p.rect(x, y, w, hgt, 0x24181a).frame(x - 1, y - 1, w + 2, hgt + 2, 0x4a4650);
  const fire = [0xfff2a0, 0xffc040, 0xf07a28, 0xb83a1e];
  for (let i = 0; i < w - 2; i++) {
    const hh = 2 + Math.floor(hsh(i, Math.floor(f * 6), 3) * (hgt - 3));
    for (let j = 0; j < hh; j++) p.set(x + 1 + i, y + hgt - 1 - j, fire[Math.min(3, Math.floor((j / hh) * 3.2))]);
  }
  p.rect(x + 1, y + hgt - 1, w - 2, 1, 0xfff2a0);
  return p;
}

/** Gear face (transparent background), rotated by phase. */
export function gearTex(col: number, dark: number, f: number, teeth = 8): Paint {
  const p = new Paint();
  const rot = f * TAU / teeth;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + rot;
    const R = 6 + (Math.cos(a * teeth) > 0.2 ? 1.6 : 0);
    if (d > R) continue;
    if (d < 1.6) p.set(x, y, dark);
    else if (d < 4 && Math.cos((a - rot) * 3 + rot * 3) > 0.6) p.set(x, y, dark);
    else p.set(x, y, d > R - 1 ? dark : col);
  }
  return p;
}

/** Spinning saw blade (transparent background). */
function sawTex(f: number): Paint {
  const p = new Paint();
  const rot = f * TAU / 12;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + rot;
    const R = 6.4 + (((a / TAU) * 12 % 1 + 1) % 1) * 1.4;
    if (d > R) continue;
    p.set(x, y, d < 1.5 ? 0x4a4650 : d > 6 ? 0xe8eef2 : (x + y) % 5 === 0 ? 0xc8d0d8 : 0xa8b0bc);
  }
  return p;
}

/** Rope/iron grid (transparent background). */
function gridTex(col: number, step = 3): Paint {
  const p = new Paint();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % step === 0 || y % step === 0) p.set(x, y, col);
  return p;
}

/** Lantern face: iron cage around a warm glow. */
export function lanternTex(): Paint {
  return new Paint().draw([
    '....aaaaaaaa....',
    '...a.bbbbbb.a...',
    '...abyyyyyyba...',
    '...ayyywwyyya...',
    '...ayywwwwyya...',
    '...ayywwwwyya...',
    '...ayyywwyyya...',
    '...abyyyyyyba...',
    '...aaaaaaaaaa...',
  ], { a: 0x3a3440, b: 0x8a6a2a, y: 0xffc04a, w: 0xfff2b0 }, 0, 3);
}

// ───────────────────────── shared parts ─────────────────────────

/** Small hanging or standing lantern centred at p (block units), glowing. */
function lantern({ c }: Ctx, p: V3): void {
  const lt = lanternTex();
  c.box([p[0] - 0.09, p[1] - 0.09, p[2]], [p[0] + 0.09, p[1] + 0.09, p[2] + 0.22], F(lt, { glow: true, uv: [4, 3, 12, 11] }), F(lt, { glow: true, uv: [3, 3, 13, 12] }), F(lt, { glow: true, uv: [3, 3, 13, 12] }), 6);
  c.light([p[0], p[1] + 0.2, p[2] + 0.1], [120, 80, 30], 1.1);
}

function chimney(ctx: Ctx, x: number, y: number, z0: number, h: number): void {
  blk(ctx, [x, y, z0], [x + 0.3125, y + 0.3125, z0 + h], 'a/mud_bricks');
  blk(ctx, [x - 0.03, y - 0.03, z0 + h], [x + 0.3425, y + 0.3425, z0 + h + 0.09], new Paint(16, 16, ctx.L.get('b/stone')).rect(4, 4, 8, 8, 0x241c22));
}

function torch({ c, L }: Ctx, p: V3, f: number): void {
  const t = L.get('as/default_torch_on_floor_animated');
  const fr = Math.floor(f * 7) % 7;
  c.sprite(p, { tex: t, uv: [0, fr * 16, 16, fr * 16 + 16], glow: true }, 6, 2, 0.4);
  c.light([p[0], p[1], p[2] + 0.4], [130, 80, 30], 1.4);
}

/** Thin floor slab under machines so they sit on something made. */
function base(ctx: Ctx, tex = 'a/cobblestone_bricks', inset = 0.03, h = 0.0625): void {
  blk(ctx, [inset, inset, 0], [1 - inset, 1 - inset, h], tex);
}

// ───────────────────────── machines ─────────────────────────

export function workbench(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  const top = new Paint(16, 16, L.get('a/oak_planks')).frame(0, 0, 16, 16, 0x5a3a26).frame(1, 1, 14, 14, 0x8a5a36);
  for (const k of [5, 10]) { top.rect(k, 2, 1, 12, 0x6a4430); top.rect(2, k, 12, 1, 0x6a4430); }
  top.draw(['..ss', '.s..', 's...'], { s: 0x9aa2aa }, 11, 2).draw(['hh', 'hh', '.w', '.w'], { h: 0x6a7480, w: 0x8a5a36 }, 3, 10);
  const side = new Paint(16, 16, L.get('a/beech_log_side')).rect(0, 0, 16, 3, 0x7a4e30).rect(0, 1, 16, 1, 0x9a6a40).blit(L.get('as/default_tool_stoneaxe'), 0, 1, 0, 0, 16, 15);
  const side2 = new Paint(16, 16, L.get('a/beech_log_side')).rect(0, 0, 16, 3, 0x7a4e30).rect(0, 1, 16, 1, 0x9a6a40).blit(L.get('as/default_tool_woodpick'), 0, 1, 0, 0, 16, 15);
  c.box([0.0625, 0.0625, 0], [0.9375, 0.9375, 0.875], F(top), F(side), F(side2), 5);
  torch(ctx, [0.85, 0.95, 0.875], f);
}

export function furnace(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  const cobble = L.get('b/cobblestone');
  const top = new Paint(16, 16, cobble).rect(4, 4, 8, 8, 0x3a3a42).frame(4, 4, 8, 8, 0x5a5a62);
  c.box([0, 0, 0], [1, 1, 1], F(top), F(fireFace(cobble, f)), F(cobble), 5);
  // glowing mouth drawn again as emissive on top of the face
  const mouth = fireFace(cobble, f);
  c.quad([0.25, 1.001, 0.6], [0.5, 0, 0], [0, 0, -0.5], F(mouth, { glow: true, uv: [4, 7, 12, 15] }), [1, 1, 1], 5, 0.01);
  c.light([0.5, 1.2, 0.3], [140, 70, 20], 1.7);
  chimney(ctx, 0.12, 0.12, 1, 0.6);
}

export function kiln(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  const brick = L.get('a/mud_bricks');
  // stepped brick dome
  blk(ctx, [0.03, 0.03, 0], [0.97, 0.97, 0.5], brick);
  blk(ctx, [0.12, 0.12, 0.5], [0.88, 0.88, 0.75], brick);
  blk(ctx, [0.25, 0.25, 0.75], [0.75, 0.75, 0.9], brick);
  c.quad([0.3, 0.971, 0.4], [0.4, 0, 0], [0, 0, -0.38], F(fireFace(brick, f, 2, 4, 12, 11), { glow: true, uv: [2, 3, 14, 15] }), [1, 1, 1], 5, 0.01);
  c.light([0.5, 1.15, 0.2], [140, 70, 20], 1.6);
  chimney(ctx, 0.6, 0.18, 0.75, 0.45);
  // firewood
  for (let i = 0; i < 3; i++) blk(ctx, [0.04 + i * 0.12, -0.02, 0], [0.14 + i * 0.12, 0.3, 0.1], 'a/oak_log_top', 'a/oak_log_side');
}

export function composter(c: Canvas, L: TexLib): void {
  const ctx = { c, L };
  const slats = 'a/pine_planks';
  blk(ctx, [0.06, 0.06, 0], [0.94, 0.94, 0.08], 'a/mud');
  for (const [a, b] of [[[0.06, 0.06, 0], [0.94, 0.16, 0.62]], [[0.06, 0.84, 0], [0.94, 0.94, 0.62]], [[0.06, 0.06, 0], [0.16, 0.94, 0.62]], [[0.84, 0.06, 0], [0.94, 0.94, 0.62]]] as [V3, V3][]) blk(ctx, a, b, slats);
  blk(ctx, [0.16, 0.16, 0.08], [0.84, 0.84, 0.52], 'a/farmland', 'a/mud');
  for (let i = 0; i < 4; i++) c.sprite([0.3 + hsh(i, 1) * 0.4, 0.3 + hsh(i, 2) * 0.4, 0.52], { tex: L.get(i % 2 ? 'a/plants/mugwort' : 'a/plants/dicot') }, 5, 1.5);
  for (const [x, y] of [[0.02, 0.02], [0.88, 0.02], [0.02, 0.88], [0.88, 0.88]]) blk(ctx, [x, y, 0], [x + 0.1, y + 0.1, 0.72], 'a/oak_log_top', 'a/oak_log_side');
}

export function sieve(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  for (const [x, y] of [[0.1, 0.1], [0.8, 0.1], [0.1, 0.8], [0.8, 0.8]]) blk(ctx, [x, y, 0.06], [x + 0.1, y + 0.1, 0.55], 'a/beech_log_top', 'a/beech_log_side');
  const sh = Math.sin(f * TAU) * 0.04;
  blk(ctx, [0.04 + sh, 0.04, 0.55], [0.96 + sh, 0.96, 0.68], 'a/beech_planks');
  c.quad([0.1 + sh, 0.1, 0.69], [0.8, 0, 0], [0, 0.8, 0], F(gridTex(0x6a6e78, 2)), [1, 1, 1], 5, 0.01, true);
  blk(ctx, [0.3 + sh, 0.3, 0.68], [0.7 + sh, 0.7, 0.76], 'a/dirt');
  blk(ctx, [0.25, 0.25, 0.06], [0.75, 0.75, 0.2], 'a/gravel');
  for (let i = 0; i < 3; i++) blk(ctx, [0.35 + i * 0.1, 0.4, 0.5 - ((f * 3 + i) % 1) * 0.28], [0.4 + i * 0.1, 0.45, 0.55 - ((f * 3 + i) % 1) * 0.28], 'a/gravel');
}

export function dewCatcher(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.05, 0.75, 0], [0.17, 0.87, 1.6], 'a/oak_log_top', 'a/oak_log_side');
  blk(ctx, [0.75, 0.05, 0], [0.87, 0.17, 1.6], 'a/oak_log_top', 'a/oak_log_side');
  const net = gridTex(0xe8dcc0, 3);
  c.quad([0.11, 0.81, 1.55], [0.7, -0.7, 0], [0, 0, -0.9], F(net), [1, 1, 1], 5, 0.1);
  // stone basin with water
  blk(ctx, [0.3, 0.3, 0.06], [0.95, 0.95, 0.38], 'a/cobblestone_bricks');
  const water = new Paint(16, 16, L.get('as/default_diamond_block')).tint([0.55, 0.75, 1]);
  c.quad([0.36, 0.36, 0.33], [0.53, 0, 0], [0, 0.53, 0], F(water), [1, 1, 1.05], 5, 0.01, true);
  for (let i = 0; i < 2; i++) c.sprite([0.4 + i * 0.3, 0.55 - i * 0.3, 1.4 - ((f + i * 0.5) % 1) * 0.9], { tex: L.get('as/bubble') }, 5, 1);
}

export function clayTub(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.12, 0.12, 0.06], [0.88, 0.88, 0.7], 'a/pine_planks', 'a/pine_log_side');
  for (const z of [0.15, 0.55]) blk(ctx, [0.11, 0.11, z], [0.89, 0.89, z + 0.06], 'as/default_steel_block');
  blk(ctx, [0.18, 0.18, 0.62], [0.82, 0.82, 0.66], 'b/old_clay');
  const a = f * TAU, px = 0.5 + Math.cos(a) * 0.15, py = 0.5 + Math.sin(a) * 0.15;
  blk(ctx, [px - 0.03, py - 0.03, 0.6], [px + 0.03, py + 0.03, 1.15], 'a/oak_log_top', 'a/oak_log_side');
  c.sprite([0.9, 0.95, 0], { tex: L.get('as/bucket') }, 5, 1.5);
}

export function harvester(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/oak_planks', 0.02);
  // log cabin with a pitched plank roof (stepped slabs)
  blk(ctx, [0.05, 0.3, 0.06], [0.6, 0.95, 0.6], 'a/oak_log_top', 'a/oak_log_side');
  c.quad([0.25, 0.951, 0.42], [0.18, 0, 0], [0, 0, -0.36], F(L.get('a/oak_planks')), [0.6, 0.5, 0.45], 5, 0.01);
  for (let k = 0; k < 4; k++) blk(ctx, [0.0 + k * 0.08, 0.25, 0.6 + k * 0.1], [0.65 - k * 0.08, 1.0, 0.7 + k * 0.1], 'a/maple_planks');
  chimney(ctx, 0.42, 0.35, 0.6, 0.55);
  // crane: post, swinging arm with a log
  blk(ctx, [0.78, 0.08, 0.06], [0.9, 0.2, 1.25], 'a/oak_log_top', 'a/oak_log_side');
  const a = -0.8 + Math.sin(f * TAU) * 0.6;
  const ex = 0.84 + Math.cos(a) * 0.55, ey = 0.14 + Math.sin(a) * 0.55;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    blk(ctx, [0.84 + (ex - 0.84) * t - 0.04, 0.14 + (ey - 0.14) * t - 0.04, 1.18], [0.84 + (ex - 0.84) * t + 0.04, 0.14 + (ey - 0.14) * t + 0.04, 1.26], 'a/beech_planks');
  }
  blk(ctx, [ex - 0.12, ey - 0.06, 0.85], [ex + 0.12, ey + 0.06, 0.95], 'a/oak_log_top', 'a/oak_log_side');
  lantern(ctx, [0.62, 0.98, 0.3]);
}

export function windSifter(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.15, 0.15, 0.06], [0.85, 0.85, 0.8], 'a/maple_planks', 'a/maple_log_side');
  blk(ctx, [0.1, 0.1, 0.8], [0.9, 0.9, 0.95], 'a/maple_planks');
  blk(ctx, [0.2, 0.2, 0.95], [0.8, 0.8, 1.0], 'a/dirt');
  blk(ctx, [0.46, 0.46, 1.0], [0.54, 0.54, 1.45], 'a/oak_log_top', 'a/oak_log_side');
  sails(ctx, [0.5, 0.62, 1.35], 0.45, f * (Math.PI / 2), 0.09);
  blk(ctx, [0.85, 0.35, 0.2], [1.02, 0.65, 0.3], 'a/beech_planks');
}

/** Four lattice sails in the x–z plane facing the camera (+y). */
function sails({ c, L }: Ctx, hub: V3, len: number, rot: number, width: number): void {
  const sail = new Paint(16, 16).rect(0, 0, 16, 16, 0xf0e2c4);
  for (let i = 0; i < 16; i += 4) sail.rect(i, 0, 1, 16, 0x8a5a36);
  sail.frame(0, 0, 16, 16, 0x6a4430);
  for (let s = 0; s < 4; s++) {
    const a = rot + (s * Math.PI) / 2;
    const ux = Math.cos(a), uz = Math.sin(a), px = -uz, pz = ux;
    // spar
    c.quad([hub[0] - px * 0.02, hub[1] + 0.02, hub[2] - pz * 0.02], [ux * len, 0, uz * len], [px * 0.04, 0, pz * 0.04], F(L.get('a/oak_log_side')), [0.9, 0.82, 0.76], 6, 0.2);
    c.quad([hub[0] + ux * len * 0.25, hub[1] + 0.03, hub[2] + uz * len * 0.25], [ux * len * 0.75, 0, uz * len * 0.75], [px * width * 2, 0, pz * width * 2], F(sail), [0.95, 0.9, 0.85], 6, 0.2);
  }
  c.box([hub[0] - 0.05, hub[1] - 0.02, hub[2] - 0.05], [hub[0] + 0.05, hub[1] + 0.06, hub[2] + 0.05], F(L.get('as/default_steel_block')), F(L.get('as/default_steel_block')), F(L.get('as/default_steel_block')), 6);
}

export function sawmill(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/oak_planks', 0.02);
  for (const [x, y] of [[0.04, 0.04], [0.84, 0.04], [0.04, 0.84], [0.84, 0.84]]) blk(ctx, [x, y, 0.06], [x + 0.12, y + 0.12, 1.1], 'a/oak_log_top', 'a/oak_log_side');
  // stepped plank roof
  for (let k = 0; k < 4; k++) blk(ctx, [0.0 + k * 0.1, -0.02, 1.1 + k * 0.1], [1.0 - k * 0.1, 1.02, 1.2 + k * 0.1], k === 3 ? 'a/oak_log_side' : 'a/maple_planks');
  // bench and log
  blk(ctx, [0.15, 0.3, 0.06], [0.85, 0.7, 0.45], 'a/oak_planks', 'a/oak_log_side');
  blk(ctx, [0.05, 0.38, 0.45], [0.7, 0.62, 0.65], 'a/oak_log_side', 'a/oak_log_side', 'a/oak_log_top');
  c.quad([0.55, 0.52, 0.9], [0.5, 0, 0], [0, 0, -0.5], F(sawTex(f)), [1, 1, 1], 6, 0.3);
  for (let i = 0; i < 4; i++) blk(ctx, [0.6, 0.78 + (i % 2) * 0.02, 0.06 + i * 0.05], [0.98, 0.95, 0.11 + i * 0.05], 'a/oak_planks');
  lantern(ctx, [0.08, 0.95, 0.75]);
}

export function press(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/slate_tiles');
  blk(ctx, [0.15, 0.15, 0.06], [0.85, 0.85, 0.3], 'b/stone');
  for (const x of [0.05, 0.8]) blk(ctx, [x, 0.4, 0.06], [x + 0.15, 0.6, 1.5], 'as/default_steel_block');
  blk(ctx, [0.05, 0.38, 1.5], [0.95, 0.62, 1.65], 'as/default_steel_block');
  const z = 0.35 + (0.5 + 0.5 * Math.cos(f * TAU)) * 0.55;
  blk(ctx, [0.44, 0.44, z + 0.15], [0.56, 0.56, 1.5], 'as/default_bronze_block');
  blk(ctx, [0.22, 0.22, z], [0.78, 0.78, z + 0.15], 'as/default_steel_block');
  c.quad([0.95, 0.7, 1.4], [0, -0.4, 0], [0, 0, -0.4], F(gearTex(0xc8962a, 0x6a4a1a, f)), [0.66, 0.66, 0.76], 6, 0.05);
}

export function millstone(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.1, 0.1, 0.06], [0.9, 0.9, 0.3], 'a/cobblestone_bricks');
  // the turning stone: an octagon of slabs, its seam rotating
  const rot = f * Math.PI / 2;
  for (let i = 0; i < 2; i++) blk(ctx, [0.15 + i * 0.05, 0.2 - i * 0.05, 0.3], [0.85 - i * 0.05, 0.8 + i * 0.05, 0.55], 'a/granite');
  const bx = Math.cos(rot) * 0.6, by = Math.sin(rot) * 0.6;
  for (let i = -6; i <= 6; i++) {
    const t = i / 6;
    blk(ctx, [0.5 + bx * t - 0.04, 0.5 + by * t - 0.04, 0.75], [0.5 + bx * t + 0.04, 0.5 + by * t + 0.04, 0.83], 'a/oak_planks');
  }
  blk(ctx, [0.45, 0.45, 0.55], [0.55, 0.55, 0.85], 'a/oak_log_top', 'a/oak_log_side');
  blk(ctx, [0.7, 0.75, 0.06], [0.98, 0.98, 0.2], 'a/gravel');
}

export function assembler(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/slate_tiles');
  blk(ctx, [0.05, 0.05, 0.06], [0.95, 0.95, 0.85], 'as/default_steel_block');
  const glass = L.get('a/glass');
  c.quad([0.2, 0.951, 0.7], [0.6, 0, 0], [0, 0, -0.45], F(glass), [0.86, 0.84, 0.86], 5, 0.02);
  c.quad([0.28, 0.93, 0.68], [0.36, 0, 0], [0, 0, -0.36], F(gearTex(0xd8a83a, 0x7a5a1a, f, 10)), [0.9, 0.85, 0.8], 5, 0.01);
  c.quad([0.951, 0.7, 0.66], [0, -0.3, 0], [0, 0, -0.3], F(gearTex(0xd08a4a, 0x7a4a2a, -f, 7)), [0.66, 0.66, 0.76], 5, 0.02);
  blk(ctx, [0.15, 0.15, 0.85], [0.85, 0.85, 0.9], 'as/default_copper_block');
  const t = 0.5 - 0.5 * Math.cos(f * TAU);
  blk(ctx, [0.7, 0.15, 0.9], [0.8, 0.25, 1.35], 'as/default_bronze_block');
  blk(ctx, [0.35 - t * 0.1, 0.15, 1.3], [0.8, 0.25, 1.38], 'as/default_bronze_block');
  blk(ctx, [0.32 - t * 0.1, 0.12, 1.05], [0.44 - t * 0.1, 0.28, 1.3], 'as/default_steel_block');
}

export function condenser(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/slate_tiles');
  blk(ctx, [0.1, 0.1, 0.06], [0.9, 0.9, 0.25], 'as/default_copper_block');
  const fill = 0.3 + f * 0.9;
  blk(ctx, [0.25, 0.25, 0.25], [0.75, 0.75, 0.25 + fill], new Paint(16, 16, L.get('a/ice_glacier')).tint([0.8, 0.95, 1.1]));
  c.box([0.2, 0.2, 0.25], [0.8, 0.8, 1.55], F(L.get('a/glass')), F(L.get('a/glass')), F(L.get('a/glass')), 5);
  blk(ctx, [0.1, 0.1, 1.55], [0.9, 0.9, 1.7], 'as/default_copper_block');
  for (const [x, y] of [[0.1, 0.1], [0.78, 0.1], [0.1, 0.78], [0.78, 0.78]]) blk(ctx, [x, y, 0.25], [x + 0.12, y + 0.12, 1.55], 'as/default_copper_block');
  c.quad([0.92, 0.72, 1.1], [0, -0.44, 0], [0, 0, -0.44], F(gearTex(0xb8c0c8, 0x4a4650, f, 4)), [0.66, 0.66, 0.76], 6, 0.03);
  c.light([0.5, 0.8, 0.6], [30, 70, 110], 1.2);
}

export function distiller(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.05, 0.05, 0.06], [0.95, 0.95, 0.3], 'a/mud_bricks');
  blk(ctx, [0.1, 0.35, 0.3], [0.55, 0.85, 0.85], 'as/default_copper_block');
  blk(ctx, [0.2, 0.45, 0.85], [0.45, 0.75, 1.05], 'as/default_copper_block');
  blk(ctx, [0.28, 0.53, 1.05], [0.37, 0.67, 1.35], 'as/default_copper_block');
  for (let i = 0; i < 5; i++) blk(ctx, [0.37 + i * 0.08, 0.57, 1.3 - i * 0.12], [0.45 + i * 0.08, 0.63, 1.36 - i * 0.12], 'as/default_copper_block');
  blk(ctx, [0.62, 0.3, 0.3], [0.92, 0.6, 0.62], new Paint(16, 16, L.get('a/glass')));
  c.sprite([0.77, 0.45, 0.32], { tex: L.get('as/glass bottle'), glow: false }, 6, 2);
  c.sprite([0.77, 0.47, 0.34], { tex: L.get('a/plants/amethyst_crystal'), glow: true, tint: [0.5, 0.9, 1.2] }, 6, 1);
  c.quad([0.25, 0.951, 0.24], [0.3, 0, 0], [0, 0, -0.16], F(fireFace(L.get('a/mud_bricks'), f, 2, 2, 12, 10), { glow: true, uv: [3, 3, 13, 11] }), [1, 1, 1], 5, 0.01);
  c.light([0.75, 0.5, 0.5], [30, 80, 120], 1.1);
}

export function starNet(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.05, 0.8, 0], [0.17, 0.92, 2.1], 'a/maple_log_top', 'a/maple_log_side');
  blk(ctx, [0.8, 0.05, 0], [0.92, 0.17, 2.25], 'a/maple_log_top', 'a/maple_log_side');
  c.quad([0.11, 0.86, 2.0], [0.75, -0.75, 0.12], [0, 0, -0.85], F(gridTex(0xe8dcc0, 3)), [1, 1, 1], 5, 0.1);
  for (let i = 0; i < 4; i++) if (hsh(i, Math.floor(f * 4), 7) > 0.4) c.sprite([0.2 + i * 0.18, 0.76 - i * 0.18, 1.4 + hsh(i, 3) * 0.5], { tex: L.get('as/default_mese_crystal_fragment'), glow: true }, 6, 1);
  blk(ctx, [0.35, 0.35, 0.06], [0.65, 0.65, 0.5], 'a/glass');
  blk(ctx, [0.38, 0.38, 0.06], [0.62, 0.62, 0.15 + f * 0.25], 'as/default_mese_block');
  blk(ctx, [0.37, 0.37, 0.5], [0.63, 0.63, 0.56], 'a/oak_planks');
  c.light([0.5, 0.6, 0.3], [110, 90, 30], 1.1);
}

export function resonator(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/marble_bricks');
  blk(ctx, [0.1, 0.1, 0.06], [0.9, 0.9, 0.4], 'a/marble_bricks3', 'a/marble');
  blk(ctx, [0.25, 0.25, 0.4], [0.75, 0.75, 0.48], 'as/default_gold_block');
  const bob = Math.sin(f * TAU) * 0.06;
  c.box([0.36, 0.36, 0.9 + bob], [0.64, 0.64, 1.32 + bob], F(L.get('a/amethyst'), { glow: true }), F(L.get('a/amethyst'), { glow: true }), F(L.get('a/amethyst'), { glow: true }), 6);
  c.sprite([0.5, 0.5, 1.32 + bob], { tex: L.get('a/plants/amethyst_crystal'), glow: true }, 6, 2);
  for (let i = 0; i < 4; i++) {
    const a = f * TAU + (i * TAU) / 4;
    blk(ctx, [0.5 + Math.cos(a) * 0.48 - 0.05, 0.5 + Math.sin(a) * 0.48 - 0.05, 1.05 + bob], [0.5 + Math.cos(a) * 0.48 + 0.05, 0.5 + Math.sin(a) * 0.48 + 0.05, 1.15 + bob], 'as/default_gold_block');
  }
  c.light([0.5, 0.5, 1.1], [90, 60, 140], 1.8);
}

export function crucible(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.05, 0.05, 0.06], [0.95, 0.95, 0.5], 'a/mud_bricks');
  blk(ctx, [0.2, 0.2, 0.5], [0.8, 0.8, 0.85], 'as/default_obsidian_block');
  const molten = new Paint(16, 16, L.get('as/default_mese_block')).tint([1.1, 0.75, 0.4]);
  c.quad([0.27, 0.27, 0.86], [0.46, 0, 0], [0, 0.46, 0], F(molten, { glow: true }), [1, 1, 1], 6, 0.01, true);
  for (const x of [0.02, 0.86]) blk(ctx, [x, 0.44, 0.06], [x + 0.12, 0.56, 1.4], 'as/default_steel_block');
  blk(ctx, [0.02, 0.44, 1.4], [0.98, 0.56, 1.5], 'as/default_steel_block');
  for (let i = 0; i < 3; i++) blk(ctx, [0.1 + i * 0.27, 0.88, 0.06], [0.3 + i * 0.27, 0.98, 0.14], 'as/default_gold_block');
  c.sprite([0.4, 0.5, 0.9 + (f % 0.5)], { tex: L.get('as/default_mese_crystal_fragment'), glow: true }, 6, 1);
  c.light([0.5, 0.5, 1.0], [150, 90, 20], 1.8);
}

export function drill(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/slate_tiles');
  for (let k = 0; k < 5; k++) {
    const r = 0.42 - k * 0.07, z = k * 0.42;
    for (const [x, y] of [[0.5 - r, 0.5 - r], [0.5 + r - 0.08, 0.5 - r], [0.5 - r, 0.5 + r - 0.08], [0.5 + r - 0.08, 0.5 + r - 0.08]]) blk(ctx, [x, y, z], [x + 0.08, y + 0.08, z + 0.42], 'as/default_steel_block');
    blk(ctx, [0.5 - r, 0.5 - r, z + 0.38], [0.5 + r, 0.5 + r, z + 0.42], 'a/slate_tiles');
  }
  const spin = Math.floor(f * 4) % 2;
  blk(ctx, [0.45, 0.45, 0], [0.55, 0.55, 2.1], spin ? 'as/default_steel_block' : 'as/default_tin_block');
  c.sprite([0.5, 0.5, 2.1], { tex: L.get('a/plants/amethyst_crystal'), glow: true, tint: [0.6, 0.9, 1.2] }, 6, 2);
  c.light([0.5, 0.5, 2.2], [40, 90, 140], 1.2);
}

export function engine(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/slate_tiles');
  blk(ctx, [0.05, 0.05, 0.06], [0.95, 0.95, 0.35], 'as/default_steel_block');
  blk(ctx, [0.15, 0.15, 0.35], [0.85, 0.85, 1.1], 'as/xcopper_oxidized_block', 'as/default_copper_block');
  c.quad([0.3, 0.851, 0.95], [0.4, 0, 0], [0, 0, -0.4], F(new Paint(16, 16, L.get('as/default_diamond_block')).tint([0.6, 0.9, 1.2]), { glow: true }), [1, 1, 1], 5, 0.01);
  c.quad([0.3, 0.87, 0.95], [0.4, 0, 0], [0, 0, -0.4], F(gearTex(0x3a3440, 0x24202a, f, 3)), [1, 1, 1], 5, 0.02);
  for (const [x, y, h] of [[0.2, 0.2, 0.55], [0.62, 0.2, 0.4]]) blk(ctx, [x, y, 1.1], [x + 0.14, y + 0.14, 1.1 + h], 'as/default_steel_block');
  c.light([0.5, 1.0, 0.75], [30, 80, 140], 1.4);
}

export function pylon(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/marble_bricks');
  for (let k = 0; k < 4; k++) blk(ctx, [0.2 + k * 0.04, 0.2 + k * 0.04, 0.06 + k * 0.4], [0.8 - k * 0.04, 0.8 - k * 0.04, 0.46 + k * 0.4], k % 2 ? 'a/marble' : 'a/marble_bricks2');
  blk(ctx, [0.28, 0.28, 1.66], [0.72, 0.72, 1.74], 'as/default_gold_block');
  const bob = Math.sin(f * TAU) * 0.05;
  c.box([0.4, 0.4, 2.0 + bob], [0.6, 0.6, 2.3 + bob], F(L.get('a/amethyst'), { glow: true, tint: [0.7, 0.9, 1.3] }), F(L.get('a/amethyst'), { glow: true, tint: [0.7, 0.9, 1.3] }), F(L.get('a/amethyst'), { glow: true, tint: [0.7, 0.9, 1.3] }), 6);
  c.light([0.5, 0.5, 2.1], [40, 90, 150], 2.2);
}

export function beacon(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/marble_bricks');
  blk(ctx, [0.25, 0.25, 0.06], [0.75, 0.75, 1.4], 'a/obsidian');
  blk(ctx, [0.15, 0.15, 1.4], [0.85, 0.85, 1.5], 'as/default_gold_block');
  const bob = Math.sin(f * TAU) * 0.05;
  c.box([0.38, 0.38, 1.75 + bob], [0.62, 0.62, 2.0 + bob], F(L.get('as/default_diamond_block'), { glow: true }), F(L.get('as/default_diamond_block'), { glow: true }), F(L.get('as/default_diamond_block'), { glow: true }), 6);
  for (let i = 0; i < 6; i++) {
    const a = f * TAU + (i * TAU) / 6;
    c.sprite([0.5 + Math.cos(a) * 0.55, 0.5 + Math.sin(a) * 0.55, 1.75], { tex: L.get('as/default_mese_crystal_fragment'), glow: true, tint: [0.6, 0.9, 1.2] }, 6, 1);
  }
  c.light([0.5, 0.5, 1.9], [40, 100, 150], 2.2);
}

export function roost(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx, 'a/marble_bricks');
  blk(ctx, [0.25, 0.25, 0.06], [0.75, 0.75, 1.6], 'a/limestone_bricks');
  blk(ctx, [0.05, 0.05, 1.6], [0.95, 0.95, 1.8], 'a/hay_top', 'a/hay_side');
  c.sprite([0.5, 0.5, 1.8], { tex: L.get('as/bubble'), glow: true, tint: [0.6, 0.9, 1.2] }, 6, 3);
  for (const [x, y, z] of [[-0.1, 0.4, 1.0], [0.5, -0.1, 1.2], [1.0, 0.6, 0.8]]) {
    blk(ctx, [Math.min(x, 0.5) , Math.min(y, 0.5), z], [Math.max(x, 0.5) + 0.06, Math.max(y, 0.5) + 0.06, z + 0.06], 'a/oak_planks');
    c.sprite([x + 0.03, y + 0.03, z + 0.06 + (Math.sin(f * TAU + x) + 1) * 0.03], { tex: L.get('as/bubble'), glow: true }, 6, 1);
  }
  lantern(ctx, [0.6, 0.78, 0.6]);
}

// ───────────────────────── logistics ─────────────────────────

/** Conveyor belt tile. dir 0:+x 1:+y 2:−x 3:−y; frame phase moves the belt. */
export function belt(c: Canvas, L: TexLib, dir: number, express: boolean, f = 0): void {
  const top = new Paint();
  const base0 = express ? 0x2a3450 : 0x3a3036, band = express ? 0x6ad0f4 : 0x7a6a5a;
  top.rect(0, 0, 16, 16, base0);
  const off = Math.floor(f * 4);
  for (let i = 0; i < 16; i++) if ((i + off) % 4 === 0) top.rect(i, 3, 1, 10, band);
  top.rect(0, 0, 16, 2, express ? 0xc8962a : 0x8a5a36).rect(0, 14, 16, 2, express ? 0xc8962a : 0x8a5a36);
  const side = new Paint(16, 16, L.get(express ? 'as/default_bronze_block' : 'a/oak_planks'));
  const along = dir % 2 === 0;
  const sign = dir < 2 ? 1 : -1;
  // rotate the moving texture by flipping UVs to the travel direction
  const uv: [number, number, number, number] = along ? (sign > 0 ? [16, 0, 0, 16] : [0, 0, 16, 16]) : (sign > 0 ? [0, 16, 16, 0] : [0, 0, 16, 16]);
  const topFace: Face = { tex: along ? top : transpose(top), uv };
  c.box([0, 0, 0], [1, 1, 0.12], topFace, F(side), F(side), 5);
  for (const t of [0.12, 0.88]) c.box(along ? [0, t - 0.05, 0.12] : [t - 0.05, 0, 0.12], along ? [1, t + 0.05, 0.18] : [t + 0.05, 1, 0.18], F(side), F(side), F(side), 5);
}

function transpose(p: Paint): Paint {
  const q = new Paint();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) q.set(x, y, p.get(y, x));
  return q;
}

function chestFront(L: TexLib): Paint {
  return new Paint(16, 16, L.get('a/oak_planks')).frame(0, 0, 16, 16, 0x4a2e1e).rect(0, 6, 16, 1, 0x4a2e1e).rect(6, 5, 4, 4, 0xa8b0bc).rect(7, 7, 2, 1, 0x3a3440);
}

export function depot(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  const lid = new Paint(16, 16, L.get('a/oak_planks')).frame(0, 0, 16, 16, 0x4a2e1e);
  c.box([0.08, 0.08, 0], [0.92, 0.92, 0.75], F(lid), F(chestFront(L)), F(new Paint(16, 16, L.get('a/oak_planks')).frame(0, 0, 16, 16, 0x4a2e1e).rect(0, 6, 16, 1, 0x4a2e1e)), 5);
  // copper hopper on the lid
  blk(ctx, [0.25, 0.25, 0.75], [0.75, 0.75, 0.95], 'as/default_copper_block');
  blk(ctx, [0.32, 0.32, 0.94], [0.68, 0.68, 0.96], new Paint().rect(0, 0, 16, 16, 0x24181a));
  if (f >= 0.5) c.sprite([0.5, 0.5, 0.95], { tex: L.get('as/default_gold_lump') }, 6, 1);
  torch(ctx, [0.95, 0.95, 0], f);
}

export function dispatcher(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.1, 0.1, 0.06], [0.9, 0.9, 0.4], 'b/cobblestone');
  blk(ctx, [0.2, 0.2, 0.4], [0.8, 0.8, 0.85], 'as/default_copper_block');
  blk(ctx, [0.28, 0.28, 0.84], [0.72, 0.72, 0.86], new Paint().rect(0, 0, 16, 16, 0x24181a));
  blk(ctx, [0.8, 0.35, 0.3], [1.05, 0.65, 0.45], 'as/default_bronze_block');
  c.quad([0.3, 0.81, 0.75], [0.4, 0, 0], [0, 0, -0.4], F(gearTex(0xe0b040, 0x7a5a1a, f)), [0.9, 0.85, 0.8], 6, 0.02);
}

export function splitter(c: Canvas, L: TexLib, sorter: boolean, f = 0): void {
  const top = new Paint(16, 16, L.get(sorter ? 'as/default_steel_block' : 'a/oak_planks'));
  const on = 0xffd040, off = 0x8a6a2a;
  const arrows: [number, number, number][] = [[1, 0, sorter || f < 0.34 ? on : off], [0, 1, f >= 0.34 && f < 0.67 ? on : off], [0, -1, !sorter && f >= 0.67 ? on : off]];
  for (const [dx, dy, col] of arrows) {
    const cx = 8 + dx * 5, cy = 8 + dy * 5;
    for (let k = 0; k < 3; k++) { top.set(cx - dy * k + dx * (2 - k), cy + dx * k + dy * (2 - k), col); top.set(cx + dy * k + dx * (2 - k), cy - dx * k + dy * (2 - k), col); }
  }
  c.box([0.05, 0.05, 0], [0.95, 0.95, 0.35], F(top), F(L.get(sorter ? 'as/default_steel_block' : 'a/oak_planks')), F(L.get(sorter ? 'as/default_steel_block' : 'a/oak_planks')), 5);
  if (sorter) c.box([0.35, 0.35, 0.35], [0.65, 0.65, 0.55], F(L.get('a/glass')), F(L.get('a/glass')), F(L.get('a/glass')), 5);
  else c.quad([0.3, 0.3, 0.36], [0.4, 0, 0], [0, 0.4, 0], F(gearTex(0xe0b040, 0x7a5a1a, f)), [1, 1, 1], 6, 0.01, true);
}

export function crates(c: Canvas, L: TexLib, fill: number): void {
  const lid = new Paint(16, 16, L.get('a/oak_planks')).frame(0, 0, 16, 16, 0x4a2e1e);
  const side = chestFront(L);
  const chest = (a: V3, b: V3) => c.box(a, b, F(lid), F(side), F(side), 5);
  chest([0.05, 0.05, 0], [0.55, 0.55, 0.5]);
  chest([0.5, 0.45, 0], [0.95, 0.9, 0.45]);
  c.box([0.08, 0.6, 0], [0.42, 0.94, 0.4], F(L.get('a/hay_top')), F(L.get('a/hay_side')), F(L.get('a/hay_side')), 5);
  if (fill >= 1) chest([0.1, 0.1, 0.5], [0.5, 0.5, 0.9]);
  if (fill >= 2) { chest([0.55, 0.5, 0.45], [0.9, 0.85, 0.8]); c.sprite([0.25, 0.8, 0.4], { tex: L.get('as/default_apple') }, 6, 1); }
}

export function silo(c: Canvas, L: TexLib, fill: number): void {
  const ctx = { c, L };
  base(ctx);
  blk(ctx, [0.12, 0.12, 0.06], [0.88, 0.88, 1.9], 'a/sandstone_bricks', 'a/sandstone_tiles');
  for (const z of [0.5, 1.0, 1.5]) blk(ctx, [0.1, 0.1, z], [0.9, 0.9, z + 0.06], 'as/default_steel_block');
  for (let k = 0; k < 4; k++) blk(ctx, [0.08 + k * 0.1, 0.08 + k * 0.1, 1.9 + k * 0.12], [0.92 - k * 0.1, 0.92 - k * 0.1, 2.02 + k * 0.12], 'a/slate_tiles');
  const lvl = [0.25, 0.75, 1.3][fill];
  c.quad([0.45, 0.881, 0.2 + lvl], [0.1, 0, 0], [0, 0, -lvl], F(L.get('a/hay_side')), [0.9, 0.85, 0.8], 5, 0.01);
}

export function warehouse(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  blk(ctx, [0.02, 0.02, 0], [0.98, 0.98, 0.95], 'a/marble_bricks', 'a/marble_bricks2');
  for (let k = 0; k < 4; k++) blk(ctx, [-0.02 + k * 0.12, -0.02, 0.95 + k * 0.12], [1.02 - k * 0.12, 1.02, 1.07 + k * 0.12], 'a/slate_tiles');
  const door = new Paint(16, 16, L.get('a/amethyst'));
  c.quad([0.32, 0.981, 0.6], [0.36, 0, 0], [0, 0, -0.6], F(door, { glow: true, tint: [0.7, 0.9, 1.3] }), [1, 1, 1], 5, 0.01);
  lantern(ctx, [0.15, 1.0, 0.55]);
  lantern(ctx, [0.75, 1.0, 0.55]);
  void f;
}

export function windmill(c: Canvas, L: TexLib, f = 0): void {
  const ctx = { c, L };
  for (let k = 0; k < 4; k++) blk(ctx, [0.08 + k * 0.03, 0.08 + k * 0.03, k * 0.5], [0.92 - k * 0.03, 0.92 - k * 0.03, k * 0.5 + 0.5], k < 2 ? 'a/cobblestone_mossy' : 'a/limestone_bricks');
  c.quad([0.38, 0.921, 0.42], [0.24, 0, 0], [0, 0, -0.4], F(L.get('a/oak_planks')), [0.7, 0.6, 0.55], 5, 0.01);
  c.quad([0.6, 0.831, 1.55], [0.14, 0, 0], [0, 0, -0.16], F(lanternTex(), { glow: true, uv: [4, 4, 12, 12] }), [1, 1, 1], 5, 0.01);
  for (let k = 0; k < 4; k++) blk(ctx, [0.05 + k * 0.1, 0.05 + k * 0.1, 2.0 + k * 0.15], [0.95 - k * 0.1, 0.95 - k * 0.1, 2.15 + k * 0.15], 'a/maple_planks');
  sails(ctx, [0.5, 0.95, 1.85], 0.95, f * (Math.PI / 2), 0.14);
  c.light([0.67, 0.95, 1.5], [110, 80, 30], 1.0);
}

export function forge(c: Canvas, L: TexLib, stage: number, f = 0): void {
  const ctx = { c, L };
  blk(ctx, [0.05, 0.05, 0], [2.95, 2.95, 0.12], 'a/marble_bricks');
  if (stage === 0) {
    for (const [x, y] of [[0.2, 0.2], [2.6, 0.2], [0.2, 2.6], [2.6, 2.6]]) blk(ctx, [x, y, 0.12], [x + 0.2, y + 0.2, 0.9], 'a/oak_log_top', 'a/oak_log_side');
    c.box([1.1, 1.1, 0.12], [1.9, 1.9, 0.16], F(L.get('a/amethyst'), { glow: true }), F(L.get('a/amethyst')), F(L.get('a/amethyst')), 5);
    return;
  }
  blk(ctx, [0.2, 0.2, 0.12], [2.8, 2.8, 0.5], 'a/marble_bricks3', 'a/marble');
  blk(ctx, [0.6, 0.6, 0.5], [2.4, 2.4, 0.75], 'a/marble_bricks2');
  if (stage >= 2) {
    for (const [x, y] of [[0.55, 0.55], [2.2, 0.55], [0.55, 2.2], [2.2, 2.2]]) {
      blk(ctx, [x, y, 0.75], [x + 0.25, y + 0.25, 3.6], 'as/default_steel_block');
      blk(ctx, [x - 0.05, y - 0.05, 0.75], [x + 0.3, y + 0.3, 1.0], 'as/default_gold_block');
    }
    blk(ctx, [0.55, 0.55, 3.6], [2.45, 0.8, 3.8], 'as/default_gold_block');
    blk(ctx, [0.55, 2.2, 3.6], [2.45, 2.45, 3.8], 'as/default_gold_block');
    blk(ctx, [0.55, 0.55, 3.6], [0.8, 2.45, 3.8], 'as/default_gold_block');
    blk(ctx, [2.2, 0.55, 3.6], [2.45, 2.45, 3.8], 'as/default_gold_block');
    c.box([1.0, 1.0, 0.75], [2.0, 2.0, 1.6], F(L.get('a/glass')), F(L.get('a/glass')), F(L.get('a/glass')), 5);
  }
  if (stage >= 3) {
    const bob = Math.sin(f * TAU) * 0.08;
    for (let k = 0; k < 5; k++) {
      const r = 0.12 + (k < 3 ? k : 4 - k) * 0.12;
      c.box([1.5 - r, 1.5 - r, 4.4 + k * 0.25 + bob], [1.5 + r, 1.5 + r, 4.65 + k * 0.25 + bob], F(L.get('a/amethyst'), { glow: true }), F(L.get('a/amethyst'), { glow: true }), F(L.get('a/amethyst'), { glow: true }), 6);
    }
    for (let i = 0; i < 8; i++) {
      const a = f * TAU + (i * TAU) / 8;
      c.sprite([1.5 + Math.cos(a) * 1.1, 1.5 + Math.sin(a) * 1.1, 4.8 + bob], { tex: L.get('as/default_mese_crystal_fragment'), glow: true }, 6, 2);
    }
    c.light([1.5, 1.5, 4.8], [90, 70, 150], 3.5);
  }
}
