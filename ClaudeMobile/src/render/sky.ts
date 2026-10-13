import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { P } from './art/palette';
import { PixelCanvas, hash2, mix, noise2, rgb, shadeRamp, bayer } from './art/pixel';
import type { Atlas } from './atlas';

// Time-of-day keyframes: [fraction, skyTop, skyHorizon, worldTint, night(0..1)]
const KEYS: [number, number, number, number, number][] = [
  [0.0, 0x1c2c4c, 0xd8a07c, 0xe8c8b8, 0.5],
  [0.07, 0x23566a, 0xf0d6b0, 0xfff0e0, 0.05],
  [0.18, 0x1d5866, 0xcfe4d4, 0xffffff, 0],
  [0.5, 0x1f5f6e, 0xd6e8d6, 0xffffff, 0],
  [0.6, 0x26506a, 0xf2c48c, 0xfff0d8, 0],
  [0.67, 0x22304e, 0xd07a62, 0xe8b8a8, 0.35],
  [0.73, 0x0e1730, 0x2c3c66, 0x8a96c8, 0.9],
  [0.9, 0x0b1228, 0x26365e, 0x8090c4, 1],
  [0.97, 0x162240, 0x6a5a80, 0xb0a8c8, 0.75],
  [1.0, 0x1c2c4c, 0xd8a07c, 0xe8c8b8, 0.5],
];

function lerpHex(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bb = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bb);
}

export interface SkyState { top: number; horizon: number; tint: number; night: number }

export function skyAt(dayFrac: number): SkyState {
  const f = ((dayFrac % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (f >= a[0] && f <= b[0]) {
      const t = (f - a[0]) / (b[0] - a[0]);
      const s = t * t * (3 - 2 * t);
      return { top: lerpHex(a[1], b[1], s), horizon: lerpHex(a[2], b[2], s), tint: lerpHex(a[3], b[3], s), night: a[4] + (b[4] - a[4]) * s };
    }
  }
  return { top: KEYS[0][1], horizon: KEYS[0][2], tint: KEYS[0][3], night: KEYS[0][4] };
}

function cloudCanvas(w: number, h: number, seed: number, haze: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const puffs: [number, number, number][] = [];
  const n = 4 + Math.floor(w / 26);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = (h * 0.32) * (0.55 + Math.sin(t * Math.PI) * 0.6) * (0.8 + hash2(i, seed) * 0.4);
    puffs.push([w * 0.1 + t * w * 0.8 + (hash2(i, seed, 2) - 0.5) * 10, h - r - 3 - hash2(i, seed, 3) * h * 0.15, r]);
  }
  const ramp = P.cloud;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let inside = 0, top = 1;
    for (const [px, py, r] of puffs) {
      const dx = (x + 0.5 - px) / r, dy = (y + 0.5 - py) / (r * 0.82);
      const d = dx * dx + dy * dy;
      if (d < 1) { inside = 1; top = Math.min(top, (y - (py - r * 0.82)) / (r * 1.64)); }
    }
    if (!inside) continue;
    const flatBottom = y > h - 4;
    let l = 0.95 - top * 0.75 + (noise2(x / 6, y / 4, seed) - 0.5) * 0.18;
    if (flatBottom) l -= 0.25;
    const col = mix(shadeRamp(ramp, l, x, y, 0.55), rgb(0x3f7f84), haze);
    c.set(x, y, col);
  }
  return c;
}

function isletCanvas(w: number, seed: number, haze: number): PixelCanvas {
  const h = Math.round(w * 1.1);
  const c = new PixelCanvas(w, h);
  const topY = Math.round(h * 0.22);
  const sky = rgb(0x3a7680);
  // top surface
  c.ellipse(w / 2, topY, w * 0.48, w * 0.12, (x, y) => mix(shadeRamp(P.grass, 0.6 + (x < w / 2 ? 0.1 : -0.1), x, y, 0.3), sky, haze));
  // tapering rock
  for (let y = topY; y < h; y++) {
    const t = (y - topY) / (h - topY);
    const half = w * 0.47 * (1 - t) * (1 - t * 0.2) + (noise2(y / 3, seed) - 0.5) * 5 * (1 - t);
    for (let x = Math.round(w / 2 - half); x <= w / 2 + half; x++) {
      const l = 0.55 - (x - w / 2) / (w * 1.2) - t * 0.3;
      c.set(x, y, mix(shadeRamp(P.rock, l, x, y, 0.4), sky, haze + t * 0.2));
    }
  }
  // tiny trees
  for (let i = 0; i < 3; i++) {
    const tx = Math.round(w * (0.3 + hash2(i, seed) * 0.4)), ty = topY - 1;
    const th = 4 + Math.round(hash2(i, seed, 2) * w * 0.12);
    c.ellipse(tx, ty - th, th * 0.6, th * 0.7, (x, y) => mix(shadeRamp(P.leaf, 0.6 - (x - tx) / 10, x, y, 0.3), sky, haze));
  }
  return c;
}

