import { BUILDINGS, HARVESTER_INTERVAL, DISPATCH_INTERVAL, HIVE, NODE_YIELD, TREE, TUFT, type BuildingDef } from './content/buildings';
import { BIOMES, type BiomeDef, FRUIT_BY_TREE, OFF_HOME } from './content/biomes';
import { BOARD_SIZE, CONTRACT_REFRESH, contractPool, levelBuffer, levelSpeed, makeContract, repForLevel } from './content/trade';
import { type WeatherDef, dayIndex, weatherFor } from './content/weather';
import type { ItemId, Stack } from './content/items';
import { FUEL_VALUE, RECIPES, recipesFor, type RecipeDef } from './content/recipes';
import { ISLETS, FORGE_STAGES, resonanceRequest } from './content/world';
import {
  type Building, type Dir, type GameState, DX, DY, key, buildingAt, addTo, stackTotal, stashAdd,
  rand, isNight, isEdgeTile, computeCapacity, attuneRank, addBuilding, addTile, tileAt, removeBuildingRaw,
} from './state';
import { checkDiscoveries } from './progression';

export const TICK = 0.05; // 20 Hz fixed simulation step
export const BELT_GAP = 0.34;
const PUSH_INTERVAL = 0.15;
const WISPS_PER_ROOST = 4;
const WISP_SPEED = 3.2;
const WISP_LOAD = 6;
const FLOW_BUCKET = 30;
const FLOW_HISTORY = 10;

/** Today's weather. */
export function weatherNow(s: GameState): WeatherDef {
  return weatherFor(dayIndex(s.time), s.seed);
}

/** Biome under a tile (only grass has one; paved ground counts as neutral). */
export function biomeAt(s: GameState, x: number, y: number): BiomeDef | null {
  const t = tileAt(s, x, y);
  if (!t || t.floor !== 'grass') return null;
  return BIOMES[t.biome ?? 'meadow'];
}
/** Fiber from a tuft standing at (x, y). */
export function tuftYield(s: GameState, x: number, y: number): number {
  return (biomeAt(s, x, y) ?? BIOMES.meadow).tuftFiber;
}

/** Buffer capacity of a machine, grown by its upgrade level. */
export function bufCap(def: BuildingDef, b: Building, fallback = 12): number {
  return Math.round((def.bufferCap ?? fallback) * levelBuffer(b.level));
}

// ───────────────────────────────── topology ─────────────────────────────────

export function rebuildCache(s: GameState): void {
  const c = s.cache;
  c.capacity = computeCapacity(s);
  c.edge.clear();
  for (const t of s.tiles.values()) if (isEdgeTile(s, t.x, t.y)) c.edge.add(key(t.x, t.y));

  const belts: Building[] = [];
  c.machines = [];
  for (const b of s.buildings.values()) {
    const k = BUILDINGS[b.type].kind;
    if (k === 'belt') belts.push(b);
    else c.machines.push(b);
  }
  c.machines.sort((a, b) => a.id - b.id);

  // Downstream-first belt order: a belt is processed after every belt it feeds.
  const next = new Map<number, Building | undefined>();
  for (const b of belts) {
    const t = buildingAt(s, b.x + DX[b.dir], b.y + DY[b.dir]);
    next.set(b.id, t && BUILDINGS[t.type].kind === 'belt' ? t : undefined);
  }
  const visited = new Set<number>();
  const order: Building[] = [];
  const visit = (b: Building) => {
    const stack: Building[] = [];
    let cur: Building | undefined = b;
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      stack.push(cur);
      cur = next.get(cur.id);
    }
    for (let i = stack.length - 1; i >= 0; i--) order.push(stack[i]);
  };
  for (const b of belts.sort((a, b) => a.id - b.id)) visit(b);
  c.beltOrder = order;

  // Resonance pylons: +50% speed within radius (non-stacking).
  c.boost.clear();
  for (const p of s.buildings.values()) {
    if (BUILDINGS[p.type].kind !== 'pylon') continue;
    const r = BUILDINGS[p.type].radius ?? 2;
    for (const m of c.machines) {
      if (Math.abs(m.x - p.x) <= r && Math.abs(m.y - p.y) <= r && m !== p) c.boost.set(m.id, 1.5);
    }
  }

  // Wisp roosts: machines in range.
  c.roostTargets.clear();
  const roosts = [...s.buildings.values()].filter((b) => BUILDINGS[b.type].kind === 'roost');
  for (const r of roosts) {
    const rad = BUILDINGS[r.type].radius ?? 5;
    const list: number[] = [];
    for (const m of c.machines) {
      const k = BUILDINGS[m.type].kind;
      if (!['crafter', 'generator', 'harvester', 'drill', 'engine', 'hive'].includes(k)) continue;
      if (Math.abs(m.x - r.x) <= rad && Math.abs(m.y - r.y) <= rad) list.push(m.id);
    }
    c.roostTargets.set(r.id, list);
  }
  // Keep wisp population in sync with roosts.
  s.wisps = s.wisps.filter((w) => s.buildings.has(w.roost));
  for (const r of roosts) {
    const have = s.wisps.filter((w) => w.roost === r.id).length;
    for (let i = have; i < WISPS_PER_ROOST; i++) {
      s.wisps.push({ roost: r.id, x: r.x, y: r.y, px: r.x, py: r.y, target: 0, phase: 'rest', job: null, carry: null, n: 0 });
    }
  }
  s.topoDirty = false;
}

