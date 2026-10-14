import { ITEMS, type ItemId } from './items';

/**
 * Long-term progression on top of discoveries: item mastery, renown levels
 * with perk points, luck, and codex collections. Logic lives in sim/actions.
 */

// ───────────────────────── mastery ─────────────────────────

export const MASTERY_STARS = 5;
export const MASTERY_SPEED = 0.05;

/** Items needed for each mastery star of an item. */
export function masteryThresholds(item: ItemId): number[] {
  const base = Math.max(5, Math.round(40 / (1 + ITEMS[item].tier / 2)));
  return Array.from({ length: MASTERY_STARS }, (_, k) => base * Math.pow(10, k));
}

/** Mastery stars (0..5) for a count of items made. */
export function masteryStar(item: ItemId, made: number): number {
  const t = masteryThresholds(item);
  let k = 0;
  while (k < t.length && made >= t[k]) k++;
  return k;
}

// ───────────────────────── renown ─────────────────────────

export const XP = { discovery: 25, star: 10, forgeStage: 100, resonance: 50, codex: 100, contractPerMark: 0.5 };

/** Renown XP needed to go from level L to L+1. */
export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(1.22, level));
}

export type PerkBranch = 'hands' | 'industry' | 'commerce';
export interface PerkDef { id: string; branch: PerkBranch; name: string; desc: (rank: number) => string; max: number }

export const PERKS: PerkDef[] = [
  { id: 'green_thumb', branch: 'hands', name: 'Green Thumb', desc: (r) => `Trees regrow ${10 * r}% faster.`, max: 3 },
  { id: 'bountiful', branch: 'hands', name: 'Bountiful', desc: (r) => `Gathering by hand: ${8 + 5 * r}% chance of a triple harvest.`, max: 3 },
  { id: 'sure_sift', branch: 'hands', name: 'Sure Sift', desc: (r) => `Rare finds from sifting and grinding +${15 * r}%.`, max: 3 },
  { id: 'forager', branch: 'hands', name: 'Forager', desc: (r) => `+${r} fiber from every tuft.`, max: 3 },
  { id: 'well_oiled', branch: 'industry', name: 'Well Oiled', desc: (r) => `Every machine works ${5 * r}% faster.`, max: 3 },
  { id: 'swift_belts', branch: 'industry', name: 'Swift Belts', desc: (r) => `Conveyors run ${10 * r}% faster.`, max: 3 },
  { id: 'deep_cellars', branch: 'industry', name: 'Deep Cellars', desc: (r) => `Your stash holds ${10 * r}% more.`, max: 3 },
  { id: 'lucky_gears', branch: 'industry', name: 'Lucky Gears', desc: (r) => `Lucky (double) output: ${2 + r}% of machine cycles.`, max: 3 },
  { id: 'haggler', branch: 'commerce', name: 'Haggler', desc: (r) => `Contracts pay ${10 * r}% more Marks.`, max: 3 },
  { id: 'good_name', branch: 'commerce', name: 'Good Name', desc: (r) => `Reputation from contracts +${15 * r}%.`, max: 3 },
  { id: 'bargains', branch: 'commerce', name: 'Bargains', desc: (r) => `Market prices −${5 * r}%.`, max: 3 },
  { id: 'night_shift', branch: 'commerce', name: 'Night Shift', desc: (r) => `Time away counts ${5 * r}% better.`, max: 3 },
];
export const PERK: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const RESPEC_PER_POINT = 5;

// ───────────────────────── luck ─────────────────────────

export const LUCK = { machine: 0.02, perMachinePerk: 0.01, crit: 0.08, perCritPerk: 0.05, critMult: 3, comboWindow: 2, comboEvery: 5 };

// ───────────────────────── codex ─────────────────────────

export const GEMS: ItemId[] = ['topaz', 'ruby', 'opal', 'emerald'];
export const FRUIT_ITEMS: ItemId[] = ['apple', 'cherry', 'orange', 'date', 'pear', 'plum'];
export interface CodexSet { id: string; name: string; desc: string }
export const CODEX: CodexSet[] = [
  { id: 'gems', name: 'Gems', desc: 'Find all four rare gems.' },
  { id: 'fruits', name: 'Orchard', desc: 'Harvest all six fruits.' },
  { id: 'biomes', name: 'Four Grounds', desc: 'Discover marsh, dunes and frost.' },
  { id: 'wonders', name: 'Wonders', desc: 'Bring every islet home and finish the Aetherforge.' },
];
