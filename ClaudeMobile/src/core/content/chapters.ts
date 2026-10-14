import type { ItemId, Stack } from './items';

/**
 * The chapter line: a coherent run of goals from the first tree to beyond
 * the Aetherforge. One chapter is active at a time; finishing it pays its
 * reward and opens the next. Chapters 1, 3, 5, 7 and 9 also unlock decor
 * patterns (via the `patternsN` discoveries).
 */
export type Goal =
  | { t: 'built'; type: string; n: number; label?: string }   // standing buildings of a type ('*fruit' = any fruit tree)
  | { t: 'made'; item: ItemId; n: number }                   // made ever (mastery counter)
  | { t: 'tiles'; n: number }
  | { t: 'contracts'; n: number }
  | { t: 'charm'; n: number }
  | { t: 'level'; n: number }                                // any machine upgraded to this level
  | { t: 'biomes'; n: number }                               // distinct non-meadow biomes on the island
  | { t: 'islets'; n: number }
  | { t: 'forge'; n: number }                                // Aetherforge stages complete
  | { t: 'resonance'; n: number }
  | { t: 'renown'; n: number }                               // renown level (as shown, 1-based)
  | { t: 'codex'; n: number };

export interface ChapterDef {
  id: number;
  title: string;
  intro: string;
  goals: Goal[];
  reward: { items?: Stack; marks?: number; points?: number; unlock?: string };
}

export const CHAPTERS: ChapterDef[] = [
  { id: 1, title: 'A Seed of Land', intro: 'One tree and a very large sky. Make a place to work and give the island room.',
    goals: [{ t: 'built', type: 'workbench', n: 1 }, { t: 'built', type: 'composter', n: 1 }, { t: 'tiles', n: 13 }],
    reward: { items: { wood: 20, loam: 10 }, unlock: 'patterns1' } },
  { id: 2, title: 'What the Soil Hides', intro: 'Loam is full of small hard things — and fire turns them into more.',
    goals: [{ t: 'built', type: 'sieve', n: 1 }, { t: 'made', item: 'stone', n: 10 }, { t: 'built', type: 'kiln', n: 1 }, { t: 'made', item: 'copper', n: 3 }],
    reward: { items: { copper_grit: 12, charcoal: 6 } } },
  { id: 3, title: 'Gears and Flow', intro: 'Hands tire. Let machines gather and conveyors carry.',
    goals: [{ t: 'made', item: 'gear', n: 10 }, { t: 'built', type: 'harvester', n: 1 }, { t: 'built', type: 'depot', n: 1 }, { t: 'built', type: 'belt', n: 6 }],
    reward: { items: { plank: 30, stone: 20 }, unlock: 'patterns2' } },
  { id: 4, title: 'Catch the Wind', intro: 'Breeze drives machines that work while you watch. Traders are watching too.',
    goals: [{ t: 'built', type: 'windmill', n: 2 }, { t: 'made', item: 'plank', n: 150 }, { t: 'built', type: 'trading_post', n: 1 }, { t: 'contracts', n: 3 }],
    reward: { marks: 20, points: 1 } },
  { id: 5, title: 'Iron and Industry', intro: 'Grind stone fine enough and iron appears. Build finer things with it.',
    goals: [{ t: 'made', item: 'iron', n: 40 }, { t: 'built', type: 'assembler', n: 1 }, { t: 'made', item: 'mechanism', n: 8 }, { t: 'level', n: 2 }],
    reward: { marks: 40, unlock: 'patterns3' } },
  { id: 6, title: 'A Pleasant Isle', intro: 'An island is more than a factory. Shape the ground, plant an orchard, make it lovely.',
    goals: [{ t: 'charm', n: 40 }, { t: 'biomes', n: 1 }, { t: 'built', type: '*fruit', n: 2, label: 'Fruit trees growing' }, { t: 'contracts', n: 10 }],
    reward: { points: 1, items: { cherry_sapling: 2 } } },
  { id: 7, title: 'Clouds and Stars', intro: 'Clouds leave aether at the edge; the night sky drops stardust. Sing them together.',
    goals: [{ t: 'made', item: 'aether', n: 30 }, { t: 'made', item: 'stardust', n: 10 }, { t: 'made', item: 'crystal', n: 6 }],
    reward: { marks: 60, unlock: 'patterns4' } },
  { id: 8, title: 'Drifters', intro: 'Other islets drift in the haze. Call them home and tap their hearts.',
    goals: [{ t: 'islets', n: 2 }, { t: 'built', type: 'drill', n: 1 }, { t: 'made', item: 'sunmetal', n: 8 }],
    reward: { points: 1, items: { crystal: 4 } } },
  { id: 9, title: 'The Great Work', intro: 'Everything you have made points to one thing.',
    goals: [{ t: 'forge', n: 3 }],
    reward: { points: 1, marks: 200, unlock: 'patterns5' } },
  { id: 10, title: 'Beyond the Haze', intro: 'The Aetherforge asks for more. Make this the finest island in the sky.',
    goals: [{ t: 'resonance', n: 3 }, { t: 'charm', n: 300 }, { t: 'codex', n: 3 }, { t: 'renown', n: 20 }],
    reward: { points: 2, marks: 500 } },
];

/** Charm milestones: each grants renown. */
export const CHARM_MILESTONES = [20, 60, 150, 300, 600, 1000];
export const CHARM_XP = 40;
/** Contract Marks bonus from charm: +1% per 5 charm, up to +30%. */
export const charmTradeBonus = (charm: number) => Math.min(0.3, Math.floor(charm / 5) / 100);
