import type { ItemId } from './items';

/**
 * Discoveries gate everything. Each one becomes known when all of its
 * conditions hold. Before that, once its `after` prerequisites are known, the
 * journal may show its riddle-like `hint` (never its name), preserving mystery.
 */
export type Cond =
  | { t: 'item'; item: ItemId; n: number }      // total ever obtained
  | { t: 'built'; type: string; n: number }      // currently standing
  | { t: 'tiles'; n: number }
  | { t: 'event'; e: string }                    // one-off sim events
  | { t: 'delivered'; n: number };               // items delivered via depots

export interface DiscoveryDef {
  id: string;
  title: string;
  text: string;
  hint: string;
  after: string[];
  when: Cond[];
}

const D: DiscoveryDef[] = [
  { id: 'start', title: 'A Seed of Land', text: 'One tree, a handful of soil and a very large sky.', hint: '', after: [], when: [] },
  { id: 'compost', title: 'Rot', text: 'Leaves pile up. Given time, they become soil.', hint: 'Leaves remember being soil.', after: ['start'], when: [{ t: 'item', item: 'leaf', n: 6 }] },
  { id: 'land', title: 'Room to Grow', text: 'Soil can be shaped into new ground at the island’s edge.', hint: 'Soil wants to become ground.', after: ['compost'], when: [{ t: 'item', item: 'loam', n: 2 }] },
  { id: 'plank', title: 'Grain', text: 'Timber splits cleanly along its grain.', hint: '', after: ['start'], when: [{ t: 'item', item: 'wood', n: 14 }] },
  { id: 'sapling', title: 'Cuttings', text: 'Saplings take root on grass.', hint: 'Sometimes the tree lets a piece of itself go.', after: ['start'], when: [{ t: 'item', item: 'sapling', n: 1 }] },
  { id: 'fiber', title: 'Tufts', text: 'New ground sprouts tall grass. Its fiber twists into twine.', hint: 'New ground does not stay bare.', after: ['land'], when: [{ t: 'item', item: 'fiber', n: 3 }] },
  { id: 'sieve', title: 'What Soil Hides', text: 'Loam is full of small hard things.', hint: 'There is more in loam than loam.', after: ['land'], when: [{ t: 'tiles', n: 13 }, { t: 'item', item: 'loam', n: 8 }, { t: 'item', item: 'fiber', n: 3 }] },
  { id: 'stone', title: 'Weight', text: 'Pebbles pack into stone.', hint: '', after: ['sieve'], when: [{ t: 'item', item: 'pebble', n: 4 }] },
  { id: 'clay', title: 'Morning', text: 'Mesh catches dew. Dew and loam make clay.', hint: 'The air is wet at dawn.', after: ['stone'], when: [{ t: 'item', item: 'stone', n: 2 }] },
  { id: 'marsh', title: 'Wetland', text: 'Dew and loam soak grass into marsh: reeds full of fiber, willows, quick compost, wet air for dew catchers.', hint: 'Too much dew turns ground soft.', after: ['clay'], when: [{ t: 'item', item: 'dew', n: 12 }] },
  { id: 'farming', title: 'Furrows', text: 'Loam and planks make a field. Fields drink dew and grow wheat or carrots — best on wet ground.', hint: 'Dew could water more than clay.', after: ['clay'], when: [{ t: 'item', item: 'dew', n: 15 }] },
  { id: 'ranching', title: 'Flocks', text: 'Sky sheep and hens eat wheat. Sheep grow wool; hens lay eggs.', hint: 'Grain could feed more than people.', after: ['farming'], when: [{ t: 'item', item: 'wheat', n: 20 }] },
  { id: 'weaving', title: 'The Loom', text: 'Wool weaves into cloth — for homes and for sails.', hint: 'Wool wants to be woven.', after: ['ranching'], when: [{ t: 'item', item: 'wool', n: 6 }] },
  { id: 'kiln', title: 'Fire', text: 'Clay and stone make a kiln. Kilns make charcoal, brick — and metal.', hint: 'Clay can hold a fire.', after: ['clay'], when: [{ t: 'item', item: 'clay', n: 2 }] },
  { id: 'copper', title: 'Copper', text: 'Copper becomes gears and wire. Stone can pave the ground.', hint: 'The bright flakes would melt.', after: ['kiln'], when: [{ t: 'item', item: 'copper', n: 1 }] },
  { id: 'automation', title: 'Tireless', text: 'Hands tire. Gears do not. A Treewright harvests the trees beside it.', hint: 'Gears could do the gathering.', after: ['copper'], when: [{ t: 'item', item: 'gear', n: 2 }] },
  { id: 'belts', title: 'Flow', text: 'Conveyors carry items. Depots take them into your stash.', hint: 'Things could travel on their own.', after: ['automation'], when: [{ t: 'built', type: 'harvester', n: 1 }] },
  { id: 'trade', title: 'Sails', text: 'Traders sail the sky. A Trading Post at the edge lets them dock and offer contracts for Marks.', hint: 'Sails on the horizon.', after: ['belts'], when: [{ t: 'delivered', n: 60 }] },
  { id: 'orchard', title: 'Orchards', text: 'A fruit sapling from far away. Apples press into cider.', hint: '', after: ['trade'], when: [{ t: 'item', item: 'fruit_sapling', n: 1 }] },
  { id: 'apiary', title: 'Bees', text: 'Hives near trees make honey and wax. Bees help fruit trees bear more.', hint: '', after: ['trade'], when: [{ t: 'event', e: 'bought_hive' }] },
  { id: 'tradelights', title: 'Lanterns', text: 'Trade lanterns: two candles and a little wood. They glow at night.', hint: '', after: ['trade'], when: [{ t: 'event', e: 'bought_lanterns' }] },
  { id: 'master', title: 'Master Tools', text: 'Machines can now be upgraded to levels IV and V.', hint: '', after: ['tinker'], when: [{ t: 'event', e: 'bought_master' }] },
  { id: 'patterns1', title: 'Garden Patterns', text: 'Paths, fences, hedges, benches and flower beds. Decor makes the island charming — and traders notice.', hint: '', after: ['start'], when: [{ t: 'event', e: 'amb_land_1' }] },
  { id: 'patterns2', title: 'Mason Patterns', text: 'Cobble paths, stone walls, planters, banners and wells.', hint: '', after: ['start'], when: [{ t: 'event', e: 'amb_industry_2' }] },
  { id: 'patterns3', title: 'Town Patterns', text: 'Lamp posts, brick arches, fountains and gazebos.', hint: '', after: ['start'], when: [{ t: 'event', e: 'amb_settlement_1' }] },
  { id: 'patterns4', title: 'Sky Patterns', text: 'Skystone paths, crystal lamps, statues and star arches.', hint: '', after: ['start'], when: [{ t: 'event', e: 'amb_aether_2' }] },
  { id: 'patterns5', title: 'Monument', text: 'A model of the Aetherforge, cast in sunmetal.', hint: '', after: ['start'], when: [{ t: 'event', e: 'amb_aether_3' }] },
  { id: 'storage', title: 'Plenty', text: 'Your stash is full. Crates make room.', hint: 'A stash has limits.', after: ['belts'], when: [{ t: 'event', e: 'stash_full' }] },
  { id: 'wind', title: 'Wind', text: 'Windmills make breeze. Breeze turns machines that work without you.', hint: 'The wind never stops up here.', after: ['belts'], when: [{ t: 'delivered', n: 25 }, { t: 'item', item: 'copper', n: 6 }] },
  { id: 'tinker', title: 'Tinkering', text: 'Machines can be improved. Each level works faster and holds more.', hint: 'Gears could be finer.', after: ['wind'], when: [{ t: 'item', item: 'gear', n: 20 }] },
  { id: 'dispatch', title: 'Dispatch', text: 'A Dispatcher sends one item out of your stash onto a conveyor.', hint: 'The stash could give as well as take.', after: ['wind'], when: [{ t: 'delivered', n: 120 }] },
  { id: 'mill', title: 'Grinding', text: 'Stone grinds into gravel, and gravel hides other things.', hint: 'Stone could be broken further.', after: ['wind'], when: [{ t: 'built', type: 'windmill', n: 1 }, { t: 'item', item: 'stone', n: 30 }] },
  { id: 'glass', title: 'Clarity', text: 'Sand melts into glass.', hint: '', after: ['mill'], when: [{ t: 'item', item: 'sand', n: 2 }] },
  { id: 'dunes', title: 'Dunes', text: 'Sand spread over grass makes warm dunes: palms, steady wind, dry air. Oranges and dates love it.', hint: 'Sand remembers the sun.', after: ['glass'], when: [{ t: 'item', item: 'sand', n: 6 }] },
  { id: 'baking', title: 'Bread', text: 'Millstones grind wheat to flour. A bakery oven makes bread, stew and pie.', hint: 'Stone could grind more than stone.', after: ['farming', 'mill'], when: [{ t: 'item', item: 'wheat', n: 30 }] },
  { id: 'kitchen', title: 'Kitchen', text: 'The oven can do more than bread: garden soup, cherry jam, honey cake. The more varied the table, the happier your settlers.', hint: 'Settlers tire of the same loaf.', after: ['baking'], when: [{ t: 'item', item: 'bread', n: 6 }] },
  { id: 'settlers', title: 'Neighbours', text: 'With homes and food, settlers come. Give them roles: they make your island better at what you choose.', hint: 'Bread smells like company.', after: ['baking', 'weaving'], when: [{ t: 'item', item: 'bread', n: 4 }] },
  { id: 'drafting', title: 'Designs', text: 'A drafting table turns what you have learned into better ways of making things. Each design costs materials, and is yours for good.', hint: 'Gears and glass could draw as well as turn.', after: ['assembler'], when: [{ t: 'item', item: 'mechanism', n: 2 }] },
  { id: 'iron', title: 'Iron', text: 'Iron needs more heat than a kiln can give. Bellows can.', hint: 'The dark flakes resist the kiln.', after: ['mill'], when: [{ t: 'item', item: 'iron_grit', n: 3 }] },
  { id: 'steel', title: 'Steel', text: 'Iron folded with charcoal in the furnace holds an edge. Steel makes springs, and springs make better mechanisms.', hint: 'Iron could be harder still.', after: ['iron'], when: [{ t: 'item', item: 'iron', n: 30 }] },
  { id: 'assembler', title: 'Precision', text: 'Assemblers build components unattended.', hint: 'Iron could hold finer work.', after: ['iron'], when: [{ t: 'item', item: 'iron', n: 6 }] },
  { id: 'routing', title: 'Routing', text: 'Splitters share. Sorters choose. Silos hold.', hint: 'One line could become many.', after: ['assembler'], when: [{ t: 'built', type: 'assembler', n: 1 }] },
  { id: 'aether', title: 'The Clouds Are Not Empty', text: 'Clouds brush the island’s edge, and leave something behind.', hint: 'Watch the clouds at the edge.', after: ['assembler'], when: [{ t: 'item', item: 'mechanism', n: 4 }, { t: 'item', item: 'lens', n: 2 }] },
  { id: 'distill', title: 'Distillation', text: 'Mist separates into dew — and aether.', hint: '', after: ['aether'], when: [{ t: 'item', item: 'mist', n: 4 }] },
  { id: 'frost', title: 'Frost', text: 'Mist frozen into pebbles makes frost: pines with twice the timber, strong wind, slow growth. Plums sweeten there.', hint: 'Mist can freeze.', after: ['distill'], when: [{ t: 'item', item: 'mist', n: 6 }] },
  { id: 'night', title: 'Night Harvest', text: 'Something falls from the sky at night. A net could catch it.', hint: 'Look up after dark.', after: ['distill'], when: [{ t: 'item', item: 'aether', n: 1 }] },
  { id: 'resonance', title: 'Resonance', text: 'Aether and stardust sing together. So do aether and stone.', hint: '', after: ['night'], when: [{ t: 'item', item: 'stardust', n: 2 }] },
  { id: 'skystone', title: 'Skystone', text: 'Ground that needs no soil. Faster conveyors. Deeper vaults.', hint: '', after: ['resonance'], when: [{ t: 'item', item: 'skystone', n: 2 }] },
  { id: 'pylon', title: 'Hum', text: 'Crystals hum. Machines near them hurry. And aether can burn.', hint: '', after: ['resonance'], when: [{ t: 'item', item: 'crystal', n: 2 }] },
  { id: 'beacon', title: 'Drifters', text: 'Other islets drift in the haze. A beacon could call one home.', hint: 'You are not the only island.', after: ['pylon'], when: [{ t: 'item', item: 'crystal', n: 6 }, { t: 'tiles', n: 36 }] },
  { id: 'drill', title: 'Islet Hearts', text: 'The islet carries a heart. A drill can tap it.', hint: '', after: ['beacon'], when: [{ t: 'event', e: 'islet_docked' }] },
  { id: 'alloy', title: 'Sunmetal', text: 'Iron, copper and aether, melted together, keep glowing.', hint: 'Metals could be married.', after: ['drill'], when: [{ t: 'built', type: 'drill', n: 1 }] },
  { id: 'wisps', title: 'Wisps', text: 'Lumen coils wake small lights that love to carry things.', hint: 'Light could carry things.', after: ['pylon'], when: [{ t: 'item', item: 'crystal', n: 14 }, { t: 'built', type: 'assembler', n: 2 }] },
  { id: 'forge', title: 'The Great Work', text: 'Everything you have made points to one thing.', hint: 'Every chain leads somewhere.', after: ['alloy', 'wisps'], when: [{ t: 'item', item: 'sunmetal', n: 4 }, { t: 'item', item: 'amber', n: 1 }] },
  { id: 'awakened', title: 'Awakening', text: 'The Aetherforge is alive. It asks for more.', hint: '', after: ['forge'], when: [{ t: 'event', e: 'forge_complete' }] },
];

export const DISCOVERIES: Record<string, DiscoveryDef> = Object.fromEntries(D.map((d) => [d.id, d]));
export const DISCOVERY_LIST = D;
