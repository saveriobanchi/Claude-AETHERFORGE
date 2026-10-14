/**
 * A scripted "reasonable player" that drives the real simulation through the
 * public action API only. Used to prove that the whole progression is
 * reachable (no softlocks, no impossible recipes) and to measure pacing.
 */
import * as A from '../src/core/actions';
import { BUILDINGS, BUILDING_LIST } from '../src/core/content/buildings';
import type { ItemId } from '../src/core/content/items';
import { ITEMS } from '../src/core/content/items';
import { RECIPES, RECIPE_LIST, type RecipeDef } from '../src/core/content/recipes';
import { FORGE_STAGES, ISLETS, summonCost } from '../src/core/content/world';
import { MARKET_BY_ID, marketPrice, upgradable, upgradeCost } from '../src/core/content/trade';
import { activeChapter, charm, goalDone, goalValue } from '../src/core/chapters';
import type { Goal } from '../src/core/content/chapters';
import { buildingUnlocked, recipeUnlocked } from '../src/core/progression';
import { TICK, forgeNeeds, tick } from '../src/core/sim';
import { type Building, type Dir, type GameState, DX, DY, buildingAt, capacity, createState, key, tileAt, isEdgeTile, stackTotal } from '../src/core/state';

const NATURE: Partial<Record<ItemId, 'tree' | 'tuft'>> = { wood: 'tree', leaf: 'tree', sapling: 'tree', fiber: 'tuft' };

export class Bot {
  s: GameState;
  timeline: { id: string; t: number }[] = [];
  depth = 0;
  limit: number;
  cells = new Map<string, number>(); // recipe -> automated cell count
  verbose = false;

  constructor(seed = 99, limitHours = 60) {
    this.s = createState(seed);
    this.limit = limitHours * 3600;
  }

  get t(): number {
    return this.s.stats.playSeconds;
  }

  wait(sec: number): void {
    const n = Math.max(1, Math.round(sec / TICK));
    for (let i = 0; i < n; i++) {
      tick(this.s);
      if (this.s.events.length) {
        for (const e of this.s.events) if (e.type === 'discovery') this.timeline.push({ id: e.id, t: this.t });
        this.s.events.length = 0;
      }
    }
    if (this.t > this.limit) throw new Error(`Bot exceeded time limit at ${this.status()}`);
  }

  flushEvents(): void {
    for (const e of this.s.events) if (e.type === 'discovery') this.timeline.push({ id: e.id, t: this.t });
    this.s.events.length = 0;
  }

  status(): string {
    const st = Object.entries(this.s.stash).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(' ');
    const ms = [...this.s.buildings.values()].filter((b) => !['tree', 'tuft', 'sapling', 'belt'].includes(b.type)).map((b) => `${b.type}(${b.x},${b.y},d${b.dir})=${b.status}${b.recipe ? '/' + b.recipe : ''}${b.filter ? '/' + b.filter : ''}`).join(' ');
    return `power=${this.s.power.gen.toFixed(1)}/${this.s.power.demand} ${ms}\n t=${(this.t / 60).toFixed(1)}m tiles=${this.s.tiles.size} known=${[...this.s.known].join(',')} stash=${st}`;
  }

  log(msg: string): void {
    if (this.verbose) console.log(`[${(this.t / 60).toFixed(1)}m] ${msg}`);
  }

  // ───────────────────────── hands ─────────────────────────

  tapTrees(): number {
    let n = 0;
    for (const b of [...this.s.buildings.values()]) {
      if (b.type !== 'tree' && b.type !== 'elder_tree') continue;
      while (b.stock >= 1) {
        if (!A.harvestAt(this.s, b.x, b.y).ok) break;
        n++;
        this.wait(0.35);
      }
    }
    this.flushEvents();
    if (!n) this.wait(1);
    return n;
  }

  tapTufts(): number {
    let n = 0;
    for (const b of [...this.s.buildings.values()]) {
      if (b.type === 'tuft') { A.harvestAt(this.s, b.x, b.y); n++; this.wait(0.4); }
    }
    this.flushEvents();
    if (!n) this.wait(2);
    return n;
  }