// ───────────────────────────────── transfer ─────────────────────────────────

/** Recipe inputs a station currently wants. */
export function currentRecipe(b: Building): RecipeDef | undefined {
  if (b.recipe) return RECIPES[b.recipe];
  return undefined;
}

export function defaultRecipe(type: string): string | null {
  const list = recipesFor(type);
  return list.length ? list[0].id : null;
}

function fuelItem(item: ItemId): boolean {
  return FUEL_VALUE[item] !== undefined;
}

/**
 * Offer one item to a building from direction `from` (the direction the item
 * travels). Returns true if accepted. Pure acceptance logic shared by belts,
 * machine output, dispatchers and wisps.
 */
export function offer(s: GameState, t: Building, item: ItemId, from: Dir): boolean {
  const def = BUILDINGS[t.type];
  switch (def.kind) {
    case 'belt': {
      if ((t.dir + 2) % 4 === from) return false; // pointing back at the source
      const pos = t.dir === from ? 0 : 0.5;
      for (const it of t.items) if (Math.abs(it.pos - pos) < BELT_GAP) return false;
      t.items.push({ item, pos, prev: pos });
      return true;
    }
    case 'crafter': {
      const r = currentRecipe(t);
      if (!r) return false;
      const cap = bufCap(def, t);
      if (r.inputs[item] !== undefined) {
        if ((t.inBuf[item] ?? 0) >= Math.max(cap, (r.inputs[item] ?? 0) * 2)) return false;
        addTo(t.inBuf, item, 1);
        return true;
      }
      if (r.fuel && fuelItem(item)) {
        if (t.fuel >= 16) return false;
        t.fuel += FUEL_VALUE[item] ?? 0;
        return true;
      }
      return false;
    }
    case 'engine': {
      if (item !== 'aether' || (t.inBuf.aether ?? 0) >= (def.bufferCap ?? 10)) return false;
      addTo(t.inBuf, 'aether', 1);
      return true;
    }
    case 'depot': {
      // Depots never block: overflow beyond stash capacity spills (and is counted).
      if (stashAdd(s, item, 1) === 1) addTo(s.flow.cur.inn, item, 1);
      else {
        s.stats.spilled++;
        s.events.push({ type: 'spill', id: t.id, item });
      }
      s.stats.delivered++;
      s.events.push({ type: 'deliver', id: t.id, item });
      return true;
    }
    case 'splitter':
    case 'sorter': {
      if (t.hold) return false;
      t.hold = item;
      return true;
    }
    case 'forge':
      return forgeAccept(s, item, 1) === 1;
    case 'post':
      return contractAccept(s, item);
    default:
      return false;
  }
}

function frontOf(s: GameState, b: Building): Building | undefined {
  const size = BUILDINGS[b.type].size;
  if (size === 1) return buildingAt(s, b.x + DX[b.dir], b.y + DY[b.dir]);
  return undefined;
}

/** Push one item from a building's output buffer to the tile in front. */
function pushOutput(s: GameState, b: Building, dt: number): void {
  b.pushTimer -= dt;
  if (b.pushTimer > 0) return;
  let any = false;
  for (const k in b.outBuf) {
    any = true;
    const item = k as ItemId;
    const t = frontOf(s, b);
    if (t && offer(s, t, item, b.dir)) {
      addTo(b.outBuf, item, -1);
      b.pushTimer = PUSH_INTERVAL;
      return;
    }
  }
  if (any) b.pushTimer = PUSH_INTERVAL;
}

// ───────────────────────────────── forge ─────────────────────────────────

export function forgeNeeds(s: GameState): Stack {
  const f = s.forge;
  if (f.stage < 0) return {};
  const target = f.stage < FORGE_STAGES.length ? FORGE_STAGES[f.stage].needs : f.request;
  const out: Stack = {};
  for (const k in target) {
    const item = k as ItemId;
    const left = (target[item] ?? 0) - (f.progress[item] ?? 0);
    if (left > 0) out[item] = left;
  }
  return out;
}

/** Feed up to n of item into the forge; returns accepted amount. */
export function forgeAccept(s: GameState, item: ItemId, n: number): number {
  const need = forgeNeeds(s)[item] ?? 0;
  const take = Math.min(need, n);
  if (take <= 0) return 0;
  addTo(s.forge.progress, item, take);
  if (stackTotal(forgeNeeds(s)) === 0) advanceForge(s);
  return take;
}

