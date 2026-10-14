import { Application, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture, TextureSource } from 'pixi.js';
import { BUILDINGS, TREE } from '../core/content/buildings';
import { BIOMES } from '../core/content/biomes';
import { ITEM_IDS, type ItemId } from '../core/content/items';
import { RECIPES } from '../core/content/recipes';
import { ISLETS, SUMMON_TIME } from '../core/content/world';
import { currentRecipe, weatherNow } from '../core/sim';
import { type Building, type GameState, type SimEvent, DX, DY, dayFraction, key, stackTotal } from '../core/state';
import { P } from './art/palette';
import { PixelCanvas, rgb } from './art/pixel';
import { tileCenter } from './art/terrain';
import { type ArtImage, type ArtSprite, art } from './artpack';
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
  def: ArtSprite;
  top: number; // world px from anchor to the top of the art
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
  private falls = new Container();
  private fallFrames: ArtImage[] = [];
  private floor = new Container();
  private items = new Container();
  private objects = new Container();
  private lights = new Container();
  private overlay = new Container();
  private grid = new Graphics();
  private ghostLayer = new Container();
  private tileSprites: Sprite[] = [];
  private decorSprites: Sprite[] = [];
  private decorSig = '';
  private tileRev = -1;
  private views = new Map<number, BView>();
  private spr = new Map<string, SpriteTex>();
  private belt: ArtImage[][] = [];
  private express: ArtImage[][] = [];
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
  private breezeTex!: Texture;
  private isletArrival: Sprite | null = null;
  private ship: Sprite | null = null;
  private state: GameState | null = null;
  private shipFrames: ArtImage[] = [];
  private time = 0;
  private shakeT = 0;
  bloom = false;
  vw = 0;
  vh = 0;
  night = 0;
  frameMs = 16;
  updateMs = 0;
  private fillLevel = 0;
  private fillTick = -1;

  async init(host: HTMLElement): Promise<void> {
    TextureSource.defaultOptions.scaleMode = 'nearest';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await this.app.init({
      resizeTo: host,
      background: 0x6a5a90,
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
    this.sky = new Sky();
    this.fx = new Effects(this.atlas);
    this.buildTextures();
    this.atlas.flush();

    this.objects.sortableChildren = true;
    this.lights.blendMode = 'add';
    this.world.addChild(this.terrain, this.falls, this.shadows, this.floor, this.items, this.grid, this.objects, this.fx.layer, this.lights, this.ghostLayer, this.overlay);
    this.worldView.roundPixels = false;
    this.app.stage.addChild(this.sky.back, this.worldView, this.sky.front);
  }

  private buildTextures(): void {
    const a = this.atlas;
    for (const [type, def] of art.sprites) this.spr.set(type, { def, top: def.frames[0].ay / art.R });
    for (let d = 0; d < 4; d++) {
      this.belt.push([0, 1, 2, 3].map((i) => art.img(`belt:p:${d}:${i}`)));
      this.express.push([0, 1, 2, 3].map((i) => art.img(`belt:x:${d}:${i}`)));
    }
    for (const id of ITEM_IDS) this.icons.set(id, art.img(`iconw:${id}`).tex);
    this.fallFrames = Array.from({ length: 6 }, (_, i) => art.img(`fall:${i}`));
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

  /**
   * The front-most building whose art covers a screen point (tall art such
   * as tree crowns reaches over the tiles behind it). Bounding boxes only.
   */
  pickAt(sx: number, sy: number): number | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    let best: number | null = null, bz = -Infinity;
    for (const v of this.views.values()) {
      if (!v.root.visible || v.type === 'belt' || v.root.zIndex <= bz) continue;
      const sp = v.sprite, f = sp.texture.frame;
      const x0 = v.root.x + sp.x - sp.anchor.x * f.width * sp.scale.x, y0 = v.root.y + sp.y - sp.anchor.y * f.height * sp.scale.y;
      if (wx >= x0 && wx < x0 + f.width * sp.scale.x && wy >= y0 && wy < y0 + f.height * sp.scale.y) { best = v.id; bz = v.root.zIndex; }
    }
    return best;
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
    for (const sp of this.tileSprites) sp.destroy();
    this.tileSprites = [];
    const has = (x: number, y: number) => s.tiles.has(key(x, y));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // painter's order: back to front; each tile draws its rock column, then its top
    const tiles = [...s.tiles.values()].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    for (const t of tiles) {
      const [wx, wy] = tileCenter(t.x, t.y);
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
      const dist = gapDist(has, t.x, t.y);
      const want = Math.max(1, Math.min(7, 1 + dist * 1.6 + (hashTile(t.x, t.y) - 0.5) * 1.4));
      const depth = art.depths.reduce((p, d) => (Math.abs(d - want) < Math.abs(p - want) ? d : p), art.depths[0]);
      const v = Math.floor(hashTile(t.y * 3 + 1, t.x * 7) * art.colVariants);
      const mask = (has(t.x + 1, t.y) ? 0 : 1) | (has(t.x, t.y + 1) ? 0 : 2) | (has(t.x - 1, t.y) ? 0 : 4) | (has(t.x, t.y - 1) ? 0 : 8);
      const tv = Math.floor(hashTile(t.x * 5 + 2, t.y * 11) * art.topVariants);
      const kind = t.floor === 'grass' && t.biome ? t.biome : t.floor;
      for (const k of [`col:${depth}:${v}`, `top:${kind}:${mask}:${tv}`]) {
        const sp = new Sprite();
        setArt(sp, art.img(k));
        sp.scale.set(1 / art.R);
        sp.position.set(wx, wy);
        this.terrain.addChild(sp);
        this.tileSprites.push(sp);
      }
    }
    this.cam.setBounds(x0, y0, x1, y1 + 80);
    this.islandBottom = y1 + 200;
    this.syncFalls(s);
    this.decorSig = '';
  }

  /** Bushes, flowers, tufts and stones scattered on free grass (stable per tile). */
  private syncDecor(s: GameState): void {
    const sig = `${s.tileRev}|${s.buildings.size}|${[...s.buildings.values()].reduce((h, b) => (h * 31 + b.x * 7 + b.y) | 0, 0)}`;
    if (sig === this.decorSig) return;
    this.decorSig = sig;
    for (const sp of this.decorSprites) sp.destroy();
    this.decorSprites = [];
    const busy = new Set<number>();
    for (const b of s.buildings.values()) {
      const size = BUILDINGS[b.type].size;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) busy.add(key(b.x + x, b.y + y));
    }
    // keep a clear ring around buildings so machines read cleanly
    const near = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (busy.has(key(x + dx, y + dy))) return true; return false; };
    const kinds = art.decorKinds;
    for (const t of s.tiles.values()) {
      if (t.floor !== 'grass' || near(t.x, t.y)) continue;
      // at most one piece per tile, sparse, and grouped in small patches of one kind
      if (hashTile(t.x * 5 + 31, t.y * 3 - 17) > 0.22) continue;
      const patch = hashTile(Math.floor(t.x / 3) * 7 + 3, Math.floor(t.y / 3) * 11 + 5);
      const set = art.decorSets[t.biome ?? 'grass'] ?? art.decorSets.grass ?? kinds;
      const kind = set[patch < 0.5 ? 0 : patch < 0.78 ? 1 : patch < 0.92 ? 2 : 3] ?? set[0];
      if (!kinds.includes(kind)) continue;
      const v = Math.floor(hashTile(Math.floor(t.x / 3), Math.floor(t.y / 3) + 9) * art.decorVariants);
      const ox = hashTile(t.x * 13, t.y * 7) - 0.5, oy = hashTile(t.x * 3, t.y * 17) - 0.5;
      const fx = t.x + ox * 0.4, fy = t.y + oy * 0.4;
      const sp = new Sprite();
      setArt(sp, art.img(`decor:${kind}:${v}`));
      sp.scale.set(1 / art.R);
      const [wx, wy] = tileCenter(fx, fy);
      sp.position.set(wx, wy);
      sp.zIndex = (fx + fy) * 512 + fx + 256;
      this.objects.addChild(sp);
      this.decorSprites.push(sp);
    }
  }

  islandBottom = 0;

  /**
   * Waterfalls spill from a few grass edges whose drop is clear of other land
   * on screen. Sites are picked by a stable hash so they stay put as you build.
   */
  private syncFalls(s: GameState): void {
    for (const c of this.falls.removeChildren()) c.destroy();
    const sites: [number, number, number][] = [];
    const centres = [...s.tiles.values()].map((t) => tileCenter(t.x, t.y));
    for (const t of s.tiles.values()) {
      if (t.floor !== 'grass' || t.biome === 'dunes' || t.biome === 'frost') continue;
      const [cx, cy] = tileCenter(t.x, t.y);
      for (const side of [0, 1]) {
        const open = side === 0 ? !s.tiles.has(key(t.x, t.y + 1)) : !s.tiles.has(key(t.x + 1, t.y));
        if (!open) continue;
        const h = hashTile(t.x * 3 + side, t.y);
        if (h > 0.3) continue;
        const fx = cx + (side === 0 ? -16 : 16), fy = cy + 8;
        if (centres.some(([x, y]) => Math.abs(x - fx) < 30 && y > fy + 4)) continue;
        sites.push([fx, fy, h]);
      }
    }
    sites.sort((a, b) => a[2] - b[2]);
    const picked: [number, number, number][] = [];
    for (const site of sites) if (picked.length < 3 && picked.every(([x, y]) => Math.hypot(x - site[0], y - site[1]) > 120)) picked.push(site);
    for (const [fx, fy] of picked) {
      const sp = new Sprite();
      setArt(sp, this.fallFrames[0]);
      sp.scale.set(1 / art.R);
      sp.position.set(fx, fy - 2);
      this.falls.addChild(sp);
    }
  }

  private rt: RenderTexture | null = null;
  private readonly worldView = new Sprite();
  private rtW = 0;
  private rtH = 0;

  /** Grow-only offscreen target; the view samples just the used corner. */
  private ensureRT(w: number, h: number): void {
    if (!this.rt || w > this.rt.width || h > this.rt.height) {
      const old = this.rt;
      this.rt = RenderTexture.create({ width: Math.ceil(Math.max(w, this.rt?.width ?? 0) / 64) * 64, height: Math.ceil(Math.max(h, this.rt?.height ?? 0) / 64) * 64, resolution: 1, scaleMode: 'linear', antialias: false });
      this.rtW = this.rtH = 0;
      old?.destroy(true);
    }
    if (w !== this.rtW || h !== this.rtH) {
      this.rtW = w; this.rtH = h;
      this.worldView.texture = new Texture({ source: this.rt.source, frame: new Rectangle(0, 0, w, h) });
    }
  }

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
  }

  // ───────────────────────── buildings ─────────────────────────

  private makeView(b: Building): BView {
    const def = BUILDINGS[b.type];
    const root = new Container();
    const isBelt = def.kind === 'belt';
    const st = isBelt ? null : this.spr.get(this.artKey(b))!;
    const sprite = new Sprite();
    setArt(sprite, isBelt ? this.belt[b.dir][0] : st!.def.frames[0]);
    sprite.scale.set(1 / art.R);
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
        v.hold.scale.set(1 / art.R);
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
        case 'lucky': {
          const b = s.buildings.get(e.id);
          const v = this.views.get(e.id);
          if (!b || !v || !v.root.visible) break;
          v.bounce = Math.max(v.bounce, 0.7);
          const [wx, wy] = this.centerOf(b);
          this.fx.emit('gold', wx, wy - 30, reduced ? 4 : 12, { up: 40, spread: 22, life: 1.2 });
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
    this.state = s;
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
    // The world is drawn crisp at a whole number of device pixels per art
    // pixel into an offscreen texture, then that image is scaled smoothly to
    // the exact zoom. Pixels stay even-sized and pans/zooms glide sub-pixel.
    const res = this.app.renderer.resolution;
    // whole device pixels per art pixel (art is baked at art.R texels per world px)
    const zr = z * res;
    const k = zr >= 1.5 ? art.R * Math.max(1, Math.round(zr / art.R)) : Math.max(1, Math.round(zr));
    const rw = Math.ceil(this.vw * k / z) + 4, rh = Math.ceil(this.vh * k / z) + 4;
    this.ensureRT(rw, rh);
    const px = rw / 2 - (this.cam.x - shx / z) * k, py = rh / 2 - (this.cam.y - shy / z) * k;
    const rx = Math.round(px), ry = Math.round(py);
    this.world.scale.set(k);
    this.world.position.set(rx, ry);
    this.worldView.scale.set(z / k);
    this.worldView.position.set(this.vw / 2 - (this.cam.x - shx / z) * z - rx * z / k, this.vh / 2 - (this.cam.y - shy / z) * z - ry * z / k);

    this.sky.weather = weatherNow(s).id;
    const sky = this.sky.update(dayFraction(s), this.time, this.cam.x * z, this.cam.y * z, this.vw, this.vh, o.reduced, !o.observe || true, (this.islandBottom - this.cam.y) * z + this.vh / 2);
    this.night = sky.night;
    for (const layer of [this.terrain, this.shadows, this.floor, this.items, this.objects, this.fx.layer]) layer.tint = sky.tint;

    // visible world rect
    const margin = 140;
    const vx0 = this.cam.x - this.vw / 2 / z - margin, vx1 = this.cam.x + this.vw / 2 / z + margin;
    const vy0 = this.cam.y - this.vh / 2 / z - margin, vy1 = this.cam.y + this.vh / 2 / z + margin * 2;
    for (const c of this.tileSprites) c.visible = c.x > vx0 - 120 && c.x < vx1 + 120 && c.y > vy0 - 40 && c.y < vy1 + 260;
    this.syncDecor(s);

    // how full the stash is drives storage visuals (0 empty-ish, 1 half, 2 nearly full)
    if (Math.floor(this.time * 2) !== this.fillTick) {
      this.fillTick = Math.floor(this.time * 2);
      let mx = 0;
      const cap = s.cache.capacity || 1;
      for (const id of ITEM_IDS) mx = Math.max(mx, s.stash[id] / cap);
      this.fillLevel = mx > 0.85 ? 2 : mx > 0.35 ? 1 : 0;
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
      if (v.arrow) v.arrow.visible = visible && !o.observe;
      for (const l of v.lights) l.visible = visible && this.night > 0.03;
      if (!visible) continue;
      if (v.x !== b.x || v.y !== b.y || v.dir !== b.dir) {
        v.x = b.x; v.y = b.y; v.dir = b.dir;
        v.root.position.set(wx, cy);
        v.root.zIndex = (b.x + b.y + (def.size - 1)) * 512 + b.x + 256;
        if (v.arrow) { v.arrow.texture = this.arrowTex[b.dir]; v.arrow.position.set(wx, cy); }
      }
      this.updateView(s, b, v, def.kind, animT, dt, o);
    }

    this.renderWisps(s, alpha);
    this.renderOverlay(s, o);
    this.renderIsletArrival(s, dt);
    this.renderShip(s);
    // hide unused item sprites
    for (let i = this.itemUsed; i < this.itemPool.length; i++) this.itemPool[i].visible = false;

    // ambient life
    if (!o.reduced && Math.random() < dt * (this.night > 0.5 ? 2 : 0.6)) {
      const [wx, wy] = this.screenToWorld(Math.random() * this.vw, Math.random() * this.vh);
      this.fx.emit(this.night > 0.5 ? 'mote' : 'leaf', wx, wy, 1, { vx: 8, up: 2, spread: 4, life: 3, drag: 0.9, g: 3 });
    }
    this.fx.update(dt);
    if (this.falls.children.length) {
      const fi = Math.floor(this.time * 12) % this.fallFrames.length;
      for (const c of this.falls.children) {
        setArt(c as Sprite, this.fallFrames[fi]);
        // soft spray where the ribbon thins out
        if (!o.reduced && c.visible && Math.random() < dt * 3) this.fx.emit('steam', c.x + (Math.random() - 0.5) * 16, c.y + 112, 1, { up: 6, spread: 10, life: 1.4, g: -4, drag: 0.6 });
      }
    }
    const t1 = performance.now();
    this.app.renderer.render({ container: this.world, target: this.rt!, clear: true });
    this.app.renderer.render(this.app.stage);
    const t2 = performance.now();
    this.frameMs = this.frameMs * 0.9 + (t2 - t0) * 0.1;
    this.updateMs = this.updateMs * 0.9 + (t1 - t0) * 0.1;
  }

  /** Sprite set for a building: island trees and tall grass take their biome's look. */
  private artKey(b: Building): string {
    if (b.type !== 'tree' && b.type !== 'tuft') return b.type;
    const t = this.state?.tiles.get(key(b.x, b.y));
    const bio = t && t.floor === 'grass' ? t.biome : undefined;
    if (!bio) return b.type;
    const k = b.type === 'tree' ? `tree_${BIOMES[bio].treeLook}` : `tuft_${bio}`;
    return this.spr.has(k) ? k : b.type;
  }

  private updateView(s: GameState, b: Building, v: BView, kind: string, t: number, dt: number, o: ViewOptions): void {
    const def = BUILDINGS[b.type];
    // squash & stretch
    if (v.bounce > 0) {
      v.bounce = Math.max(0, v.bounce - dt * 3.2);
      const k = Math.sin(v.bounce * Math.PI) * 0.08 * (o.reduced ? 0.3 : 1);
      v.sprite.scale.set((1 + k) / art.R, (1 - k) / art.R);
    } else if (v.sprite.scale.x !== 1 / art.R) v.sprite.scale.set(1 / art.R);

    if (kind === 'belt') {
      const set = b.type === 'express' ? this.express : this.belt;
      const spd = def.speed ?? 1.25;
      setArt(v.sprite, set[b.dir][Math.floor(t * spd * 4) % 4]);
      this.renderBeltItems(b, v, s);
      return;
    }
    const st = this.spr.get(this.artKey(b)) ?? this.spr.get(b.type)!;
    const vars = st.def.variants;
    let frames = st.def.frames;
    if (kind === 'tree') {
      if (b.type === 'tree') frames = vars[b.stock >= 4 ? 's5' : b.stock >= 1 ? 's3' : 's0'] ?? frames;
    } else if (kind === 'sapling') {
      const stage = Math.min(2, Math.floor((b.progress / TREE.saplingGrowTime) * 3));
      frames = vars['g' + stage] ?? frames;
    } else if (kind === 'storage') {
      frames = vars['f' + this.fillLevel] ?? frames;
    } else if (kind === 'forge') {
      frames = vars['st' + Math.max(0, Math.min(3, s.forge.stage))] ?? frames;
    }
    const animated = b.status === 'working' || ['tree', 'tuft', 'node', 'pylon', 'beacon', 'sapling', 'forge', 'elder', 'post', 'decor'].includes(kind) || b.type === 'elder_tree';
    const raw = animated && frames.length > 1 ? Math.floor((t + v.phase) * st.def.fps) % frames.length : 0;
    const fr = frames[Number.isFinite(raw) && raw >= 0 ? raw : 0];
    if (v.sprite.texture !== fr.tex) setArt(v.sprite, fr);

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
    const show = o.bubbles && !o.observe && problem && v.problem > (status === 'ready' ? 1.5 : 3) && (kind === 'crafter' || kind === 'harvester' || kind === 'generator' || kind === 'drill' || kind === 'engine' || kind === 'hive');
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
      sp.scale.set(1 / art.R);
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
          setArt(sp, (gh.type === 'express' ? this.express : this.belt)[c.dir][0]);
        } else {
          setArt(sp, this.spr.get(gh.type)!.def.frames[0]);
        }
        sp.scale.set(1 / art.R);
        sp.position.set(wx, wy + (def.size - 1) * 16);
        sp.alpha = 0.7;
        sp.tint = c.ok ? 0xe8ffe0 : 0xff9a8a;
      }
    }
    for (let i = gi; i < this.ghostPool.length; i++) this.ghostPool[i].visible = false;
  }

  /** A trader's airship hovers beside the first trading post while contracts are open. */
  private renderShip(s: GameState): void {
    let post: Building | undefined;
    for (const b of s.buildings.values()) if (b.type === 'trading_post') { post = b; break; }
    const show = !!post && s.trade.board.some((c) => c) && art.has('ship:0');
    if (!show) { if (this.ship) this.ship.visible = false; return; }
    if (!this.ship) {
      this.shipFrames = [0, 1, 2, 3].map((i) => art.img(`ship:${i}`));
      this.ship = new Sprite();
      this.ship.scale.set(1 / art.R);
      this.objects.addChild(this.ship);
    }
    // float off the open side of the post
    let d = 1;
    for (const k of [1, 0, 3, 2]) if (!s.tiles.has(key(post!.x + DX[k], post!.y + DY[k]))) { d = k; break; }
    const fx = post!.x + DX[d] * 3 - 0.5, fy = post!.y + DY[d] * 3 - 0.5;
    const [wx, wy] = tileCenter(fx + 0.5, fy + 0.5);
    setArt(this.ship, this.shipFrames[Math.floor(this.time * 3) % 4]);
    this.ship.visible = true;
    this.ship.position.set(wx, wy);
    this.ship.zIndex = (fx + fy + 1) * 512 + fx + 256;
  }

  private renderIsletArrival(s: GameState, _dt: number): void {
    const sm = s.islets.summon;
    if (!sm) { if (this.isletArrival) this.isletArrival.visible = false; return; }
    if (!this.isletArrival) {
      const im = art.img('islet:0');
      const tex = im.tex;
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
    return { sprites: this.views.size, items: this.itemUsed, particles: this.fx.count, chunks: this.tileSprites.length };
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

function hashTile(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}


/** Point a sprite at a baked art image, keeping its anchor on the image's ground point. */
function setArt(sp: Sprite, a: ArtImage | undefined): void {
  if (!a) return;
  sp.texture = a.tex;
  sp.anchor.set(a.ax / a.w, a.ay / a.h);
}

/** Chebyshev distance (in tiles, capped at 4) to the nearest missing tile. */
function gapDist(has: (x: number, y: number) => boolean, x: number, y: number): number {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!has(x + dx, y + dy)) return r - 1;
    }
  }
  return 4;
}