  plantSaplings(): void {
    const trees = this.countOf('tree') + this.countOf('sapling');
    let budget = Math.max(0, 4 - trees);
    while (budget-- > 0 && this.s.stash.sapling > 0 && buildingUnlocked(this.s, 'sapling')) {
      const spot = this.findSpot([{ type: 'sapling', dx: 0, dy: 0, dir: 0 }], false);
      if (!spot) return;
      if (!A.place(this.s, 'sapling', spot[0], spot[1]).ok) return;
    }
  }

  // ───────────────────────── storage ─────────────────────────

  ensureCapacity(n: number): void {
    while (capacity(this.s) < n) {
      const type = ['warehouse', 'silo', 'crate'].find((t) => buildingUnlocked(this.s, t));
      if (!type) throw new Error(`Need capacity ${n} but no storage known (${this.status()})`);
      this.build(type);
    }
  }

  // ───────────────────────── ensure ─────────────────────────

  ensure(item: ItemId, n: number): void {
    if (this.s.stash[item] >= n) return;
    this.depth++;
    if (this.depth > 40) throw new Error(`Recursion too deep for ${item}: ${this.status()}`);
    try {
      if (!['warehouse', 'silo', 'crate'].some((t) => buildingUnlocked(this.s, t))) n = Math.min(n, capacity(this.s));
      this.ensureCapacity(n + 2);
      const t0 = this.t;
      let best = this.s.stash[item];
      let bestT = this.t;
      const paused: Building[] = [];
      let stalls = 0;
      try {
        while (this.s.stash[item] < n) {
          if (this.t - t0 > 4 * 3600) throw new Error(`Stuck ensuring ${n} ${item}: ${this.status()}`);
          this.produce(item, n - this.s.stash[item]);
          if (this.s.stash[item] > best) { best = this.s.stash[item]; bestT = this.t; }
          else if (this.t - bestT > 60) {
            // consumers are draining it: pause the dispatchers that send it out
            for (const b of this.s.buildings.values()) if (b.type === 'dispatcher' && b.filter === item) { A.setFilter(this.s, b.id, null); paused.push(b); }
            bestT = this.t;
            // a slow line (like a player noticing a bottleneck): add one more cell, once per ensure
            if (++stalls % 10 === 0 && stalls <= 30) this.widenBottleneck(item);
          }
        }
      } finally {
        for (const b of paused) A.setFilter(this.s, b.id, item);
      }
    } finally {
      this.depth--;
    }
  }

  /** Follow a starving item down its recipe chain and add a cell where supply runs dry. */
  widenBottleneck(item: ItemId, depth = 0): void {
    const r = this.producerRecipe(item);
    if (!r || depth > 6) return;
    const short = (Object.keys(r.inputs) as ItemId[]).filter((k) => this.s.stash[k] < (r.inputs[k] ?? 0) * 4).sort((a, b) => this.s.stash[a] - this.s.stash[b])[0];
    if (short && this.producerRecipe(short)) return this.widenBottleneck(short, depth + 1);
    const cells = this.cells.get(r.id) ?? 0;
    if (cells > 0 && cells < 9) {
      try { this.automate(r.id, 1); this.log(`widened ${r.id} for ${item}`); } catch { /* no station or room */ }
    }
  }

  ensureAll(cost: Partial<Record<ItemId, number>>): void {
    for (let pass = 0; pass < 30; pass++) {
      for (const k in cost) this.ensure(k as ItemId, cost[k as ItemId] ?? 0);
      if (A.missing(this.s, cost) === '') return;
    }
    if (A.missing(this.s, cost)) throw new Error(`ensureAll failed ${A.missing(this.s, cost)}`);
  }

