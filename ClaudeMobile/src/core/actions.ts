import { openRung } from './ambitions';
import { ambitionById } from './content/ambitions';
import type { Role } from './content/people';
import { assign, draft } from './people';
import { BUILDINGS } from './content/buildings';
import { FRUIT_BY_TREE } from './content/biomes';
import { ITEMS, type ItemId, type Stack } from './content/items';
import { FUEL_VALUE, RECIPES } from './content/recipes';
import { ATTUNE, ISLETS, LAND, START_TILES, SUMMON_TIME, clearRefund, landCost, summonCost } from './content/world';
import { buildingUnlocked, checkDiscoveries, landUnlocked, recipeUnlocked } from './progression';
import { bufCap, completeContract, rareChance, tuftYield, currentRecipe, defaultRecipe, fillBoard, forgeAccept, forgeNeeds, harvestTree, rebuildCache, salvage } from './sim';
import { LUCK, PERK, RESPEC_PER_POINT } from './content/renown';
import { BASIC_MAX_LEVEL, MARKET_BY_ID, MAX_LEVEL, SKIP_COOLDOWN, marketPrice, upgradable, upgradeCost } from './content/trade';
import {
  type Building, type Dir, type GameState, DX, DY, addBuilding, addTile, addTo, buildingAt, canAfford, key,
  pay, refund, room, stashAdd, tileAt, isEdgeTile, stackTotal, removeBuildingRaw, rand, made, perkRank,
} from './state';

export interface Result {
  ok: boolean;
  reason?: string;
  got?: Stack;
  /** Hand harvest: a triple (bountiful) harvest, and the current combo chain. */
  crit?: boolean;
  combo?: number;
}
const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

function sync(s: GameState): void {
  if (s.topoDirty) rebuildCache(s);
}

export function missing(s: GameState, cost: Stack): string {
  const parts: string[] = [];
  for (const k in cost) {
    const item = k as ItemId;
    const need = (cost[item] ?? 0) - s.stash[item];
    if (need > 0) parts.push(`${need} ${ITEMS[item].name}`);
  }
  return parts.length ? 'Need ' + parts.join(', ') : '';
}

// ───────────────────────── placement ─────────────────────────

export function canPlace(s: GameState, type: string, x: number, y: number, ignore?: Building, checkCost = true): Result {
  const def = BUILDINGS[type];
  if (!def) return fail('Unknown');
  if (!ignore && !buildingUnlocked(s, type)) return fail('Not discovered');
  let edge = false;
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) {
    const t = tileAt(s, x + dx, y + dy);
    if (!t) return fail('Needs ground');
    if (def.floors && !def.floors.includes(t.floor)) {
      return fail(def.floors.includes('grass') ? 'Needs grass' : 'Needs flagstone or skystone');
    }
    const o = buildingAt(s, x + dx, y + dy);
    if (o && o !== ignore && o.type !== 'tuft') return fail('Occupied');
    if (isEdgeTile(s, x + dx, y + dy)) edge = true;
  }
  if (def.edge && !edge) return fail('Must touch the edge');
  if (def.nearNode) {
    let near = false;
    for (let d = 0; d < 4; d++) {
      const n = buildingAt(s, x + DX[d], y + DY[d]);
      if (n && BUILDINGS[n.type].kind === 'node') near = true;
    }
    if (!near) return fail('Place beside an islet heart');
  }
  if (def.kind === 'forge' && !ignore && [...s.buildings.values()].some((b) => b.type === 'forge')) return fail('Only one');
  if (checkCost && !ignore && !canAfford(s, def.cost)) return fail(missing(s, def.cost));
  return OK;
}

function clearTufts(s: GameState, type: string, x: number, y: number): void {
  const size = BUILDINGS[type].size;
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
    const o = buildingAt(s, x + dx, y + dy);
    if (o && o.type === 'tuft') {
      stashAdd(s, 'fiber', tuftYield(s, o.x, o.y));
      removeBuildingRaw(s, o);
    }
  }
}