function starCanvas(): PixelCanvas {
  const c = new PixelCanvas(256, 160);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash2(i, 1, 99) * 256), y = Math.floor(hash2(i, 2, 99) * 160);
    const b = hash2(i, 3, 99);
    c.set(x, y, b > 0.85 ? rgb(0xfff6d8) : b > 0.5 ? rgb(0xc8d4f0, 220) : rgb(0x8ea0d0, 160));
    if (b > 0.94) { c.set(x + 1, y, rgb(0xfff6d8, 120)); c.set(x - 1, y, rgb(0xfff6d8, 120)); c.set(x, y + 1, rgb(0xfff6d8, 120)); c.set(x, y - 1, rgb(0xfff6d8, 120)); }
  }
  return c;
}

function discCanvas(r: number, ramp: number[], glow: number): PixelCanvas {
  const s = Math.ceil(r * 2 + glow * 2 + 2);
  const c = new PixelCanvas(s, s);
  const cx = s / 2, cy = s / 2;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r) c.set(x, y, rgb(ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor((1 - d / r) * ramp.length * 0.999 + (bayer(x, y) - 0.5) * 0.6)))]));
    else if (d < r + glow) {
      const a = (1 - (d - r) / glow) * 90;
      if (bayer(x, y) * 90 < a) c.set(x, y, rgb(ramp[ramp.length - 1], Math.round(a)));
    }
  }
  return c;
}

interface Drifter { s: Sprite; px: number; py: number; speed: number; par: number; w: number; bob: number }

/**
 * Background: gradient sky, sun/moon, stars, distant islets and parallax
 * cloud layers; plus a foreground cloud sea that passes below the island.
 */
export class Sky {
  readonly back = new Container();
  readonly front = new Container();
  private grad: HTMLCanvasElement;
  private gradTex: Texture;
  private gradSprite: Sprite;
  private stars: TilingSprite;
  private sun: Sprite;
  private moon: Sprite;
  private far: Drifter[] = [];
  private near: Drifter[] = [];
  private lastGrad = '';
  readonly pixel = 3;
  /** Light quality: skip every other cloud to cut overdraw. */
  lite = false;

