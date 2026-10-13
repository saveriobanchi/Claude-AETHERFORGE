import { Application, Container, Graphics, Sprite, Texture, TextureSource } from 'pixi.js';
import { BUILDINGS } from '../core/content/buildings';
import { ITEM_IDS, type ItemId } from '../core/content/items';
import { RECIPES } from '../core/content/recipes';
import { ISLETS, SUMMON_TIME } from '../core/content/world';
import { currentRecipe } from '../core/sim';
import { type Building, type GameState, type SimEvent, DX, DY, dayFraction, key, stackTotal } from '../core/state';
import { iconFor } from './art/icons';
import { beltFrames } from './art/machines';
import { P } from './art/palette';
import { PixelCanvas, bayer, rgb } from './art/pixel';
import { SPRITE_TYPES, spriteFor } from './art/registry';
import type { SpriteDef } from './art/sprite';
import { CHUNK, chunkOrigin, renderChunk, tileCenter } from './art/terrain';
import { Atlas } from './atlas';
import { Camera } from './camera';
import { Effects, glowTexture } from './effects';
import { Sky } from './sky';

export interface Ghost {
  type: string; // building type or 'land:<id>' or 'remove'
  cells: { x: number; y: number; dir: number; ok: boolean }[];
}

export interface ViewOptions {
  selected: number | null;
  ghost: Ghost | null;
  grid: boolean;
  landSpots: [number, number][];
  observe: boolean;
  reduced: boolean;
  bubbles: boolean;
  range: { x: number; y: number; r: number; size: number } | null;
}

interface SpriteTex {
  def: SpriteDef;
  frames: Texture[];
  variants: Record<string, Texture[]>;
  top: number; // pixels from anchor to the top of the art
}

interface BView {
  id: number;
  type: string;
  root: Container;
  sprite: Sprite;
  mote: Sprite | null;
  bubble: Container | null;
  bubbleIcon: Sprite | null;
  lights: Sprite[];
  lightOff: [number, number][];
  shadow: Sprite | null;
  arrow: Sprite | null;
  phase: number;
  problem: number;
  bounce: number;
  lastCycles: number;
  x: number;
  y: number;
  dir: number;
  hold: Sprite | null;
}

const STATUS_COLOR: Record<string, number> = {
  working: 0x9cf07a, noinput: 0xffc24a, blocked: 0xff6a52, nopower: 0x8adcff, ready: 0x9cf07a, idle: 0x6a7480, night: 0x8a90c8,
};

export class WorldView {
  app = new Application();
  atlas = new Atlas();
  cam = new Camera();
  sky!: Sky;
  fx!: Effects;
  world = new Container();
  private terrain = new Container();
  private shadows = new Container();
  private floor = new Container();
  private items = new Container();
  private objects = new Container();
  private lights = new Container();
  private overlay = new Container();
  private grid = new Graphics();
  private ghostLayer = new Container();
  private chunks = new Map<string, Sprite>();
  private tileRev = -1;
  private floorSnapshot = new Map<number, string>();
  private views = new Map<number, BView>();
  private spr = new Map<string, SpriteTex>();
  private belt: Texture[][] = [];
  private express: Texture[][] = [];
  private icons = new Map<ItemId, Texture>();
  private itemPool: Sprite[] = [];
  private itemUsed = 0;
  private wispSprites: Sprite[] = [];
  private ghostPool: Sprite[] = [];
  private glow!: Texture;
  private moteTex!: Texture;
  private bubbleTex!: Texture;
  private bubbleWarnTex!: Texture;
  private arrowTex: Texture[] = [];
  private shadowTex!: Texture;
  private breezeTex!: Texture;
  private isletArrival: Sprite | null = null;
  private time = 0;
  private shakeT = 0;
  bloom = false;
  vw = 0;
  vh = 0;
  night = 0;
  frameMs = 16;

  async init(host: HTMLElement): Promise<void> {
    TextureSource.defaultOptions.scaleMode = 'nearest';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      resizeTo: host,
      background: 0x1f5f6e,
      antialias: false,
      resolution: dpr,
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.ticker.stop(); // the game loop drives rendering

    this.glow = glowTexture();
    this.sky = new Sky(this.atlas);
    this.fx = new Effects(this.atlas);
    this.buildTextures();
    this.atlas.flush();

    this.objects.sortableChildren = true;
    this.lights.blendMode = 'add';
    this.world.addChild(this.terrain, this.shadows, this.floor, this.items, this.grid, this.objects, this.fx.layer, this.lights, this.ghostLayer, this.overlay);
    this.app.stage.addChild(this.sky.back, this.world, this.sky.front);
  }