export function place(s: GameState, type: string, x: number, y: number, dir: Dir = 0): Result & { id?: number } {
  const r = canPlace(s, type, x, y);
  if (!r.ok) return r;
  const def = BUILDINGS[type];
  pay(s, def.cost);
  clearTufts(s, type, x, y);
  const b = addBuilding(s, type, x, y, def.rotatable ? dir : 0);
  b.recipe = defaultRecipe(type);
  if (type === 'sapling') b.progress = 0;
  if (def.kind === 'forge') {
    s.forge.id = b.id;
    s.forge.stage = 0;
    s.forge.progress = {};
  }
  s.stats.built++;
  sync(s);
  checkDiscoveries(s);
  return { ok: true, id: b.id };
}

/** Lay a run of conveyors; each segment points toward the next. */
export function placeLine(s: GameState, type: string, cells: { x: number; y: number; dir: Dir }[]): number {
  let n = 0;
  for (const c of cells) {
    const existing = buildingAt(s, c.x, c.y);
    if (existing && existing.type === type) {
      if (existing.dir !== c.dir) { existing.dir = c.dir; s.topoDirty = true; }
      continue;
    }
    if (place(s, type, c.x, c.y, c.dir).ok) n++;
    else if (!canAfford(s, BUILDINGS[type].cost)) break;
  }
  sync(s);
  return n;
}

export function removeAt(s: GameState, x: number, y: number): Result {
  const b = buildingAt(s, x, y);
  if (!b) return fail('Nothing here');
  return remove(s, b.id);
}

export function remove(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('Nothing here');
  const def = BUILDINGS[b.type];
  if (def.removable === false) return fail('It will not move');
  if (b.type === 'tuft') return harvestAt(s, b.x, b.y);
  salvage(s, b);
  if (def.kind === 'tree') refund(s, { [FRUIT_BY_TREE[b.type]?.seed ?? 'sapling']: 1 }); // the sapling back, nothing more
  else refund(s, def.cost);
  // half of what went into upgrades comes back too
  if (b.level > 1) {
    const back: Stack = {};
    for (let lv = 2; lv <= b.level; lv++) {
      const c = upgradeCost(def, lv).items;
      for (const k in c) back[k as ItemId] = (back[k as ItemId] ?? 0) + Math.floor((c[k as ItemId] ?? 0) / 2);
    }
    refund(s, back);
  }
  sync(s);
  return OK;
}

export function move(s: GameState, id: number, x: number, y: number, dir?: Dir): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('Nothing here');
  const def = BUILDINGS[b.type];
  if (def.removable === false || def.kind === 'tree') return fail('It will not move');
  const r = canPlace(s, b.type, x, y, b);
  if (!r.ok) return r;
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) s.occ.delete(key(b.x + dx, b.y + dy));
  clearTufts(s, b.type, x, y);
  b.x = x;
  b.y = y;
  if (dir !== undefined && def.rotatable) b.dir = dir;
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) s.occ.set(key(x + dx, y + dy), b.id);
  b.items = b.items.filter((it) => { s.stash[it.item]++; return false; });
  s.topoDirty = true;
  sync(s);
  return OK;
}

export function rotate(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b || !BUILDINGS[b.type].rotatable) return fail('Cannot rotate');
  b.dir = ((b.dir + 1) % 4) as Dir;
  s.topoDirty = true;
  sync(s);
  return OK;
}

// ───────────────────────── land ─────────────────────────

/** Would the island still be one piece without the tile at (x, y)? */
function staysWhole(s: GameState, x: number, y: number): boolean {
  const gone = key(x, y);
  let start: number | null = null;
  for (let d = 0; d < 4 && start === null; d++) { const k = key(x + DX[d], y + DY[d]); if (s.tiles.has(k)) start = k; }
  if (start === null) return s.tiles.size <= 1;
  const seen = new Set<number>([gone, start]);
  const stack = [start];
  while (stack.length) {
    const t = s.tiles.get(stack.pop()!)!;
    for (let d = 0; d < 4; d++) {
      const k = key(t.x + DX[d], t.y + DY[d]);
      if (!seen.has(k) && s.tiles.has(k)) { seen.add(k); stack.push(k); }
    }
  }
  return seen.size === s.tiles.size;
}