function advanceForge(s: GameState): void {
  const f = s.forge;
  f.progress = {};
  if (f.stage < FORGE_STAGES.length) {
    f.stage++;
    s.events.push({ type: 'forge_stage', stage: f.stage });
    if (f.stage === FORGE_STAGES.length) {
      s.flags.add('forge_complete');
      f.request = resonanceRequest(f.level);
    }
  } else {
    f.level++;
    f.sparks++;
    f.request = resonanceRequest(f.level);
    s.events.push({ type: 'resonance', level: f.level });
  }
}

// ───────────────────────────────── machines ─────────────────────────────────

function machineSpeed(s: GameState, b: Building): number {
  return (s.cache.boost.get(b.id) ?? 1) * (1 + 0.1 * attuneRank(s, 'swift')) * levelSpeed(b.level);
}

function outputsFit(def: BuildingDef, b: Building, r: RecipeDef): boolean {
  const cap = bufCap(def, b);
  for (const k in r.outputs) if ((b.outBuf[k as ItemId] ?? 0) + (r.outputs[k as ItemId] ?? 0) > cap) return false;
  return true;
}

function hasInputs(b: Building, r: RecipeDef): boolean {
  for (const k in r.inputs) if ((b.inBuf[k as ItemId] ?? 0) < (r.inputs[k as ItemId] ?? 0)) return false;
  return true;
}

function finishRecipe(s: GameState, b: Building, r: RecipeDef, sink: (item: ItemId, n: number) => void): void {
  for (const k in r.outputs) sink(k as ItemId, r.outputs[k as ItemId] ?? 0);
  if (r.chance) for (const k in r.chance) if (rand(s) < (r.chance[k as ItemId] ?? 0)) sink(k as ItemId, 1);
  b.cycles++;
  s.events.push({ type: 'cycle', id: b.id });
}

function tickCrafter(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  const r = currentRecipe(b);
  if (!r) { b.status = 'idle'; return; }
  if (!b.working) {
    if (!outputsFit(def, b, r)) { b.status = 'blocked'; return; }
    if (!hasInputs(b, r)) { b.status = stackTotal(b.outBuf) > 0 ? 'ready' : 'noinput'; return; }
    if (r.fuel && b.fuel < r.fuel) { b.status = 'noinput'; return; }
    for (const k in r.inputs) addTo(b.inBuf, k as ItemId, -(r.inputs[k as ItemId] ?? 0));
    if (r.fuel) b.fuel -= r.fuel;
    b.working = true;
    b.progress = 0;
  }
  let rate = machineSpeed(s, b);
  if (def.power) {
    s.power.nextDemand += def.power;
    rate *= s.power.ratio;
    if (s.power.ratio <= 0) { b.status = 'nopower'; return; }
  }
  if (r.id === 'compost') rate *= biomeAt(s, b.x, b.y)?.compost ?? 1;
  b.status = 'working';
  b.progress += dt * rate;
  if (b.progress >= r.time) {
    b.working = false;
    b.progress = 0;
    finishRecipe(s, b, r, (item, n) => addTo(b.outBuf, item, n));
  }
}

function tickGenerator(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  const p = def.produces!;
  if (p.nightOnly && !isNight(s)) { b.status = 'night'; return; }
  if ((b.outBuf[p.item] ?? 0) >= bufCap(def, b, 10)) { b.status = 'blocked'; return; }
  let rate = machineSpeed(s, b);
  const w = weatherNow(s);
  if (p.item === 'dew') rate *= w.dew * (biomeAt(s, b.x, b.y)?.dew ?? 1);
  else if (p.item === 'mist') rate *= w.mist;
  else if (p.item === 'stardust') rate *= w.stardust;
  if (def.power) {
    s.power.nextDemand += def.power;
    rate *= s.power.ratio;
    if (s.power.ratio <= 0) { b.status = 'nopower'; return; }
  }
  if (p.item === 'mist') rate *= 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(s.time / 37 + b.x * 0.7 + b.y * 1.3));
  b.status = 'working';
  b.progress += dt * rate;
  if (b.progress >= p.every) {
    b.progress -= p.every;
    addTo(b.outBuf, p.item, 1);
    b.cycles++;
    s.events.push({ type: 'cycle', id: b.id });
  }
}

function isTree(t: Building | undefined): boolean {
  return !!t && BUILDINGS[t.type].kind === 'tree';
}