  private buildTextures(): void {
    const a = this.atlas;
    for (const type of SPRITE_TYPES) {
      const def = spriteFor(type);
      const frames = def.frames.map((f) => a.add(f));
      const variants: Record<string, Texture[]> = {};
      if (def.variants) for (const k in def.variants) variants[k] = def.variants[k].map((f) => a.add(f));
      // find top of the art for motes and bubbles
      const f0 = def.frames[0];
      let top = f0.h;
      for (let y = 0; y < f0.h && top === f0.h; y++) for (let x = 0; x < f0.w; x++) if (f0.alpha(x, y) > 0) { top = y; break; }
      this.spr.set(type, { def, frames, variants, top: def.ay - top });
    }
    for (let d = 0; d < 4; d++) {
      this.belt.push(beltFrames(d, false).map((f) => a.add(f)));
      this.express.push(beltFrames(d, true).map((f) => a.add(f)));
    }
    for (const id of ITEM_IDS) this.icons.set(id, a.add(iconFor(id)));
    const mote = new PixelCanvas(3, 3);
    mote.set(1, 0, rgb(0xffffff)); mote.set(0, 1, rgb(0xffffff)); mote.set(1, 1, rgb(0xffffff)); mote.set(2, 1, rgb(0xffffff)); mote.set(1, 2, rgb(0xffffff));
    this.moteTex = a.add(mote);
    const bubble = (border: number) => {
      const b = new PixelCanvas(22, 24);
      b.poly([[2, 0], [20, 0], [22, 2], [22, 18], [20, 20], [13, 20], [11, 23], [9, 20], [2, 20], [0, 18], [0, 2]], rgb(0x161c22, 235));
      for (let x = 2; x < 20; x++) { b.set(x, 0, rgb(border)); b.set(x, 19, rgb(border, 160)); }
      for (let y = 2; y < 18; y++) { b.set(0, y, rgb(border, 160)); b.set(21, y, rgb(border, 160)); }
      return a.add(b);
    };
    this.bubbleTex = bubble(0xd8c8a0);
    this.bubbleWarnTex = bubble(0xff8a6a);
    for (let d = 0; d < 4; d++) {
      const c = new PixelCanvas(64, 32);
      // small brass chevron on the ground near the output edge
      const ex = [16, -16, -16, 16][d], ey = [8, 8, -8, -8][d];
      const cx = 32 + ex * 0.72, cy = 16 + ey * 0.72;
      for (let k = 0; k < 3; k++) {
        const px = Math.round(cx - ex * 0.08 * k), py = Math.round(cy - ey * 0.08 * k);
        c.set(px, py, k === 0 ? P.gold[4] : P.brass[2]);
        c.set(px + (d === 0 || d === 3 ? -1 : 1), py, P.brass[1]);
      }
      this.arrowTex.push(a.add(c));
    }
    const sh = new PixelCanvas(48, 24);
    sh.ellipse(24, 12, 23, 11.5, (x, y, dd) => (bayer(x, y) > dd * 1.2 - 0.2 ? rgb(0x0a1418, 70) : 0));
    this.shadowTex = a.add(sh);
    const br = new PixelCanvas(16, 16);
    for (let i = 0; i < 3; i++) { for (let x = 2; x < 13 - i * 2; x++) br.set(x, 4 + i * 4 + Math.round(Math.sin(x * 0.7 + i) * 1), P.lampBlue); }
    this.breezeTex = a.add(br);
  }

  // ───────────────────────── coordinates ─────────────────────────

  screenToWorld(sx: number, sy: number): [number, number] {
    return [this.cam.x + (sx - this.vw / 2) / this.cam.zoom, this.cam.y + (sy - this.vh / 2) / this.cam.zoom];
  }

  screenToTile(sx: number, sy: number): [number, number] {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const fx = wx / 64 + wy / 32, fy = wy / 32 - wx / 64;
    return [Math.floor(fx + 0.5), Math.floor(fy + 0.5)];
  }

  tileToScreen(x: number, y: number): [number, number] {
    const [wx, wy] = tileCenter(x, y);
    return [(wx - this.cam.x) * this.cam.zoom + this.vw / 2, (wy - this.cam.y) * this.cam.zoom + this.vh / 2];
  }

  iconTexture(item: ItemId): Texture {
    return this.icons.get(item)!;
  }

  // ───────────────────────── terrain ─────────────────────────

