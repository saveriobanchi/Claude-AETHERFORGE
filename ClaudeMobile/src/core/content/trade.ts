import type { BuildingDef } from './buildings';
import { ITEMS, type ItemId, type Stack } from './items';

/**
 * Sky traders, the market and machine upgrades. Numbers here are the
 * balance knobs; the logic lives in sim.ts / actions.ts.
 */

/** Marks per item delivered (before the trade-level bonus). Unlisted items aren't traded. */
export const TRADE_VALUE: Partial<Record<ItemId, number>> = {
  wood: 0.25, plank: 0.6, twine: 0.6, loam: 0.4, stone: 0.8, clay: 1, charcoal: 1, brick: 1.4,
  copper: 2, gear: 2.4, wire: 1.4, glass: 3, iron: 3, plate: 5, lens: 8, mechanism: 14,
  skystone: 6, crystal: 20, sunmetal: 30,
  apple: 0.8, honey: 2, wax: 1.6, cider: 5, candle: 2.2, preserves: 7,
  cherry: 1, orange: 1.2, date: 1.4, pear: 1, plum: 1.4, juice: 5, fruit_basket: 40,
  topaz: 30, ruby: 35, opal: 35, emerald: 45,
};

/** Base contract size per item (scaled by trade level). */
const BASE_AMOUNT: Partial<Record<ItemId, number>> = {
  wood: 60, plank: 30, twine: 25, loam: 30, stone: 25, clay: 20, charcoal: 20, brick: 20,
  copper: 15, gear: 15, wire: 25, glass: 12, iron: 12, plate: 8, lens: 4, mechanism: 3,
  skystone: 8, crystal: 2, sunmetal: 2,
  apple: 30, honey: 12, wax: 12, cider: 6, candle: 12, preserves: 5,
  cherry: 30, orange: 25, date: 25, pear: 25, plum: 25, juice: 6, fruit_basket: 2,
};
/** Goods traders favour (picked more often). */
const FAVOURED = new Set<ItemId>(['apple', 'honey', 'wax', 'cider', 'candle', 'preserves', 'cherry', 'orange', 'date', 'pear', 'plum', 'juice', 'fruit_basket']);

export interface Contract { item: ItemId; n: number; got: number; marks: number }

export const BOARD_SIZE = 3;
export const CONTRACT_REFRESH = 20; // seconds before a finished contract is replaced
export const SKIP_COOLDOWN = 90;

/** Reputation needed to reach the next trade level. */
export function repForLevel(level: number): number {
  return Math.round(30 * Math.pow(1.45, level));
}

/** Items a contract may ask for: traded goods the player has made at least once. */
export function contractPool(obtained: Stack): ItemId[] {
  return (Object.keys(BASE_AMOUNT) as ItemId[]).filter((i) => (obtained[i] ?? 0) > 0);
}

/** A new contract from a random roll r1, r2 ∈ [0, 1). */
export function makeContract(pool: ItemId[], level: number, r1: number, r2: number, avoid: ItemId[] = []): Contract | null {
  const choices = pool.filter((i) => !avoid.includes(i));
  const list = choices.length ? choices : pool;
  if (!list.length) return null;
  // weight: higher tiers and favoured goods come up more often
  const w = list.map((i) => (1 + ITEMS[i].tier) * (FAVOURED.has(i) ? 2 : 1));
  let t = r1 * w.reduce((a, b) => a + b, 0), k = 0;
  while (k < list.length - 1 && t >= w[k]) { t -= w[k]; k++; }
  const item = list[k];
  const n = Math.max(1, Math.round((BASE_AMOUNT[item] ?? 10) * (1 + 0.3 * level) * (0.8 + r2 * 0.4)));
  const marks = Math.max(1, Math.round(n * (TRADE_VALUE[item] ?? 1) * (1 + 0.1 * level)));
  return { item, n, got: 0, marks };
}

// ───────────────────────── market ─────────────────────────