  constructor(atlas: Atlas) {
    this.grad = document.createElement('canvas');
    this.grad.width = 1;
    this.grad.height = 128;
    this.gradTex = Texture.from(this.grad);
    this.gradSprite = new Sprite(this.gradTex);
    this.back.addChild(this.gradSprite);

    const starTex = Texture.from(starCanvas().toCanvas());
    starTex.source.scaleMode = 'nearest';
    this.stars = new TilingSprite({ texture: starTex, width: 100, height: 100 });
    this.back.addChild(this.stars);

    this.sun = new Sprite(atlas.add(discCanvas(9, [0xf4b860, 0xffd890, 0xfff2c8], 10)));
    this.moon = new Sprite(atlas.add(discCanvas(7, [0x9aa6c8, 0xc8d0e8, 0xeef0f8], 8)));
    for (const s of [this.sun, this.moon]) { s.anchor.set(0.5); s.scale.set(this.pixel); this.back.addChild(s); }

    // distant islets (very slow parallax, hazy)
    for (let i = 0; i < 6; i++) {
      const w = 22 + Math.floor(hash2(i, 5) * 40);
      const tex = atlas.add(isletCanvas(w, i * 13 + 1, 0.45 + hash2(i, 6) * 0.25));
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.3);
      s.scale.set(this.pixel * (0.6 + hash2(i, 7) * 0.5));
      this.back.addChild(s);
      this.far.push({ s, px: hash2(i, 8) * 1.4 - 0.2, py: 0.22 + hash2(i, 9) * 0.38, speed: 0.002 + hash2(i, 10) * 0.003, par: 0.03 + hash2(i, 11) * 0.04, w, bob: hash2(i, 12) * 6 });
    }
    // background clouds: three depths
    for (let i = 0; i < 14; i++) {
      const depth = i % 3;
      const w = 70 + Math.floor(hash2(i, 21) * 120) + depth * 30;
      const tex = atlas.add(cloudCanvas(w, Math.round(w * 0.38), i * 7 + 3, 0.5 - depth * 0.18));
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      s.scale.set(this.pixel);
      s.alpha = 0.75 + depth * 0.08;
      this.back.addChild(s);
      this.far.push({ s, px: hash2(i, 22) * 1.6 - 0.3, py: 0.35 + depth * 0.18 + hash2(i, 23) * 0.15, speed: 0.004 + depth * 0.004, par: 0.06 + depth * 0.06, w, bob: 0 });
    }
    // cloud sea far below the island, and a few thin wisps drifting in front
    for (let i = 0; i < 7; i++) {
      const w = 160 + Math.floor(hash2(i, 31) * 160);
      const front = false;
      const tex = atlas.add(cloudCanvas(w, Math.round(w * 0.32), i * 11 + 50, front ? 0 : 0.12));
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      s.scale.set(this.pixel);
      s.alpha = front ? 0.32 : 0.95;
      (front ? this.front : this.back).addChild(s);
      this.near.push({ s, px: hash2(i, 32) * 1.6 - 0.3, py: front ? 0.2 + hash2(i, 33) * 0.4 : hash2(i, 33) * 0.5, speed: 0.006 + hash2(i, 34) * 0.006, par: front ? 0.9 : 0.35, w, bob: 0 });
    }
  }

  /** dayFrac in [0,1); t seconds; cam in world px; viewport in CSS px. */
  update(dayFrac: number, t: number, camX: number, camY: number, vw: number, vh: number, reduced: boolean, showFront: boolean, seaY: number): SkyState {
    const st = skyAt(dayFrac);
    const key = `${st.top},${st.horizon}`;
    if (key !== this.lastGrad) {
      this.lastGrad = key;
      const ctx = this.grad.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
      g.addColorStop(0, hex(st.top));
      g.addColorStop(0.62, hex(lerpHex(st.top, st.horizon, 0.55)));
      g.addColorStop(1, hex(st.horizon));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1, 128);
      this.gradTex.source.update();
    }
    this.gradSprite.width = vw;
    this.gradSprite.height = vh;

    this.stars.width = vw;
    this.stars.height = vh * 0.75;
    this.stars.tileScale.set(this.pixel);
    this.stars.alpha = Math.max(0, st.night - 0.2) * 1.2 * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3));
    this.stars.tilePosition.set(-camX * 0.01, -camY * 0.01);
    this.stars.visible = this.stars.alpha > 0.01;

    // sun arcs during the day, moon at night
    const arc = (f: number) => [vw * (0.12 + f * 0.76), vh * (0.5 - Math.sin(f * Math.PI) * 0.38)];
    const df = ((dayFrac % 1) + 1) % 1;
    const sunF = df / 0.7;
    this.sun.visible = sunF >= 0 && sunF <= 1;
    if (this.sun.visible) { const [x, y] = arc(sunF); this.sun.position.set(x, y); this.sun.alpha = Math.min(1, Math.sin(sunF * Math.PI) * 3); }
    const moonF = (df - 0.66 + (df < 0.3 ? 1 : 0)) / 0.36;
    this.moon.visible = moonF >= 0 && moonF <= 1;
    if (this.moon.visible) { const [x, y] = arc(moonF); this.moon.position.set(x, y); this.moon.alpha = Math.min(1, Math.sin(moonF * Math.PI) * 3); }

    const place = (d: Drifter, layerTint: number) => {
      const span = vw + d.w * this.pixel * 2;
      let x = (d.px * vw + (reduced ? 0 : t * d.speed * vw) - camX * d.par * 0.6) % span;
      if (x < 0) x += span;
      d.s.x = x - d.w * this.pixel;
      d.s.y = d.py * vh - camY * d.par * 0.4 + (d.bob ? Math.sin(t * 0.2 + d.bob) * d.bob : 0);
      d.s.tint = layerTint;
    };
    this.far.forEach((d, i) => { d.s.visible = !this.lite || i % 2 === 0 || i < 6; if (d.s.visible) place(d, st.tint); });
    for (const d of this.near) {
      place(d, st.tint);
      d.s.y = seaY + d.py * vh * 0.35 + (d.par > 0.5 ? -vh * 0.15 : 40);
    }
    this.front.visible = showFront;
    return st;
  }
}