  private syncTerrain(s: GameState): void {
    if (s.tileRev === this.tileRev) return;
    this.tileRev = s.tileRev;
    const dirty = new Set<string>();
    const mark = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dirty.add(`${Math.floor((x + dx) / CHUNK)},${Math.floor((y + dy) / CHUNK)}`);
    };
    const seen = new Set<number>();
    for (const [k, t] of s.tiles) {
      seen.add(k);
      const sig = t.floor;
      if (this.floorSnapshot.get(k) !== sig) { this.floorSnapshot.set(k, sig); mark(t.x, t.y); }
    }
    for (const k of [...this.floorSnapshot.keys()]) if (!seen.has(k)) { this.floorSnapshot.delete(k); const x = Math.floor(k / 4096) - 2048, y = (k % 4096) - 2048; mark(x, y); }
    // undersides depend on land several tiles behind: widen dirty region diagonally
    for (const d of [...dirty]) {
      const [cx, cy] = d.split(',').map(Number);
      dirty.add(`${cx + 1},${cy + 1}`);
    }
    const get = (x: number, y: number) => s.tiles.get(key(x, y));
    for (const d of dirty) {
      const [cx, cy] = d.split(',').map(Number);
      const pc = renderChunk(get, cx, cy, this.bloom);
      const old = this.chunks.get(d);
      if (old) { old.texture.destroy(true); old.destroy(); this.chunks.delete(d); }
      if (!pc) continue;
      const tex = Texture.from(pc.toCanvas());
      tex.source.scaleMode = 'nearest';
      const sp = new Sprite(tex);
      const [ox, oy] = chunkOrigin(cx, cy);
      sp.position.set(ox, oy);
      sp.zIndex = cx + cy;
      this.chunks.set(d, sp);
      this.terrain.addChild(sp);
    }
    this.terrain.sortChildren();
    // camera bounds follow the island
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of s.tiles.values()) {
      const [wx, wy] = tileCenter(t.x, t.y);
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
    }
    this.cam.setBounds(x0, y0, x1, y1 + 80);
    this.islandBottom = y1 + 60;
  }

  islandBottom = 0;

  setQuality(q: 'high' | 'low'): void {
    const res = q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    if (this.app.renderer && this.app.renderer.resolution !== res) {
      this.app.renderer.resolution = res;
      this.app.renderer.resize(this.app.screen.width, this.app.screen.height, res);
    }
    this.sky.lite = q === 'low';
    this.fx.max = q === 'low' ? 120 : 500;
  }

  forceTerrain(): void {
    this.tileRev = -1;
    this.floorSnapshot.clear();
  }

  // ───────────────────────── buildings ─────────────────────────

  private makeView(b: Building): BView {
    const def = BUILDINGS[b.type];
    const root = new Container();
    const isBelt = def.kind === 'belt';
    const st = isBelt ? null : this.spr.get(b.type)!;
    const sprite = new Sprite(isBelt ? this.belt[b.dir][0] : st!.frames[0]);
    if (isBelt) sprite.anchor.set(0.5, 24 / 40);
    else sprite.anchor.set(st!.def.ax / sprite.texture.width, st!.def.ay / sprite.texture.height);
    root.addChild(sprite);
    const v: BView = {
      id: b.id, type: b.type, root, sprite, mote: null, bubble: null, bubbleIcon: null, lights: [], lightOff: [], shadow: null, arrow: null,
      phase: Math.random() * 10, problem: 0, bounce: 0, lastCycles: b.cycles, x: NaN, y: NaN, dir: -1, hold: null,
    };
    if (isBelt) {
      this.floor.addChild(root);
    } else {
      this.objects.addChild(root);
      if (st!.def.lamp || ['crafter', 'generator', 'harvester', 'drill', 'dispatcher', 'engine', 'roost', 'windmill'].includes(def.kind)) {
        v.mote = new Sprite(this.moteTex);
        v.mote.anchor.set(0.5);
        root.addChild(v.mote);
        v.mote.y = -st!.top - 5;
      }
      if (def.kind !== 'tuft' && def.kind !== 'sapling' && def.kind !== 'node') {
        v.shadow = new Sprite(this.shadowTex);
        v.shadow.anchor.set(0.5);
        v.shadow.scale.set(def.size * (def.kind === 'tree' ? 0.7 : 1));
        this.shadows.addChild(v.shadow);
      }
      if (def.rotatable && def.kind !== 'belt') {
        v.arrow = new Sprite(this.arrowTex[b.dir]);
        v.arrow.anchor.set(0.5);
        this.floor.addChild(v.arrow);
      }
      for (const l of st!.def.lights ?? []) {
        const g = new Sprite(this.glow);
        g.anchor.set(0.5);
        g.tint = l[2];
        g.scale.set((l[3] * 2) / 64);
        g.alpha = 0;
        v.lightOff.push([l[0], l[1]]);
        this.lights.addChild(g);
        v.lights.push(g);
      }
      if (def.kind === 'splitter' || def.kind === 'sorter') {
        v.hold = new Sprite(this.icons.get('wood')!);
        v.hold.anchor.set(0.5, 1);
        v.hold.visible = false;
        v.hold.y = -6;
        root.addChild(v.hold);
      }
    }
    return v;
  }

  private destroyView(v: BView): void {
    v.root.destroy({ children: true });
    v.shadow?.destroy();
    v.arrow?.destroy();
    for (const l of v.lights) l.destroy();
  }

  /** A short squash-and-stretch on a building (placement, harvest, delivery). */
  pulse(id: number, amount = 1): void {
    const v = this.views.get(id);
    if (v) v.bounce = Math.max(v.bounce, amount);
  }

  shake(t = 0.25): void {
    this.shakeT = Math.max(this.shakeT, t);
  }

  // ───────────────────────── events → effects ─────────────────────────

  handleEvents(s: GameState, events: SimEvent[], reduced: boolean): void {
    for (const e of events) {
      switch (e.type) {
        case 'cycle': {
          const b = s.buildings.get(e.id);
          const v = this.views.get(e.id);
          if (!b || !v || !v.root.visible) break;
          v.bounce = Math.max(v.bounce, 0.35);
          const [wx, wy] = this.centerOf(b);
          const kind = BUILDINGS[b.type].kind;
          if (b.type === 'kiln' || b.type === 'furnace' || b.type === 'crucible') this.fx.emit('spark', wx, wy - 10, 3, { up: 30, spread: 6, g: 40, life: 0.6 });
          else if (b.type === 'star_net') this.fx.emit('star', wx, wy - 30, 2, { up: 8, spread: 12, life: 1 });
          else if (kind === 'harvester') this.fx.emit('leaf', wx, wy - 20, 3, { up: 20, spread: 14, g: 30, life: 1.2 });
          else if (b.type === 'drill') this.fx.emit('dust', wx, wy, 3, { up: 14, spread: 10, g: 20, life: 0.8 });
          else if (b.type === 'resonator' || b.type === 'distiller' || b.type === 'condenser') this.fx.emit('mote', wx, wy - 26, 3, { up: 16, spread: 10, life: 1 });
          break;
        }
        case 'harvest': {
          const [wx, wy] = tileCenter(e.x, e.y);
          this.fx.emit('leaf', wx, wy - 40, reduced ? 3 : 8, { up: 30, spread: 26, g: 50, life: 1.4, drag: 0.4 });
          break;
        }
        case 'grown': {
          const [wx, wy] = tileCenter(e.x, e.y);
          this.fx.emit('pop', wx, wy - 20, 6, { up: 20, spread: 20, life: 0.8 });
          break;
        }
        case 'islet_docked': {
          if (!e.name) break;
          const [wx, wy] = tileCenter(e.x, e.y);
          this.fx.emit('dust', wx, wy, 30, { up: 30, spread: 60, g: 30, life: 1.4 });
          this.fx.emit('mote', wx, wy - 10, 20, { up: 30, spread: 60, life: 2 });
          this.shake(0.5);
          break;
        }
        case 'forge_stage':
        case 'resonance': {
          const f = s.buildings.get(s.forge.id);
          if (!f) break;
          const [wx, wy] = this.centerOf(f);
          this.fx.emit('gold', wx, wy - 80, 30, { up: 50, spread: 80, life: 2 });
          this.fx.emit('mote', wx, wy - 60, 30, { up: 40, spread: 90, life: 2.4 });
          this.shake(0.4);
          break;
        }
        case 'spill': {
          const b = s.buildings.get(e.id);
          if (!b || Math.random() > 0.3) break;
          const [wx, wy] = this.centerOf(b);
          this.fx.emit('dust', wx, wy - 14, 2, { up: 20, spread: 8, g: 60, life: 0.6 });
          break;
        }
        case 'deliver': {
          const v = this.views.get(e.id);
          if (v) v.bounce = Math.max(v.bounce, 0.25);
          break;
        }
        default:
          break;
      }
    }
  }

  centerOf(b: Building): [number, number] {
    const size = BUILDINGS[b.type].size;
    const [wx, wy] = tileCenter(b.x, b.y);
    return [wx + (size - 1) * 0, wy + (size - 1) * 16];
  }

  burst(kind: Parameters<Effects['emit']>[0], x: number, y: number, n: number, up = 30): void {
    const [wx, wy] = tileCenter(x, y);
    this.fx.emit(kind, wx, wy - 4, n, { up, spread: 28, g: 40, life: 1 });
  }

  // ───────────────────────── frame ─────────────────────────

  render(s: GameState, alpha: number, dt: number, o: ViewOptions): void {
    const t0 = performance.now();
    this.time += dt;
    this.vw = this.app.screen.width;
    this.vh = this.app.screen.height;
    this.syncTerrain(s);
    this.cam.update(dt);

    let shx = 0, shy = 0;
    if (this.shakeT > 0 && !o.reduced) {
      this.shakeT -= dt;
      shx = (Math.random() - 0.5) * 3;
      shy = (Math.random() - 0.5) * 3;
    }
    const z = this.cam.zoom;
    this.world.scale.set(z);
    this.world.position.set(Math.round(this.vw / 2 - this.cam.x * z + shx), Math.round(this.vh / 2 - this.cam.y * z + shy));

    const sky = this.sky.update(dayFraction(s), this.time, this.cam.x * z, this.cam.y * z, this.vw, this.vh, o.reduced, !o.observe || true, (this.islandBottom - this.cam.y) * z + this.vh / 2);
    this.night = sky.night;
    for (const layer of [this.terrain, this.shadows, this.floor, this.items, this.objects, this.fx.layer]) layer.tint = sky.tint;

    // visible world rect
    const margin = 140;
    const vx0 = this.cam.x - this.vw / 2 / z - margin, vx1 = this.cam.x + this.vw / 2 / z + margin;
    const vy0 = this.cam.y - this.vh / 2 / z - margin, vy1 = this.cam.y + this.vh / 2 / z + margin * 2;
    for (const c of this.chunks.values()) {
      c.visible = c.x < vx1 && c.x + c.width > vx0 && c.y < vy1 && c.y + c.height > vy0;
    }

    // sync building views
    for (const [id, v] of this.views) {
      const b = s.buildings.get(id);
      if (!b || b.type !== v.type && !(v.type === 'sapling' && b.type === 'tree')) { this.destroyView(v); this.views.delete(id); }
      else if (v.type === 'sapling' && b.type === 'tree') { this.destroyView(v); this.views.delete(id); }
    }
    this.itemUsed = 0;
    const animT = o.reduced ? 0 : this.time;
    for (const b of s.buildings.values()) {
      let v = this.views.get(b.id);
      if (!v) { v = this.makeView(b); this.views.set(b.id, v); v.bounce = 0.6; }
      const def = BUILDINGS[b.type];
      const [wx, wy] = tileCenter(b.x, b.y);
      const cy = wy + (def.size - 1) * 16;
      const visible = wx > vx0 && wx < vx1 && cy > vy0 && cy < vy1;
      v.root.visible = visible;
      if (v.shadow) v.shadow.visible = visible;
      if (v.arrow) v.arrow.visible = visible && !o.observe;
      for (const l of v.lights) l.visible = visible && this.night > 0.03;
      if (!visible) continue;
      if (v.x !== b.x || v.y !== b.y || v.dir !== b.dir) {
        v.x = b.x; v.y = b.y; v.dir = b.dir;
        v.root.position.set(wx, cy);
        v.root.zIndex = (b.x + b.y + (def.size - 1)) * 512 + b.x + 256;
        if (v.shadow) v.shadow.position.set(wx, cy + 1);
        if (v.arrow) { v.arrow.texture = this.arrowTex[b.dir]; v.arrow.position.set(wx, cy); }
      }
      this.updateView(s, b, v, def.kind, animT, dt, o);
    }

    this.renderWisps(s, alpha);
    this.renderOverlay(s, o);
    this.renderIsletArrival(s, dt);
    // hide unused item sprites
    for (let i = this.itemUsed; i < this.itemPool.length; i++) this.itemPool[i].visible = false;

    // ambient life
    if (!o.reduced && Math.random() < dt * (this.night > 0.5 ? 2 : 0.6)) {
      const [wx, wy] = this.screenToWorld(Math.random() * this.vw, Math.random() * this.vh);
      this.fx.emit(this.night > 0.5 ? 'mote' : 'leaf', wx, wy, 1, { vx: 8, up: 2, spread: 4, life: 3, drag: 0.9, g: 3 });
    }
    this.fx.update(dt);
    this.app.renderer.render(this.app.stage);
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  private updateView(s: GameState, b: Building, v: BView, kind: string, t: number, dt: number, o: ViewOptions): void {
    const def = BUILDINGS[b.type];
    // squash & stretch
    if (v.bounce > 0) {
      v.bounce = Math.max(0, v.bounce - dt * 3.2);
      const k = Math.sin(v.bounce * Math.PI) * 0.08 * (o.reduced ? 0.3 : 1);
      v.sprite.scale.set(1 + k, 1 - k);
    } else if (v.sprite.scale.x !== 1) v.sprite.scale.set(1, 1);

    if (kind === 'belt') {
      const set = b.type === 'express' ? this.express : this.belt;
      const spd = def.speed ?? 1.25;
      v.sprite.texture = set[b.dir][Math.floor(t * spd * 4) % 4];
      this.renderBeltItems(b, v, s);
      return;
    }
    const st = this.spr.get(b.type)!;
    let frames = st.frames;
    if (kind === 'tree') {
      if (b.type === 'tree') frames = st.variants['s' + Math.max(0, Math.min(5, Math.floor(b.stock)))] ?? frames;
    } else if (kind === 'sapling') {
      const stage = Math.min(2, Math.floor((b.progress / 45) * 3));
      frames = st.variants['g' + stage] ?? frames;
    } else if (kind === 'forge') {
      frames = st.variants['st' + Math.max(0, Math.min(3, s.forge.stage))] ?? frames;
    }
    const animated = b.status === 'working' || ['tree', 'tuft', 'node', 'pylon', 'beacon', 'sapling', 'forge', 'elder'].includes(kind) || b.type === 'elder_tree';
    const fi = animated && frames.length > 1 ? Math.floor((t + v.phase) * st.def.fps) % frames.length : 0;
    if (v.sprite.texture !== frames[fi]) v.sprite.texture = frames[fi];

    // status mote
    const status = b.status;
    if (v.mote) {
      const col = STATUS_COLOR[status] ?? 0x6a7480;
      v.mote.tint = col;
      const blink = status === 'noinput' || status === 'blocked' || status === 'nopower';
      v.mote.alpha = status === 'idle' || status === 'night' ? 0.35 : blink ? 0.55 + 0.45 * Math.sin(t * 6) : 0.75 + 0.25 * Math.sin(t * 2 + v.phase);
      v.mote.visible = !o.observe;
      v.mote.y = -st.top - 6 + (o.reduced ? 0 : Math.round(Math.sin(t * 2 + v.phase)));
    }
    // problem bubbles after a short grace period
    const problem = status === 'noinput' || status === 'blocked' || status === 'nopower' || status === 'ready';
    v.problem = problem ? v.problem + dt : 0;
    const show = o.bubbles && !o.observe && problem && v.problem > (status === 'ready' ? 1.5 : 3) && (kind === 'crafter' || kind === 'harvester' || kind === 'generator' || kind === 'drill' || kind === 'engine');
    if (show) {
      if (!v.bubble) {
        v.bubble = new Container();
        const bg = new Sprite(this.bubbleTex);
        bg.anchor.set(0.5, 1);
        v.bubbleIcon = new Sprite(this.icons.get('wood')!);
        v.bubbleIcon.anchor.set(0.5);
        v.bubbleIcon.y = -14;
        v.bubble.addChild(bg, v.bubbleIcon);
        v.root.addChild(v.bubble);
      }
      const bg = v.bubble.children[0] as Sprite;
      bg.texture = status === 'blocked' ? this.bubbleWarnTex : this.bubbleTex;
      v.bubbleIcon!.texture = this.problemIcon(b, status);
      v.bubble.y = -st.top - 9 + (o.reduced ? 0 : Math.round(Math.sin(t * 2.4 + v.phase) * 1.5));
      v.bubble.visible = true;
      v.bubble.alpha = Math.min(1, v.bubble.alpha + dt * 4);
    } else if (v.bubble) {
      v.bubble.alpha -= dt * 4;
      if (v.bubble.alpha <= 0) v.bubble.visible = false;
    }
    // lights
    if (v.lights.length) {
      const on = status === 'working' || kind === 'node' || kind === 'pylon' || kind === 'beacon' || kind === 'tree' || b.type === 'warehouse' || kind === 'forge';
      const flick = 0.85 + 0.15 * Math.sin(t * 7 + v.phase);
      for (let li = 0; li < v.lights.length; li++) {
        const l = v.lights[li];
        const off = v.lightOff[li];
        l.position.set(v.root.x + off[0], v.root.y + off[1]);
        const target = this.night * (on ? 0.8 * flick : 0.18);
        l.alpha += (target - l.alpha) * Math.min(1, dt * 4);
      }
    }
    // smoke and steam while working
    if (st.def.smoke && status === 'working' && !o.reduced && Math.random() < dt * 3) {
      const [sx, sy] = st.def.smoke;
      this.fx.emit(b.type === 'composter' ? 'steam' : 'smoke', v.root.x + sx, v.root.y + sy, 1, { vx: 4, up: 14, spread: 2, life: 2.4, drag: 0.7, grow: 1.2 });
    }
    // splitter/sorter held item
    if (v.hold) {
      v.hold.visible = !!b.hold;
      if (b.hold) v.hold.texture = this.icons.get(b.hold)!;
    }
  }

  private problemIcon(b: Building, status: string): Texture {
    if (status === 'nopower') return this.breezeTex;
    const r = currentRecipe(b);
    if (status === 'noinput') {
      if (r) {
        for (const k in r.inputs) if ((b.inBuf[k as ItemId] ?? 0) < (r.inputs[k as ItemId] ?? 0)) return this.icons.get(k as ItemId)!;
        if (r.fuel) return this.icons.get('charcoal')!;
      }
      if (BUILDINGS[b.type].kind === 'harvester') return this.icons.get('sapling')!;
      if (BUILDINGS[b.type].kind === 'engine') return this.icons.get('aether')!;
      return this.icons.get('loam')!;
    }
    // blocked / ready: show the waiting output
    let best: ItemId | null = null;
    for (const k in b.outBuf) if (!best || (b.outBuf[k as ItemId] ?? 0) > (b.outBuf[best] ?? 0)) best = k as ItemId;
    if (best) return this.icons.get(best)!;
    const out = r ? (Object.keys(r.outputs)[0] as ItemId) : 'wood';
    return this.icons.get(out)!;
  }

  private itemSprite(): Sprite {
    let sp = this.itemPool[this.itemUsed];
    if (!sp) {
      sp = new Sprite(this.icons.get('wood')!);
      sp.anchor.set(0.5, 0.8);
      this.items.addChild(sp);
      this.itemPool.push(sp);
    }
    this.itemUsed++;
    sp.visible = true;
    return sp;
  }

  private renderBeltItems(b: Building, v: BView, _s: GameState): void {
    if (!b.items.length) return;
    const ex = [32, -32, -32, 32][b.dir], ey = [16, 16, -16, -16][b.dir];
    const alpha = this.lastAlpha;
    for (const it of b.items) {
      const p = it.prev + (it.pos - it.prev) * alpha;
      const sp = this.itemSprite();
      sp.texture = this.icons.get(it.item)!;
      sp.position.set(Math.round(v.root.x + (p - 0.5) * ex), Math.round(v.root.y + (p - 0.5) * ey - 2));
    }
  }

  lastAlpha = 1;

  private renderWisps(s: GameState, alpha: number): void {
    while (this.wispSprites.length < s.wisps.length) {
      const sp = new Sprite(this.moteTex);
      sp.anchor.set(0.5);
      sp.scale.set(1.4);
      sp.tint = 0xd8fff2;
      this.fx.layer.addChild(sp);
      this.wispSprites.push(sp);
    }
    s.wisps.forEach((w, i) => {
      const sp = this.wispSprites[i];
      const x = w.px + (w.x - w.px) * alpha, y = w.py + (w.y - w.py) * alpha;
      const [wx, wy] = tileCenter(x, y);
      const lift = w.phase === 'rest' ? 26 : 34 + Math.sin(this.time * 5 + i) * 3;
      sp.visible = true;
      sp.position.set(Math.round(wx + Math.sin(this.time * 2 + i * 1.7) * (w.phase === 'rest' ? 8 : 2)), Math.round(wy - lift));
      if (w.phase !== 'rest' && Math.random() < 0.3) this.fx.emit('mote', sp.x, sp.y, 1, { spread: 1, life: 0.6, drag: 0.2 });
    });
    for (let i = s.wisps.length; i < this.wispSprites.length; i++) this.wispSprites[i].visible = false;
  }

  private ghostSprite(i: number): Sprite {
    let g = this.ghostPool[i];
    if (!g) {
      g = new Sprite();
      this.ghostLayer.addChild(g);
      this.ghostPool.push(g);
    }
    g.visible = true;
    return g;
  }

  private renderOverlay(s: GameState, o: ViewOptions): void {
    const g = this.grid;
    g.clear();
    let gi = 0;
    const diamond = (x: number, y: number, color: number, alpha: number, fill = 0) => {
      const [cx, cy] = tileCenter(x, y);
      const pts = [cx, cy - 16, cx + 32, cy, cx, cy + 16, cx - 32, cy];
      if (fill) g.poly(pts).fill({ color, alpha: fill });
      g.poly(pts).stroke({ width: 1 / this.cam.zoom * 1.5, color, alpha });
    };
    if (o.grid) {
      // faint grid around the camera centre only
      const [cx, cy] = this.screenToTile(this.vw / 2, this.vh / 2);
      for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 9; x <= cx + 9; x++) {
        if (!s.tiles.has(key(x, y))) continue;
        const d = Math.hypot(x - cx, y - cy);
        diamond(x, y, 0xf6e9c6, Math.max(0, 0.22 - d * 0.02));
      }
    }
    for (const [x, y] of o.landSpots) diamond(x, y, 0xf6e9c6, 0.55, 0.08);
    if (o.range) {
      const r = o.range;
      for (let y = r.y - r.r; y <= r.y + r.r + r.size - 1; y++) for (let x = r.x - r.r; x <= r.x + r.r + r.size - 1; x++) diamond(x, y, 0x8fe3d2, 0.35, 0.07);
    }
    if (o.selected !== null) {
      const b = s.buildings.get(o.selected);
      if (b) {
        const size = BUILDINGS[b.type].size;
        const pulse = 0.55 + 0.35 * Math.sin(this.time * 5);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) diamond(b.x + x, b.y + y, 0xffe08a, pulse, 0.1);
      }
    }
    if (o.ghost) {
      const gh = o.ghost;
      for (const c of gh.cells) {
        const color = c.ok ? 0x9cf07a : 0xff6a52;
        if (gh.type.startsWith('land:') || gh.type === 'remove') {
          diamond(c.x, c.y, color, 0.9, 0.25);
          continue;
        }
        const def = BUILDINGS[gh.type];
        for (let y = 0; y < def.size; y++) for (let x = 0; x < def.size; x++) diamond(c.x + x, c.y + y, color, 0.8, 0.12);
        const sp = this.ghostSprite(gi++);
        const [wx, wy] = tileCenter(c.x, c.y);
        if (def.kind === 'belt') {
          sp.texture = (gh.type === 'express' ? this.express : this.belt)[c.dir][0];
          sp.anchor.set(0.5, 24 / 40);
        } else {
          const st = this.spr.get(gh.type)!;
          sp.texture = st.frames[0];
          sp.anchor.set(st.def.ax / sp.texture.width, st.def.ay / sp.texture.height);
        }
        sp.position.set(wx, wy + (def.size - 1) * 16);
        sp.alpha = 0.7;
        sp.tint = c.ok ? 0xe8ffe0 : 0xff9a8a;
      }
    }
    for (let i = gi; i < this.ghostPool.length; i++) this.ghostPool[i].visible = false;
  }

  private renderIsletArrival(s: GameState, _dt: number): void {
    const sm = s.islets.summon;
    if (!sm) { if (this.isletArrival) this.isletArrival.visible = false; return; }
    if (!this.isletArrival) {
      const st = this.spr.get('tree')!;
      void st;
      const c = new PixelCanvas(48, 54);
      c.ellipse(24, 12, 22, 7, (_x, y) => (y < 12 ? P.grass[4] : P.grass[3]));
      for (let y = 12; y < 54; y++) { const half = 22 * (1 - (y - 12) / 42); for (let x = Math.round(24 - half); x <= 24 + half; x++) c.set(x, y, P.rock[2 + ((x + y) % 7 === 0 ? 1 : 0)]); }
      c.outline(0.5);
      const tex = Texture.from(c.toCanvas());
      tex.source.scaleMode = 'nearest';
      this.isletArrival = new Sprite(tex);
      this.isletArrival.anchor.set(0.5, 0.25);
      this.overlay.addChild(this.isletArrival);
    }
    const beacon = s.buildings.get(sm.beacon);
    const [bx, by] = beacon ? tileCenter(beacon.x, beacon.y) : [0, 0];
    const p = 1 - sm.t / SUMMON_TIME; // 0 → 1
    const e = p * p * (3 - 2 * p);
    const fromX = bx + 900, fromY = by - 260;
    this.isletArrival.visible = true;
    this.isletArrival.position.set(fromX + (bx + 60 - fromX) * e, fromY + (by - fromY) * e + Math.sin(this.time) * 4);
    this.isletArrival.scale.set(0.4 + e * 0.9);
    this.isletArrival.alpha = 0.4 + e * 0.6;
    this.isletArrival.tint = this.night > 0.5 ? 0x8090c4 : 0xffffff;
    void ISLETS;
  }

  setAlpha(a: number): void {
    this.lastAlpha = a;
  }

  /** For dev overlays. */
  stats(): { sprites: number; items: number; particles: number; chunks: number } {
    return { sprites: this.views.size, items: this.itemUsed, particles: this.fx.count, chunks: this.chunks.size };
  }

  recipeName(id: string): string {
    return RECIPES[id]?.name ?? id;
  }

  hasOutputs(b: Building): boolean {
    return stackTotal(b.outBuf) > 0;
  }

  dirVec(d: number): [number, number] {
    return [DX[d], DY[d]];
  }
}
