import type { Floor } from './buildings';
import type { ItemId, Stack } from './items';

/** Ground the player can lay. */
export interface LandDef {
  id: string;
  name: string;
  desc: string;
  floor: Floor;
  /** 'new' extends the island into the sky; 'convert' repaves existing grass. */
  mode: 'new' | 'convert';
  unlock: string;
}

export const LANDS: LandDef[] = [
  { id: 'plot', name: 'Loam Plot', desc: 'New ground at the island’s edge. Each costs a little more.', floor: 'grass', mode: 'new', unlock: 'land' },
  { id: 'flagstone', name: 'Flagstone', desc: 'Paves grass. Heavy machines need it.', floor: 'stone', mode: 'convert', unlock: 'copper' },
  { id: 'skytile', name: 'Skystone Tile', desc: 'Ground that needs no soil. Flat cost.', floor: 'sky', mode: 'new', unlock: 'skystone' },
];
export const LAND: Record<string, LandDef> = Object.fromEntries(LANDS.map((l) => [l.id, l]));

export const START_TILES = 9;

/** Cost of the next Loam Plot given current tile count. */
export function plotCost(tiles: number): Stack {
  const k = Math.max(0, tiles - START_TILES);
  return {
    loam: Math.ceil(2 + 0.45 * k + 0.004 * k * k),
    wood: 1 + Math.floor(k / 6),
  };
}
export function landCost(id: string, tiles: number): Stack {
  if (id === 'plot') return plotCost(tiles);
  if (id === 'flagstone') return { stone: 2 };
  return { skystone: 3 };
}

/** Islets that can be summoned, in order. Layouts are relative tile offsets. */
export interface IsletDef {
  id: string;
  name: string;
  floor: Floor;
  /** rows of chars: '#' ground, 'N' node, 'T' elder tree, 't' tree, '.' empty */
  layout: string[];
  node?: string;
}
export const ISLETS: IsletDef[] = [
  { id: 'grove', name: 'Elder Grove', floor: 'grass', layout: ['.##.', '#T##', '##t#', '.##.'] },
  { id: 'vein', name: 'Ore Heart', floor: 'stone', layout: ['.##.', '##N#', '####', '.#..'], node: 'node_vein' },
  { id: 'spring', name: 'Cloud Spring', floor: 'grass', layout: ['.###', '##N#', '###.', '.#..'], node: 'node_spring' },
  { id: 'shard', name: 'Fallen Star', floor: 'sky', layout: ['.#.', '#N#', '###', '.#.'], node: 'node_shard' },
];

export function summonCost(index: number): Stack {
  const m = Math.pow(1.6, index);
  return { aether: Math.round(20 * m), crystal: Math.round(4 * m) };
}
export const SUMMON_TIME = 45; // seconds for an islet to drift in

/** The Aetherforge: three construction stages, then endless resonance. */
export const FORGE_STAGES: { name: string; needs: Stack }[] = [
  { name: 'Foundation', needs: { stone: 400, brick: 300, skystone: 120 } },
  { name: 'Frame', needs: { iron: 300, plate: 150, mechanism: 60, glass: 120 } },
  { name: 'Heart', needs: { sunmetal: 60, cell: 30, coil: 20, core: 8 } },
];

const RESONANCE_POOL: { item: ItemId; base: number }[] = [
  { item: 'plank', base: 200 }, { item: 'brick', base: 160 }, { item: 'glass', base: 120 },
  { item: 'iron', base: 120 }, { item: 'plate', base: 80 }, { item: 'mechanism', base: 40 },
  { item: 'lens', base: 50 }, { item: 'skystone', base: 100 }, { item: 'crystal', base: 30 },
  { item: 'sunmetal', base: 25 }, { item: 'cell', base: 12 }, { item: 'coil', base: 10 },
  { item: 'gear', base: 150 }, { item: 'wire', base: 200 }, { item: 'copper', base: 150 },
];

/** Deterministic resonance request for a given level. */
export function resonanceRequest(level: number): Stack {
  const out: Stack = {};
  let h = (level + 1) * 2654435761;
  const picked = new Set<number>();
  const count = Math.min(5, 3 + Math.floor(level / 4));
  while (picked.size < count) {
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h >>> 0;
    picked.add(h % RESONANCE_POOL.length);
  }
  const scale = Math.pow(1.35, level);
  for (const i of picked) {
    const p = RESONANCE_POOL[i];
    out[p.item] = Math.ceil((p.base * scale) / 5) * 5;
  }
  return out;
}

export interface AttunementDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: (rank: number) => number;
}
export const ATTUNEMENTS: AttunementDef[] = [
  { id: 'swift', name: 'Swift Hands', desc: 'Every machine works 10% faster.', max: 10, cost: (r) => 1 + r },
  { id: 'stores', name: 'Deep Stores', desc: 'Your stash holds 25% more.', max: 10, cost: (r) => 1 + r },
  { id: 'tailwind', name: 'Tailwind', desc: 'Breeze output rises 15%.', max: 10, cost: (r) => 1 + r },
  { id: 'dreams', name: 'Long Dreams', desc: 'Offline time counts longer and better.', max: 5, cost: (r) => 2 + r },
  { id: 'wispsong', name: 'Wisp Song', desc: 'Wisps fly 20% faster.', max: 5, cost: (r) => 1 + r },
  { id: 'aurora', name: 'Aurora', desc: 'The night sky remembers you.', max: 1, cost: () => 2 },
  { id: 'lanterns', name: 'Lanterns', desc: 'Lanterns rise from the island at dusk.', max: 1, cost: () => 2 },
  { id: 'bloom', name: 'Bloom', desc: 'Flowers find every corner.', max: 1, cost: () => 1 },
];
export const ATTUNE: Record<string, AttunementDef> = Object.fromEntries(ATTUNEMENTS.map((a) => [a.id, a]));

export const DAY_LENGTH = 600; // seconds per full day
export const NIGHT_START = 0.68; // fraction of day when night begins
export const NIGHT_END = 0.98;
export const BASE_CAPACITY = 50;
export const OFFLINE = { baseCapHours: 4, efficiency: 0.5 };
