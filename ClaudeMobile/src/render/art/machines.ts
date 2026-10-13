import { blocks, flat, glassShade, metal, noisy, planks, LIGHT } from './materials';
import { P } from './palette';
import { type IsoOrigin, type RGBA, PixelCanvas, box, cylinder, hash2, iso, mix, rgb, shadeRamp, bayer, face } from './pixel';
import { type SpriteDef, anchorOf, canvasFor, frames } from './sprite';

type Draw = (c: PixelCanvas, o: IsoOrigin, f: number) => void;

function make(h: number, n: number, draw: Draw, extra: Partial<SpriteDef> = {}, size = 1, pad = 0): SpriteDef {
  const [ax, ay] = anchorOf(size, h, pad);
  return {
    frames: frames(n, (f) => {
      const { c, o } = canvasFor(size, h, pad);
      draw(c, o, f);
      c.outline(0.5, true);
      return c;
    }),
    ax, ay, fps: 6, ...extra,
  };
}

const woodBox = (seed = 1, boards = 3) => ({ top: planks('top', boards, seed), left: planks('left', boards, seed + 1), right: planks('right', boards, seed + 2) });
const stoneBox = (rows = 3, cols = 3, r = P.stone) => ({ top: flat(r, 'top'), left: blocks('left', rows, cols, r, 7), right: blocks('right', rows, cols, r, 8) });
const brickBox = (rows = 5, cols = 3) => ({ top: flat(P.brick, 'top'), left: blocks('left', rows, cols, P.brick, 11), right: blocks('right', rows, cols, P.brick, 12) });
const ironBox = (r = P.iron) => ({ top: metal('top', r), left: metal('left', r), right: metal('right', r) });
const plainBox = (r: RGBA[]) => ({ top: flat(r, 'top'), left: flat(r, 'left'), right: flat(r, 'right') });

/** Small post: a thin box. */
function post(c: PixelCanvas, o: IsoOrigin, u: number, v: number, z0: number, h: number, r = P.wood, w = 1.5): void {
  box(c, o, u, v, w, w, z0, h, plainBox(r));
}

function plinth(c: PixelCanvas, o: IsoOrigin, h = 3, r = P.stone): void {
  box(c, o, 0, 0, 14, 14, 0, h, stoneBox(1, 4, r));
}

/** A gear seen face-on in the iso left plane, rotating with f. */
function gearLeft(c: PixelCanvas, cx: number, cy: number, r: number, f: number, ramp: RGBA[] = P.brass): void {
  const teeth = 8;
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + f * (Math.PI / 16);
    const tooth = Math.cos(a * teeth) > 0.3 ? 1.6 : 0;
    if (d <= r + tooth && d > r * 0.3) {
      const l = 0.7 - (dx + dy) / (r * 4) + (d > r ? -0.1 : 0);
      c.px(x, y, shadeRamp(ramp, l, x, y, 0.2));
    } else if (d <= r * 0.3) c.px(x, y, ramp[1]);
  }
}


// ───────────────────────── crafting ─────────────────────────

export function workbench(): SpriteDef {
  return make(72, 1, (c, o) => {
    for (const [u, v] of [[-10, -6], [10, -6], [-10, 6], [10, 6]]) post(c, o, u, v, 0, 12, P.darkwood, 1.2);
    box(c, o, 0, 0, 13, 9, 12, 3, woodBox(4, 2));
    // tools: saw blade, hammer, vise
    const [sx, sy] = iso(o, -4, -2, 15);
    c.line(sx - 6, sy, sx + 2, sy - 4, P.iron[4]);
    c.line(sx - 6, sy + 1, sx + 2, sy - 3, P.iron[3]);
    c.rect(sx + 2, sy - 5, 3, 2, P.wood[4]);
    const [hx, hy] = iso(o, 5, 3, 15);
    c.line(hx - 4, hy, hx + 2, hy - 3, P.wood[3]);
    c.rect(hx + 1, hy - 5, 3, 3, P.iron[3]);
    box(c, o, 8, -6, 2.5, 2.5, 15, 4, ironBox());
    // shelf with planks
    box(c, o, 0, 0, 9, 6, 3, 1.5, woodBox(9, 1));
  }, { fps: 1 });
}

export function composter(): SpriteDef {
  return make(80, 4, (c, o, f) => {
    box(c, o, 0, 0, 13, 13, 0, 14, woodBox(2, 3));
    // dark loam inside with leaves on top
    const [tx, ty] = iso(o, 0, 0, 14);
    c.ellipse(tx, ty, 22, 10.5, (x, y) => shadeRamp(P.soil, 0.25 + (hash2(x, y, 3) > 0.7 ? 0.2 : 0), x, y, 0.4));
    for (let i = 0; i < 14; i++) {
      const lx = tx - 14 + Math.floor(hash2(i, 1, 5) * 28), ly = ty - 4 + Math.floor(hash2(i, 2, 5) * 8);
      c.set(lx, ly, P.leaf[2 + (i % 3)]);
      c.set(lx + 1, ly, P.leaf[1 + (i % 3)]);
    }
    // corner posts
    for (const [u, v] of [[-13, 13], [13, 13], [13, -13]]) post(c, o, u, v, 0, 16, P.darkwood, 1.3);
    // steam
    for (let i = 0; i < 3; i++) {
      const k = (f + i * 1.4) % 4;
      c.px(tx - 6 + i * 6, ty - 4 - Math.round(k * 3), rgb(0xf6efe0, Math.round(150 - k * 35)));
    }
  }, { fps: 3, smoke: [0, -24] });
}