  producerRecipe(item: ItemId): RecipeDef | undefined {
    const known = RECIPE_LIST.filter((r) => recipeUnlocked(this.s, r.id));
    // Prefer automated cells, then hand, then direct outputs, then by-products.
    const direct = known.filter((r) => (r.outputs[item] ?? 0) > 0);
    const cell = direct.find((r) => (this.cells.get(r.id) ?? 0) > 0);
    if (cell) return cell;
    const hand = direct.find((r) => r.stations.includes('hand'));
    if (hand) return hand;
    if (direct.length) return direct.sort((a, b) => a.time - b.time)[0];
    const by = known.filter((r) => (r.chance?.[item] ?? 0) > 0);
    const byCell = by.find((r) => (this.cells.get(r.id) ?? 0) > 0);
    return byCell ?? by[0];
  }

  produce(item: ItemId, want: number): void {
    const nat = NATURE[item];
    const r = this.producerRecipe(item);
    if (nat === 'tree' && !(r && (this.cells.get(r.id) ?? 0) > 0)) {
      if (this.cells.get('grove')) { this.wait(10); this.relieve(); this.collectAll(); return; }
      this.plantSaplings();
      this.tapTrees();
      return;
    }
    if (nat === 'tuft') {
      if (this.cells.get('grove')) { this.wait(10); this.relieve(); this.collectAll(); if (this.s.stash.fiber < want) this.tapTufts(); return; }
      this.tapTufts();
      return;
    }
    if (item === 'amber') { if (!this.cells.get('elder')) this.tapElder(); this.wait(10); this.collectAll(); return; }
    // generator / node items
    const gen = this.generatorFor(item);
    if (gen && (!r || !(this.cells.get(r.id) ?? 0))) {
      if (!this.countOf(gen)) {
        if (buildingUnlocked(this.s, 'depot')) this.buildCell(gen, null);
        else this.build(gen);
      }
      this.wait(10);
      this.collectAll();
      return;
    }
    if (!r) throw new Error(`No known way to make ${item}: ${this.status()}`);
    if ((this.cells.get(r.id) ?? 0) > 0) {
      this.feedCells(r, want);
      return;
    }
    if (r.stations.includes('hand')) {
      if (!A.hasWorkbench(this.s)) this.build('workbench');
      const times = Math.max(1, Math.min(Math.ceil(want / (r.outputs[item] ?? 1)), 20));
      for (const k in r.inputs) this.ensure(k as ItemId, (r.inputs[k as ItemId] ?? 0) * times);
      A.craft(this.s, r.id, times);
      this.wait(0.5 * times);
      return;
    }
    const station = r.stations[0];
    if (BUILDINGS[station].kind === 'manual') {
      if (!this.countOf(station)) this.build(station);
      const b = this.firstOf(station)!;
      this.ensure('loam', 1);
      A.tapManual(this.s, b.id);
      this.wait(0.4);
      this.flushEvents();
      return;
    }
    this.handFeed(r, want);
  }

  generatorFor(item: ItemId): string | undefined {
    for (const b of Object.values(BUILDINGS)) if (b.produces?.item === item && buildingUnlocked(this.s, b.id)) return b.id;
    if (item === 'mist' && this.countOf('drill')) return undefined;
    return undefined;
  }

  countOf(type: string): number {
    let n = 0;
    for (const b of this.s.buildings.values()) if (b.type === type) n++;
    return n;
  }

  firstOf(type: string): Building | undefined {
    for (const b of this.s.buildings.values()) if (b.type === type) return b;
    return undefined;
  }

  collectAll(): void {
    for (const b of this.s.buildings.values()) if (stackTotal(b.outBuf) > 0) A.collect(this.s, b.id);
    this.flushEvents();
  }

