import type { ItemId, Stack } from './items';

/**
 * Biomes: a property of grass tiles that varies existing mechanics — tree
 * species and yields, tall-grass fiber, dew, wind, compost and bees — and
 * decides where each fruit species thrives.
 */
export type BiomeId = 'meadow' | 'marsh' | 'dunes' | 'frost';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  desc: string;
  /** Multipliers on machines and nature standing on this biome. */
  dew: number;
  wind: number;
  compost: number;
  hive: number;
  regrow: number;
  /** Field growth speed. */
  crop: number;
  /** Island tree harvest on this biome. */
  tree: Stack;
  treeFiber: number;
  /** Fiber pulled from a tuft of tall grass here. */
  tuftFiber: number;
  /** Look of the island tree here. */
  treeLook: 'oak' | 'willow' | 'palm' | 'pine';
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  meadow: { id: 'meadow', name: 'Meadow', desc: 'Soft grass and wildflowers. Bees love it.', dew: 1, wind: 1, compost: 1, hive: 1.2, regrow: 1, crop: 1, tree: { wood: 1, leaf: 2 }, treeFiber: 0.2, tuftFiber: 2, treeLook: 'oak' },
  marsh: { id: 'marsh', name: 'Marsh', desc: 'Wet and green: more dew, faster compost, reeds full of fiber.', dew: 1.5, wind: 0.9, compost: 1.5, hive: 1, regrow: 1.2, crop: 1.25, tree: { wood: 1, leaf: 3 }, treeFiber: 0.3, tuftFiber: 4, treeLook: 'willow' },
  dunes: { id: 'dunes', name: 'Dunes', desc: 'Warm sand: dry air, steady wind, palms and citrus.', dew: 0.5, wind: 1.1, compost: 0.75, hive: 0.9, regrow: 0.9, crop: 0.75, tree: { wood: 1, leaf: 1 }, treeFiber: 0.5, tuftFiber: 1, treeLook: 'palm' },
  frost: { id: 'frost', name: 'Frost', desc: 'Snow and pines: strong wind and twice the timber, slow to grow.', dew: 1, wind: 1.25, compost: 0.6, hive: 0.6, regrow: 0.75, crop: 0.6, tree: { wood: 2, leaf: 1 }, treeFiber: 0.1, tuftFiber: 1, treeLook: 'pine' },
};
export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];

export interface FruitDef {
  id: string;
  /** Building types for the grown tree and its sapling; the sapling item. */
  tree: string;
  sapling: string;
  seed: ItemId;
  fruit: ItemId;
  home: BiomeId;
  maxStock: number;
  regrow: number;
  yield: Stack;
  saplingChance: number;
}

export const FRUITS: FruitDef[] = [
  { id: 'apple', tree: 'fruit_tree', sapling: 'fruit_sapling', seed: 'fruit_sapling', fruit: 'apple', home: 'meadow', maxStock: 4, regrow: 8, yield: { apple: 1, leaf: 1 }, saplingChance: 0.03 },
  { id: 'cherry', tree: 'cherry_tree', sapling: 'cherry_sapling', seed: 'cherry_sapling', fruit: 'cherry', home: 'meadow', maxStock: 3, regrow: 10, yield: { cherry: 2, leaf: 1 }, saplingChance: 0.03 },
  { id: 'orange', tree: 'orange_tree', sapling: 'orange_sapling', seed: 'orange_sapling', fruit: 'orange', home: 'dunes', maxStock: 4, regrow: 9, yield: { orange: 1, leaf: 1 }, saplingChance: 0.03 },
  { id: 'date', tree: 'date_palm', sapling: 'date_sapling', seed: 'date_sapling', fruit: 'date', home: 'dunes', maxStock: 3, regrow: 12, yield: { date: 2, leaf: 1 }, saplingChance: 0.03 },
  { id: 'pear', tree: 'pear_tree', sapling: 'pear_sapling', seed: 'pear_sapling', fruit: 'pear', home: 'marsh', maxStock: 4, regrow: 9, yield: { pear: 1, leaf: 1 }, saplingChance: 0.03 },
  { id: 'plum', tree: 'plum_tree', sapling: 'plum_sapling', seed: 'plum_sapling', fruit: 'plum', home: 'frost', maxStock: 3, regrow: 11, yield: { plum: 2, leaf: 1 }, saplingChance: 0.03 },
];
export const FRUIT_BY_TREE: Record<string, FruitDef> = Object.fromEntries(FRUITS.map((f) => [f.tree, f]));

/** Regrow speed outside a fruit's home biome. */
export const OFF_HOME = 0.5;
