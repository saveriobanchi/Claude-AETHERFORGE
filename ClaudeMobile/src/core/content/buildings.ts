import type { ItemId, Stack } from './items';

export type BuildingKind =
  | 'tree'        // harvestable, regrowing
  | 'sapling'     // grows into a tree
  | 'tuft'        // natural fiber tuft (spawns by itself)
  | 'workbench'   // unlocks hand crafting
  | 'crafter'     // automatic recipe station
  | 'manual'      // tap-driven recipe station drawing from the stash
  | 'generator'   // produces items from nothing (dew, mist, stardust)
  | 'harvester'   // harvests adjacent trees
  | 'drill'       // extracts from adjacent islet nodes
  | 'node'        // islet resource node (not removable)
  | 'belt'
  | 'splitter'
  | 'sorter'
  | 'depot'       // delivers into the stash
  | 'dispatcher'  // pulls one item type out of the stash
  | 'storage'     // raises stash capacity
  | 'windmill'    // power
  | 'engine'      // fuel-burning power
  | 'pylon'       // resonance field (speed aura)
  | 'beacon'      // summons islets
  | 'roost'       // wisp logistics
  | 'forge'       // the great work
  | 'post'        // trading post: contracts with sky traders
  | 'hive'        // beehive: honey and wax near trees
  | 'decor'       // purely decorative
  | 'home'        // houses settlers
  | 'dock';       // air dock: expeditions

export type Floor = 'grass' | 'stone' | 'sky';
import { FRUITS } from './biomes';
export type BuildCategory = 'nature' | 'craft' | 'logistics' | 'power' | 'storage' | 'aether' | 'decor' | 'wonder';

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  kind: BuildingKind;
  category: BuildCategory;
  size: number; // square footprint
  cost: Stack;
  /** Floors this building may stand on. Undefined = any. */
  floors?: Floor[];
  edge?: boolean;          // must touch the island edge
  nearNode?: boolean;      // must be adjacent to an islet node
  rotatable?: boolean;
  draggable?: boolean;
  removable?: boolean;     // default true
  unlock: string;          // discovery id ('' = always)
  power?: number;          // breeze drawn while working
  powerGen?: number;       // breeze produced
  speed?: number;          // belts: tiles/s; crafters: multiplier
  capacity?: number;       // storage: stash capacity bonus per item
  produces?: { item: ItemId; every: number; nightOnly?: boolean }; // generators
  radius?: number;
  bufferCap?: number;      // input/output buffer cap per item
  growsInto?: string;      // saplings: the tree they become
  charm?: number;          // decor: how much it adds to the island's charm
}