  /** Manually operate stations: load inputs, wait, collect. */
  handFeed(r: RecipeDef, want: number): void {
    const station = r.stations.find((st) => st !== 'hand' && buildingUnlocked(this.s, st))!;
    if (!station) throw new Error(`No station for ${r.id}`);
    if (!this.countOf(station)) this.build(station);
    const stations = [...this.s.buildings.values()].filter((b) => b.type === station && !this.isCellMachine(b));
    if (!stations.length) this.build(station);
    const list = [...this.s.buildings.values()].filter((b) => b.type === station && !this.isCellMachine(b));
    const out = Object.keys(r.outputs)[0] as ItemId;
    const perCycle = (r.outputs[out] ?? 0) || 0.3;
    const cycles = Math.min(Math.ceil(want / perCycle), 6 * list.length);
    const per = Math.ceil(cycles / list.length);
    for (const k in r.inputs) this.ensure(k as ItemId, (r.inputs[k as ItemId] ?? 0) * Math.min(per, 6) * list.length);
    if (r.fuel) this.ensure('charcoal', Math.ceil((per * list.length) / 4) + 1);
    if (BUILDINGS[station].power) this.ensurePower();
    for (const b of list) {
      A.setRecipe(this.s, b.id, r.id);
      A.load(this.s, b.id);
    }
    this.wait(Math.min(per, 6) * r.time + 1);
    this.collectAll();
  }

  isCellMachine(b: Building): boolean {
    const f = buildingAt(this.s, b.x + DX[b.dir], b.y + DY[b.dir]);
    return !!f && f.type === 'depot';
  }

  // ───────────────────────── automation ─────────────────────────

  /** Keep a cell's inputs flowing, then let it run. */
  feedCells(r: RecipeDef, _want: number): void {
    for (const k in r.inputs) {
      const item = k as ItemId;
      const per = r.inputs[item] ?? 0;
      if (this.s.stash[item] < per) this.produce(item, per);
    }
    if (r.fuel && this.s.stash.charcoal < 1) this.produce('charcoal', 1);
    this.wait(10);
    this.collectAll();
  }

  automate(recipeId: string, count = 1): void {
    const r = RECIPES[recipeId];
    for (let i = 0; i < count; i++) {
      const station = r.stations.find((st) => st !== 'hand' && BUILDINGS[st].kind === 'crafter' && buildingUnlocked(this.s, st))!;
      if (!station) throw new Error(`no automatable station for ${recipeId}`);
      this.buildCell(station, r);
      this.cells.set(recipeId, (this.cells.get(recipeId) ?? 0) + 1);
    }
    this.ensurePower();
    this.log(`automated ${recipeId} ×${count}`);
  }

  /** Station facing a depot, with a dispatcher on each other side per input. */
  buildCell(station: string, r: RecipeDef | null): void {
    const inputs = r ? (Object.keys(r.inputs) as ItemId[]) : [];
    if (r?.fuel) inputs.push('charcoal');
    if (inputs.length > 3) throw new Error('cell supports at most 3 inputs');
    const pattern: PatternEl[] = [{ type: station, dx: 0, dy: 0, dir: 0 }, { type: 'depot', dx: 1, dy: 0, dir: 0 }];
    const sides: [number, number, Dir][] = [[-1, 0, 0], [0, -1, 1], [0, 1, 3]];
    inputs.forEach((_, i) => pattern.push({ type: 'dispatcher', dx: sides[i][0], dy: sides[i][1], dir: sides[i][2] }));
    for (const el of pattern) this.ensureAll(BUILDINGS[el.type].cost);
    const spot = this.makeRoom(pattern);
    // pay for each element
    const placed: number[] = [];
    for (const el of pattern) {
      this.pave(el, spot);
      this.ensureAll(BUILDINGS[el.type].cost);
      const res = A.place(this.s, el.type, spot[0] + el.dx, spot[1] + el.dy, el.dir);
      if (!res.ok) throw new Error(`cell place failed ${el.type}: ${res.reason}`);
      placed.push(res.id!);
    }
    const st = this.s.buildings.get(placed[0])!;
    if (r) A.setRecipe(this.s, st.id, r.id);
    inputs.forEach((item, i) => A.setFilter(this.s, placed[2 + i], item));
    if (BUILDINGS[station].power) this.ensurePower();
  }

