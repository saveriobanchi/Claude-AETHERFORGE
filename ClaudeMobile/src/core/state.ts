import { BUILDINGS, type Floor } from './content/buildings';
import { ITEM_IDS, type ItemId, type Stack } from './content/items';
import { ATTUNE, BASE_CAPACITY } from './content/world';

export type Dir = 0 | 1 | 2 | 3; // 0:+x 1:+y 2:-x 3:-y
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export type Status = 'idle' | 'working' | 'noinput' | 'blocked' | 'nopower' | 'night' | 'ready';

export interface Tile {
  x: number;
  y: number;
  floor: Floor;
  /** Deterministic per-tile seed for decoration variety. */
  seed: number;
  islet?: string;
}

export interface BeltItem {
  item: ItemId;
  pos: number;
  prev: number;
}

export interface Building {
  id: number;
  type: string;
  x: number;
  y: number;
  dir: Dir;
  recipe: string | null;
  progress: number;
  working: boolean;
  inBuf: Stack;
  outBuf: Stack;
  fuel: number;
  stock: number;
  timer: number;
  pushTimer: number;
  items: BeltItem[];
  hold: ItemId | null;
  filter: ItemId | null;
  rr: number;
  status: Status;
  /** Visual pulse counter incremented on each completed cycle. */
  cycles: number;
  claimed: number;
}

export interface Wisp {
  roost: number;
  x: number;
  y: number;
  px: number;
  py: number;
  target: number;
  phase: 'rest' | 'out' | 'back';
  job: 'collect' | 'deliver' | null;
  carry: ItemId | null;
  n: number;
}

export type SimEvent =
  | { type: 'harvest'; x: number; y: number; items: Stack }
  | { type: 'produce'; id: number; item: ItemId }
  | { type: 'cycle'; id: number }
  | { type: 'discovery'; id: string }
  | { type: 'stash_full'; item: ItemId }
  | { type: 'grown'; x: number; y: number }
  | { type: 'islet_docked'; name: string; x: number; y: number }
  | { type: 'forge_stage'; stage: number }
  | { type: 'resonance'; level: number }
  | { type: 'deliver'; id: number; item: ItemId }
  | { type: 'spill'; id: number; item: ItemId };

export interface FlowBucket {
  dt: number;
  inn: Stack;
  out: Stack;
}

export interface GameState {
  version: number;
  rng: number;
  time: number;
  tiles: Map<number, Tile>;
  buildings: Map<number, Building>;
  occ: Map<number, number>;
  stash: Record<ItemId, number>;
  stats: {
    obtained: Stack;
    delivered: number;
    harvests: number;
    sincePity: number;
    crafted: number;
    built: number;
    playSeconds: number;
    spilled: number;
  };
  known: Set<string>;
  flags: Set<string>;
  nextId: number;
  power: { gen: number; demand: number; ratio: number; wind: number; nextDemand: number };
  islets: { docked: number; summon: { beacon: number; t: number; index: number } | null };
  forge: { id: number; stage: number; progress: Stack; level: number; sparks: number; attune: Record<string, number>; request: Stack };
  wisps: Wisp[];
  flow: { cur: FlowBucket; hist: FlowBucket[] };
  tuftTimer: number;
  savedAt: number;
  /** Developer/test capacity bonus (not saved). */
  extraCapacity: number;
  // transient
  events: SimEvent[];
  topoDirty: boolean;
  cache: SimCache;
}

export interface SimCache {
  beltOrder: Building[];
  machines: Building[];
  boost: Map<number, number>;
  roostTargets: Map<number, number[]>;
  edge: Set<number>;
  capacity: number;
}

export function key(x: number, y: number): number {
  return (x + 2048) * 4096 + (y + 2048);
}
export function unkey(k: number): [number, number] {
  return [Math.floor(k / 4096) - 2048, (k % 4096) - 2048];
}

export function emptyStash(): Record<ItemId, number> {
  const s = {} as Record<ItemId, number>;
  for (const id of ITEM_IDS) s[id] = 0;
  return s;
}

export function newBuilding(id: number, type: string, x: number, y: number, dir: Dir = 0): Building {
  return {
    id, type, x, y, dir,
    recipe: null, progress: 0, working: false,
    inBuf: {}, outBuf: {}, fuel: 0, stock: 0, timer: 0, pushTimer: 0,
    items: [], hold: null, filter: null, rr: 0, status: 'idle', cycles: 0, claimed: 0,
  };
}

export function emptyCache(): SimCache {
  return { beltOrder: [], machines: [], boost: new Map(), roostTargets: new Map(), edge: new Set(), capacity: BASE_CAPACITY };
}