const B: BuildingDef[] = [
  // ── Nature ──
  { id: 'tree', name: 'Islet Tree', desc: 'Tap to gather timber and leaves. It regrows.', kind: 'tree', category: 'nature', size: 1, cost: {}, floors: ['grass'], unlock: '_never' },
  { id: 'sapling', name: 'Sapling', desc: 'Plant on grass. Grows into a tree.', kind: 'sapling', category: 'nature', size: 1, cost: { sapling: 1 }, floors: ['grass'], unlock: 'sapling' },
  { id: 'tuft', name: 'Tall Grass', desc: 'Tap to pull fiber.', kind: 'tuft', category: 'nature', size: 1, cost: {}, floors: ['grass'], unlock: '_never' },
  // fruit trees and their saplings come from the FRUITS table (biomes.ts)
  { id: 'field', name: 'Field', desc: 'Grows wheat or carrots. Needs dew. Wet ground helps.', kind: 'crafter', category: 'nature', size: 1, cost: { loam: 6, plank: 2 }, floors: ['grass'], unlock: 'farming', rotatable: true, bufferCap: 12 },
  { id: 'sheep_pen', name: 'Sheep Pen', desc: 'Sky sheep eat wheat and grow wool.', kind: 'crafter', category: 'nature', size: 1, cost: { plank: 10, twine: 4 }, floors: ['grass'], unlock: 'ranching', rotatable: true, bufferCap: 12 },
  { id: 'chicken_coop', name: 'Chicken Coop', desc: 'Hens eat wheat and lay eggs.', kind: 'crafter', category: 'nature', size: 1, cost: { plank: 8, twine: 2 }, floors: ['grass'], unlock: 'ranching', rotatable: true, bufferCap: 12 },
  { id: 'cottage', name: 'Cottage', desc: 'A home for two settlers. They need food.', kind: 'home', category: 'nature', size: 1, cost: { plank: 20, brick: 10, cloth: 4 }, unlock: 'settlers' },
  { id: 'hive', name: 'Beehive', desc: 'Bees make honey and wax. Needs trees within reach.', kind: 'hive', category: 'nature', size: 1, cost: { plank: 8, twine: 4 }, floors: ['grass'], unlock: 'apiary', rotatable: true, produces: { item: 'honey', every: 15 }, bufferCap: 12 },
  { id: 'elder_tree', name: 'Elder Tree', desc: 'Ancient and generous.', kind: 'tree', category: 'nature', size: 1, cost: {}, unlock: '_never', removable: false },

  // ── Crafting / production ──
  { id: 'workbench', name: 'Workbench', desc: 'Lets you craft by hand.', kind: 'workbench', category: 'craft', size: 1, cost: { wood: 6 }, unlock: '' },
  { id: 'composter', name: 'Compost Bin', desc: 'Leaves slowly become loam.', kind: 'crafter', category: 'craft', size: 1, cost: { wood: 8 }, unlock: 'compost', rotatable: true, bufferCap: 12 },
  { id: 'sieve', name: 'Sifting Frame', desc: 'Tap to sift loam from your stash.', kind: 'manual', category: 'craft', size: 1, cost: { wood: 8, twine: 2 }, unlock: 'sieve' },
  { id: 'dew_catcher', name: 'Dew Catcher', desc: 'A mesh that drinks the air.', kind: 'generator', category: 'craft', size: 1, cost: { wood: 6, twine: 2, plank: 2 }, floors: ['grass'], unlock: 'clay', rotatable: true, produces: { item: 'dew', every: 10 }, bufferCap: 10 },
  { id: 'clay_tub', name: 'Clay Tub', desc: 'Loam and dew, stirred into clay.', kind: 'crafter', category: 'craft', size: 1, cost: { plank: 4, stone: 2 }, unlock: 'clay', rotatable: true, bufferCap: 12 },
  { id: 'loom', name: 'Loom', desc: 'Weaves wool into cloth.', kind: 'crafter', category: 'craft', size: 1, cost: { plank: 12, gear: 4 }, unlock: 'weaving', rotatable: true, bufferCap: 12 },
  { id: 'oven', name: 'Bakery Oven', desc: 'Bread, stew and pie. Needs fuel.', kind: 'crafter', category: 'craft', size: 1, cost: { brick: 16, stone: 8, plank: 4 }, unlock: 'baking', rotatable: true, bufferCap: 12 },
  { id: 'kiln', name: 'Kiln', desc: 'Fire for charcoal, brick and metal. Needs fuel.', kind: 'crafter', category: 'craft', size: 1, cost: { stone: 8, clay: 3 }, unlock: 'kiln', rotatable: true, bufferCap: 12 },
  { id: 'harvester', name: 'Treewright', desc: 'Harvests the trees around it.', kind: 'harvester', category: 'craft', size: 1, cost: { plank: 6, gear: 3, twine: 2 }, unlock: 'automation', rotatable: true, radius: 1, bufferCap: 24 },
  { id: 'wind_sifter', name: 'Wind Sifter', desc: 'Sifts on its own while the wind blows.', kind: 'crafter', category: 'craft', size: 1, cost: { plank: 8, gear: 4, copper: 2 }, floors: ['stone', 'sky'], unlock: 'wind', rotatable: true, power: 2, bufferCap: 12 },
  { id: 'sawmill', name: 'Sawmill', desc: 'Cuts timber into planks, wastefully less.', kind: 'crafter', category: 'craft', size: 1, cost: { plank: 6, gear: 3, stone: 4 }, floors: ['stone', 'sky'], unlock: 'wind', rotatable: true, power: 2, bufferCap: 12 },
  { id: 'press', name: 'Stone Press', desc: 'Packs pebbles into stone. Twists twine.', kind: 'crafter', category: 'craft', size: 1, cost: { stone: 10, gear: 4 }, floors: ['stone', 'sky'], unlock: 'wind', rotatable: true, power: 2, bufferCap: 16 },
  { id: 'millstone', name: 'Millstone', desc: 'Grinds stone down.', kind: 'crafter', category: 'craft', size: 1, cost: { stone: 16, gear: 6, plank: 4 }, floors: ['stone', 'sky'], unlock: 'mill', rotatable: true, power: 3, bufferCap: 12 },
  { id: 'furnace', name: 'Bellows Furnace', desc: 'A wind-fed furnace, hot enough for iron.', kind: 'crafter', category: 'craft', size: 1, cost: { brick: 16, copper: 8, gear: 4 }, floors: ['stone', 'sky'], unlock: 'iron', rotatable: true, power: 4, bufferCap: 12 },
  { id: 'assembler', name: 'Assembler', desc: 'Builds components on its own.', kind: 'crafter', category: 'craft', size: 1, cost: { iron: 8, gear: 8, brick: 8 }, floors: ['stone', 'sky'], unlock: 'assembler', rotatable: true, power: 3, bufferCap: 12 },
  { id: 'condenser', name: 'Mist Condenser', desc: 'Combs passing clouds. Must touch the edge.', kind: 'generator', category: 'aether', size: 1, cost: { glass: 6, copper: 8, plate: 4 }, edge: true, unlock: 'aether', rotatable: true, power: 3, produces: { item: 'mist', every: 3 }, bufferCap: 16 },
  { id: 'distiller', name: 'Distiller', desc: 'Separates mist.', kind: 'crafter', category: 'aether', size: 1, cost: { glass: 8, iron: 8, brick: 10 }, floors: ['stone', 'sky'], unlock: 'distill', rotatable: true, power: 4, bufferCap: 16 },
  { id: 'star_net', name: 'Star Net', desc: 'Catches what falls at night. Must touch the edge.', kind: 'generator', category: 'aether', size: 1, cost: { twine: 16, lens: 2, wire: 6 }, edge: true, unlock: 'night', rotatable: true, produces: { item: 'stardust', every: 12, nightOnly: true }, bufferCap: 12 },
  { id: 'resonator', name: 'Resonator', desc: 'Sings matter into new shapes.', kind: 'crafter', category: 'aether', size: 1, cost: { iron: 10, lens: 4, mechanism: 2 }, floors: ['stone', 'sky'], unlock: 'resonance', rotatable: true, power: 6, bufferCap: 12 },
  { id: 'crucible', name: 'Sunforge Crucible', desc: 'Melts metals together with aether.', kind: 'crafter', category: 'aether', size: 1, cost: { brick: 30, plate: 12, crystal: 3 }, floors: ['stone', 'sky'], unlock: 'alloy', rotatable: true, power: 10, bufferCap: 12 },
  { id: 'drill', name: 'Core Drill', desc: 'Taps an islet heart. Place beside a node.', kind: 'drill', category: 'aether', size: 1, cost: { plate: 10, mechanism: 4, crystal: 1 }, nearNode: true, unlock: 'drill', rotatable: true, power: 5, bufferCap: 16 },

  // ── Logistics ──
  { id: 'belt', name: 'Conveyor', desc: 'Moves items. Drag to lay a line.', kind: 'belt', category: 'logistics', size: 1, cost: { plank: 1 }, unlock: 'belts', rotatable: true, draggable: true, speed: 1.25 },
  { id: 'express', name: 'Sky Conveyor', desc: 'A faster, floating conveyor.', kind: 'belt', category: 'logistics', size: 1, cost: { skystone: 1, gear: 1 }, unlock: 'skystone', rotatable: true, draggable: true, speed: 2.5 },
  { id: 'depot', name: 'Depot', desc: 'Anything delivered here joins your stash.', kind: 'depot', category: 'logistics', size: 1, cost: { stone: 6, plank: 4 }, unlock: 'belts' },
  { id: 'dispatcher', name: 'Dispatcher', desc: 'Sends one chosen item out of your stash.', kind: 'dispatcher', category: 'logistics', size: 1, cost: { gear: 4, plank: 4, stone: 4 }, unlock: 'dispatch', rotatable: true },
  { id: 'splitter', name: 'Splitter', desc: 'Shares items between left, front and right.', kind: 'splitter', category: 'logistics', size: 1, cost: { plank: 2, gear: 2 }, unlock: 'routing', rotatable: true },
  { id: 'sorter', name: 'Sorter', desc: 'One chosen item goes straight on; the rest turn aside.', kind: 'sorter', category: 'logistics', size: 1, cost: { plank: 2, gear: 2, wire: 4 }, unlock: 'routing', rotatable: true },
  { id: 'roost', name: 'Wisp Roost', desc: 'Wisps ferry items between your stash and nearby machines.', kind: 'roost', category: 'logistics', size: 1, cost: { coil: 2, skystone: 8, plate: 6 }, unlock: 'wisps', power: 4, radius: 5 },

  { id: 'airdock', name: 'Air Dock', desc: 'Sends crews to distant skies. Must touch the edge.', kind: 'dock', category: 'logistics', size: 1, cost: { plank: 40, cloth: 12, gear: 10, iron: 10 }, edge: true, unlock: 'expeditions' },
  { id: 'trading_post', name: 'Trading Post', desc: 'Sky traders dock here. Must touch the edge.', kind: 'post', category: 'logistics', size: 1, cost: { plank: 12, stone: 6, twine: 4 }, edge: true, unlock: 'trade', bufferCap: 999 },
  { id: 'lantern', name: 'Trade Lantern', desc: 'A gift from the traders. Glows at night.', kind: 'decor', category: 'decor', size: 1, cost: { plank: 2, candle: 2 }, unlock: 'tradelights', charm: 4 },

  // ── Decor: pieces for shaping the island; they add charm ──
  // Garden patterns (Land I)
  { id: 'plank_path', name: 'Plank Path', desc: 'A boardwalk tile.', kind: 'decor', category: 'decor', size: 1, cost: { plank: 1 }, unlock: 'patterns1', charm: 1, draggable: true },
  { id: 'fence', name: 'Fence', desc: 'A low rail fence. Drag to lay a line.', kind: 'decor', category: 'decor', size: 1, cost: { plank: 2 }, unlock: 'patterns1', charm: 1, draggable: true, rotatable: true },
  { id: 'hedge', name: 'Hedge', desc: 'A trimmed leafy block.', kind: 'decor', category: 'decor', size: 1, cost: { leaf: 8 }, floors: ['grass'], unlock: 'patterns1', charm: 2, draggable: true },
  { id: 'flower_bed', name: 'Flower Bed', desc: 'A wooden box of wildflowers.', kind: 'decor', category: 'decor', size: 1, cost: { loam: 2, fiber: 2 }, unlock: 'patterns1', charm: 3 },
  { id: 'bench', name: 'Bench', desc: 'Somewhere to watch the clouds.', kind: 'decor', category: 'decor', size: 1, cost: { plank: 4 }, unlock: 'patterns1', charm: 2, rotatable: true },
  // Mason patterns (Industry II)
  { id: 'stone_path', name: 'Cobble Path', desc: 'A cobbled tile.', kind: 'decor', category: 'decor', size: 1, cost: { stone: 1 }, unlock: 'patterns2', charm: 1, draggable: true },
  { id: 'stone_wall', name: 'Stone Wall', desc: 'A dry-stone wall. Drag to lay a line.', kind: 'decor', category: 'decor', size: 1, cost: { stone: 4 }, unlock: 'patterns2', charm: 2, draggable: true },
  { id: 'planter', name: 'Brick Planter', desc: 'A raised bed with a little tree.', kind: 'decor', category: 'decor', size: 1, cost: { brick: 6, loam: 2 }, unlock: 'patterns2', charm: 4 },
  { id: 'banner', name: 'Banner', desc: 'Your island’s colours.', kind: 'decor', category: 'decor', size: 1, cost: { twine: 6, plank: 3 }, unlock: 'patterns2', charm: 3 },
  { id: 'well', name: 'Well', desc: 'A stone well with a little roof.', kind: 'decor', category: 'decor', size: 1, cost: { stone: 16, plank: 6 }, unlock: 'patterns2', charm: 6 },
  // Town patterns (Settlement I)
  { id: 'lamp_post', name: 'Lamp Post', desc: 'An iron lamp. Glows at night.', kind: 'decor', category: 'decor', size: 1, cost: { iron: 4, glass: 2 }, unlock: 'patterns3', charm: 5 },
  { id: 'brick_arch', name: 'Brick Arch', desc: 'A proud brick arch.', kind: 'decor', category: 'decor', size: 1, cost: { brick: 24 }, unlock: 'patterns3', charm: 8 },
  { id: 'fountain', name: 'Fountain', desc: 'Clear water, endlessly falling.', kind: 'decor', category: 'decor', size: 1, cost: { stone: 30, glass: 8 }, unlock: 'patterns3', charm: 14 },
  { id: 'gazebo', name: 'Gazebo', desc: 'A shaded pavilion.', kind: 'decor', category: 'decor', size: 1, cost: { plank: 30, brick: 12 }, unlock: 'patterns3', charm: 12 },
  // Sky patterns (Aether II)
  { id: 'sky_path', name: 'Skystone Path', desc: 'A faintly glowing tile.', kind: 'decor', category: 'decor', size: 1, cost: { skystone: 1 }, unlock: 'patterns4', charm: 2, draggable: true },
  { id: 'crystal_lamp', name: 'Crystal Lamp', desc: 'An aether crystal on a marble stand.', kind: 'decor', category: 'decor', size: 1, cost: { crystal: 1, glass: 4 }, unlock: 'patterns4', charm: 10 },
  { id: 'statue', name: 'Skystone Statue', desc: 'A wanderer looking out at the haze.', kind: 'decor', category: 'decor', size: 1, cost: { skystone: 16 }, unlock: 'patterns4', charm: 12 },
  { id: 'star_arch', name: 'Star Arch', desc: 'A skystone arch with stars caught in it.', kind: 'decor', category: 'decor', size: 1, cost: { skystone: 20, crystal: 2 }, unlock: 'patterns4', charm: 16 },
  // Wonder pattern (Aether IV)
  { id: 'monument', name: 'Forge Monument', desc: 'A model of the Aetherforge, cast in sunmetal.', kind: 'decor', category: 'decor', size: 1, cost: { sunmetal: 8, skystone: 20 }, unlock: 'patterns5', charm: 30 },

  // ── Storage ──
  { id: 'crate', name: 'Storage Crate', desc: 'Your stash holds 50 more of everything.', kind: 'storage', category: 'storage', size: 1, cost: { plank: 8, stone: 2 }, unlock: 'storage', capacity: 50 },
  { id: 'silo', name: 'Silo', desc: 'Your stash holds 250 more of everything.', kind: 'storage', category: 'storage', size: 1, cost: { brick: 20, iron: 6, plank: 10 }, unlock: 'routing', capacity: 250 },
  { id: 'warehouse', name: 'Sky Vault', desc: 'Your stash holds 1000 more of everything.', kind: 'storage', category: 'storage', size: 1, cost: { skystone: 16, plate: 8, mechanism: 2 }, unlock: 'skystone', capacity: 1000 },

  // ── Power ──
  { id: 'windmill', name: 'Windmill', desc: 'Makes breeze for machines. Stronger at the edge.', kind: 'windmill', category: 'power', size: 1, cost: { plank: 12, gear: 4, twine: 4 }, unlock: 'wind', powerGen: 6 },
  { id: 'engine', name: 'Storm Engine', desc: 'Burns aether into a gale.', kind: 'engine', category: 'power', size: 1, cost: { mechanism: 6, plate: 12, crystal: 2 }, floors: ['stone', 'sky'], unlock: 'pylon', powerGen: 50, bufferCap: 10 },
  { id: 'pylon', name: 'Resonance Pylon', desc: 'Machines nearby work faster.', kind: 'pylon', category: 'power', size: 1, cost: { crystal: 2, plate: 4, wire: 6 }, unlock: 'pylon', radius: 2 },

  // ── Aether / wonder ──
  { id: 'beacon', name: 'Lodestone Beacon', desc: 'Calls drifting islets. Must touch the edge.', kind: 'beacon', category: 'aether', size: 1, cost: { skystone: 12, crystal: 4, mechanism: 4 }, edge: true, unlock: 'beacon' },
  { id: 'forge', name: 'The Aetherforge', desc: 'The great work.', kind: 'forge', category: 'wonder', size: 3, cost: { skystone: 40, crystal: 10 }, floors: ['stone', 'sky'], unlock: 'forge', removable: false },

  // ── Islet nodes ──
  { id: 'node_vein', name: 'Ore Heart', desc: 'Copper and iron run through it.', kind: 'node', category: 'nature', size: 1, cost: {}, unlock: '_never', removable: false },
  { id: 'node_spring', name: 'Cloud Spring', desc: 'Water and mist well up endlessly.', kind: 'node', category: 'nature', size: 1, cost: {}, unlock: '_never', removable: false },
  { id: 'node_shard', name: 'Fallen Star', desc: 'It still sheds dust.', kind: 'node', category: 'nature', size: 1, cost: {}, unlock: '_never', removable: false },
];