export function sieve(): SpriteDef {
  const h = 76;
  const s = make(h, 3, (c, o, f) => {
    const sh = [0, 1, -1][f];
    for (const [u, v] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) post(c, o, u, v, 0, 14, P.wood, 1.2);
    const oo = { x: o.x + sh, y: o.y };
    // frame with mesh
    box(c, oo, 0, 0, 13, 13, 14, 3, woodBox(6, 1));
    const [tx, ty] = iso(oo, 0, 0, 17);
    c.ellipse(tx, ty, 19, 9, (x, y) => ((x + y) % 3 === 0 || (x - y) % 3 === 0 ? P.iron[2] : shadeRamp(P.soil, 0.55, x, y, 0.4)));
    c.ellipse(tx - 2, ty - 1, 9, 4.5, (x, y) => shadeRamp(P.soil, 0.65, x, y, 0.5));
    // falling grains
    const [bx, by] = iso(o, 0, 0, 6);
    for (let i = 0; i < 4; i++) c.set(bx - 6 + i * 4, by - ((f * 3 + i * 5) % 9), P.soil[4]);
    // pile underneath
    c.ellipse(bx, iso(o, 0, 0, 0)[1] - 1, 10, 4, P.rock[3]);
    c.ellipse(bx - 1, iso(o, 0, 0, 0)[1] - 2, 6, 2.5, P.rock[4]);
  }, { fps: 10 });
  return s;
}

export function dewCatcher(): SpriteDef {
  return make(96, 4, (c, o, f) => {
    post(c, o, -12, 4, 0, 40, P.wood, 1.3);
    post(c, o, 4, -12, 0, 40, P.wood, 1.3);
    // mesh between posts
    const [ax, ay] = iso(o, -12, 4, 38), [bx, by] = iso(o, 4, -12, 38);
    for (let y = 0; y < 30; y++) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
      const t = (x - ax) / (bx - ax);
      const yy = Math.round(ay + (by - ay) * t + y);
      if ((x % 3 === 0) || (y % 3 === 0)) c.px(x, yy, rgb(0xd8e4e0, 170));
    }
    // droplets sliding
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3;
      const x = Math.round(ax + (bx - ax) * t);
      const y = Math.round(ay + (by - ay) * t + ((f * 7 + i * 9) % 28));
      c.set(x, y, P.water[4]);
      c.set(x, y + 1, P.water[2]);
    }
    // bowl
    cylinder(c, o, -2, 0, 9, 0, 6, P.clay);
    const [cx, cy] = iso(o, -2, 0, 6);
    c.ellipse(cx, cy, 11, 5, (x, y) => shadeRamp(P.water, 0.7 + (Math.sin(x * 0.8 + f) > 0.7 ? 0.25 : 0), x, y, 0.3));
  }, { fps: 4, lights: [[0, -8, 0x8adcff, 10]] });
}

export function clayTub(): SpriteDef {
  return make(70, 4, (c, o, f) => {
    cylinder(c, o, 0, 0, 13, 0, 13, P.wood);
    // hoops
    for (const z of [3, 10]) {
      const [cx, cy] = iso(o, 0, 0, z);
      for (let x = -18; x <= 18; x++) {
        const t = x / 18.4;
        const y = Math.round(cy + 9.2 * Math.sqrt(Math.max(0, 1 - t * t)));
        c.set(cx + x, y, P.iron[2 + (x < 0 ? 1 : 0)]);
      }
    }
    const [tx, ty] = iso(o, 0, 0, 13);
    c.ellipse(tx, ty, 16, 8, (x, y) => shadeRamp(P.clay, 0.55 + Math.sin((x - tx) * 0.5 + f * 1.5) * 0.12, x, y, 0.4));
    // paddle
    const a = (f / 4) * Math.PI * 2;
    const px = Math.round(tx + Math.cos(a) * 8), py = Math.round(ty + Math.sin(a) * 4);
    c.line(px, py, px + 3, py - 16, P.wood[4]);
    c.line(px + 1, py, px + 4, py - 16, P.wood[2]);
  }, { fps: 5 });
}

export function kiln(): SpriteDef {
  return make(96, 4, (c, o, f) => {
    plinth(c, o, 3);
    // beehive dome built from stacked brick rings
    for (let k = 0; k < 9; k++) {
      const r = 13 - k * k * 0.14;
      cylinder(c, o, 0, 0, Math.max(3, r), 3 + k * 3, 3, P.brick, (d, x, y) => shadeRamp(P.brick, 0.75 - d * 0.3, x, y, 0.4));
    }
    // brick courses
    // chimney
    box(c, o, 4, -4, 2.5, 2.5, 26, 10, brickBox(4, 1));
    // arched mouth with fire
    const [mx, my] = iso(o, 0, 12, 4);
    for (let y = -9; y <= 0; y++) for (let x = -5; x <= 5; x++) {
      if (x * x + (y + 3) * (y + 3) * 0.8 > 26 && y < -3) continue;
      const heat = (y + 9) / 9 + (hash2(x, y, f) - 0.5) * 0.5;
      c.set(mx + x - 2, my + y + 2, shadeRamp(P.fire, heat, x + f, y, 0.3));
    }
  }, { fps: 6, lights: [[-2, -4, 0xff8a3a, 22]], smoke: [8, -48] });
}

export function harvester(): SpriteDef {
  return make(96, 4, (c, o, f) => {
    plinth(c, o, 2, P.flag);
    // little hut with thatch roof
    box(c, o, -3, 3, 8, 8, 2, 12, woodBox(3, 3));
    const [rx, ry] = iso(o, -3, 3, 14);
    c.poly([[rx - 19, ry + 1], [rx, ry - 12], [rx + 19, ry + 1], [rx, ry + 10]], (x, y) => shadeRamp(thatchRamp, 0.55 + (x < rx ? 0.15 : -0.1) + (hash2(x, Math.floor(y / 2)) - 0.5) * 0.25, x, y, 0.3));
    // pole with swinging arm and claw
    post(c, o, 9, -9, 2, 30, P.iron, 1.2);
    const [px, py] = iso(o, 9, -9, 30);
    const a = Math.sin((f / 4) * Math.PI * 2) * 0.9;
    const ex = Math.round(px + Math.cos(a) * 14), ey = Math.round(py + Math.sin(a) * 5 + 2);
    c.line(px, py, ex, ey, P.copper[3]);
    c.line(px, py + 1, ex, ey + 1, P.copper[2]);
    c.line(ex, ey, ex - 2, ey + 4, P.iron[4]);
    c.line(ex, ey, ex + 2, ey + 4, P.iron[4]);
    gearLeft(c, px, py, 3, f * 2, P.brass);
    // basket of timber
    box(c, o, 6, 9, 5, 4, 2, 5, woodBox(7, 2));
    const [bx, by] = iso(o, 6, 9, 7);
    c.rect(bx - 4, by - 2, 8, 2, P.wood[4]);
    c.rect(bx - 3, by - 3, 6, 1, P.leaf[3]);
  }, { fps: 6, lamp: [0, 0] });
}