export function canExpand(s: GameState, land: string, x: number, y: number, checkCost = true): Result {
  const def = LAND[land];
  if (!def || !landUnlocked(s, land)) return fail('Not discovered');
  const t = tileAt(s, x, y);
  if (def.mode === 'clear') {
    if (!t) return fail('No ground here');
    const o = buildingAt(s, x, y);
    if (o && o.type !== 'tuft') return fail('Clear it first');
    if (s.tiles.size <= START_TILES) return fail('The island cannot get smaller');
    if (!staysWhole(s, x, y)) return fail('The island must stay in one piece');
    return OK;
  }
  if (def.mode === 'new') {
    if (t) return fail('Already ground');
    let adj = false;
    for (let d = 0; d < 4; d++) if (s.tiles.has(key(x + DX[d], y + DY[d]))) adj = true;
    if (!adj) return fail('Must join the island');
  } else if (def.biome) {
    if (!t) return fail('Needs ground');
    if (t.floor !== 'grass') return fail('Needs grass');
    if ((t.biome ?? 'meadow') === def.biome) return fail(`Already ${def.name.toLowerCase()}`);
  } else {
    if (!t) return fail('Needs ground');
    if (t.floor !== 'grass') return fail('Already paved');
    const o = buildingAt(s, x, y);
    if (o && o.type !== 'tuft' && BUILDINGS[o.type].floors?.includes('grass')) return fail('Clear it first');
  }
  const cost = landCost(land, s.tiles.size);
  if (checkCost && !canAfford(s, cost)) return fail(missing(s, cost));
  return OK;
}

export function expand(s: GameState, land: string, x: number, y: number): Result {
  const r = canExpand(s, land, x, y);
  if (!r.ok) return r;
  const def = LAND[land];
  pay(s, landCost(land, s.tiles.size));
  if (def.mode === 'clear') {
    const t = tileAt(s, x, y)!;
    const o = buildingAt(s, x, y);
    if (o) { stashAdd(s, 'fiber', tuftYield(s, o.x, o.y)); removeBuildingRaw(s, o); }
    refund(s, clearRefund(t.floor, s.tiles.size));
    s.tiles.delete(key(x, y));
    s.topoDirty = true;
    s.tileRev++;
  } else if (def.mode === 'new') addTile(s, x, y, def.floor);
  else if (def.biome) {
    const t = tileAt(s, x, y)!;
    if (def.biome === 'meadow') delete t.biome; else t.biome = def.biome;
    s.topoDirty = true;
    s.tileRev++;
  } else {
    const o = buildingAt(s, x, y);
    if (o && o.type === 'tuft') { stashAdd(s, 'fiber', tuftYield(s, o.x, o.y)); removeBuildingRaw(s, o); }
    tileAt(s, x, y)!.floor = def.floor;
    s.topoDirty = true;
    s.tileRev++;
  }
  sync(s);
  checkDiscoveries(s);
  return OK;
}

// ───────────────────────── hands ─────────────────────────

