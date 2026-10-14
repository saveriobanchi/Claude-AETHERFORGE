import type { ItemId, Stack } from './items';

/**
 * Ambitions: seven paths, each a short ladder. The next rung of every path
 * is open at once — the player decides what to develop and in what order.
 * Some rungs also unlock decor patterns (via the `patternsN` discoveries).
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
  | { t: 'codex'; n: number }
  | { t: 'settlers'; n: number }
  | { t: 'blueprints'; n: number };

export type PathId = 'land' | 'industry' | 'trade' | 'nature' | 'settlement' | 'aether' | 'invention';

export interface PathDef { id: PathId; name: string; icon: string; desc: string }

export const PATHS: PathDef[] = [
  { id: 'land', name: 'Land', icon: 'expand', desc: 'Grow the island, shape its biomes, call islets home.' },
  { id: 'industry', name: 'Industry', icon: 'gear', desc: 'Machines, metals and the long chains between them.' },
  { id: 'trade', name: 'Trade', icon: 'marks', desc: 'Contracts, Marks and a name among the sky traders.' },
  { id: 'nature', name: 'Nature', icon: 'leaf', desc: 'Orchards, bees and the wind.' },
  { id: 'settlement', name: 'Settlement', icon: 'home', desc: 'Fields, kitchens and people who call this island home.' },
  { id: 'aether', name: 'Aether', icon: 'star', desc: 'Clouds, stars and the Aetherforge.' },
  { id: 'invention', name: 'Invention', icon: 'research', desc: 'Draft new designs: better ways to make what you already make.' },
];

export interface Reward { items?: Stack; marks?: number; points?: number; unlock?: string }

export interface AmbitionDef {
  /** `<path>_<rung>`, e.g. `land_1`. */
  id: string;
  path: PathId;
  rung: number;
  title: string;
  intro: string;
  goals: Goal[];
  reward: Reward;
}

