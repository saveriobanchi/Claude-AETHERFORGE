// Item catalogue. Names are player-facing; descriptions are short and
// deliberately avoid listing what an item is later used for (discovery).

export type ItemId =
  | 'wood' | 'leaf' | 'sapling' | 'fiber' | 'twine' | 'plank' | 'loam' | 'pebble' | 'stone'
  | 'dew' | 'clay' | 'charcoal' | 'brick' | 'copper_grit' | 'copper' | 'gear' | 'wire'
  | 'gravel' | 'sand' | 'iron_grit' | 'iron' | 'glass' | 'plate' | 'mechanism' | 'lens'
  | 'mist' | 'aether' | 'stardust' | 'crystal' | 'skystone' | 'sunmetal' | 'amber'
  | 'cell' | 'coil' | 'core';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  /** Progression band used for sorting and for colour-coding in the stash. */
  tier: number;
}

const list: ItemDef[] = [
  { id: 'wood', name: 'Timber', desc: 'Pale, springy wood from the island tree.', tier: 0 },
  { id: 'leaf', name: 'Leaves', desc: 'Soft green leaves. They rot quickly into something useful.', tier: 0 },
  { id: 'sapling', name: 'Sapling', desc: 'A living cutting. Plant it on grass.', tier: 0 },
  { id: 'fiber', name: 'Fiber', desc: 'Tough strands from the tufts that sprout on new ground.', tier: 0 },
  { id: 'twine', name: 'Twine', desc: 'Fiber twisted into cord.', tier: 0 },
  { id: 'plank', name: 'Plank', desc: 'Flat-sawn timber.', tier: 0 },
  { id: 'loam', name: 'Loam', desc: 'Dark, rich soil. Islands are made of this.', tier: 0 },
  { id: 'pebble', name: 'Pebbles', desc: 'Small stones sifted out of loam.', tier: 1 },
  { id: 'stone', name: 'Stone', desc: 'Packed pebbles. Heavy and dependable.', tier: 1 },
  { id: 'dew', name: 'Dew', desc: 'Clean water wrung from the morning air.', tier: 1 },
  { id: 'clay', name: 'Clay', desc: 'Wet loam that holds its shape.', tier: 1 },
  { id: 'charcoal', name: 'Charcoal', desc: 'Slow-burning fuel.', tier: 1 },
  { id: 'brick', name: 'Brick', desc: 'Fired clay.', tier: 1 },
  { id: 'copper_grit', name: 'Copper Flakes', desc: 'Bright metallic specks.', tier: 1 },
  { id: 'copper', name: 'Copper', desc: 'A warm, soft metal ingot.', tier: 1 },
  { id: 'gear', name: 'Gear', desc: 'Toothed copper wheel.', tier: 2 },
  { id: 'wire', name: 'Wire', desc: 'Drawn copper strand.', tier: 2 },
  { id: 'gravel', name: 'Gravel', desc: 'Crushed stone.', tier: 2 },
  { id: 'sand', name: 'Sand', desc: 'Fine grains, almost glassy already.', tier: 2 },
  { id: 'iron_grit', name: 'Iron Flakes', desc: 'Dark, heavy specks.', tier: 2 },
  { id: 'iron', name: 'Iron', desc: 'A hard grey ingot.', tier: 2 },
  { id: 'glass', name: 'Glass', desc: 'Clear and faintly green.', tier: 2 },
  { id: 'plate', name: 'Iron Plate', desc: 'Hammered iron sheet.', tier: 3 },
  { id: 'mechanism', name: 'Mechanism', desc: 'Gears, springs and wire in a neat housing.', tier: 3 },
  { id: 'lens', name: 'Lens', desc: 'Ground glass that gathers light.', tier: 3 },
  { id: 'mist', name: 'Mist', desc: 'Cloud, captured. It glimmers.', tier: 4 },
  { id: 'aether', name: 'Aether', desc: 'The weightless something that keeps islands aloft.', tier: 4 },
  { id: 'stardust', name: 'Stardust', desc: 'Falls only at night. Warm to the touch.', tier: 4 },
  { id: 'crystal', name: 'Aether Crystal', desc: 'Aether given a shape. It hums.', tier: 4 },
  { id: 'skystone', name: 'Skystone', desc: 'Stone that has forgotten how to fall.', tier: 4 },
  { id: 'amber', name: 'Amber', desc: 'Old sap holding old light.', tier: 5 },
  { id: 'sunmetal', name: 'Sunmetal', desc: 'An alloy that glows long after cooling.', tier: 5 },
  { id: 'cell', name: 'Aether Cell', desc: 'A sealed charge of living aether.', tier: 5 },
  { id: 'coil', name: 'Lumen Coil', desc: 'A spiral that remembers light.', tier: 5 },
  { id: 'core', name: 'Heart Core', desc: 'It beats.', tier: 6 },
];

export const ITEMS: Record<ItemId, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i])) as Record<ItemId, ItemDef>;
export const ITEM_IDS: ItemId[] = list.map((i) => i.id);

export type Stack = Partial<Record<ItemId, number>>;

export function isItemId(s: string): s is ItemId {
  return s in ITEMS;
}
