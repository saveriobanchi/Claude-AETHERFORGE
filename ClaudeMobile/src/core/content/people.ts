import type { ItemId, Stack } from './items';

/**
 * Settlers and expeditions: tuning and content. Logic lives in
 * core/people.ts.
 */

export const HOME_CAPACITY = 2;
export const ARRIVE_EVERY = 45;      // seconds between arrivals while there is room and food
export const MEAL_EVERY = 90;        // seconds between meals per settler
export const LEAVE_AFTER = 300;      // seconds of hunger before one settler leaves
export const MEMORY = 8;             // meals remembered for variety

/** What settlers will eat (the one you have most of, each meal). */
export const FOODS: ItemId[] = ['bread', 'stew', 'pie', 'egg', 'carrot', 'apple', 'cherry', 'orange', 'date', 'pear', 'plum', 'cider', 'juice', 'preserves', 'honey'];

export type Role = 'forester' | 'mason' | 'smith' | 'mystic' | 'merchant';
export interface RoleDef { id: Role; name: string; desc: string; types: string[] }
export const ROLES: RoleDef[] = [
  { id: 'forester', name: 'Forester', desc: 'Trees, Treewrights, fields, pens, coops and hives.', types: ['harvester', 'field', 'sheep_pen', 'chicken_coop', 'hive', 'composter'] },
  { id: 'mason', name: 'Mason', desc: 'Sieves, presses, millstones, kilns, clay tubs, sawmills.', types: ['sieve', 'wind_sifter', 'press', 'millstone', 'kiln', 'clay_tub', 'sawmill', 'loom', 'oven'] },
  { id: 'smith', name: 'Smith', desc: 'Furnaces, assemblers and crucibles.', types: ['furnace', 'assembler', 'crucible'] },
  { id: 'mystic', name: 'Mystic', desc: 'Condensers, distillers, resonators, star nets and drills.', types: ['condenser', 'distiller', 'resonator', 'star_net', 'drill', 'dew_catcher'] },
  { id: 'merchant', name: 'Merchant', desc: 'Contracts pay more Marks.', types: [] },
];
export const ROLE: Record<Role, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, RoleDef>;
export const SPECIALIST_BONUS = 0.06;
export const IDLE_BONUS = 0.01;

// ───────────────────────── expeditions ─────────────────────────

export interface Loot { item: ItemId; min: number; max: number; chance: number }
export interface Destination {
  id: string;
  name: string;
  desc: string;
  time: number;           // seconds
  provisions: Stack;
  needs: string;          // discovery required
  loot: Loot[];
  /** Chance per crew member of a blueprint. */
  blueprint: number;
}

export const DESTINATIONS: Destination[] = [
  { id: 'orchard', name: 'Old Orchard', desc: 'An overgrown garden islet. Fruit and saplings.', time: 120, provisions: { bread: 4 }, needs: 'expeditions', blueprint: 0.05,
    loot: [{ item: 'apple', min: 6, max: 14, chance: 1 }, { item: 'cherry_sapling', min: 1, max: 2, chance: 0.5 }, { item: 'pear_sapling', min: 1, max: 1, chance: 0.4 }, { item: 'fruit_sapling', min: 1, max: 2, chance: 0.6 }, { item: 'honey', min: 2, max: 6, chance: 0.5 }] },
  { id: 'quarry', name: 'Sunken Quarry', desc: 'Old diggings in the haze. Stone, ore and the odd gem.', time: 240, provisions: { bread: 6, stew: 2 }, needs: 'expeditions', blueprint: 0.1,
    loot: [{ item: 'stone', min: 20, max: 50, chance: 1 }, { item: 'iron_grit', min: 10, max: 30, chance: 0.8 }, { item: 'copper_grit', min: 10, max: 30, chance: 0.8 }, { item: 'topaz', min: 1, max: 1, chance: 0.15 }, { item: 'ruby', min: 1, max: 1, chance: 0.1 }] },
  { id: 'reef', name: 'Crystal Reef', desc: 'A shoal of floating crystal. Bring warm food.', time: 360, provisions: { stew: 4, bread: 6 }, needs: 'aether', blueprint: 0.15,
    loot: [{ item: 'mist', min: 20, max: 40, chance: 1 }, { item: 'aether', min: 4, max: 10, chance: 0.8 }, { item: 'crystal', min: 1, max: 3, chance: 0.5 }, { item: 'opal', min: 1, max: 1, chance: 0.15 }, { item: 'orange_sapling', min: 1, max: 1, chance: 0.3 }] },
  { id: 'storm', name: 'Storm Front', desc: 'Lightning and stardust. Dangerous and rich.', time: 480, provisions: { pie: 3, stew: 4 }, needs: 'pylon', blueprint: 0.2,
    loot: [{ item: 'stardust', min: 6, max: 16, chance: 1 }, { item: 'aether', min: 8, max: 20, chance: 0.9 }, { item: 'emerald', min: 1, max: 1, chance: 0.15 }, { item: 'plum_sapling', min: 1, max: 1, chance: 0.3 }, { item: 'date_sapling', min: 1, max: 1, chance: 0.3 }] },
  { id: 'ruins', name: 'Ancient Ruins', desc: 'The island that built the first forge.', time: 600, provisions: { pie: 6, stew: 6, cloth: 6 }, needs: 'alloy', blueprint: 0.3,
    loot: [{ item: 'sunmetal', min: 2, max: 6, chance: 0.8 }, { item: 'skystone', min: 10, max: 30, chance: 1 }, { item: 'amber', min: 1, max: 3, chance: 0.6 }, { item: 'mechanism', min: 2, max: 6, chance: 0.6 }] },
];
export const DESTINATION: Record<string, Destination> = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

/** Blueprints: alternative recipes (ids match RECIPES and their `unlock`). */
export const BLUEPRINTS = ['bp_twin_saw', 'bp_clamp', 'bp_ore_wash', 'bp_still', 'bp_gears', 'bp_sky_loom', 'bp_quick_bread', 'bp_lattice'];
export const MAX_CREW = 3;