export function windSifter(): SpriteDef {
  return make(104, 4, (c, o, f) => {
    plinth(c, o, 3);
    box(c, o, 0, 0, 11, 11, 3, 16, woodBox(12, 3));
    // hopper on top
    const [tx, ty] = iso(o, 0, 0, 19);
    c.poly([[tx - 18, ty], [tx, ty - 9], [tx + 18, ty], [tx, ty + 9]], (x, y) => shadeRamp(P.soil, 0.45, x, y, 0.5));
    // mast + rotor
    post(c, o, 0, 0, 19, 18, P.wood, 1);
    const [mx, my] = iso(o, 0, 0, 37);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + (f / 4) * (Math.PI / 2);
      const ex = mx + Math.cos(a) * 13, ey = my + Math.sin(a) * 13 * 0.5;
      c.line(mx, my, ex, ey, P.cream[1]);
      c.line(mx, my - 1, ex, ey - 1, P.cream[2]);
    }
    c.rect(mx - 1, my - 1, 2, 2, P.copper[3]);
    // chute with falling pebbles
    const [cx, cy] = iso(o, 12, 0, 8);
    c.rect(cx - 2, cy - 2, 4, 3, P.wood[2]);
    c.set(cx, cy + 2 + (f % 3), P.rock[4]);
  }, { fps: 8, lamp: [0, 0] });
}

export function sawmill(): SpriteDef {
  return make(84, 4, (c, o, f) => {
    plinth(c, o, 3);
    for (const [u, v] of [[-11, -8], [11, -8], [-11, 8], [11, 8]]) post(c, o, u, v, 3, 9, P.darkwood, 1.2);
    box(c, o, 0, 0, 13, 9, 12, 3, woodBox(5, 2));
    // log on the table
    cylinder(c, o, -3, 0, 3.5, 15, 0, P.wood);
    box(c, o, -6, 0, 6, 3, 15, 5, { top: (_s, t, x, y) => shadeRamp(P.wood, 0.85 - t * 0.2, x, y, 0.2), left: planks('left', 2, 3), right: (s, t) => ((Math.hypot(s - 0.5, t - 0.5) * 8) % 1 < 0.4 ? P.wood[4] : P.wood[3]) });
    // circular saw spinning (left-plane disc)
    const [sx, sy] = iso(o, 6, 0, 18);
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d > 7) continue;
      const a = Math.atan2(y, x) + f * 0.6;
      const tooth = d > 5.8 && Math.cos(a * 12) > 0;
      if (d > 6 && !tooth) continue;
      c.set(sx + x, sy + y - 3, d < 1.5 ? P.iron[1] : shadeRamp(P.iron, 0.75 - (x + y) / 20 + (Math.cos(a * 3) > 0.9 ? 0.2 : 0), x, y, 0.2));
    }
    // sawdust
    for (let i = 0; i < 3; i++) c.set(sx + 7 + i * 2, sy + 2 + ((f + i) % 3), P.wood[5]);
    // roof
    post(c, o, -11, -8, 15, 18, P.darkwood, 1);
    post(c, o, 11, 8, 15, 14, P.darkwood, 1);
  }, { fps: 10, lamp: [0, 0] });
}

export function press(): SpriteDef {
  return make(100, 4, (c, o, f) => {
    plinth(c, o, 3);
    box(c, o, 0, 0, 12, 12, 3, 8, stoneBox(2, 3));
    // frame
    post(c, o, -10, 10, 11, 26, P.iron, 1.6);
    post(c, o, 10, -10, 11, 26, P.iron, 1.6);
    box(c, o, 0, 0, 12, 2.5, 37, 3, ironBox());
    // piston
    const z = [24, 20, 13, 20][f];
    box(c, o, 0, 0, 2, 2, z + 5, 37 - z - 5, plainBox(P.brass));
    box(c, o, 0, 0, 7, 7, z, 5, ironBox(P.iron));
    // stone block being pressed
    box(c, o, 0, 0, 5, 5, 11, f === 2 ? 2 : 3, plainBox(P.stone));
    if (f === 2) for (let i = 0; i < 4; i++) { const [dx, dy] = iso(o, -8 + i * 5, 8, 12); c.set(dx, dy - 1, P.rock[4]); }
  }, { fps: 5, lamp: [0, 0] });
}

export function millstone(): SpriteDef {
  return make(92, 4, (c, o, f) => {
    plinth(c, o, 3);
    cylinder(c, o, 0, 0, 13, 3, 7, P.stone);
    cylinder(c, o, 0, 0, 11, 10, 6, P.stone, (d, x, y) => {
      const a = Math.atan2(y - iso(o, 0, 0, 16)[1], (x - iso(o, 0, 0, 16)[0]) / 2) + f * 0.4;
      return shadeRamp(P.stone, 0.8 - d * 0.3 + (Math.cos(a * 6) > 0.7 ? -0.25 : 0), x, y, 0.3);
    });
    // shaft and wooden beam turning
    post(c, o, 0, 0, 16, 16, P.wood, 1.3);
    const [mx, my] = iso(o, 0, 0, 28);
    const a = (f / 4) * Math.PI;
    c.line(mx - Math.cos(a) * 14, my - Math.sin(a) * 7, mx + Math.cos(a) * 14, my + Math.sin(a) * 7, P.wood[3]);
    c.line(mx - Math.cos(a) * 14, my - Math.sin(a) * 7 + 1, mx + Math.cos(a) * 14, my + Math.sin(a) * 7 + 1, P.wood[1]);
    gearLeft(c, mx, my - 3, 4, f * 2);
    // gravel pile
    const [gx, gy] = iso(o, 10, 10, 0);
    c.ellipse(gx, gy - 1, 6, 3, (x, y) => shadeRamp(P.rock, 0.5 + hash2(x, y) * 0.3, x, y, 0.3));
  }, { fps: 6, lamp: [0, 0] });
}