export function harvestTree(s: GameState, t: Building, sink: (item: ItemId, n: number) => number): Stack {
  const elder = t.type === 'elder_tree';
  const got: Stack = {};
  if (t.stock < 1) return got;
  t.stock -= 1;
  const fruit = FRUIT_BY_TREE[t.type];
  if (fruit) {
    const y: Stack = { ...fruit.yield };
    // bees nearby pollinate: one more fruit
    if (hivesNear(s, t) > 0) y[fruit.fruit] = (y[fruit.fruit] ?? 0) + 1;
    for (const k in y) {
      const n = sink(k as ItemId, y[k as ItemId] ?? 0);
      if (n) got[k as ItemId] = n;
    }
    s.stats.harvests++;
    if (rand(s) < fruit.saplingChance && sink(fruit.seed, 1)) got[fruit.seed] = 1;
    return got;
  }
  const bio = biomeAt(s, t.x, t.y) ?? BIOMES.meadow;
  const y = elder ? TREE.elderYield : bio.tree;
  for (const k in y) {
    const item = k as ItemId;
    const n = sink(item, y[item] ?? 0);
    if (n) got[item] = n;
  }
  s.stats.harvests++;
  s.stats.sincePity++;
  if (!elder) {
    if (rand(s) < bio.treeFiber && sink('fiber', 1)) got.fiber = 1;
    if (rand(s) < TREE.saplingChance || s.stats.sincePity >= TREE.saplingPity) {
      s.stats.sincePity = 0;
      if (sink('sapling', 1)) got.sapling = 1;
    }
  } else if (rand(s) < TREE.amberChance) {
    if (sink('amber', 1)) got.amber = 1;
  }
  return got;
}

function tickHarvester(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  const full = stackTotal(b.outBuf) >= bufCap(def, b, 24) - 3;
  if (full) { b.status = 'blocked'; return; }
  b.timer += dt * machineSpeed(s, b);
  const ready: Building[] = [];
  let any = false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const t = buildingAt(s, b.x + dx, b.y + dy);
    if (!t) continue;
    if (isTree(t)) { any = true; if (t.stock >= 1 && !ready.includes(t)) ready.push(t); }
    else if (t.type === 'tuft') { any = true; ready.push(t); }
  }
  if (!any) { b.status = 'noinput'; b.timer = 0; return; }
  b.status = ready.length ? 'working' : 'noinput';
  if (b.timer < HARVESTER_INTERVAL) return;
  if (!ready.length) { b.timer = HARVESTER_INTERVAL; return; }
  b.timer = 0;
  const t = ready[b.rr++ % ready.length];
  if (t.type === 'tuft') {
    addTo(b.outBuf, 'fiber', tuftYield(s, t.x, t.y));
    removeBuildingRaw(s, t);
  } else harvestTree(s, t, (item, n) => { addTo(b.outBuf, item, n); return n; });
  b.cycles++;
  s.events.push({ type: 'cycle', id: b.id });
}

function tickDrill(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  let node: Building | undefined;
  for (let d = 0; d < 4 && !node; d++) {
    const t = buildingAt(s, b.x + DX[d], b.y + DY[d]);
    if (t && BUILDINGS[t.type].kind === 'node') node = t;
  }
  if (!node) { b.status = 'noinput'; return; }
  if (stackTotal(b.outBuf) >= bufCap(def, b, 16)) { b.status = 'blocked'; return; }
  s.power.nextDemand += def.power ?? 0;
  if (s.power.ratio <= 0) { b.status = 'nopower'; return; }
  b.status = 'working';
  const y = NODE_YIELD[node.type];
  b.progress += dt * machineSpeed(s, b) * s.power.ratio;
  if (b.progress >= y.every) {
    b.progress -= y.every;
    const total = y.table.reduce((a, e) => a + e.weight, 0);
    let roll = rand(s) * total;
    for (const e of y.table) {
      roll -= e.weight;
      if (roll <= 0) { addTo(b.outBuf, e.item, 1); break; }
    }
    b.cycles++;
    s.events.push({ type: 'cycle', id: b.id });
  }
}

function tickDispatcher(s: GameState, b: Building, dt: number): void {
  if (!b.filter) { b.status = 'idle'; return; }
  b.timer -= dt;
  if (b.timer > 0) return;
  b.timer = DISPATCH_INTERVAL;
  if (s.stash[b.filter] < 1) { b.status = 'noinput'; return; }
  const t = frontOf(s, b);
  if (t && offer(s, t, b.filter, b.dir)) {
    s.stash[b.filter]--;
    addTo(s.flow.cur.out, b.filter, 1);
    b.status = 'working';
    b.cycles++;
  } else b.status = 'blocked';
}

function tickRouter(s: GameState, b: Building): void {
  if (!b.hold) { b.status = 'idle'; return; }
  const def = BUILDINGS[b.type];
  const left = ((b.dir + 3) % 4) as Dir;
  const right = ((b.dir + 1) % 4) as Dir;
  let dirs: Dir[];
  if (def.kind === 'sorter') dirs = b.filter && b.hold === b.filter ? [b.dir] : [left, right];
  else dirs = [left, b.dir, right];
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[(b.rr + i) % dirs.length];
    const t = buildingAt(s, b.x + DX[d], b.y + DY[d]);
    if (t && offer(s, t, b.hold, d)) {
      b.hold = null;
      if (dirs.length > 1) b.rr = (b.rr + i + 1) % dirs.length;
      b.status = 'working';
      b.cycles++;
      return;
    }
  }
  b.status = 'blocked';
}

