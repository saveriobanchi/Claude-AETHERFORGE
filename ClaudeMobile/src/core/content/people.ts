import type { ItemId, Stack } from './items';

/**
 * Settlers and designs: tuning and content. Logic lives in core/people.ts.
 */

export const HOME_CAPACITY = 2;
export const ARRIVE_EVERY = 45;      // seconds between arrivals while there is room and food
export const MEAL_EVERY = 90;        // seconds between meals per settler
export const LEAVE_AFTER = 300;      // seconds of hunger before one settler leaves
export const MEMORY = 10;            // meals remembered for variety

/** What settlers will eat (the one you have most of, each meal). */
export const FOODS: ItemId[] = ['bread', 'stew', 'pie', 'egg', 'carrot', 'apple', 'cherry', 'orange', 'date', 'pear', 'plum', 'cider', 'juice', 'preserves', 'honey', 'soup', 'jam', 'honey_cake'];

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

// ───────────────────────── designs (blueprints) ─────────────────────────

/**
 * Designs: alternative recipes the player drafts at a Drafting Table by
 * paying a fixed cost — nothing is found or rolled. Each needs the
 * discoveries that make its machine and ingredients known. Ids match the
 * recipes' `unlock`.
 */
export interface DesignDef { id: string; needs: string[]; cost: Stack; desc: string }
export const DESIGNS: DesignDef[] = [
  { id: 'bp_twin_saw', needs: ['wind', 'assembler'], cost: { plank: 80, gear: 10, iron: 10 }, desc: 'A second blade: the sawmill wastes no wood.' },
  { id: 'bp_clamp', needs: ['kiln'], cost: { brick: 40, charcoal: 30, clay: 20 }, desc: 'Bank the kiln with leaves: twice the charcoal from the wood.' },
  { id: 'bp_ore_wash', needs: ['wind', 'iron'], cost: { gear: 20, glass: 10, iron: 20 }, desc: 'Wash gravel with dew in the wind sifter for iron grit.' },
  { id: 'bp_gears', needs: ['assembler'], cost: { copper: 60, mechanism: 4 }, desc: 'Stamp three gears from two copper.' },
  { id: 'bp_sky_loom', needs: ['weaving'], cost: { cloth: 20, plank: 60, gear: 10 }, desc: 'Twist twine into the warp: two cloth from two fleece.' },
  { id: 'bp_quick_bread', needs: ['baking'], cost: { bread: 30, brick: 20, flour: 20 }, desc: 'Flat bread straight from wheat — no millstone.' },
  { id: 'bp_still', needs: ['distill'], cost: { glass: 30, aether: 10, copper: 20 }, desc: 'A charcoal-fired still: more aether from less mist.' },
  { id: 'bp_fine_mesh', needs: ['wind', 'sieve'], cost: { gear: 12, twine: 20, copper: 10 }, desc: 'A finer mesh for the wind sifter: twice the copper flakes from loam.' },
  { id: 'bp_lattice', needs: ['resonance', 'skystone'], cost: { crystal: 6, glass: 20, skystone: 20 }, desc: 'Grow crystal on a glass lattice — no stardust.' },
];
export const DESIGN: Record<string, DesignDef> = Object.fromEntries(DESIGNS.map((d) => [d.id, d]));
export const BLUEPRINTS = DESIGNS.map((d) => d.id);