export function furnace(): SpriteDef {
  return make(112, 4, (c, o, f) => {
    plinth(c, o, 3);
    box(c, o, 0, 0, 12, 12, 3, 22, brickBox(7, 3));
    box(c, o, 0, 0, 9, 9, 25, 8, brickBox(3, 3));
    box(c, o, 2, -2, 3, 3, 33, 14, brickBox(5, 1));
    // glowing mouth
    const [mx, my] = iso(o, -2, 12, 4);
    for (let y = -8; y <= 0; y++) for (let x = -5; x <= 5; x++) {
      const heat = (y + 8) / 8 + (hash2(x, y, f) - 0.5) * 0.45 + (f % 2) * 0.1;
      c.set(mx + x, my + y + Math.floor((x + 5) / 2) - 2, shadeRamp(P.fire, heat, x, y, 0.3));
    }
    // bellows pumping
    const squash = [0, 2, 4, 2][f];
    const [bx, by] = iso(o, 15, 4, 8);
    c.poly([[bx - 6, by], [bx + 4, by - 4 + squash], [bx + 8, by + 2], [bx - 2, by + 6 - squash / 2]], (x, y) => shadeRamp(P.soil, 0.55 + ((x + y) % 3 === 0 ? -0.2 : 0), x, y, 0.3));
    c.line(bx - 6, by, bx - 12, by - 2, P.wood[3]);
    // copper pipe
    const [px, py] = iso(o, 12, -6, 20);
    c.line(px, py, px - 6, py - 4, P.copper[4]);
    c.line(px, py + 1, px - 6, py - 3, P.copper[2]);
  }, { fps: 6, lights: [[-2, -6, 0xff7a2a, 24]], smoke: [4, -64], lamp: [0, 0] });
}

export function assembler(): SpriteDef {
  return make(96, 4, (c, o, f) => {
    plinth(c, o, 3, P.iron);
    box(c, o, 0, 0, 13, 13, 3, 14, ironBox());
    // window into the works
    const [wx, wy] = iso(o, -4, 13, 13);
    c.rect(wx - 4, wy - 4, 9, 6, P.glass[1]);
    c.line(wx - 3, wy - 3, wx + 1, wy + 1, P.glass[3]);
    gearLeft(c, wx + 2, wy - 1, 2.5, f * 3, P.brass);
    // work table on top
    box(c, o, 0, 0, 10, 10, 17, 2, plainBox(P.copper));
    // arm
    post(c, o, 8, -8, 19, 10, P.iron, 1.2);
    const [jx, jy] = iso(o, 8, -8, 29);
    const t = [0, 0.33, 0.66, 0.33][f];
    const ex = Math.round(jx - 4 - t * 10), ey = Math.round(jy + 3 + t * 6);
    c.line(jx, jy, ex, ey, P.brass[3]);
    c.line(jx, jy + 1, ex, ey + 1, P.brass[1]);
    c.rect(ex - 1, ey, 3, 3, P.iron[4]);
    // part on table
    const [px, py] = iso(o, -2, 2, 19);
    gearLeft(c, px, py - 2, 3, 0, P.copper);
  }, { fps: 6, lamp: [0, 0], lights: [[-4, -12, 0x8adcff, 10]] });
}

// ───────────────────────── aether ─────────────────────────

export function condenser(): SpriteDef {
  return make(108, 4, (c, o, f) => {
    plinth(c, o, 3, P.iron);
    // copper frame cage around a glass column
    cylinder(c, o, 0, 0, 7, 3, 30, P.glass, (d, x, y) => shadeRamp(P.aether, 0.7 - d * 0.3, x, y, 0.3));
    const [gx, gy] = iso(o, 0, 0, 3);
    for (let y = 0; y < 30; y++) {
      const fill = y < 10 + f * 3;
      if (!fill) continue;
      for (let x = -6; x <= 6; x++) if (hash2(x, y, 1) > 0.45) c.px(gx + x, gy - y, rgb(0xd8fff2, 110));
    }
    for (const [u, v] of [[-8, 8], [8, 8], [8, -8]]) post(c, o, u, v, 3, 32, P.copper, 1);
    box(c, o, 0, 0, 9, 9, 33, 2, plainBox(P.copper));
    // intake fan on the side, spinning
    const [fx, fy] = iso(o, 10, 0, 20);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + (f / 4) * ((Math.PI * 2) / 3);
      c.line(fx, fy, fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, P.iron[4]);
    }
    c.rect(fx - 1, fy - 1, 2, 2, P.brass[3]);
    // wisps of cloud being drawn in
    for (let i = 0; i < 3; i++) c.px(fx + 10 - ((f * 3 + i * 4) % 10), fy - 3 + i * 3, rgb(0xf6f0e0, 160));
  }, { fps: 6, lamp: [0, 0], lights: [[0, -18, 0x8fe3d2, 18]] });
}

export function distiller(): SpriteDef {
  return make(104, 4, (c, o, f) => {
    plinth(c, o, 3);
    box(c, o, 0, 0, 13, 13, 3, 8, brickBox(3, 3));
    // copper pot
    cylinder(c, o, -4, 3, 8, 11, 12, P.copper);
    const [tx, ty] = iso(o, -4, 3, 23);
    c.line(tx, ty, tx + 4, ty - 8, P.copper[3]);
    // glass coil and flask
    for (let k = 0; k < 4; k++) {
      const [cx, cy] = iso(o, 6, -6, 14 + k * 4);
      c.ellipse(cx, cy, 4, 2, (_x, _y, d) => (d > 0.5 ? P.glass[3] : 0));
    }
    const [fx, fy] = iso(o, 8, 6, 11);
    c.ellipse(fx, fy - 5, 5, 5, (x, y, d) => shadeRamp(P.aether, 0.85 - d * 0.4 + (bayer(x, y) > 0.8 ? 0.15 : 0), x, y, 0.3));
    c.rect(fx - 1, fy - 13, 3, 4, P.glass[3]);
    // bubbles
    for (let i = 0; i < 3; i++) c.set(fx - 2 + i * 2, fy - 4 - ((f + i * 2) % 5), P.aether[5]);
    c.line(tx + 4, ty - 8, fx, fy - 12, P.glass[3]);
  }, { fps: 6, lamp: [0, 0], lights: [[8, -10, 0x8fe3d2, 16]] });
}