function tickBelt(s: GameState, b: Building, dt: number): void {
  const speed = BUILDINGS[b.type].speed ?? 1.25;
  const items = b.items;
  if (!items.length) return;
  if (items.length > 1) items.sort((a, c) => c.pos - a.pos);
  const step = speed * dt;
  let limit = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    it.prev = it.pos;
    let np = Math.min(it.pos + step, limit);
    if (i === 0 && np >= 1) {
      const t = buildingAt(s, b.x + DX[b.dir], b.y + DY[b.dir]);
      if (t && offer(s, t, it.item, b.dir)) {
        items.splice(0, 1);
        i--;
        limit = Infinity;
        continue;
      }
      np = 1;
    }
    if (np < it.pos) np = it.pos;
    it.pos = np;
    limit = it.pos - BELT_GAP;
  }
}

function tickEngine(s: GameState, b: Building, dt: number, needed: boolean): number {
  const def = BUILDINGS[b.type];
  if (!needed) { b.status = (b.inBuf.aether ?? 0) > 0 || b.timer > 0 ? 'idle' : 'noinput'; return 0; }
  if (b.timer <= 0) {
    if ((b.inBuf.aether ?? 0) < 1) { b.status = 'noinput'; return 0; }
    addTo(b.inBuf, 'aether', -1);
    b.timer = 10;
  }
  b.timer -= dt;
  b.status = 'working';
  return (def.powerGen ?? 50) * (1 + 0.15 * attuneRank(s, 'tailwind'));
}

// ───────────────────────────────── wisps ─────────────────────────────────

function wispStep(s: GameState, dt: number): void {
  const speed = WISP_SPEED * (1 + 0.2 * attuneRank(s, 'wispsong')) * dt;
  for (const w of s.wisps) {
    w.px = w.x;
    w.py = w.y;
    const roost = s.buildings.get(w.roost);
    if (!roost) continue;
    const powered = s.power.ratio > 0;
    if (w.phase === 'rest') {
      if (!powered || roost.status === 'nopower') continue;
      if (findWispJob(s, w, roost)) w.phase = 'out';
      continue;
    }
    const target = w.phase === 'out' ? s.buildings.get(w.target) : roost;
    if (!target) { abortWisp(s, w); continue; }
    const dx = target.x - w.x;
    const dy = target.y - w.y;
    const d = Math.hypot(dx, dy);
    if (d > speed) {
      w.x += (dx / d) * speed;
      w.y += (dy / d) * speed;
      continue;
    }
    w.x = target.x;
    w.y = target.y;
    if (w.phase === 'out') {
      target.claimed = Math.max(0, target.claimed - 1);
      if (w.job === 'collect') {
        // pick up the most plentiful output
        let best: ItemId | null = null;
        for (const k in target.outBuf) if (!best || (target.outBuf[k as ItemId] ?? 0) > (target.outBuf[best] ?? 0)) best = k as ItemId;
        if (best) {
          const n = Math.min(WISP_LOAD, target.outBuf[best] ?? 0);
          addTo(target.outBuf, best, -n);
          w.carry = best;
          w.n = n;
        }
      } else if (w.job === 'deliver' && w.carry) {
        let left = w.n;
        while (left > 0 && offer(s, target, w.carry, 0)) left--;
        if (left > 0) s.stash[w.carry] += left;
        w.carry = null;
        w.n = 0;
      }
      w.phase = 'back';
    } else {
      if (w.carry && w.n > 0) {
        const fit = stashAdd(s, w.carry, w.n);
        addTo(s.flow.cur.inn, w.carry, fit);
        if (fit < w.n) {
          // stash full: return what does not fit to the floor (lost would violate conservation) — keep carrying
          w.n -= fit;
          w.phase = 'rest';
          continue;
        }
        s.events.push({ type: 'deliver', id: roost.id, item: w.carry });
      }
      w.carry = null;
      w.n = 0;
      w.phase = 'rest';
      w.job = null;
    }
  }
}

function abortWisp(s: GameState, w: (typeof s.wisps)[number]): void {
  if (w.carry && w.n) s.stash[w.carry] += w.n;
  w.carry = null;
  w.n = 0;
  w.phase = 'back';
  w.job = null;
  const roost = s.buildings.get(w.roost);
  if (!roost) w.phase = 'rest';
}