/** Tap on the world: gather from trees and tufts. */
export function harvestAt(s: GameState, x: number, y: number): Result {
  const b = buildingAt(s, x, y);
  if (!b) return fail('');
  if (b.type === 'tuft') {
    const n = stashAdd(s, 'fiber', tuftYield(s, b.x, b.y));
    made(s, 'fiber', n);
    removeBuildingRaw(s, b);
    sync(s);
    checkDiscoveries(s);
    return { ok: true, got: n ? { fiber: n } : {} };
  }
  if (BUILDINGS[b.type].kind !== 'tree') return fail('');
  if (b.stock < 1) return fail('Regrowing');
  const got = harvestTree(s, b, (item, n) => stashAdd(s, item, n));
  // gathering combo: quick taps chain; every 5th gives one more of the main item
  const c = s.combo;
  c.n = s.time - c.t <= LUCK.comboWindow ? c.n + 1 : 1;
  if (c.n > (s.stats.bestCombo ?? 0)) s.stats.bestCombo = c.n;
  c.t = s.time;
  const main = Object.keys(got).find((k) => k !== 'sapling' && k !== 'fiber' && !k.endsWith('_sapling')) as ItemId | undefined;
  let crit = false;
  if (main) {
    // bountiful: a triple harvest of everything ordinary
    if (rand(s) < LUCK.crit + LUCK.perCritPerk * perkRank(s, 'bountiful')) {
      crit = true;
      for (const k in got) {
        const item = k as ItemId;
        if (item === 'sapling' || item === 'fiber' || item.endsWith('_sapling')) continue;
        const extra = stashAdd(s, item, (got[item] ?? 0) * (LUCK.critMult - 1));
        made(s, item, extra);
        got[item] = (got[item] ?? 0) + extra;
      }
    }
    if (c.n % LUCK.comboEvery === 0) { const e = stashAdd(s, main, 1); made(s, main, e); got[main] = (got[main] ?? 0) + e; }
  }
  checkDiscoveries(s);
  return { ok: true, got, crit, combo: c.n };
}

export const SIEVE_TAPS = 3;

export function tapManual(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b || BUILDINGS[b.type].kind !== 'manual') return fail('');
  const r = RECIPES[b.recipe ?? 'sift_loam'];
  if (!b.working) {
    if (!canAfford(s, r.inputs)) return fail(missing(s, r.inputs));
    pay(s, r.inputs);
    b.working = true;
    b.progress = 0;
  }
  b.progress += r.time / SIEVE_TAPS + 1e-9;
  b.status = 'working';
  if (b.progress >= r.time) {
    b.working = false;
    b.progress = 0;
    b.cycles++;
    const got: Stack = {};
    for (const k in r.outputs) { const n = stashAdd(s, k as ItemId, r.outputs[k as ItemId] ?? 0); made(s, k as ItemId, n); if (n) got[k as ItemId] = n; }
    if (r.chance) for (const k in r.chance) {
      if (rand(s) < rareChance(s, k as ItemId, r.chance[k as ItemId] ?? 0) && stashAdd(s, k as ItemId, 1)) { got[k as ItemId] = 1; made(s, k as ItemId, 1); }
    }
    b.status = 'idle';
    checkDiscoveries(s);
    return { ok: true, got };
  }
  return OK;
}

export function hasWorkbench(s: GameState): boolean {
  for (const b of s.buildings.values()) if (b.type === 'workbench') return true;
  return false;
}

export function maxCraftable(s: GameState, recipe: string): number {
  const r = RECIPES[recipe];
  let n = Infinity;
  for (const k in r.inputs) n = Math.min(n, Math.floor(s.stash[k as ItemId] / (r.inputs[k as ItemId] ?? 1)));
  for (const k in r.outputs) n = Math.min(n, Math.floor(room(s, k as ItemId) / (r.outputs[k as ItemId] ?? 1)));
  return n === Infinity ? 0 : n;
}

export function craft(s: GameState, recipe: string, times = 1): Result {
  const r = RECIPES[recipe];
  if (!r || !r.stations.includes('hand')) return fail('Cannot craft by hand');
  if (!recipeUnlocked(s, recipe)) return fail('Not discovered');
  if (!hasWorkbench(s)) return fail('Build a workbench');
  const n = Math.min(times, maxCraftable(s, recipe));
  if (n < 1) {
    const m = missing(s, scale(r.inputs, 1));
    return fail(m || 'Stash is full');
  }
  pay(s, scale(r.inputs, n));
  for (const k in r.outputs) made(s, k as ItemId, stashAdd(s, k as ItemId, (r.outputs[k as ItemId] ?? 0) * n));
  s.stats.crafted += n;
  checkDiscoveries(s);
  return { ok: true, got: scale(r.outputs, n) };
}