export function hashSeed(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A fresh world: a 3×3 seed of grass with a single tree. */
export function createState(seed = 1234567): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    time: 0,
    tiles: new Map(),
    buildings: new Map(),
    occ: new Map(),
    stash: emptyStash(),
    stats: { obtained: {}, delivered: 0, harvests: 0, sincePity: 0, crafted: 0, built: 0, playSeconds: 0, spilled: 0 },
    known: new Set(['start']),
    flags: new Set(),
    nextId: 1,
    power: { gen: 0, demand: 0, ratio: 1, wind: 1, nextDemand: 0 },
    islets: { docked: 0, summon: null },
    forge: { id: 0, stage: -1, progress: {}, level: 0, sparks: 0, attune: {}, request: {} },
    wisps: [],
    flow: { cur: { dt: 0, inn: {}, out: {} }, hist: [] },
    tuftTimer: 0,
    savedAt: 0,
    extraCapacity: 0,
    events: [],
    topoDirty: true,
    cache: emptyCache(),
  };
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) addTile(s, x, y, 'grass');
  const tree = addBuilding(s, 'tree', 0, 0, 0);
  tree.stock = 5;
  s.time = 0.2 * 600; // begin mid-morning
  return s;
}

export const SAVE_VERSION = 2;

export function addTile(s: GameState, x: number, y: number, floor: Floor, islet?: string): Tile {
  const t: Tile = { x, y, floor, seed: hashSeed(x, y), islet };
  s.tiles.set(key(x, y), t);
  s.topoDirty = true;
  return t;
}

export function addBuilding(s: GameState, type: string, x: number, y: number, dir: Dir): Building {
  const b = newBuilding(s.nextId++, type, x, y, dir);
  const def = BUILDINGS[type];
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) s.occ.set(key(x + dx, y + dy), b.id);
  s.buildings.set(b.id, b);
  s.topoDirty = true;
  return b;
}

export function removeBuildingRaw(s: GameState, b: Building): void {
  const def = BUILDINGS[b.type];
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) s.occ.delete(key(b.x + dx, b.y + dy));
  s.buildings.delete(b.id);
  s.topoDirty = true;
}

export function buildingAt(s: GameState, x: number, y: number): Building | undefined {
  const id = s.occ.get(key(x, y));
  return id === undefined ? undefined : s.buildings.get(id);
}

export function tileAt(s: GameState, x: number, y: number): Tile | undefined {
  return s.tiles.get(key(x, y));
}

export function isEdgeTile(s: GameState, x: number, y: number): boolean {
  for (let d = 0; d < 4; d++) if (!s.tiles.has(key(x + DX[d], y + DY[d]))) return true;
  return false;
}

// ── RNG (mulberry32, state lives in the save for determinism) ──
export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── Stash ──
export function attuneRank(s: GameState, id: string): number {
  return Math.min(s.forge.attune[id] ?? 0, ATTUNE[id]?.max ?? 0);
}

export function computeCapacity(s: GameState): number {
  let cap = BASE_CAPACITY;
  for (const b of s.buildings.values()) cap += BUILDINGS[b.type].capacity ?? 0;
  return Math.floor(cap * (1 + 0.25 * attuneRank(s, 'stores'))) + s.extraCapacity;
}

export function capacity(s: GameState): number {
  return s.cache.capacity;
}

export function room(s: GameState, item: ItemId): number {
  return Math.max(0, capacity(s) - s.stash[item]);
}

/** Adds up to n of item to the stash; returns how many fit. Counts toward discoveries. */
export function stashAdd(s: GameState, item: ItemId, n: number): number {
  const fit = Math.min(n, room(s, item));
  if (fit > 0) {
    s.stash[item] += fit;
    s.stats.obtained[item] = (s.stats.obtained[item] ?? 0) + fit;
  }
  if (fit < n && !s.flags.has('full_' + item)) {
    s.flags.add('full_' + item);
    s.flags.add('stash_full');
    s.events.push({ type: 'stash_full', item });
  } else if (fit === n && s.stash[item] < capacity(s) * 0.9) {
    s.flags.delete('full_' + item);
  }
  return fit;
}

export function canAfford(s: GameState, cost: Stack): boolean {
  for (const k in cost) if (s.stash[k as ItemId] < (cost[k as ItemId] ?? 0)) return false;
  return true;
}

export function pay(s: GameState, cost: Stack): boolean {
  if (!canAfford(s, cost)) return false;
  for (const k in cost) s.stash[k as ItemId] -= cost[k as ItemId] ?? 0;
  return true;
}

/** Refund ignores capacity so nothing is ever destroyed by deconstruction. */
export function refund(s: GameState, cost: Stack): void {
  for (const k in cost) s.stash[k as ItemId] += cost[k as ItemId] ?? 0;
}

export function stackTotal(st: Stack): number {
  let n = 0;
  for (const k in st) n += st[k as ItemId] ?? 0;
  return n;
}

export function addTo(st: Stack, item: ItemId, n: number): void {
  st[item] = (st[item] ?? 0) + n;
  if (st[item] === 0) delete st[item];
}

export function isNight(s: GameState): boolean {
  const f = (s.time % 600) / 600;
  return f >= 0.68 && f < 0.98;
}

export function dayFraction(s: GameState): number {
  return (s.time % 600) / 600;
}