function findWispJob(s: GameState, w: (typeof s.wisps)[number], roost: Building): boolean {
  if (w.carry && w.n) {
    // still holding items the stash could not take
    const fit = stashAdd(s, w.carry, w.n);
    w.n -= fit;
    if (w.n > 0) return false;
    w.carry = null;
  }
  const targets = s.cache.roostTargets.get(roost.id) ?? [];
  const n = targets.length;
  if (!n) return false;
  const start = Math.floor(rand(s) * n);
  // 1) collect outputs
  for (let i = 0; i < n; i++) {
    const m = s.buildings.get(targets[(start + i) % n]);
    if (!m || m.claimed > 0) continue;
    const out = stackTotal(m.outBuf);
    if (out >= 1) {
      const front = frontOf(s, m);
      if (front && BUILDINGS[front.type].kind !== 'node' && out < 4) continue; // let conveyors handle it
      w.target = m.id;
      w.job = 'collect';
      m.claimed++;
      return true;
    }
  }
  // 2) deliver missing inputs
  for (let i = 0; i < n; i++) {
    const m = s.buildings.get(targets[(start + i) % n]);
    if (!m || m.claimed > 0) continue;
    const def = BUILDINGS[m.type];
    let want: ItemId | null = null;
    let qty = 0;
    if (def.kind === 'engine') {
      if ((m.inBuf.aether ?? 0) < 4 && s.stash.aether > 0) { want = 'aether'; qty = Math.min(WISP_LOAD, s.stash.aether); }
    } else if (def.kind === 'crafter') {
      const r = currentRecipe(m);
      if (!r) continue;
      for (const k in r.inputs) {
        const item = k as ItemId;
        const need = (r.inputs[item] ?? 0) * 2 - (m.inBuf[item] ?? 0);
        if (need > 0 && s.stash[item] > 0) { want = item; qty = Math.min(WISP_LOAD, need, s.stash[item]); break; }
      }
      if (!want && r.fuel && m.fuel < 4 && s.stash.charcoal > 0) { want = 'charcoal'; qty = Math.min(2, s.stash.charcoal); }
    }
    if (want && qty > 0) {
      s.stash[want] -= qty;
      addTo(s.flow.cur.out, want, qty);
      w.carry = want;
      w.n = qty;
      w.target = m.id;
      w.job = 'deliver';
      m.claimed++;
      return true;
    }
  }
  return false;
}

// ───────────────────────────────── nature ─────────────────────────────────

function tickNature(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  if (def.kind === 'tree') {
    const elder = b.type === 'elder_tree', fruit = FRUIT_BY_TREE[b.type];
    const max = elder ? TREE.elderMaxStock : fruit ? fruit.maxStock : TREE.maxStock;
    if (b.stock < max) {
      const bio = biomeAt(s, b.x, b.y) ?? BIOMES.meadow;
      const home = !fruit || fruit.home === bio.id ? 1 : OFF_HOME;
      b.timer += dt * weatherNow(s).regrow * bio.regrow * home;
      const per = elder ? TREE.elderRegrow : fruit ? fruit.regrow : TREE.regrow;
      if (b.timer >= per) { b.timer -= per; b.stock++; }
      b.status = 'working';
    } else { b.timer = 0; b.status = 'ready'; }
  } else if (def.kind === 'sapling') {
    b.progress += dt;
    b.status = 'working';
    if (b.progress >= TREE.saplingGrowTime) {
      b.type = def.growsInto ?? 'tree';
      b.stock = 2;
      b.progress = 0;
      b.timer = 0;
      s.topoDirty = true;
      s.events.push({ type: 'grown', x: b.x, y: b.y });
    }
  }
}

// ───────────────────────────────── bees ─────────────────────────────────

function treesNear(s: GameState, b: Building): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isTree(buildingAt(s, b.x + dx, b.y + dy))) n++;
  return n;
}
function hivesNear(s: GameState, b: Building): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = (dx || dy) ? buildingAt(s, b.x + dx, b.y + dy) : undefined;
    if (t && BUILDINGS[t.type].kind === 'hive') n++;
  }
  return n;
}

function tickHive(s: GameState, b: Building, dt: number): void {
  const def = BUILDINGS[b.type];
  const trees = Math.min(HIVE.maxTrees, treesNear(s, b));
  if (!trees) { b.status = 'noinput'; return; }
  if (stackTotal(b.outBuf) >= bufCap(def, b)) { b.status = 'blocked'; return; }
  b.status = 'working';
  b.progress += dt * machineSpeed(s, b) * (1 + HIVE.perTree * trees) * (biomeAt(s, b.x, b.y)?.hive ?? 1);
  const every = def.produces?.every ?? 15;
  if (b.progress >= every) {
    b.progress -= every;
    addTo(b.outBuf, 'honey', 1);
    if (rand(s) < HIVE.waxChance) addTo(b.outBuf, 'wax', 1);
    b.cycles++;
    s.events.push({ type: 'cycle', id: b.id });
  }
}

// ───────────────────────────────── trade ─────────────────────────────────

/** A belt or wisp offers an item to a trading post: accepted if a contract wants it. */
function contractAccept(s: GameState, item: ItemId): boolean {
  const tr = s.trade;
  for (let i = 0; i < tr.board.length; i++) {
    const c = tr.board[i];
    if (!c || c.item !== item || c.got >= c.n) continue;
    c.got++;
    s.stats.delivered++;
    if (c.got >= c.n) completeContract(s, i);
    return true;
  }
  return false;
}