const FRUIT_NAMES: Record<string, [string, string]> = { apple: ['Apple', 'apples'], cherry: ['Cherry', 'cherries'], orange: ['Orange', 'oranges'], date: ['Date Palm', 'dates'], pear: ['Pear', 'pears'], plum: ['Plum', 'plums'] };
for (const f of FRUITS) {
  const [nm, fruit] = FRUIT_NAMES[f.id];
  const tree = f.id === 'date' ? nm : `${nm} Tree`;
  B.push(
    { id: f.sapling, name: `${nm} Sapling`, desc: `Grows into ${f.id === 'apple' ? 'an apple tree' : f.id === 'date' ? 'a date palm' : `a ${f.id} tree`}.`, kind: 'sapling', category: 'nature', size: 1, cost: { [f.seed]: 1 }, floors: ['grass'], unlock: 'orchard', growsInto: f.tree },
    { id: f.tree, name: tree, desc: `Tap to pick ${fruit}. Bees nearby make it bear more.`, kind: 'tree', category: 'nature', size: 1, cost: {}, floors: ['grass'], unlock: '_never' },
  );
}

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(B.map((b) => [b.id, b]));
export const BUILDING_LIST = B;

/** Drill yields per node type: rolled per cycle. */
export const NODE_YIELD: Record<string, { every: number; table: { item: ItemId; weight: number }[] }> = {
  node_vein: { every: 1.5, table: [{ item: 'iron_grit', weight: 6 }, { item: 'copper_grit', weight: 4 }, { item: 'emerald', weight: 0.05 }] },
  node_spring: { every: 1.5, table: [{ item: 'mist', weight: 5 }, { item: 'dew', weight: 5 }] },
  node_shard: { every: 5, table: [{ item: 'stardust', weight: 1 }] },
};

/** Tree yields. */
export const TREE = {
  maxStock: 5,
  regrow: 5, // seconds per stock
  yield: { wood: 1, leaf: 2 } as Stack,
  saplingChance: 0.05,
  fiberChance: 0.2,
  saplingPity: 12,
  elderMaxStock: 20,
  elderRegrow: 1.5,
  elderYield: { wood: 2, leaf: 3 } as Stack,
  amberChance: 0.12,
  saplingGrowTime: 45,
};

/** Fruit trees and beehives. */
export const ORCHARD = { maxStock: 4, regrow: 8, yield: { apple: 1, leaf: 1 } as Stack, saplingChance: 0.03 };
export const HIVE = { waxChance: 0.4, perTree: 0.15, maxTrees: 4 };

export const HARVESTER_INTERVAL = 1.5; // seconds per harvest
export const DISPATCH_INTERVAL = 0.4;
export const TUFT = { every: 18, yield: 2 };