export function starNet(): SpriteDef {
  return make(120, 4, (c, o, f) => {
    plinth(c, o, 2, P.flag);
    post(c, o, -12, 6, 2, 44, P.darkwood, 1.2);
    post(c, o, 6, -12, 2, 50, P.darkwood, 1.2);
    // net strung between (a sagging catenary)
    const [ax, ay] = iso(o, -12, 6, 46), [bx, by] = iso(o, 6, -12, 52);
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const x = Math.round(ax + (bx - ax) * t);
      const sag = Math.sin(t * Math.PI) * 10;
      const yTop = Math.round(ay + (by - ay) * t + sag);
      for (let k = 0; k < 18; k++) {
        if ((i + k) % 3 && k % 3) continue;
        c.px(x, yTop + k, rgb(0xe8dcc0, 150 - k * 5));
      }
      // caught stardust glitter
      if (hash2(i, f, 7) > 0.84) c.set(x, yTop + 6 + Math.floor(hash2(i, 9) * 8), P.star[3]);
    }
    // collecting jar
    cylinder(c, o, -2, 4, 4, 2, 7, P.glass);
    const [jx, jy] = iso(o, -2, 4, 6);
    c.ellipse(jx, jy, 4, 3, P.star[f % 2 ? 2 : 3]);
  }, { fps: 4, lamp: [0, 0], lights: [[-2, -8, 0xffe08a, 14]] });
}

export function resonator(): SpriteDef {
  return make(112, 6, (c, o, f) => {
    plinth(c, o, 3, P.iron);
    box(c, o, 0, 0, 11, 11, 3, 8, ironBox());
    cylinder(c, o, 0, 0, 7, 11, 3, P.brass);
    // floating crystal
    const bob = Math.round(Math.sin((f / 6) * Math.PI * 2) * 2);
    const [cx, cy] = iso(o, 0, 0, 30 + bob);
    c.poly([[cx, cy - 12], [cx + 6, cy - 2], [cx, cy + 8], [cx - 6, cy - 2]], (x, y) => shadeRamp(P.aether, 0.85 - (x - cx + 6) / 16 + (y < cy - 2 ? 0.1 : -0.1), x, y, 0.2));
    c.line(cx, cy - 12, cx, cy + 8, P.aether[5]);
    // orbiting rings
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + (f / 6) * Math.PI * 0.5;
      const x = Math.round(cx + Math.cos(a) * 12), y = Math.round(cy + Math.sin(a) * 4 + 2);
      c.set(x, y, Math.sin(a) > 0 ? P.brass[4] : P.brass[2]);
    }
  }, { fps: 8, lamp: [0, 0], lights: [[0, -30, 0x8fe3d2, 26]] });
}

export function crucible(): SpriteDef {
  return make(100, 4, (c, o, f) => {
    plinth(c, o, 3);
    box(c, o, 0, 0, 13, 13, 3, 12, brickBox(4, 3));
    cylinder(c, o, 0, 0, 9, 15, 9, P.iron);
    const [tx, ty] = iso(o, 0, 0, 24);
    c.ellipse(tx, ty, 11, 5.5, (x, y) => shadeRamp(P.gold, 0.6 + Math.sin(x * 0.6 + y + f * 1.7) * 0.25, x, y, 0.3));
    // support arms
    post(c, o, -12, 0, 3, 26, P.iron, 1.2);
    post(c, o, 12, 0, 3, 26, P.iron, 1.2);
    box(c, o, 0, 0, 13, 1.5, 29, 2, plainBox(P.iron));
    for (let i = 0; i < 2; i++) c.set(tx - 3 + i * 6, ty - 3 - ((f + i * 2) % 4), P.gold[4]);
  }, { fps: 5, lamp: [0, 0], lights: [[0, -22, 0xffc04a, 26]], smoke: [0, -40] });
}

export function drill(): SpriteDef {
  return make(116, 4, (c, o, f) => {
    plinth(c, o, 2, P.iron);
    // derrick
    for (const [u, v] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
      const [x0, y0] = iso(o, u, v, 2), [x1, y1] = iso(o, u * 0.3, v * 0.3, 44);
      c.line(x0, y0, x1, y1, P.iron[3]);
      c.line(x0 + 1, y0, x1 + 1, y1, P.iron[2]);
    }
    box(c, o, 0, 0, 4, 4, 42, 4, plainBox(P.brass));
    // spinning bit going into the ground
    const [bx, by] = iso(o, 0, 0, 40);
    for (let y = 0; y < 38; y++) {
      const w = y > 30 ? 2 : 1;
      for (let x = -w; x <= w; x++) {
        const stripe = (y + f * 2 + x) % 4 < 2;
        c.set(bx + x, by + y, stripe ? P.iron[4] : P.iron[2]);
      }
    }
    // crystal core on top
    const [cx, cy] = iso(o, 0, 0, 50);
    c.poly([[cx, cy - 7], [cx + 4, cy], [cx, cy + 4], [cx - 4, cy]], (x, y) => shadeRamp(P.aether, 0.8 - (x - cx + 4) / 10, x, y, 0.2));
    // dust
    const [gx, gy] = iso(o, 0, 0, 2);
    for (let i = 0; i < 3; i++) c.set(gx - 6 + i * 6, gy - 2 - ((f + i) % 3), P.rock[4]);
  }, { fps: 10, lamp: [0, 0], lights: [[0, -46, 0x8fe3d2, 14]] });
}

// ───────────────────────── logistics ─────────────────────────

