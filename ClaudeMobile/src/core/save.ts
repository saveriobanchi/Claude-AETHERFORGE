import { BUILDINGS } from './content/buildings';
import { isItemId, type ItemId, type Stack } from './content/items';
import type { Floor } from './content/buildings';
import {
  type Building, type Dir, type GameState, SAVE_VERSION, createState, emptyStash, newBuilding, key, hashSeed, emptyCache,
} from './state';
import { rebuildCache } from './sim';

/** On-disk shape (current version). Plain JSON; Maps flattened to arrays. */
export interface SaveData {
  v: number;
  rng: number;
  time: number;
  tiles: [number, number, Floor, string?][];
  buildings: SavedBuilding[];
  stash: Stack;
  stats: GameState['stats'];
  known: string[];
  flags: string[];
  nextId: number;
  islets: GameState['islets'];
  forge: GameState['forge'];
  flow: GameState['flow'];
  tuftTimer: number;
  savedAt: number;
  view?: { x: number; y: number; zoom: number };
}

type SavedBuilding = [
  id: number, type: string, x: number, y: number, dir: number,
  extra: Partial<Pick<Building, 'recipe' | 'progress' | 'working' | 'inBuf' | 'outBuf' | 'fuel' | 'stock' | 'timer' | 'hold' | 'filter' | 'rr'>> & { items?: [ItemId, number][] },
];

function cleanStack(st: Stack | undefined): Stack {
  const o: Stack = {};
  if (!st) return o;
  for (const k in st) {
    const n = st[k as ItemId];
    if (isItemId(k) && typeof n === 'number' && Number.isFinite(n) && n > 0) o[k] = n;
  }
  return o;
}

export function serialize(s: GameState, view?: SaveData['view']): SaveData {
  const buildings: SavedBuilding[] = [];
  for (const b of s.buildings.values()) {
    const e: SavedBuilding[5] = {};
    if (b.recipe) e.recipe = b.recipe;
    if (b.progress) e.progress = b.progress;
    if (b.working) e.working = true;
    if (Object.keys(b.inBuf).length) e.inBuf = b.inBuf;
    if (Object.keys(b.outBuf).length) e.outBuf = b.outBuf;
    if (b.fuel) e.fuel = b.fuel;
    if (b.stock) e.stock = b.stock;
    if (b.timer) e.timer = b.timer;
    if (b.hold) e.hold = b.hold;
    if (b.filter) e.filter = b.filter;
    if (b.rr) e.rr = b.rr;
    if (b.items.length) e.items = b.items.map((i) => [i.item, i.pos]);
    buildings.push([b.id, b.type, b.x, b.y, b.dir, e]);
  }
  // Items carried by wisps are returned to the stash on save (wisps respawn on load).
  const stash: Stack = {};
  for (const k in s.stash) if (s.stash[k as ItemId] > 0) stash[k as ItemId] = s.stash[k as ItemId];
  for (const w of s.wisps) if (w.carry && w.n) stash[w.carry] = (stash[w.carry] ?? 0) + w.n;
  return {
    v: SAVE_VERSION,
    rng: s.rng,
    time: s.time,
    tiles: [...s.tiles.values()].map((t) => (t.islet ? [t.x, t.y, t.floor, t.islet] : [t.x, t.y, t.floor])),
    buildings,
    stash,
    stats: s.stats,
    known: [...s.known],
    flags: [...s.flags],
    nextId: s.nextId,
    islets: s.islets,
    forge: s.forge,
    flow: s.flow,
    tuftTimer: s.tuftTimer,
    savedAt: s.savedAt,
    view,
  };
}

