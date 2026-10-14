import type { ItemId, Stack } from './items';

/**
 * A recipe converts inputs to outputs over `time` seconds in one of the listed
 * stations. `chance` adds probabilistic by-products (rolled per cycle with the
 * seeded simulation RNG). `fuel` is consumed per cycle from the station's fuel
 * store (kilns). Recipes become usable once their unlocking discovery is known.
 */
export interface RecipeDef {
  id: string;
  name: string;
  inputs: Stack;
  outputs: Stack;
  chance?: Stack;
  time: number;
  fuel?: number;
  /** Station building types able to run it. 'hand' = the workbench craft menu. */
  stations: string[];
  unlock: string;
}

const R: RecipeDef[] = [
  // ── Hand crafting (workbench) ────────────────────────────────────────────
  { id: 'plank', name: 'Plank', inputs: { wood: 2 }, outputs: { plank: 1 }, time: 2, stations: ['hand', 'assembler'], unlock: 'plank' },
  { id: 'twine', name: 'Twine', inputs: { fiber: 3 }, outputs: { twine: 1 }, time: 2, stations: ['hand', 'assembler'], unlock: 'fiber' },
  { id: 'stone', name: 'Stone', inputs: { pebble: 4 }, outputs: { stone: 1 }, time: 2, stations: ['hand'], unlock: 'stone' },
  { id: 'gear', name: 'Gear', inputs: { copper: 1 }, outputs: { gear: 1 }, time: 2, stations: ['hand', 'assembler'], unlock: 'copper' },
  { id: 'wire', name: 'Wire', inputs: { copper: 1 }, outputs: { wire: 2 }, time: 2, stations: ['hand', 'assembler'], unlock: 'copper' },
  { id: 'plate', name: 'Iron Plate', inputs: { iron: 2 }, outputs: { plate: 1 }, time: 3, stations: ['hand', 'assembler'], unlock: 'iron' },
  { id: 'lens', name: 'Lens', inputs: { glass: 2 }, outputs: { lens: 1 }, time: 4, stations: ['hand', 'assembler'], unlock: 'assembler' },
  { id: 'mechanism', name: 'Mechanism', inputs: { gear: 2, plate: 1, wire: 2 }, outputs: { mechanism: 1 }, time: 6, stations: ['hand', 'assembler'], unlock: 'assembler' },
  { id: 'cell', name: 'Aether Cell', inputs: { crystal: 1, wire: 4, plate: 2 }, outputs: { cell: 1 }, time: 10, stations: ['assembler'], unlock: 'wisps' },
  { id: 'coil', name: 'Lumen Coil', inputs: { crystal: 1, mechanism: 1, glass: 2 }, outputs: { coil: 1 }, time: 12, stations: ['assembler'], unlock: 'wisps' },
  { id: 'core', name: 'Heart Core', inputs: { sunmetal: 4, cell: 2, coil: 1, amber: 2 }, outputs: { core: 1 }, time: 30, stations: ['assembler'], unlock: 'forge' },

  { id: 'basket', name: 'Fruit Basket', inputs: { apple: 2, cherry: 2, orange: 2, date: 2, pear: 2, plum: 2, twine: 1 }, outputs: { fruit_basket: 1 }, time: 8, stations: ['hand', 'assembler'], unlock: 'orchard' },
  { id: 'candle', name: 'Candles', inputs: { wax: 2, twine: 1 }, outputs: { candle: 2 }, time: 4, stations: ['hand', 'assembler'], unlock: 'apiary' },

  // ── Nature-driven processes ──────────────────────────────────────────────
  { id: 'compost', name: 'Compost', inputs: { leaf: 2 }, outputs: { loam: 1 }, time: 8, stations: ['composter'], unlock: 'compost' },
  { id: 'sift_loam', name: 'Sift loam', inputs: { loam: 1 }, outputs: { pebble: 2 }, chance: { copper_grit: 0.35, sapling: 0.04 }, time: 2.5, stations: ['sieve', 'wind_sifter'], unlock: 'sieve' },
  { id: 'sift_gravel', name: 'Sift gravel', inputs: { gravel: 1 }, outputs: { sand: 1 }, chance: { iron_grit: 0.5, copper_grit: 0.12 }, time: 3, stations: ['wind_sifter'], unlock: 'mill' },
  { id: 'clay', name: 'Clay', inputs: { loam: 2, dew: 1 }, outputs: { clay: 1 }, time: 10, stations: ['clay_tub'], unlock: 'clay' },

  // ── Fire ─────────────────────────────────────────────────────────────────
  { id: 'charcoal', name: 'Charcoal', inputs: { wood: 3 }, outputs: { charcoal: 1 }, time: 8, stations: ['kiln'], unlock: 'kiln' },
  { id: 'brick', name: 'Brick', inputs: { clay: 1 }, outputs: { brick: 1 }, time: 6, fuel: 1, stations: ['kiln'], unlock: 'kiln' },
  { id: 'smelt_copper', name: 'Copper', inputs: { copper_grit: 2 }, outputs: { copper: 1 }, time: 6, fuel: 1, stations: ['kiln'], unlock: 'kiln' },
  { id: 'glass', name: 'Glass', inputs: { sand: 2 }, outputs: { glass: 1 }, time: 8, fuel: 1, stations: ['kiln'], unlock: 'glass' },
  { id: 'preserves', name: 'Preserves', inputs: { apple: 2, honey: 1 }, outputs: { preserves: 1 }, time: 8, fuel: 1, stations: ['kiln'], unlock: 'apiary' },
  { id: 'smelt_iron', name: 'Iron', inputs: { iron_grit: 2, charcoal: 1 }, outputs: { iron: 1 }, time: 6, stations: ['furnace'], unlock: 'iron' },
  { id: 'fast_copper', name: 'Copper', inputs: { copper_grit: 2 }, outputs: { copper: 1 }, time: 3, stations: ['furnace'], unlock: 'iron' },
  { id: 'fast_glass', name: 'Glass', inputs: { sand: 2 }, outputs: { glass: 1 }, time: 3, stations: ['furnace'], unlock: 'iron' },

  // ── Wind-driven industry ─────────────────────────────────────────────────
  { id: 'saw', name: 'Planks', inputs: { wood: 3 }, outputs: { plank: 2 }, time: 3, stations: ['sawmill'], unlock: 'wind' },
  { id: 'press', name: 'Stone', inputs: { pebble: 4 }, outputs: { stone: 1 }, time: 3, stations: ['press'], unlock: 'wind' },
  { id: 'twist', name: 'Twine', inputs: { fiber: 3 }, outputs: { twine: 1 }, time: 3, stations: ['press'], unlock: 'wind' },
  { id: 'juice', name: 'Orange Juice', inputs: { orange: 3 }, outputs: { juice: 1 }, time: 5, stations: ['press'], unlock: 'dunes' },
  { id: 'cider', name: 'Cider', inputs: { apple: 4 }, outputs: { cider: 1 }, time: 5, stations: ['press'], unlock: 'orchard' },
  { id: 'crush', name: 'Gravel', inputs: { stone: 1 }, outputs: { gravel: 3 }, time: 4, stations: ['millstone'], unlock: 'mill' },

  // ── Aether ───────────────────────────────────────────────────────────────
  { id: 'distill', name: 'Aether', inputs: { mist: 3 }, outputs: { aether: 1, dew: 1 }, time: 6, stations: ['distiller'], unlock: 'distill' },
  { id: 'crystal', name: 'Aether Crystal', inputs: { aether: 2, stardust: 1 }, outputs: { crystal: 1 }, time: 12, stations: ['resonator'], unlock: 'resonance' },
  { id: 'skystone', name: 'Skystone', inputs: { stone: 3, aether: 1 }, outputs: { skystone: 2 }, time: 6, stations: ['resonator'], unlock: 'resonance' },
  { id: 'sunmetal', name: 'Sunmetal', inputs: { iron: 2, copper: 2, aether: 1 }, outputs: { sunmetal: 1 }, time: 10, stations: ['crucible'], unlock: 'alloy' },
];

export const RECIPES: Record<string, RecipeDef> = Object.fromEntries(R.map((r) => [r.id, r]));
export const RECIPE_LIST = R;

export function recipesFor(station: string): RecipeDef[] {
  return R.filter((r) => r.stations.includes(station));
}

/** Kiln fuel values: how many fuel units one item provides. */
export const FUEL_VALUE: Partial<Record<ItemId, number>> = { charcoal: 4, wood: 1 };