  buildGrove(): void {
    // Treewright among trees (existing ones count), depot in front.
    this.ensureAll(BUILDINGS.harvester.cost);
    this.ensureAll(BUILDINGS.depot.cost);
    const slots = [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
    let spot: [number, number] | null = null;
    for (let i = 0; i < 100 && !spot; i++) {
      let bestScore = -1;
      for (const t of this.s.tiles.values()) {
        const x = t.x, y = t.y;
        if (!this.fits({ type: 'harvester', dx: 0, dy: 0, dir: 0 }, x, y) || !this.fits({ type: 'depot', dx: 0, dy: 0, dir: 0 }, x + 1, y)) continue;
        let score = 0;
        for (const [dx, dy] of slots) if (this.fits({ type: 'sapling', dx: 0, dy: 0, dir: 0 }, x + dx, y + dy)) score++;
        const sc = score * 100 - Math.abs(x) - Math.abs(y);
        if (score >= 4 && sc > bestScore) { bestScore = sc; spot = [x, y]; }
      }
      if (!spot) this.growIsland(true);
    }
    if (!spot) throw new Error('no grove spot');
    const h = A.place(this.s, 'harvester', spot[0], spot[1], 0);
    if (!h.ok) throw new Error('grove harvester: ' + h.reason);
    this.ensureAll(BUILDINGS.depot.cost);
    const d = A.place(this.s, 'depot', spot[0] + 1, spot[1], 0);
    if (!d.ok) throw new Error('grove depot: ' + d.reason);
    for (const [dx, dy] of slots) {
      const x = spot[0] + dx, y = spot[1] + dy;
      const o = buildingAt(this.s, x, y);
      if (o && (o.type === 'tree' || o.type === 'sapling')) continue;
      if (!this.fits({ type: 'sapling', dx: 0, dy: 0, dir: 0 }, x, y)) continue;
      this.ensure('sapling', 1);
      A.place(this.s, 'sapling', x, y);
    }
    this.cells.set('grove', (this.cells.get('grove') ?? 0) + 1);
    this.log('grove built');
  }

  /** Relieve a full stash (harvesters block when one of their outputs has no room). */
  relieve(): void {
    for (const b of this.s.buildings.values()) {
      if (b.type !== 'harvester' || b.status !== 'blocked') continue;
      const cap = capacity(this.s);
      if (cap < 250) {
        const type = ['silo', 'crate'].find((t) => buildingUnlocked(this.s, t));
        if (type && A.missing(this.s, BUILDINGS[type].cost) === '') { try { this.build(type); } catch { /* later */ } }
      }
      if (this.s.stash.wood >= capacity(this.s) - 2 && A.hasWorkbench(this.s) && this.s.stash.plank < capacity(this.s) - 10) A.craft(this.s, 'plank', 10);
      if (this.s.stash.sapling >= capacity(this.s) - 2) this.s.stash.sapling -= 0; // saplings just wait
      A.collect(this.s, b.id);
    }
  }

  powering = false;
  ensurePower(): void {
    if (this.powering) return;
    this.powering = true;
    try { this.ensurePowerInner(); } finally { this.powering = false; }
  }

  ensurePowerInner(): void {
    let demand = 0;
    let mills = 0;
    let engines = 0;
    for (const b of this.s.buildings.values()) {
      const d = BUILDINGS[b.type];
      demand += d.power ?? 0;
      if (b.type === 'windmill') mills++;
      if (b.type === 'engine') engines++;
    }
    while (mills * 6 * 0.62 + engines * 50 < demand) {
      if (demand > 60 && buildingUnlocked(this.s, 'engine') && engines < 4) {
        this.build('engine');
        engines++;
        this.automateEngineFuel();
      } else {
        this.build('windmill');
        mills++;
      }
    }
  }

  automateEngineFuel(): void {
    for (const b of this.s.buildings.values()) if (b.type === 'engine') { this.ensure('aether', 6); A.load(this.s, b.id); }
  }

  build(type: string): number {
    if (!buildingUnlocked(this.s, type)) throw new Error(`build ${type}: not discovered. ${this.status()}`);
    this.ensureAll(BUILDINGS[type].cost);
    const el = { type, dx: 0, dy: 0, dir: 0 as Dir };
    const spot = this.makeRoom([el]);
    this.pave(el, spot);
    this.ensureAll(BUILDINGS[type].cost);
    const r = A.place(this.s, type, spot[0], spot[1], 0);
    if (!r.ok) throw new Error(`build ${type} failed: ${r.reason} ${this.status()}`);
    this.log(`built ${type}`);
    return r.id!;
  }

  // ───────────────────────── space ─────────────────────────

  pave(el: PatternEl, spot: [number, number]): void {
    const def = BUILDINGS[el.type];
    const size = def.size;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const x = spot[0] + el.dx + dx;
      const y = spot[1] + el.dy + dy;
      const t = tileAt(this.s, x, y)!;
      if (def.floors && !def.floors.includes(t.floor) && t.floor === 'grass') {
        this.ensureAll({ stone: 2 });
        const r = A.expand(this.s, 'flagstone', x, y);
        if (!r.ok) throw new Error(`pave failed: ${r.reason}`);
      }
    }
  }