/** Migrations: index i upgrades version i → i+1. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySave = any;
export const MIGRATIONS: Record<number, (d: AnySave) => AnySave> = {
  // v1 (early prototype format): stash stored as [item, n] pairs, no islets/forge/flow.
  1: (d) => {
    const stash: Stack = {};
    if (Array.isArray(d.stash)) for (const [k, n] of d.stash) stash[k as ItemId] = n;
    return {
      ...d,
      v: 2,
      stash,
      islets: d.islets ?? { docked: 0, summon: null },
      forge: d.forge ?? { id: 0, stage: -1, progress: {}, level: 0, sparks: 0, attune: {}, request: {} },
      flow: { cur: { dt: 0, inn: {}, out: {} }, hist: [] },
      tuftTimer: 0,
    };
  },
};

export function migrate(d: AnySave): SaveData {
  if (!d || typeof d !== 'object') throw new Error('Save is not an object');
  let v = typeof d.v === 'number' ? d.v : 1;
  if (v > SAVE_VERSION) throw new Error(`Save is from a newer version (${v})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from v${v}`);
    d = m(d);
    v = d.v;
  }
  return d as SaveData;
}

export function deserialize(raw: unknown): { state: GameState; view?: SaveData['view'] } {
  const d = migrate(raw);
  const s = createState(d.rng);
  s.tiles.clear();
  s.buildings.clear();
  s.occ.clear();
  s.rng = d.rng >>> 0;
  s.time = +d.time || 0;
  for (const [x, y, floor, islet] of d.tiles ?? []) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    s.tiles.set(key(x, y), { x, y, floor: floor === 'stone' || floor === 'sky' ? floor : 'grass', seed: hashSeed(x, y), islet });
  }
  if (!s.tiles.size) throw new Error('Save has no ground');
  let maxId = 0;
  for (const [id, type, x, y, dir, e] of d.buildings ?? []) {
    const def = BUILDINGS[type];
    if (!def) continue;
    const b = newBuilding(id, type, x, y, ((dir | 0) & 3) as Dir);
    b.recipe = e.recipe ?? null;
    b.progress = e.progress ?? 0;
    b.working = !!e.working;
    b.inBuf = cleanStack(e.inBuf);
    b.outBuf = cleanStack(e.outBuf);
    b.fuel = e.fuel ?? 0;
    b.stock = e.stock ?? 0;
    b.timer = e.timer ?? 0;
    b.hold = e.hold && isItemId(e.hold) ? e.hold : null;
    b.filter = e.filter && isItemId(e.filter) ? e.filter : null;
    b.rr = e.rr ?? 0;
    b.items = (e.items ?? []).filter(([it]) => isItemId(it)).map(([item, pos]) => ({ item, pos, prev: pos }));
    let clash = false;
    for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) if (s.occ.has(key(x + dx, y + dy))) clash = true;
    if (clash) continue;
    for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) s.occ.set(key(x + dx, y + dy), id);
    s.buildings.set(id, b);
    maxId = Math.max(maxId, id);
  }
  s.stash = emptyStash();
  const st = cleanStack(d.stash);
  for (const k in st) s.stash[k as ItemId] = st[k as ItemId] ?? 0;
  s.stats = { ...s.stats, ...(d.stats ?? {}) };
  s.stats.obtained = cleanStack(s.stats.obtained);
  s.known = new Set(d.known ?? ['start']);
  s.known.add('start');
  s.flags = new Set(d.flags ?? []);
  s.nextId = Math.max(d.nextId ?? 1, maxId + 1);
  s.islets = d.islets ?? { docked: 0, summon: null };
  s.forge = { ...s.forge, ...(d.forge ?? {}) };
  s.flow = d.flow ?? s.flow;
  s.tuftTimer = d.tuftTimer ?? 0;
  s.savedAt = d.savedAt ?? 0;
  s.cache = emptyCache();
  s.topoDirty = true;
  rebuildCache(s);
  return { state: s, view: d.view };
}

/** Text form for export/import (base64 of JSON, prefixed for recognisability). */
export function exportText(s: GameState, view?: SaveData['view']): string {
  const json = JSON.stringify(serialize(s, view));
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'AETHERFORGE1:' + btoa(bin);
}

export function importText(text: string): { state: GameState; view?: SaveData['view'] } {
  const t = text.trim();
  let json: string;
  if (t.startsWith('AETHERFORGE1:')) {
    const bin = atob(t.slice('AETHERFORGE1:'.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } else json = t;
  return deserialize(JSON.parse(json));
}