export function scale(st: Stack, n: number): Stack {
  const o: Stack = {};
  for (const k in st) o[k as ItemId] = (st[k as ItemId] ?? 0) * n;
  return o;
}

// ───────────────────────── machine controls ─────────────────────────

export function setRecipe(s: GameState, id: number, recipe: string): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('');
  const r = RECIPES[recipe];
  if (!r || !r.stations.includes(b.type)) return fail('Wrong station');
  if (!recipeUnlocked(s, recipe)) return fail('Not discovered');
  if (b.recipe === recipe) return OK;
  for (const k in b.inBuf) s.stash[k as ItemId] += b.inBuf[k as ItemId] ?? 0;
  b.inBuf = {};
  if (b.working) {
    const cur = currentRecipe(b);
    if (cur) for (const k in cur.inputs) s.stash[k as ItemId] += cur.inputs[k as ItemId] ?? 0;
  }
  b.working = false;
  b.progress = 0;
  b.recipe = recipe;
  return OK;
}

export function setFilter(s: GameState, id: number, item: ItemId | null): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('');
  b.filter = item;
  if (b.filter2 === item) b.filter2 = null;
  return OK;
}

/** A dispatcher's second item (null clears it). Sorters keep a single filter. */
export function setFilter2(s: GameState, id: number, item: ItemId | null): Result {
  const b = s.buildings.get(id);
  if (!b || BUILDINGS[b.type].kind !== 'dispatcher') return fail('');
  b.filter2 = item === b.filter ? null : item;
  return OK;
}

/** Hand-feed a machine from the stash (before conveyors exist). */
export function load(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('');
  const def = BUILDINGS[b.type];
  let moved = 0;
  if (def.kind === 'engine') {
    const n = Math.min(s.stash.aether, (def.bufferCap ?? 10) - (b.inBuf.aether ?? 0));
    if (n > 0) { s.stash.aether -= n; addTo(b.inBuf, 'aether', n); addTo(s.flow.cur.out, 'aether', n); moved += n; }
    return moved ? OK : fail('Need Aether');
  }
  const r = currentRecipe(b);
  if (!r) return fail('');
  const cap = bufCap(def, b);
  for (const k in r.inputs) {
    const item = k as ItemId;
    const want = Math.max(cap, (r.inputs[item] ?? 0) * 2) - (b.inBuf[item] ?? 0);
    const n = Math.max(0, Math.min(want, s.stash[item]));
    if (n > 0) { s.stash[item] -= n; addTo(b.inBuf, item, n); addTo(s.flow.cur.out, item, n); moved += n; } // counted so time away doesn't replay hand-fed output for free
  }
  if (r.fuel) {
    for (const f of ['charcoal', 'wood'] as ItemId[]) {
      if (r.inputs[f]) continue;
      while (b.fuel < 12 && s.stash[f] > 0) { s.stash[f]--; addTo(s.flow.cur.out, f, 1); b.fuel += FUEL_VALUE[f] ?? 0; moved++; }
    }
  }
  return moved ? OK : fail(missing(s, r.inputs) || 'Already full');
}

export function collect(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('');
  const got: Stack = {};
  for (const k in b.outBuf) {
    const item = k as ItemId;
    const n = stashAdd(s, item, b.outBuf[item] ?? 0);
    if (n) { addTo(b.outBuf, item, -n); got[item] = n; }
  }
  checkDiscoveries(s);
  return stackTotal(got) ? { ok: true, got } : fail(stackTotal(b.outBuf) ? 'Stash is full' : 'Nothing yet');
}

// ───────────────────────── islets & forge ─────────────────────────