  fits(el: PatternEl, x: number, y: number): boolean {
    const def = BUILDINGS[el.type];
    if (el.type === 'sapling') {
      const o = buildingAt(this.s, x, y);
      if (o && (o.type === 'tree' || o.type === 'sapling')) return true;
    }
    for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) {
      const t = tileAt(this.s, x + dx, y + dy);
      if (!t) return false;
      const o = buildingAt(this.s, x + dx, y + dy);
      if (o && o.type !== 'tuft') return false;
      if (def.floors && !def.floors.includes(t.floor)) {
        if (!(t.floor === 'grass' && (def.floors.includes('stone')) && A.canExpand(this.s, 'flagstone', x + dx, y + dy, false).ok)) return false;
      }
    }
    if (def.edge) {
      let e = false;
      for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) if (isEdgeTile(this.s, x + dx, y + dy)) e = true;
      if (!e) return false;
    }
    if (def.nearNode) {
      let near = false;
      for (let d = 0; d < 4; d++) { const n = buildingAt(this.s, x + DX[d], y + DY[d]); if (n && BUILDINGS[n.type].kind === 'node') near = true; }
      if (!near) return false;
    }
    return true;
  }

  findSpot(pattern: PatternEl[], keepClear = true): [number, number] | null {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const t of this.s.tiles.values()) { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y); }
    for (let y = minY - 1; y <= maxY + 1; y++) for (let x = minX - 1; x <= maxX + 1; x++) {
      const d = Math.abs(x) + Math.abs(y) + (keepClear && x === 0 && y === 0 ? 100 : 0);
      if (d >= bestD) continue;
      if (pattern.every((el) => this.fits(el, x + el.dx, y + el.dy))) { best = [x, y]; bestD = d; }
    }
    return best;
  }

  makeRoom(pattern: PatternEl[]): [number, number] {
    for (let i = 0; i < 200; i++) {
      const spot = this.findSpot(pattern);
      if (spot) return spot;
      this.growIsland(pattern.some((p) => BUILDINGS[p.type].floors?.includes('grass') && !BUILDINGS[p.type].floors?.includes('stone')));
    }
    throw new Error(`no room for ${pattern.map((p) => p.type).join(',')}: ${this.status()}`);
  }

  growIsland(needGrass: boolean): void {
    // add a handful of tiles on the side closest to the origin
    const cands: [number, number][] = [];
    for (const t of this.s.tiles.values()) for (let d = 0; d < 4; d++) {
      const x = t.x + DX[d], y = t.y + DY[d];
      if (!this.s.tiles.has(key(x, y))) cands.push([x, y]);
    }
    cands.sort((a, b) => Math.hypot(a[0], a[1] * 1.2) - Math.hypot(b[0], b[1] * 1.2));
    const land = !needGrass && A.canExpand(this.s, 'skytile', cands[0][0], cands[0][1], false).ok ? 'skytile' : 'plot';
    let added = 0;
    for (const [x, y] of cands) {
      if (added >= 4) break;
      if (this.s.tiles.has(key(x, y))) continue;
      if (!A.canExpand(this.s, land, x, y, false).ok) continue;
      this.ensureAll(this.landCost(land));
      const r = A.expand(this.s, land, x, y);
      if (r.ok) added++;
    }
    this.log(`island grew to ${this.s.tiles.size}`);
  }

  landCost(land: string): Partial<Record<ItemId, number>> {
    // mirrors content/world.landCost through the public API
    return land === 'plot' ? plotCostFor(this.s.tiles.size) : land === 'flagstone' ? { stone: 2 } : { skystone: 3 };
  }

  // ───────────────────────── trade ─────────────────────────

  /** Fill contracts (making the goods as needed) until the bot holds `marks`. */
  tradeUntil(marks: number): void {
    if (!this.countOf('trading_post')) this.build('trading_post');
    let g = 0;
    while (this.s.trade.marks < marks) {
      if (++g > 300) throw new Error(`trade stuck: ${this.status()}`);
      const i = this.s.trade.board.findIndex((c) => c);
      if (i < 0) { this.wait(5); continue; }
      const c = this.s.trade.board[i]!;
      this.ensure(c.item, Math.min(c.n - c.got, Math.floor(capacity(this.s) * 0.8)));
      A.handOver(this.s, i);
      this.flushEvents();
    }
  }

  buy(id: string): void {
    const m = MARKET_BY_ID[id];
    this.tradeUntil(marketPrice(m, this.s.trade.bought[id] ?? 0));
    const r = A.buy(this.s, id);
    if (!r.ok) throw new Error(`buy ${id}: ${r.reason}`);
    this.flushEvents();
    this.log(`bought ${id}`);
  }

  // ───────────────────────── chapters ─────────────────────────

  /** Work through chapters up to (and including) `upTo`, satisfying each goal. */
  doChapters(upTo: number): void {
    let guard = 0;
    while (this.s.chapters < upTo) {
      if (++guard > 60) throw new Error(`chapters stuck at ${this.s.chapters + 1}: ${this.status()}`);
      const ch = activeChapter(this.s)!;
      for (const g of ch.goals) {
        if (goalDone(this.s, g)) continue;
        this.satisfy(g);
      }
      this.wait(1.1);
      this.log(`chapter ${ch.id} → ${this.s.chapters}`);
    }
  }

  satisfy(g: Goal): void {
    const s = this.s;
    switch (g.t) {
      case 'built':
        if (g.type === '*fruit') {
          while (goalValue(s, g) < g.n) {
            if (!s.stash.fruit_sapling) this.buy('fruit');
            const spot = this.findSpot([{ type: 'fruit_sapling', dx: 0, dy: 0, dir: 0 }]);
            if (!spot) { this.growIsland(true); continue; }
            A.place(s, 'fruit_sapling', spot[0], spot[1]);
            this.wait(50);
          }
        } else while (goalValue(s, g) < g.n) this.build(g.type);
        break;
      case 'made': this.ensure(g.item, g.n - goalValue(s, g) + s.stash[g.item]); break;
      case 'tiles': while (s.tiles.size < g.n) this.growIsland(true); break;
      case 'contracts': {
        if (!this.countOf('trading_post')) this.build('trading_post');
        let k = 0;
        while (s.trade.done < g.n && k++ < 200) {
          const i = s.trade.board.findIndex((c) => c);
          if (i < 0) { this.wait(5); continue; }
          const c = s.trade.board[i]!;
          this.ensure(c.item, Math.min(c.n - c.got, Math.floor(capacity(s) * 0.8)));
          A.handOver(s, i);
        }
        break;
      }
      case 'charm': {
        // cheapest charm per unit of material first, rotating for variety
        const decor = BUILDING_LIST.filter((b) => b.kind === 'decor' && buildingUnlocked(s, b.id) && b.id !== 'lantern');
        let k = 0;
        while (charm(s) < g.n && k++ < 400) {
          const pick = decor[k % decor.length];
          this.build(pick.id);
        }
        break;
      }
      case 'level': {
        const m = [...s.buildings.values()].filter((b) => upgradable(BUILDINGS[b.type])).sort((a, b) => stackTotal(BUILDINGS[a.type].cost) - stackTotal(BUILDINGS[b.type].cost))[0];
        while (m.level < g.n) {
          this.ensureAll(upgradeCost(BUILDINGS[m.type], m.level + 1).items);
          const r = A.upgrade(s, m.id);
          if (!r.ok) throw new Error('upgrade: ' + r.reason);
        }
        break;
      }
      case 'biomes': {
        for (const t of [...s.tiles.values()]) {
          if (t.floor !== 'grass' || t.biome) continue;
          this.ensureAll({ dew: 3, loam: 2 });
          if (A.expand(s, 'marsh', t.x, t.y).ok) break;
        }
        break;
      }
      case 'islets': this.summonAll(); break;
      case 'forge': this.buildForge(); break;
      default: throw new Error('bot cannot do goal ' + g.t);
    }
  }

  // ───────────────────────── wonders ─────────────────────────

  summonAll(): void {
    if (!this.countOf('beacon')) this.build('beacon');
    const beacon = this.firstOf('beacon')!;
    while (this.s.islets.docked < ISLETS.length) {
      this.ensureAll(summonCost(this.s.islets.docked));
      const r = A.summon(this.s, beacon.id);
      if (!r.ok) throw new Error(`summon failed: ${r.reason}`);
      const before = this.s.islets.docked;
      while (this.s.islets.docked === before) this.wait(5);
      this.log(`islet docked (${this.s.islets.docked})`);
    }
  }

  /** A Treewright beside the Elder Tree, delivering into a depot. */
  tapElder(): void {
    const elder = this.firstOf('elder_tree');
    if (!elder) throw new Error('no elder tree');
    for (let d = 0; d < 4; d++) {
      const x = elder.x + DX[d], y = elder.y + DY[d];
      for (let fd = 0; fd < 4; fd++) {
        const fx = x + DX[fd], fy = y + DY[fd];
        if (this.fits({ type: 'harvester', dx: 0, dy: 0, dir: 0 }, x, y) && this.fits({ type: 'depot', dx: 0, dy: 0, dir: 0 }, fx, fy) && !(fx === elder.x && fy === elder.y)) {
          this.ensureAll(BUILDINGS.harvester.cost);
          A.place(this.s, 'harvester', x, y, fd as Dir);
          this.ensureAll(BUILDINGS.depot.cost);
          A.place(this.s, 'depot', fx, fy);
          this.cells.set('elder', 1);
          return;
        }
      }
    }
    throw new Error('no room beside the elder tree');
  }

  buildForge(): void {
    if (!this.countOf('forge')) {
      const el = { type: 'forge', dx: 0, dy: 0, dir: 0 as Dir };
      const spot = this.makeRoom([el]);
      this.pave(el, spot);
      this.ensureAll(BUILDINGS.forge.cost);
      const r = A.place(this.s, 'forge', spot[0], spot[1]);
      if (!r.ok) throw new Error('forge: ' + r.reason);
    }
    while (this.s.forge.stage < FORGE_STAGES.length) {
      const need = forgeNeeds(this.s);
      for (const k in need) {
        const item = k as ItemId;
        const chunk = Math.min(need[item] ?? 0, Math.floor(capacity(this.s) * 0.8));
        this.ensure(item, chunk);
        A.contribute(this.s);
      }
      this.log(`forge stage ${this.s.forge.stage}`);
    }
  }

  describe(item: ItemId): string {
    return ITEMS[item].name;
  }
}

interface PatternEl { type: string; dx: number; dy: number; dir: Dir }

import { plotCost } from '../src/core/content/world';
function plotCostFor(tiles: number) {
  return plotCost(tiles);
}