export interface MarketDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  /** Price multiplier per previous purchase (repeatables). */
  grow?: number;
  once?: boolean;
  gives?: Stack;
  /** Event flag set on purchase (unlocks discoveries). */
  flag?: string;
  /** Discovery required to see the offer. */
  needs?: string;
}

export const MARKET: MarketDef[] = [
  { id: 'fruit', name: 'Apple Sapling', desc: 'Thrives in meadow.', price: 8, grow: 1.1, gives: { fruit_sapling: 1 } },
  { id: 'cherry', name: 'Cherry Sapling', desc: 'Thrives in meadow. Two cherries a pick.', price: 10, grow: 1.1, gives: { cherry_sapling: 1 }, needs: 'orchard' },
  { id: 'orange', name: 'Orange Sapling', desc: 'Thrives in dunes.', price: 14, grow: 1.1, gives: { orange_sapling: 1 }, needs: 'dunes' },
  { id: 'date', name: 'Date Palm Sapling', desc: 'Thrives in dunes. Two dates a pick.', price: 16, grow: 1.1, gives: { date_sapling: 1 }, needs: 'dunes' },
  { id: 'pear', name: 'Pear Sapling', desc: 'Thrives in marsh.', price: 12, grow: 1.1, gives: { pear_sapling: 1 }, needs: 'marsh' },
  { id: 'plum', name: 'Plum Sapling', desc: 'Thrives in frost. Two plums a pick.', price: 18, grow: 1.1, gives: { plum_sapling: 1 }, needs: 'frost' },
  { id: 'hive', name: 'Hive Kit', desc: 'Learn to keep bees.', price: 25, once: true, flag: 'bought_hive', needs: 'orchard' },
  { id: 'lanterns', name: 'Lantern Pattern', desc: 'Make trade lanterns from candles.', price: 12, once: true, flag: 'bought_lanterns', needs: 'apiary' },
  { id: 'master', name: 'Master Tools', desc: 'Upgrade machines to levels IV and V.', price: 60, once: true, flag: 'bought_master', needs: 'tinker' },
  { id: 'copper', name: 'Copper Flakes ×40', desc: 'A crate of bright flakes.', price: 6, grow: 1.25, gives: { copper_grit: 40 } },
  { id: 'iron', name: 'Iron Flakes ×30', desc: 'A crate of dark flakes.', price: 10, grow: 1.25, gives: { iron_grit: 30 }, needs: 'iron' },
  { id: 'stardust', name: 'Stardust ×6', desc: 'Swept from a meteor field.', price: 15, grow: 1.25, gives: { stardust: 6 }, needs: 'night' },
];
export const MARKET_BY_ID: Record<string, MarketDef> = Object.fromEntries(MARKET.map((m) => [m.id, m]));

export function marketPrice(m: MarketDef, bought: number): number {
  return Math.round(m.price * Math.pow(m.grow ?? 1, bought));
}

// ───────────────────────── upgrades ─────────────────────────

export const UPGRADE_KINDS = new Set(['crafter', 'generator', 'harvester', 'drill', 'windmill', 'hive']);
export const MAX_LEVEL = 5;
export const BASIC_MAX_LEVEL = 3;

export function upgradable(def: BuildingDef): boolean {
  return UPGRADE_KINDS.has(def.kind);
}

/** Materials and Marks to raise a machine to `level` (2..5). */
export function upgradeCost(def: BuildingDef, level: number): { items: Stack; marks: number } {
  const items: Stack = {};
  const m = Math.pow(2, level - 1);
  for (const k in def.cost) items[k as ItemId] = Math.ceil((def.cost[k as ItemId] ?? 0) * m);
  return { items, marks: level >= 4 ? 15 * (level - 3) : 0 };
}

/** Speed (and windmill breeze) multiplier for a machine level. */
export const levelSpeed = (level: number) => 1 + 0.25 * (Math.max(1, level) - 1);
/** Buffer capacity multiplier. */
export const levelBuffer = (level: number) => 1 + 0.5 * (Math.max(1, level) - 1);