/** Conveyor tile: flat, drawn in the floor layer. dir 0:+x 1:+y 2:-x 3:-y. */
export function beltFrames(dir: number, express: boolean): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const bed = express ? P.aether : P.iron;
  const rail = express ? P.stone : P.wood;
  for (let f = 0; f < 4; f++) {
    const { c, o } = canvasFor(1, 40);
    // along axis a (u for dir 0/2, v for 1/3); width across
    const alongU = dir % 2 === 0;
    const sign = dir < 2 ? 1 : -1;
    const hw = 9;
    // bed
    const bedShade = (s: number, t: number, x: number, y: number) => {
      const along = (alongU ? s : t) * 32;
      const k = ((along * sign - f * 2) % 8 + 8) % 8;
      const across = alongU ? t : s;
      // chevrons
      const chev = Math.abs(across - 0.5) * 6;
      const on = ((k + chev) % 8) < 1.6;
      return shadeRamp(bed, (on ? 0.62 : 0.32) + (across < 0.12 || across > 0.88 ? -0.1 : 0), x, y, 0.1);
    };
    if (alongU) box(c, o, 0, 0, 16, hw, 0, 2, { top: bedShade, left: flat(bed, 'left'), right: flat(bed, 'right') });
    else box(c, o, 0, 0, hw, 16, 0, 2, { top: bedShade, left: flat(bed, 'left'), right: flat(bed, 'right') });
    // side rails
    if (alongU) { box(c, o, 0, -hw - 1.5, 16, 1.5, 0, 4, plainBox(rail)); box(c, o, 0, hw + 1.5, 16, 1.5, 0, 4, plainBox(rail)); }
    else { box(c, o, -hw - 1.5, 0, 1.5, 16, 0, 4, plainBox(rail)); box(c, o, hw + 1.5, 0, 1.5, 16, 0, 4, plainBox(rail)); }
    out.push(c);
  }
  return out;
}

export function depot(): SpriteDef {
  return make(84, 2, (c, o, f) => {
    box(c, o, 0, 0, 13, 13, 0, 12, woodBox(21, 3));
    // iron bands
    box(c, o, 0, 0, 13.5, 13.5, 3, 1.5, plainBox(P.iron));
    box(c, o, 0, 0, 13.5, 13.5, 9, 1.5, plainBox(P.iron));
    // funnel/hopper on top
    const [tx, ty] = iso(o, 0, 0, 12);
    c.poly([[tx - 22, ty - 6], [tx, ty - 17], [tx + 22, ty - 6], [tx, ty + 5]], (x, y) => shadeRamp(P.copper, 0.55 + (x < tx ? 0.18 : -0.05), x, y, 0.3));
    c.poly([[tx - 12, ty - 4], [tx, ty - 10], [tx + 12, ty - 4], [tx, ty + 2]], P.darkwood[0]);
    if (f) c.rect(tx - 2, ty - 6, 4, 2, P.gold[3]);
    // little brass plaque
    const [px, py] = iso(o, -6, 13, 7);
    c.rect(px - 2, py - 1, 4, 2, P.brass[3]);
  }, { fps: 1 });
}

export function dispatcher(): SpriteDef {
  return make(80, 4, (c, o, f) => {
    box(c, o, 0, 0, 12, 12, 0, 10, stoneBox(2, 3, P.stone));
    cylinder(c, o, 0, 0, 7, 10, 6, P.copper);
    const [tx, ty] = iso(o, 0, 0, 16);
    c.ellipse(tx, ty, 9, 4.5, P.darkwood[0]);
    // outlet chute toward +u (rotated by sprite flipping in renderer)
    box(c, o, 12, 0, 4, 3, 3, 4, plainBox(P.brass));
    // indicator gear
    gearLeft(c, tx, ty - 8, 3, f * 2, P.brass);
  }, { fps: 6, lamp: [0, 0] });
}

export function splitter(sorter: boolean): SpriteDef {
  return make(64, 4, (c, o, f) => {
    box(c, o, 0, 0, 12, 12, 0, 6, sorter ? ironBox(P.iron) : woodBox(31, 3));
    const [tx, ty] = iso(o, 0, 0, 6);
    // three arrows (left, front, right), front arrow +u
    const arrow = (u: number, v: number, on: boolean) => {
      const [x, y] = iso(o, u, v, 6);
      c.rect(x - 1, y - 1, 3, 2, on ? P.gold[4] : P.brass[1]);
    };
    arrow(8, 0, f === 1 || sorter);
    arrow(0, -8, !sorter && f === 0);
    arrow(0, 8, f === 2);
    if (sorter) {
      c.ellipse(tx, ty - 3, 4, 3, (x, y, d) => shadeRamp(P.glass, 0.9 - d * 0.5, x, y, 0.2));
    } else gearLeft(c, tx, ty - 2, 3, f * 2, P.brass);
  }, { fps: 6 });
}