export function canSummon(s: GameState): Result {
  if (s.islets.summon) return fail('An islet is already on its way');
  if (s.islets.docked >= ISLETS.length) return fail('No more drifters answer');
  const cost = summonCost(s.islets.docked);
  if (!canAfford(s, cost)) return fail(missing(s, cost));
  return OK;
}

export function summon(s: GameState, beacon: number): Result {
  const r = canSummon(s);
  if (!r.ok) return r;
  pay(s, summonCost(s.islets.docked));
  s.islets.summon = { beacon, t: SUMMON_TIME, index: s.islets.docked };
  return OK;
}

export function contribute(s: GameState): Result {
  const need = forgeNeeds(s);
  let moved = 0;
  for (const k in need) {
    const item = k as ItemId;
    const n = Math.min(s.stash[item], need[item] ?? 0);
    if (n > 0) {
      s.stash[item] -= n;
      moved += forgeAccept(s, item, n);
    }
  }
  checkDiscoveries(s);
  return moved ? OK : fail('Nothing it needs is in your stash');
}

export function attune(s: GameState, id: string): Result {
  const a = ATTUNE[id];
  if (!a) return fail('');
  const rank = s.forge.attune[id] ?? 0;
  if (rank >= a.max) return fail('Fully attuned');
  const cost = a.cost(rank);
  if (s.forge.sparks < cost) return fail(`Need ${cost} sparks`);
  s.forge.sparks -= cost;
  s.forge.attune[id] = rank + 1;
  s.topoDirty = true;
  sync(s);
  return OK;
}

// ───────────────────────── trade ─────────────────────────

/** Fill a contract from the stash (as much as is there). */
export function handOver(s: GameState, slot: number): Result {
  const c = s.trade.board[slot];
  if (!c) return fail('');
  const n = Math.min(s.stash[c.item], c.n - c.got);
  if (n <= 0) return fail(`No ${ITEMS[c.item].name} in your stash`);
  s.stash[c.item] -= n;
  c.got += n;
  s.stats.delivered += n;
  if (c.got >= c.n) completeContract(s, slot);
  checkDiscoveries(s);
  return { ok: true, got: { [c.item]: n } };
}

/** Swap a contract for a new one (free, on a cooldown). Delivered goods are kept as Marks pro rata. */
export function skipContract(s: GameState, slot: number): Result {
  const tr = s.trade;
  const c = tr.board[slot];
  if (!c) return fail('');
  if (tr.skipCd > 0) return fail(`Traders need ${Math.ceil(tr.skipCd)} s`);
  const part = Math.floor((c.marks * c.got) / c.n);
  tr.marks += part;
  tr.earned += part;
  tr.board[slot] = null;
  tr.refresh[slot] = 0;
  tr.skipCd = SKIP_COOLDOWN;
  fillBoard(s, true, [c.item], slot);
  return OK;
}

/** Market price after the Bargains perk. */
export function priceOf(s: GameState, id: string): number {
  const m = MARKET_BY_ID[id];
  return Math.max(1, Math.round(marketPrice(m, s.trade.bought[id] ?? 0) * (1 - 0.05 * perkRank(s, 'bargains'))));
}

// ───────────────────────── renown & perks ─────────────────────────

export function canPerk(s: GameState, id: string): Result {
  const p = PERK[id];
  if (!p) return fail('');
  if ((s.renown.perks[id] ?? 0) >= p.max) return fail('Mastered');
  if (s.renown.points < 1) return fail('No perk points — earn renown');
  return OK;
}

export function takePerk(s: GameState, id: string): Result {
  const r = canPerk(s, id);
  if (!r.ok) return r;
  s.renown.points--;
  s.renown.perks[id] = (s.renown.perks[id] ?? 0) + 1;
  s.topoDirty = true; // capacity may change
  sync(s);
  return OK;
}

export function respecCost(s: GameState): number {
  return RESPEC_PER_POINT * Object.values(s.renown.perks).reduce((a, b) => a + b, 0);
}