/** Pay out a finished contract and schedule its replacement. */
export function completeContract(s: GameState, i: number): void {
  const tr = s.trade;
  const c = tr.board[i];
  if (!c) return;
  tr.marks += c.marks;
  tr.earned += c.marks;
  tr.rep += c.marks;
  tr.done++;
  s.events.push({ type: 'contract', item: c.item, marks: c.marks });
  while (tr.rep >= repForLevel(tr.level)) {
    tr.rep -= repForLevel(tr.level);
    tr.level++;
    s.events.push({ type: 'trade_level', level: tr.level });
  }
  tr.board[i] = null;
  tr.refresh[i] = CONTRACT_REFRESH;
}

/** Fill empty board slots whose refresh time has passed. */
export function fillBoard(s: GameState, force = false, avoidAlso: ItemId[] = []): void {
  const tr = s.trade;
  const pool = contractPool(s.stats.obtained);
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (tr.board[i] || (!force && tr.refresh[i] > 0)) continue;
    const avoid = [...avoidAlso, ...tr.board.filter((c): c is NonNullable<typeof c> => !!c).map((c) => c.item)];
    tr.board[i] = makeContract(pool, tr.level, rand(s), rand(s), avoid);
    tr.refresh[i] = 0;
  }
}

function tickTrade(s: GameState, dt: number, hasPost: boolean): void {
  const tr = s.trade;
  if (tr.skipCd > 0) tr.skipCd = Math.max(0, tr.skipCd - dt);
  if (!hasPost) return;
  for (let i = 0; i < BOARD_SIZE; i++) if (tr.refresh[i] > 0) tr.refresh[i] = Math.max(0, tr.refresh[i] - dt);
  if (tr.board.some((c) => !c)) fillBoard(s);
}

function spawnTufts(s: GameState, dt: number): void {
  if (!s.known.has('land')) return;
  s.tuftTimer += dt;
  if (s.tuftTimer < TUFT.every) return;
  s.tuftTimer = 0;
  let tufts = 0;
  const free: number[] = [];
  for (const [k, t] of s.tiles) {
    if (t.floor !== 'grass') continue;
    const id = s.occ.get(k);
    if (id === undefined) free.push(k);
    else if (s.buildings.get(id)!.type === 'tuft') tufts++;
  }
  if (tufts >= Math.max(1, Math.floor((free.length + tufts) / 5)) || !free.length) return;
  const k = free[Math.floor(rand(s) * free.length)];
  const t = s.tiles.get(k)!;
  addBuilding(s, 'tuft', t.x, t.y, 0);
}

// ───────────────────────────────── islets ─────────────────────────────────

export function tickSummon(s: GameState, dt: number): void {
  const sm = s.islets.summon;
  if (!sm) return;
  sm.t -= dt;
  if (sm.t > 0) return;
  s.islets.summon = null;
  const beacon = s.buildings.get(sm.beacon);
  const def = ISLETS[sm.index];
  if (!def) return;
  const bx = beacon ? beacon.x : 0;
  const by = beacon ? beacon.y : 0;
  const spot = findIsletSpot(s, def.layout, bx, by);
  if (!spot) {
    // nowhere to dock: refund the attempt by keeping the index unchanged
    s.events.push({ type: 'islet_docked', name: '', x: bx, y: by });
    return;
  }
  stampIslet(s, sm.index, spot[0], spot[1]);
  s.islets.docked = Math.max(s.islets.docked, sm.index + 1);
  s.flags.add('islet_docked');
  s.events.push({ type: 'islet_docked', name: def.name, x: spot[0] + 1, y: spot[1] + 1 });
}

export function stampIslet(s: GameState, index: number, ox: number, oy: number): void {
  const def = ISLETS[index];
  def.layout.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === '.') return;
      const x = ox + rx;
      const y = oy + ry;
      addTile(s, x, y, def.floor, def.id);
      if (ch === 'N' && def.node) addBuilding(s, def.node, x, y, 0);
      if (ch === 'T') { const t = addBuilding(s, 'elder_tree', x, y, 0); t.stock = 10; }
      if (ch === 't') { const t = addBuilding(s, 'tree', x, y, 0); t.stock = 3; }
    });
  });
}

export function findIsletSpot(s: GameState, layout: string[], bx: number, by: number): [number, number] | null {
  const cells: [number, number][] = [];
  layout.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') cells.push([rx, ry]); }));
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let oy = by - 8; oy <= by + 8; oy++) {
    for (let ox = bx - 8; ox <= bx + 8; ox++) {
      let ok = true;
      let touches = false;
      for (const [cx, cy] of cells) {
        const x = ox + cx;
        const y = oy + cy;
        if (s.tiles.has(key(x, y))) { ok = false; break; }
        for (let d = 0; d < 4; d++) if (s.tiles.has(key(x + DX[d], y + DY[d]))) touches = true;
      }
      if (!ok || !touches) continue;
      const dd = Math.hypot(ox + 1.5 - bx, oy + 1.5 - by);
      if (dd < bestD) { bestD = dd; best = [ox, oy]; }
    }
  }
  return best;
}