export function storage(kind: 'crate' | 'silo' | 'warehouse'): SpriteDef {
  if (kind === 'crate') {
    return make(72, 1, (c, o) => {
      box(c, o, -3, -3, 10, 10, 0, 14, woodBox(41, 3));
      box(c, o, 7, 7, 6, 6, 0, 9, woodBox(43, 2));
      box(c, o, -3, -3, 6, 6, 14, 8, woodBox(45, 2));
      // cross braces on big crate
      const [a, b] = [iso(o, -13, 7, 14), iso(o, 7, 7, 0)];
      c.line(a[0], a[1], b[0], b[1], P.wood[1]);
    }, { fps: 1 });
  }
  if (kind === 'silo') {
    return make(128, 1, (c, o) => {
      plinth(c, o, 3);
      cylinder(c, o, 0, 0, 12, 3, 46, P.brick);
      for (const z of [12, 26, 40]) {
        const [cx, cy] = iso(o, 0, 0, z);
        for (let x = -17; x <= 17; x++) { const t = x / 17; c.set(cx + x, Math.round(cy + 8.5 * Math.sqrt(Math.max(0, 1 - t * t))), P.iron[x < 0 ? 4 : 2]); }
      }
      // conical copper roof
      const [rx, ry] = iso(o, 0, 0, 49);
      for (let y = 0; y < 16; y++) {
        const w = Math.round(18 * (y / 16));
        for (let x = -w; x <= w; x++) c.set(rx + x, ry - 16 + y, shadeRamp(P.copper, 0.75 - x / 40 - (y % 4 === 0 ? 0.15 : 0), x, y, 0.3));
      }
      c.ellipse(rx, ry, 18, 8, (x, y, d) => (d > 0.75 ? shadeRamp(P.copper, 0.4, x, y, 0) : 0));
    }, { fps: 1 });
  }
  return make(104, 2, (c, o, f) => {
    box(c, o, 0, 0, 14, 14, 0, 24, stoneBox(4, 3, P.stone));
    box(c, o, 0, 0, 15, 15, 24, 3, plainBox(P.flag));
    // arched door with aether glow
    const [dx, dy] = iso(o, -2, 14, 2);
    for (let y = -14; y <= 0; y++) for (let x = -4; x <= 4; x++) {
      if (y < -10 && x * x + (y + 10) * (y + 10) > 18) continue;
      c.set(dx + x, dy + y + Math.round(x / 2), shadeRamp(P.aether, 0.4 + (f ? 0.15 : 0) + (y + 14) / 40, x, y, 0.4));
    }
    // aether veins on the stone
    for (let i = 0; i < 18; i++) { const [vx, vy] = iso(o, 14, -12 + i * 1.4, 4 + ((i * 7) % 18)); c.set(vx, vy, P.aether[4]); }
  }, { fps: 1, lights: [[-2, -8, 0x8fe3d2, 16]] });
}

export function windmill(): SpriteDef {
  const h = 150;
  const n = 8;
  return make(h, n, (c, o, f) => {
    plinth(c, o, 3);
    // tapering timber tower
    for (let k = 0; k < 10; k++) {
      const r = 11 - k * 0.6;
      box(c, o, 0, 0, r, r, 3 + k * 5, 5, woodBox(51 + k, 2));
    }
    // cap
    const [cx, cy] = iso(o, 0, 0, 53);
    c.poly([[cx - 10, cy + 2], [cx, cy - 10], [cx + 10, cy + 2], [cx, cy + 6]], (x, y) => shadeRamp(P.brick, 0.6 + (x < cx ? 0.15 : -0.1), x, y, 0.3));
    // sails in the left plane (facing down-left)
    const [hx, hy] = iso(o, -4, 6, 50);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + (f / n) * (Math.PI / 2);
      const dx = Math.cos(a), dy = Math.sin(a);
      // skew to the left plane: direction (dx, dy) in plane maps to screen (dx*0.9, dy + dx*0.45)
      const sx = (t: number, w: number) => hx + dx * t * 0.9 - dy * w * 0.9;
      const sy = (t: number, w: number) => hy + (dy + dx * 0.45) * t + (dx - dy * 0.45) * w;
      for (let t = 3; t < 30; t++) {
        for (let w = 0; w < 6; w++) {
          const x = Math.round(sx(t, w)), y = Math.round(sy(t, w));
          const lat = (t % 5 === 0) || w === 0;
          c.set(x, y, lat ? P.wood[2] : shadeRamp(P.cream, 0.8 - w * 0.06 - (k % 2) * 0.1, x, y, 0.2));
        }
      }
      c.line(hx, hy, Math.round(sx(30, 0)), Math.round(sy(30, 0)), P.wood[1]);
    }
    c.rect(hx - 1, hy - 1, 3, 3, P.iron[4]);
  }, { fps: 10 }, 1, 16);
}

export function engine(): SpriteDef {
  return make(104, 4, (c, o, f) => {
    plinth(c, o, 3, P.iron);
    box(c, o, 0, 0, 13, 13, 3, 10, ironBox());
    cylinder(c, o, 0, 0, 10, 13, 14, P.copper);
    // turbine window glowing aether, spinning blades
    const [cx, cy] = iso(o, 0, 0, 20);
    c.ellipse(cx - 6, cy + 3, 6, 6, (x, y, d) => shadeRamp(P.aether, 0.95 - d * 0.5, x, y, 0.3));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + (f / 4) * (Math.PI / 2);
      c.line(cx - 6, cy + 3, cx - 6 + Math.cos(a) * 5, cy + 3 + Math.sin(a) * 5, P.iron[1]);
    }
    // exhaust stacks
    box(c, o, 8, -8, 2, 2, 27, 10, plainBox(P.iron));
    box(c, o, -8, -8, 2, 2, 27, 7, plainBox(P.iron));
  }, { fps: 10, lamp: [0, 0], lights: [[-6, -14, 0x8fe3d2, 24]], smoke: [10, -52] });
}

export function pylon(): SpriteDef {
  return make(120, 6, (c, o, f) => {
    plinth(c, o, 3, P.flag);
    // tapered obelisk
    for (let k = 0; k < 6; k++) box(c, o, 0, 0, 7 - k, 7 - k, 3 + k * 6, 6, stoneBox(1, 2, P.flag));
    const bob = Math.round(Math.sin((f / 6) * Math.PI * 2) * 2);
    const [cx, cy] = iso(o, 0, 0, 48 + bob);
    c.poly([[cx, cy - 10], [cx + 5, cy - 1], [cx, cy + 6], [cx - 5, cy - 1]], (x, y) => shadeRamp(P.aether, 0.9 - (x - cx + 5) / 12, x, y, 0.2));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + f; c.px(cx + Math.cos(a) * 8, cy + Math.sin(a) * 3, rgb(0xd8fff2, 200)); }
  }, { fps: 6, lights: [[0, -48, 0x8fe3d2, 30]] });
}