type Rung = Omit<AmbitionDef, 'id' | 'path' | 'rung'>;
const LADDERS: Record<PathId, Rung[]> = {
  land: [
    { title: 'First Ground', intro: 'One tree and a very large sky. Make a place to work and give the island room.',
      goals: [{ t: 'built', type: 'workbench', n: 1 }, { t: 'built', type: 'composter', n: 1 }, { t: 'tiles', n: 13 }],
      reward: { items: { wood: 20, loam: 10 }, unlock: 'patterns1' } },
    { title: 'Room to Grow', intro: 'More ground, and ground of a different kind.',
      goals: [{ t: 'tiles', n: 30 }, { t: 'biomes', n: 1 }], reward: { items: { plank: 20, stone: 20 }, points: 1 } },
    { title: 'Four Lands', intro: 'Marsh, dune and frost side by side — each grows something the others cannot.',
      goals: [{ t: 'tiles', n: 60 }, { t: 'biomes', n: 3 }], reward: { marks: 60 } },
    { title: 'Drifting Home', intro: 'Other islets drift in the haze. Call them home.',
      goals: [{ t: 'islets', n: 2 }, { t: 'tiles', n: 100 }], reward: { points: 1, items: { crystal: 4 } } },
  ],
  industry: [
    { title: 'What the Soil Hides', intro: 'Loam is full of small hard things — and fire turns them into more.',
      goals: [{ t: 'built', type: 'sieve', n: 1 }, { t: 'made', item: 'stone', n: 10 }, { t: 'built', type: 'kiln', n: 1 }, { t: 'made', item: 'copper', n: 3 }],
      reward: { items: { copper_grit: 12, charcoal: 6 } } },
    { title: 'Gears and Flow', intro: 'Hands tire. Let machines gather and conveyors carry.',
      goals: [{ t: 'made', item: 'gear', n: 10 }, { t: 'built', type: 'harvester', n: 1 }, { t: 'built', type: 'depot', n: 1 }, { t: 'built', type: 'belt', n: 6 }],
      reward: { items: { plank: 30, stone: 20 }, unlock: 'patterns2' } },
    { title: 'Iron and Industry', intro: 'Grind stone fine enough and iron appears. Build finer things with it.',
      goals: [{ t: 'made', item: 'iron', n: 40 }, { t: 'built', type: 'assembler', n: 1 }, { t: 'made', item: 'mechanism', n: 8 }, { t: 'level', n: 2 }],
      reward: { marks: 40, points: 1 } },
    { title: 'Heavy Works', intro: 'Drill to the heart of an islet and cast the brightest metal.',
      goals: [{ t: 'built', type: 'drill', n: 1 }, { t: 'made', item: 'sunmetal', n: 8 }, { t: 'level', n: 4 }],
      reward: { points: 1, marks: 120 } },
  ],
  trade: [
    { title: 'Open for Business', intro: 'Traders pass every day. Give them a reason to stop.',
      goals: [{ t: 'built', type: 'trading_post', n: 1 }, { t: 'contracts', n: 3 }], reward: { marks: 20 } },
    { title: 'A Known Name', intro: 'Steady work, steady pay.',
      goals: [{ t: 'contracts', n: 15 }, { t: 'made', item: 'plank', n: 150 }], reward: { points: 1, marks: 30 } },
    { title: 'Merchant Isle', intro: 'A lovely island fetches better prices.',
      goals: [{ t: 'contracts', n: 40 }, { t: 'charm', n: 60 }], reward: { marks: 150 } },
    { title: 'Sky Exchange', intro: 'Every trader in the sky knows your post.',
      goals: [{ t: 'contracts', n: 100 }, { t: 'renown', n: 12 }], reward: { points: 1, marks: 300 } },
  ],
  nature: [
    { title: 'First Orchard', intro: 'Fruit trees grow from saplings the old trees drop.',
      goals: [{ t: 'built', type: '*fruit', n: 2, label: 'Grow 2 fruit trees' }], reward: { items: { cherry_sapling: 2 } } },
    { title: 'Wind and Bloom', intro: 'Breeze drives machines that work while you watch; flowers make it pleasant.',
      goals: [{ t: 'built', type: 'windmill', n: 2 }, { t: 'charm', n: 40 }], reward: { marks: 20, points: 1 } },
    { title: 'Hum of Bees', intro: 'Hives near flowers and fruit make honey and wax.',
      goals: [{ t: 'built', type: 'hive', n: 2 }, { t: 'made', item: 'honey', n: 20 }], reward: { points: 1 } },
    { title: 'Every Fruit', intro: 'Each biome grows its own fruit. Plant them all.',
      goals: [{ t: 'built', type: '*fruit', n: 8, label: 'Grow 8 fruit trees' }, { t: 'biomes', n: 2 }], reward: { marks: 100, points: 1 } },
  ],
  settlement: [
    { title: 'Harvest Home', intro: 'Fields of wheat, a millstone and an oven: bread.',
      goals: [{ t: 'built', type: 'field', n: 2 }, { t: 'made', item: 'bread', n: 10 }],
      reward: { items: { wheat: 20 }, unlock: 'patterns3' } },
    { title: 'First Neighbours', intro: 'Build a cottage, keep food in the stores, and people will come.',
      goals: [{ t: 'built', type: 'cottage', n: 1 }, { t: 'settlers', n: 2 }], reward: { points: 1 } },
    { title: 'A Village', intro: 'Feed them well and varied — happy settlers work harder.',
      goals: [{ t: 'settlers', n: 6 }, { t: 'made', item: 'pie', n: 10 }], reward: { marks: 100 } },
    { title: 'Town in the Sky', intro: 'A real town, with fountains and lamplight.',
      goals: [{ t: 'settlers', n: 12 }, { t: 'charm', n: 300 }], reward: { points: 2 } },
  ],
  aether: [
    { title: 'Clouds and Stars', intro: 'Clouds leave aether at the edge; the night sky drops stardust.',
      goals: [{ t: 'made', item: 'aether', n: 30 }, { t: 'made', item: 'stardust', n: 10 }], reward: { marks: 30 } },
    { title: 'Song of Crystal', intro: 'Sing aether and stardust together.',
      goals: [{ t: 'made', item: 'crystal', n: 6 }], reward: { marks: 60, unlock: 'patterns4' } },
    { title: 'The Great Work', intro: 'Everything you have made points to one thing.',
      goals: [{ t: 'forge', n: 3 }], reward: { points: 1, marks: 200, unlock: 'patterns5' } },
    { title: 'Beyond the Haze', intro: 'The Aetherforge asks for more.',
      goals: [{ t: 'resonance', n: 3 }, { t: 'codex', n: 3 }], reward: { points: 2, marks: 500 } },
  ],
  invention: [
    { title: 'The Drawing Board', intro: 'A drafting table, paper and a steady hand. Draw a better machine.',
      goals: [{ t: 'built', type: 'drafting_table', n: 1 }, { t: 'blueprints', n: 1 }], reward: { marks: 30 } },
    { title: 'Tinkerer', intro: 'Every design pays for itself, eventually.',
      goals: [{ t: 'blueprints', n: 3 }, { t: 'level', n: 3 }], reward: { points: 1 } },
    { title: 'Inventor', intro: 'Your workshops run on your own ideas.',
      goals: [{ t: 'blueprints', n: 6 }], reward: { marks: 200 } },
    { title: 'Master Designer', intro: 'Every design drafted.',
      goals: [{ t: 'blueprints', n: 8 }], reward: { points: 2 } },
  ],
};

export const AMBITIONS: AmbitionDef[] = PATHS.flatMap((p) =>
  LADDERS[p.id].map((r, i) => ({ ...r, id: `${p.id}_${i + 1}`, path: p.id, rung: i + 1 })));
export const AMBITION: Record<string, AmbitionDef> = Object.fromEntries(AMBITIONS.map((a) => [a.id, a]));
export const AMBITION_XP = 60;

/** Charm milestones: each grants renown. */
export const CHARM_MILESTONES = [20, 60, 150, 300, 600, 1000];
export const CHARM_XP = 40;
/** Contract Marks bonus from charm: +1% per 5 charm, up to +30%. */
export const charmTradeBonus = (charm: number) => Math.min(0.3, Math.floor(charm / 5) / 100);