// ───────────────────────────────── tick ─────────────────────────────────

export function windFactor(t: number): number {
  return 0.85 + 0.22 * Math.sin(t / 97) + 0.1 * Math.sin(t / 23 + 1.3);
}

export function tick(s: GameState, dt = TICK): void {
  if (s.topoDirty) rebuildCache(s);
  s.time += dt;
  s.stats.playSeconds += dt;

  // Power: generation from wind; demand measured last tick. Engines cover any shortfall.
  const wind = windFactor(s.time) * weatherNow(s).wind;
  s.power.wind = wind;
  let windGen = 0;
  const engines: Building[] = [];
  for (const b of s.cache.machines) {
    const def = BUILDINGS[b.type];
    if (def.kind === 'windmill') {
      const edge = s.cache.edge.has(key(b.x, b.y)) ? 1.25 : 1;
      windGen += (def.powerGen ?? 6) * wind * edge * (1 + 0.15 * attuneRank(s, 'tailwind')) * levelSpeed(b.level) * (biomeAt(s, b.x, b.y)?.wind ?? 1);
      b.status = 'working';
    } else if (def.kind === 'engine') engines.push(b);
  }
  let gen = windGen;
  let shortfall = s.power.demand - windGen;
  for (const e of engines) {
    const g = tickEngine(s, e, dt, shortfall > 0);
    gen += g;
    shortfall -= g;
  }
  s.power.gen = gen;
  s.power.ratio = s.power.demand <= 0 ? (gen > 0 ? 1 : 0) : Math.min(1, gen / s.power.demand);
  if (s.power.demand <= 0) s.power.ratio = gen > 0 ? 1 : 0;
  s.power.nextDemand = 0;

  let hasPost = false;
  for (const b of s.cache.machines) {
    const def = BUILDINGS[b.type];
    switch (def.kind) {
      case 'crafter': tickCrafter(s, b, dt); pushOutput(s, b, dt); break;
      case 'generator': tickGenerator(s, b, dt); pushOutput(s, b, dt); break;
      case 'harvester': tickHarvester(s, b, dt); pushOutput(s, b, dt); break;
      case 'drill': tickDrill(s, b, dt); pushOutput(s, b, dt); break;
      case 'dispatcher': tickDispatcher(s, b, dt); break;
      case 'splitter': case 'sorter': tickRouter(s, b); break;
      case 'tree': case 'sapling': tickNature(s, b, dt); break;
      case 'hive': tickHive(s, b, dt); pushOutput(s, b, dt); break;
      case 'post': hasPost = true; b.status = s.trade.board.some((c) => c) ? 'working' : 'idle'; break;
      case 'roost':
        s.power.nextDemand += def.power ?? 0;
        b.status = s.power.ratio > 0 ? 'working' : 'nopower';
        break;
      default: break;
    }
  }
  if (s.topoDirty) rebuildCache(s); // saplings may have grown
  for (const b of s.cache.beltOrder) tickBelt(s, b, dt);
  if (s.wisps.length) wispStep(s, dt);
  // If nothing needs power this tick, keep ratio meaningful for the HUD.
  s.power.demand = s.power.nextDemand;

  spawnTufts(s, dt);
  tickSummon(s, dt);
  tickTrade(s, dt, hasPost);

  const f = s.flow.cur;
  f.dt += dt;
  if (f.dt >= FLOW_BUCKET) {
    s.flow.hist.push(f);
    if (s.flow.hist.length > FLOW_HISTORY) s.flow.hist.shift();
    s.flow.cur = { dt: 0, inn: {}, out: {} };
  }

  // Discoveries once per simulated second (cheap, and deterministic).
  if (Math.floor(s.time) !== Math.floor(s.time - dt)) checkDiscoveries(s);
}

export function run(s: GameState, seconds: number): void {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n; i++) tick(s, TICK);
}

/** Exposed for actions: remove a building and return its contents to the stash. */
export function salvage(s: GameState, b: Building): void {
  for (const k in b.inBuf) s.stash[k as ItemId] += b.inBuf[k as ItemId] ?? 0;
  for (const k in b.outBuf) s.stash[k as ItemId] += b.outBuf[k as ItemId] ?? 0;
  for (const it of b.items) s.stash[it.item] += 1;
  if (b.hold) s.stash[b.hold] += 1;
  if (b.working) {
    const r = currentRecipe(b);
    if (r) for (const k in r.inputs) s.stash[k as ItemId] += r.inputs[k as ItemId] ?? 0;
  }
  for (const w of s.wisps) if (w.roost === b.id && w.carry) s.stash[w.carry] += w.n;
  removeBuildingRaw(s, b);
}

export { tileAt };