export function beacon(): SpriteDef {
  return make(130, 6, (c, o, f) => {
    plinth(c, o, 4, P.stone);
    box(c, o, 0, 0, 8, 8, 4, 30, stoneBox(5, 2, P.stone));
    box(c, o, 0, 0, 10, 10, 34, 3, plainBox(P.brass));
    // floating lodestone with a magnetic ring
    const bob = Math.round(Math.sin((f / 6) * Math.PI * 2) * 2);
    const [cx, cy] = iso(o, 0, 0, 52 + bob);
    c.ellipse(cx, cy, 7, 7, (x, y, d) => shadeRamp(P.iron, 0.85 - d * 0.4 - (x - cx) / 20, x, y, 0.3));
    c.set(cx - 2, cy - 3, P.aether[5]);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + (f / 6) * Math.PI;
      c.set(Math.round(cx + Math.cos(a) * 13), Math.round(cy + Math.sin(a) * 5), Math.sin(a) > 0 ? P.aether[4] : P.aether[2]);
    }
  }, { fps: 6, lights: [[0, -52, 0x8fe3d2, 28]] });
}

export function roost(): SpriteDef {
  return make(128, 4, (c, o, f) => {
    plinth(c, o, 3, P.flag);
    box(c, o, 0, 0, 6, 6, 3, 34, stoneBox(5, 2, P.flag));
    // perches
    for (const [u, v, z] of [[-10, 4, 24], [6, -10, 30], [8, 8, 18]]) {
      const [a, b] = [iso(o, 0, 0, z), iso(o, u, v, z)];
      c.line(a[0], a[1], b[0], b[1], P.wood[2]);
      c.set(b[0], b[1] - 1, P.aether[f % 2 ? 4 : 5]);
    }
    // lantern nest on top
    const [nx, ny] = iso(o, 0, 0, 37);
    c.ellipse(nx, ny, 10, 5, (x, y) => shadeRamp(thatchRamp, 0.5 + hash2(x, y) * 0.3, x, y, 0.3));
    c.ellipse(nx, ny - 5, 5, 5, (x, y, d) => shadeRamp(P.aether, 0.95 - d * 0.4 + (f % 2) * 0.05, x, y, 0.3));
  }, { fps: 4, lamp: [0, 0], lights: [[0, -42, 0x8fe3d2, 26]] });
}

const thatchRamp = [rgb(0x6a4a24), rgb(0x8f6a32), rgb(0xb88d44), rgb(0xd9b15e), rgb(0xf0d488)];

/** The Aetherforge: 3×3, one look per construction stage (0..3) plus awake animation. */
export function forge(): SpriteDef {
  const H = 260;
  const [ax, ay] = anchorOf(3, H);
  const variants: Record<string, PixelCanvas[]> = {};
  for (let stage = 0; stage <= 3; stage++) {
    const n = stage === 3 ? 8 : 1;
    variants['st' + stage] = frames(n, (f) => {
      const { c, o } = canvasFor(3, H);
      // footprint u,v ∈ [-48, 48]
      // stage 0: survey stakes and a stone ring
      box(c, o, 0, 0, 44, 44, 0, 4, stoneBox(1, 8, P.flag));
      if (stage === 0) {
        for (const [u, v] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) post(c, o, u, v, 4, 10, P.wood, 1.2);
        const [cx, cy] = iso(o, 0, 0, 4);
        c.ellipse(cx, cy, 34, 17, (_x, _y, d) => (d > 0.85 ? P.aether[3] : 0));
      }
      if (stage >= 1) {
        // stepped foundation
        box(c, o, 0, 0, 40, 40, 4, 10, stoneBox(2, 8, P.stone));
        box(c, o, 0, 0, 32, 32, 14, 8, stoneBox(2, 6, P.flag));
      }
      if (stage >= 2) {
        // iron frame arches
        for (const [u, v] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) box(c, o, u, v, 4, 4, 22, 60, ironBox());
        box(c, o, 0, -26, 30, 3, 82, 5, ironBox(P.brass));
        box(c, o, -26, 0, 3, 30, 82, 5, ironBox(P.brass));
        box(c, o, 0, 26, 30, 3, 82, 5, ironBox(P.brass));
        box(c, o, 26, 0, 3, 30, 82, 5, ironBox(P.brass));
        // glass walls (lower)
        const glass = { top: glassShade('top'), left: glassShade('left'), right: glassShade('right') };
        box(c, o, 0, 0, 20, 20, 22, 18, glass);
      }
      if (stage >= 3) {
        // the heart: a great floating crystal with sunmetal rings
        const t = (f / 8) * Math.PI * 2;
        const bob = Math.round(Math.sin(t) * 3);
        const [cx, cy] = iso(o, 0, 0, 120 + bob);
        c.poly([[cx, cy - 34], [cx + 18, cy - 4], [cx, cy + 26], [cx - 18, cy - 4]], (x, y) => {
          const l = 0.95 - (x - cx + 18) / 46 + (y < cy - 4 ? 0.08 : -0.08);
          return shadeRamp(P.aether, l + (bayer(x, y) > 0.85 ? 0.1 : 0), x, y, 0.2);
        });
        c.line(cx, cy - 34, cx, cy + 26, P.aether[5]);
        c.line(cx - 18, cy - 4, cx + 18, cy - 4, P.aether[4]);
        for (let k = 0; k < 40; k++) {
          const a = (k / 40) * Math.PI * 2 + t * 0.5;
          const x = Math.round(cx + Math.cos(a) * 34), y = Math.round(cy + Math.sin(a) * 11);
          c.set(x, y, Math.sin(a) > 0 ? P.gold[4] : P.gold[2]);
          const a2 = (k / 40) * Math.PI * 2 - t * 0.7;
          c.set(Math.round(cx + Math.cos(a2) * 26), Math.round(cy - 6 + Math.sin(a2) * 8), Math.sin(a2) > 0 ? P.gold[3] : P.gold[1]);
        }
        // sunmetal crown on the frame
        for (const [u, v] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) {
          const [x, y] = iso(o, u, v, 88);
          c.ellipse(x, y - 3, 4, 4, (xx, yy, d) => shadeRamp(P.gold, 0.9 - d * 0.4, xx, yy, 0.2));
        }
      }
      c.outline(0.5, true);
      return c;
    });
  }
  return { frames: variants.st0, ax, ay, fps: 6, variants, lights: [[0, -120, 0x8fe3d2, 60]] };
}

export { face, LIGHT, noisy, mix };