/** Take back every perk point (costs Marks). */
export function respec(s: GameState): Result {
  const spent = Object.values(s.renown.perks).reduce((a, b) => a + b, 0);
  if (!spent) return fail('No perks taken');
  const cost = respecCost(s);
  if (s.trade.marks < cost) return fail(`Need ${cost} Marks`);
  s.trade.marks -= cost;
  s.renown.points += spent;
  s.renown.perks = {};
  s.topoDirty = true;
  sync(s);
  return OK;
}

export function marketVisible(s: GameState, id: string): boolean {
  const m = MARKET_BY_ID[id];
  if (!m) return false;
  if (m.needs && !s.known.has(m.needs)) return false;
  return !(m.once && (s.trade.bought[id] ?? 0) > 0);
}

export function buy(s: GameState, id: string): Result {
  const m = MARKET_BY_ID[id];
  if (!m || !marketVisible(s, id)) return fail('Not offered');
  const price = priceOf(s, id);
  if (s.trade.marks < price) return fail(`Need ${price - s.trade.marks} more Marks`);
  if (m.gives) for (const k in m.gives) if (room(s, k as ItemId) < (m.gives[k as ItemId] ?? 0)) return fail('Stash is full');
  s.trade.marks -= price;
  s.trade.bought[id] = (s.trade.bought[id] ?? 0) + 1;
  if (m.gives) for (const k in m.gives) stashAdd(s, k as ItemId, m.gives[k as ItemId] ?? 0);
  if (m.flag) s.flags.add(m.flag);
  checkDiscoveries(s);
  return { ok: true, got: m.gives };
}

// ───────────────────────── upgrades ─────────────────────────

export function maxLevel(s: GameState): number {
  return s.known.has('master') ? MAX_LEVEL : BASIC_MAX_LEVEL;
}

/** Can this machine be upgraded right now? (`ok` false with a reason otherwise.) */
export function canUpgrade(s: GameState, id: number): Result {
  const b = s.buildings.get(id);
  if (!b) return fail('');
  const def = BUILDINGS[b.type];
  if (!upgradable(def) || !s.known.has('tinker')) return fail('Cannot be upgraded');
  if (b.level >= MAX_LEVEL) return fail('Fully upgraded');
  if (b.level >= maxLevel(s)) return fail('Needs master tools');
  const c = upgradeCost(def, b.level + 1);
  if (s.trade.marks < c.marks) return fail(`Need ${c.marks - s.trade.marks} more Marks`);
  if (!canAfford(s, c.items)) return fail(missing(s, c.items));
  return OK;
}

export function upgrade(s: GameState, id: number): Result {
  const r = canUpgrade(s, id);
  if (!r.ok) return r;
  const b = s.buildings.get(id)!;
  const c = upgradeCost(BUILDINGS[b.type], b.level + 1);
  pay(s, c.items);
  s.trade.marks -= c.marks;
  b.level++;
  s.topoDirty = true; // a roost upgrade brings more wisps
  return OK;
}

export { canAfford } from './state';

// ───────────────────────── settlers, designs, ambitions ─────────────────────────

/** Move one settler into (delta 1) or out of (delta -1) a role. */
export function assignRole(s: GameState, role: Role, delta: 1 | -1): Result {
  if (!assign(s, role, delta)) return fail(delta > 0 ? 'Everyone already has a role' : 'Nobody in that role');
  return { ok: true };
}

/** Draft a design at the Drafting Table. */
export function draftDesign(s: GameState, id: string): Result {
  const why = draft(s, id);
  return why ? fail(why) : { ok: true };
}

/** Pin an ambition to the quest card (null unpins). */
export function pinAmbition(s: GameState, id: string | null): Result {
  const a = id === null ? null : ambitionById(id);
  if (id !== null && (!a || openRung(s, a.path).id !== id)) return fail('Not an open ambition');
  s.pinned = s.pinned === id ? null : id;
  return { ok: true };
}
