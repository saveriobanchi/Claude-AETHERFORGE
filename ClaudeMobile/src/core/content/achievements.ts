import type { Goal } from './ambitions';
import type { ItemId } from './items';

/**
 * Achievements: a tree per branch. Each one opens once its parent is earned,
 * so the tree reveals itself as you play (locked ones show only "???").
 * They pay renown XP — never Marks — so they can't feed the economy.
 */

export type AchGoal =
  | Goal
  | { t: 'stat'; key: 'harvests' | 'delivered' | 'crafted' | 'built' | 'playSeconds' | 'bestCombo'; n: number }
  | { t: 'earned'; n: number }
  | { t: 'tradeLevel'; n: number }
  | { t: 'discoveries'; n: number }
  | { t: 'stars'; n: number }
  | { t: 'ambitions'; n: number }
  | { t: 'kind'; kind: string; n: number; label: string }
  | { t: 'years'; n: number }
  | { t: 'paved'; n: number }
  | { t: 'perks'; n: number }
  | { t: 'tended'; n: number };

export type BranchId = 'hands' | 'land' | 'craft' | 'industry' | 'nature' | 'trade' | 'settlement' | 'aether' | 'knowledge' | 'charm';

export interface AchBranch { id: BranchId; name: string; desc: string; icon: string }

export const ACH_BRANCHES: AchBranch[] = [
  { id: 'hands', name: 'Gatherer', desc: 'Everything starts with a tap.', icon: 'item:wood' },
  { id: 'land', name: 'Landshaper', desc: 'Ground, laid tile by tile.', icon: 'ui:expand' },
  { id: 'craft', name: 'Maker', desc: 'Things made, and made well.', icon: 'item:gear' },
  { id: 'industry', name: 'Engineer', desc: 'Machines that work while you watch.', icon: 'item:mechanism' },
  { id: 'nature', name: 'Grower', desc: 'Orchards, hives and fields.', icon: 'item:apple' },
  { id: 'trade', name: 'Merchant', desc: 'Sails, contracts and Marks.', icon: 'ui:marks' },
  { id: 'settlement', name: 'Host', desc: 'Neighbours, and what they eat.', icon: 'ui:settler' },
  { id: 'aether', name: 'Skybound', desc: 'Aether, islets and the great work.', icon: 'item:crystal' },
  { id: 'knowledge', name: 'Scholar', desc: 'What you have learned and mastered.', icon: 'ui:research' },
  { id: 'charm', name: 'Keeper', desc: 'A lovely island, kept for years.', icon: 'ui:charm' },
];

export type Medal = 'bronze' | 'silver' | 'gold' | 'star';

export interface AchDef {
  id: string;
  branch: BranchId;
  /** Earned first (null for a branch root). */
  parent: string | null;
  name: string;
  /** Flavour line shown once it is visible. */
  flavor: string;
  goal: AchGoal;
  medal: Medal;
}

const XP_BY_MEDAL: Record<Medal, number> = { bronze: 20, silver: 45, gold: 90, star: 180 };
export const achXp = (a: AchDef) => XP_BY_MEDAL[a.medal];

const L: AchDef[] = [];
function add(branch: BranchId, id: string, parent: string | null, medal: Medal, name: string, flavor: string, goal: AchGoal): void {
  L.push({ id, branch, parent, name, flavor, goal, medal });
}
const made = (item: ItemId, n: number): Goal => ({ t: 'made', item, n });

// ── Gatherer ──
add('hands', 'h_first', null, 'bronze', 'First Gathering', 'A leaf, a stick, a start.', { t: 'stat', key: 'harvests', n: 1 });
add('hands', 'h_50', 'h_first', 'bronze', 'Busy Hands', 'The island knows your touch.', { t: 'stat', key: 'harvests', n: 50 });
add('hands', 'h_500', 'h_50', 'silver', 'Calloused', 'Hands that know the work.', { t: 'stat', key: 'harvests', n: 500 });
add('hands', 'h_5000', 'h_500', 'gold', 'Thousand Taps', 'Five thousand, in fact.', { t: 'stat', key: 'harvests', n: 5000 });
add('hands', 'h_25000', 'h_5000', 'star', 'Tireless', 'Machines could do this. You chose not to.', { t: 'stat', key: 'harvests', n: 25000 });
add('hands', 'h_combo10', 'h_50', 'bronze', 'In the Rhythm', 'Ten quick taps in a row.', { t: 'stat', key: 'bestCombo', n: 10 });
add('hands', 'h_combo30', 'h_combo10', 'silver', 'Flow', 'Thirty without a pause.', { t: 'stat', key: 'bestCombo', n: 30 });
add('hands', 'h_combo75', 'h_combo30', 'gold', 'Drumroll', 'Seventy-five. Your thumb aches.', { t: 'stat', key: 'bestCombo', n: 75 });
add('hands', 'h_wood100', 'h_first', 'bronze', 'Woodcutter', 'A good pile of timber.', made('wood', 100));
add('hands', 'h_wood2k', 'h_wood100', 'silver', 'Timberland', 'Two thousand logs and counting.', made('wood', 2000));
add('hands', 'h_wood20k', 'h_wood2k', 'gold', 'Forest Lord', 'The trees grow back. Mostly.', made('wood', 20000));
add('hands', 'h_leaf500', 'h_wood100', 'bronze', 'Leaf Pile', 'Soft enough to jump in.', made('leaf', 500));
add('hands', 'h_fiber300', 'h_leaf500', 'silver', 'Tuft Hunter', 'Every tuft, combed.', made('fiber', 300));
add('hands', 'h_tend1', 'h_leaf500', 'bronze', 'Green Fingers', 'A tree tended with care.', { t: 'tended', n: 1 });
add('hands', 'h_tend12', 'h_tend1', 'silver', 'Arborist', 'Twelve trees fully tended.', { t: 'tended', n: 12 });
add('hands', 'h_pebble500', 'h_first', 'bronze', 'Pebble Picker', 'Small stones, big plans.', made('pebble', 500));

// ── Landshaper ──
add('land', 'l_12', null, 'bronze', 'Elbow Room', 'A little more ground.', { t: 'tiles', n: 12 });
add('land', 'l_25', 'l_12', 'bronze', 'Homestead', 'Room for a workshop.', { t: 'tiles', n: 25 });
add('land', 'l_50', 'l_25', 'silver', 'Freeholder', 'Fifty tiles in the sky.', { t: 'tiles', n: 50 });
add('land', 'l_100', 'l_50', 'gold', 'Isle Builder', 'A hundred tiles of your own.', { t: 'tiles', n: 100 });
add('land', 'l_200', 'l_100', 'gold', 'Archipelago', 'Two hundred tiles.', { t: 'tiles', n: 200 });
add('land', 'l_400', 'l_200', 'star', 'Continent', 'The clouds make way.', { t: 'tiles', n: 400 });
add('land', 'l_pave5', 'l_25', 'bronze', 'Flagstones', 'Solid ground for heavy work.', { t: 'paved', n: 5 });
add('land', 'l_pave40', 'l_pave5', 'silver', 'Paved Quarter', 'Forty tiles of stone.', { t: 'paved', n: 40 });
add('land', 'l_pave120', 'l_pave40', 'gold', 'Stone City', 'Stone, wall to wall.', { t: 'paved', n: 120 });
add('land', 'l_biome1', 'l_25', 'silver', 'New Ground', 'Not every tile is meadow.', { t: 'biomes', n: 1 });
add('land', 'l_biome3', 'l_biome1', 'gold', 'Four Grounds', 'Every kind of ground, on one island.', { t: 'biomes', n: 3 });

// ── Maker ──
add('craft', 'c_first', null, 'bronze', 'Handmade', 'Your first craft.', { t: 'stat', key: 'crafted', n: 1 });
add('craft', 'c_100', 'c_first', 'bronze', 'Apprentice', 'A hundred things, by hand.', { t: 'stat', key: 'crafted', n: 100 });
add('craft', 'c_1000', 'c_100', 'silver', 'Journeyman', 'A thousand crafts.', { t: 'stat', key: 'crafted', n: 1000 });
add('craft', 'c_plank', 'c_first', 'bronze', 'Joiner', 'Planks enough for a floor.', made('plank', 100));
add('craft', 'c_plank2k', 'c_plank', 'silver', 'Lumberyard', 'Two thousand planks.', made('plank', 2000));
add('craft', 'c_brick', 'c_plank', 'bronze', 'Brickmaker', 'Fired in your own kiln.', made('brick', 100));
add('craft', 'c_brick1k', 'c_brick', 'silver', 'Mason', 'A thousand bricks.', made('brick', 1000));
add('craft', 'c_copper', 'c_brick', 'bronze', 'Coppersmith', 'Bright metal, from grit.', made('copper', 100));
add('craft', 'c_gear', 'c_copper', 'silver', 'Gearwright', 'Teeth that mesh.', made('gear', 250));
add('craft', 'c_glass', 'c_copper', 'silver', 'Glassblower', 'Sand made clear.', made('glass', 200));
add('craft', 'c_iron', 'c_gear', 'silver', 'Ironmonger', 'Dark and dependable.', made('iron', 200));
add('craft', 'c_plate', 'c_iron', 'gold', 'Plated', 'Heavy sheets of metal.', made('plate', 300));
add('craft', 'c_mech', 'c_gear', 'gold', 'Clockwork', 'Twenty-five little marvels.', made('mechanism', 25));
add('craft', 'c_mech250', 'c_mech', 'star', 'Horologist', 'Two hundred and fifty mechanisms.', made('mechanism', 250));
add('craft', 'c_steel', 'c_iron', 'silver', 'Steelwright', 'Iron that holds an edge.', made('steel', 100));
add('craft', 'c_spring', 'c_steel', 'gold', 'Wound Up', 'Five hundred springs.', made('spring', 500));
add('craft', 'c_lens', 'c_glass', 'gold', 'Lensgrinder', 'Fifty lenses, each one true.', made('lens', 50));

// ── Engineer ──
add('industry', 'i_crafter1', null, 'bronze', 'Automation', 'It works while you rest.', { t: 'kind', kind: 'crafter', n: 1, label: 'machines' });
add('industry', 'i_crafter10', 'i_crafter1', 'bronze', 'Workshop', 'Ten machines humming.', { t: 'kind', kind: 'crafter', n: 10, label: 'machines' });
add('industry', 'i_crafter30', 'i_crafter10', 'silver', 'Factory', 'Thirty machines.', { t: 'kind', kind: 'crafter', n: 30, label: 'machines' });
add('industry', 'i_crafter80', 'i_crafter30', 'gold', 'Industrial Isle', 'Eighty machines.', { t: 'kind', kind: 'crafter', n: 80, label: 'machines' });
add('industry', 'i_belt20', 'i_crafter1', 'bronze', 'Conveyance', 'Things that move themselves.', { t: 'kind', kind: 'belt', n: 20, label: 'conveyors' });
add('industry', 'i_belt150', 'i_belt20', 'silver', 'Beltway', 'A hundred and fifty conveyors.', { t: 'kind', kind: 'belt', n: 150, label: 'conveyors' });
add('industry', 'i_belt500', 'i_belt150', 'gold', 'Spaghetti', 'Five hundred. It all makes sense to you.', { t: 'kind', kind: 'belt', n: 500, label: 'conveyors' });
add('industry', 'i_deliver1k', 'i_belt20', 'silver', 'Supply Line', 'A thousand items delivered by machine.', { t: 'stat', key: 'delivered', n: 1000 });
add('industry', 'i_deliver50k', 'i_deliver1k', 'gold', 'Logistics', 'Fifty thousand deliveries.', { t: 'stat', key: 'delivered', n: 50000 });
add('industry', 'i_deliver500k', 'i_deliver50k', 'star', 'Never Stops', 'Half a million deliveries.', { t: 'stat', key: 'delivered', n: 500000 });
add('industry', 'i_wind', 'i_crafter1', 'bronze', 'Breeze Catcher', 'Power from the sky.', { t: 'kind', kind: 'windmill', n: 1, label: 'windmills' });
add('industry', 'i_wind10', 'i_wind', 'silver', 'Wind Farm', 'Ten windmills turning.', { t: 'kind', kind: 'windmill', n: 10, label: 'windmills' });
add('industry', 'i_level3', 'i_crafter10', 'silver', 'Tinkerer', 'A machine at level III.', { t: 'level', n: 3 });
add('industry', 'i_level5', 'i_level3', 'gold', 'Master Tools', 'A machine at level V.', { t: 'level', n: 5 });
add('industry', 'i_maxed10', 'i_level5', 'star', 'Perfectionist', 'Ten machines at level V.', { t: 'maxed', n: 10 });
add('industry', 'i_roost', 'i_belt150', 'silver', 'Wisp Keeper', 'Little lights that carry things.', { t: 'kind', kind: 'roost', n: 1, label: 'roosts' });
add('industry', 'i_roost4', 'i_roost', 'gold', 'Wisp Choir', 'Four roosts.', { t: 'kind', kind: 'roost', n: 4, label: 'roosts' });

// ── Grower ──
add('nature', 'n_sapling', null, 'bronze', 'Planter', 'Three saplings found.', made('sapling', 3));
add('nature', 'n_fruit1', 'n_sapling', 'bronze', 'Orchardist', 'A tree that gives fruit.', { t: 'built', type: '*fruit', n: 1, label: 'Grow a fruit tree' });
add('nature', 'n_fruit6', 'n_fruit1', 'silver', 'Orchard', 'Six fruit trees.', { t: 'built', type: '*fruit', n: 6, label: 'Grow 6 fruit trees' });
add('nature', 'n_fruit20', 'n_fruit6', 'gold', 'Grove', 'Twenty fruit trees.', { t: 'built', type: '*fruit', n: 20, label: 'Grow 20 fruit trees' });
add('nature', 'n_apple', 'n_fruit1', 'bronze', 'An Apple a Day', 'Crisp and sweet.', made('apple', 100));
add('nature', 'n_basket', 'n_fruit6', 'gold', 'Every Fruit', 'A basket of all six.', made('fruit_basket', 5));
add('nature', 'n_honey', 'n_fruit1', 'silver', 'Beekeeper', 'Fifty jars of honey.', made('honey', 50));
add('nature', 'n_honey1k', 'n_honey', 'gold', 'Hive Mind', 'A thousand jars.', made('honey', 1000));
add('nature', 'n_candle', 'n_honey', 'silver', 'Chandler', 'Wax and wick.', made('candle', 50));
add('nature', 'n_wheat', 'n_sapling', 'bronze', 'Farmer', 'Golden rows.', made('wheat', 100));
add('nature', 'n_wheat2k', 'n_wheat', 'silver', 'Breadbasket', 'Two thousand sheaves.', made('wheat', 2000));
add('nature', 'n_wool', 'n_wheat', 'silver', 'Shepherd', 'Soft and warm.', made('wool', 100));
add('nature', 'n_cloth', 'n_wool', 'gold', 'Weaver', 'A hundred bolts of cloth.', made('cloth', 100));
add('nature', 'n_egg', 'n_wheat', 'bronze', 'Henkeeper', 'Fresh every morning.', made('egg', 100));

// ── Merchant ──
add('trade', 't_first', null, 'bronze', 'First Sale', 'A trader leaves happy.', { t: 'contracts', n: 1 });
add('trade', 't_10', 't_first', 'bronze', 'Regular', 'Ten contracts filled.', { t: 'contracts', n: 10 });
add('trade', 't_50', 't_10', 'silver', 'Trusted', 'Fifty contracts.', { t: 'contracts', n: 50 });
add('trade', 't_250', 't_50', 'gold', 'Trade House', 'Two hundred and fifty contracts.', { t: 'contracts', n: 250 });
add('trade', 't_1000', 't_250', 'star', 'Merchant Prince', 'A thousand contracts.', { t: 'contracts', n: 1000 });
add('trade', 't_lv3', 't_first', 'bronze', 'Known in Port', 'Trade level 3.', { t: 'tradeLevel', n: 3 });
add('trade', 't_lv6', 't_lv3', 'silver', 'Name on Every Sail', 'Trade level 6.', { t: 'tradeLevel', n: 6 });
add('trade', 't_lv10', 't_lv6', 'gold', 'Sky Guild', 'Trade level 10.', { t: 'tradeLevel', n: 10 });
add('trade', 't_lv15', 't_lv10', 'star', 'Legend of the Lanes', 'Trade level 15.', { t: 'tradeLevel', n: 15 });
add('trade', 't_m1k', 't_10', 'bronze', 'Purse', 'A thousand Marks earned.', { t: 'earned', n: 1000 });
add('trade', 't_m10k', 't_m1k', 'silver', 'Coffers', 'Ten thousand Marks earned.', { t: 'earned', n: 10000 });
add('trade', 't_m100k', 't_m10k', 'gold', 'Treasury', 'A hundred thousand Marks earned.', { t: 'earned', n: 100000 });
add('trade', 't_m1m', 't_m100k', 'star', 'Fortune', 'A million Marks, earned honestly.', { t: 'earned', n: 1000000 });

// ── Host ──
add('settlement', 's_1', null, 'bronze', 'Neighbour', 'Someone moved in.', { t: 'settlers', n: 1 });
add('settlement', 's_5', 's_1', 'bronze', 'Hamlet', 'Five settlers.', { t: 'settlers', n: 5 });
add('settlement', 's_12', 's_5', 'silver', 'Village', 'Twelve settlers.', { t: 'settlers', n: 12 });
add('settlement', 's_25', 's_12', 'gold', 'Town', 'Twenty-five settlers.', { t: 'settlers', n: 25 });
add('settlement', 's_50', 's_25', 'star', 'Sky City', 'Fifty settlers.', { t: 'settlers', n: 50 });
add('settlement', 's_bread', 's_1', 'bronze', 'Baker', 'Fifty loaves.', made('bread', 50));
add('settlement', 's_bread1k', 's_bread', 'silver', 'Bakehouse', 'A thousand loaves.', made('bread', 1000));
add('settlement', 's_stew', 's_bread', 'silver', 'Hearty', 'A hundred bowls of stew.', made('stew', 100));
add('settlement', 's_pie', 's_stew', 'gold', 'Pie Day', 'A hundred pies.', made('pie', 100));
add('settlement', 's_pie1k', 's_pie', 'star', 'Feast', 'A thousand pies.', made('pie', 1000));
add('settlement', 's_soup', 's_bread', 'bronze', 'Soup Kitchen', 'A hundred bowls of garden soup.', made('soup', 100));
add('settlement', 's_jam', 's_soup', 'silver', 'Preserver', 'Fifty jars of cherry jam.', made('jam', 50));
add('settlement', 's_cake', 's_stew', 'gold', 'Sweet Tooth', 'A hundred honey cakes.', made('honey_cake', 100));
add('settlement', 's_home5', 's_5', 'silver', 'Lane of Cottages', 'Five homes.', { t: 'kind', kind: 'home', n: 5, label: 'homes' });

// ── Skybound ──
add('aether', 'a_mist', null, 'bronze', 'Head in the Clouds', 'Mist, gathered.', made('mist', 20));
add('aether', 'a_aether', 'a_mist', 'bronze', 'Aether', 'The sky, distilled.', made('aether', 50));
add('aether', 'a_aether2k', 'a_aether', 'silver', 'Aether Well', 'Two thousand aether.', made('aether', 2000));
add('aether', 'a_star', 'a_aether', 'silver', 'Starcatcher', 'Dust from the night.', made('stardust', 100));
add('aether', 'a_crystal', 'a_star', 'silver', 'Crystal Song', 'Fifty crystals.', made('crystal', 50));
add('aether', 'a_sunmetal', 'a_crystal', 'gold', 'Sunforged', 'Fifty bars of sunmetal.', made('sunmetal', 50));
add('aether', 'a_islet1', 'a_aether', 'silver', 'Drifter Home', 'An islet joins you.', { t: 'islets', n: 1 });
add('aether', 'a_islet4', 'a_islet1', 'gold', 'Gathering of Isles', 'Every drifter, home.', { t: 'islets', n: 4 });
add('aether', 'a_forge', 'a_crystal', 'gold', 'The Great Work', 'The Aetherforge stands.', { t: 'forge', n: 3 });
add('aether', 'a_res5', 'a_forge', 'gold', 'Resonant', 'Resonance 5.', { t: 'resonance', n: 5 });
add('aether', 'a_res15', 'a_res5', 'star', 'Harmonic', 'Resonance 15.', { t: 'resonance', n: 15 });
add('aether', 'a_res40', 'a_res15', 'star', 'Song of the Sky', 'Resonance 40.', { t: 'resonance', n: 40 });

// ── Scholar ──
add('knowledge', 'k_d5', null, 'bronze', 'Curious', 'Five discoveries.', { t: 'discoveries', n: 5 });
add('knowledge', 'k_d20', 'k_d5', 'silver', 'Learned', 'Twenty discoveries.', { t: 'discoveries', n: 20 });
add('knowledge', 'k_d40', 'k_d20', 'gold', 'Sage', 'Forty discoveries.', { t: 'discoveries', n: 40 });
add('knowledge', 'k_star1', 'k_d5', 'bronze', 'Practice', 'A mastery star.', { t: 'stars', n: 1 });
add('knowledge', 'k_star25', 'k_star1', 'silver', 'Expertise', 'Twenty-five mastery stars.', { t: 'stars', n: 25 });
add('knowledge', 'k_star100', 'k_star25', 'gold', 'Mastery', 'A hundred mastery stars.', { t: 'stars', n: 100 });
add('knowledge', 'k_codex1', 'k_d20', 'silver', 'Collector', 'A codex set complete.', { t: 'codex', n: 1 });
add('knowledge', 'k_codex4', 'k_codex1', 'gold', 'Complete Codex', 'Every codex set.', { t: 'codex', n: 4 });
add('knowledge', 'k_amb5', 'k_d5', 'bronze', 'Ambitious', 'Five ambitions achieved.', { t: 'ambitions', n: 5 });
add('knowledge', 'k_amb20', 'k_amb5', 'silver', 'Driven', 'Twenty ambitions.', { t: 'ambitions', n: 20 });
add('knowledge', 'k_amb40', 'k_amb20', 'gold', 'Unstoppable', 'Forty ambitions.', { t: 'ambitions', n: 40 });
add('knowledge', 'k_amb80', 'k_amb40', 'star', 'Living Legend', 'Eighty ambitions.', { t: 'ambitions', n: 80 });
add('knowledge', 'k_design1', 'k_d20', 'silver', 'Draftsman', 'Your first design.', { t: 'blueprints', n: 1 });
add('knowledge', 'k_design5', 'k_design1', 'gold', 'Architect', 'Five designs.', { t: 'blueprints', n: 5 });
add('knowledge', 'k_renown10', 'k_amb5', 'silver', 'Renowned', 'Renown 10.', { t: 'renown', n: 10 });
add('knowledge', 'k_renown30', 'k_renown10', 'gold', 'Famous', 'Renown 30.', { t: 'renown', n: 30 });
add('knowledge', 'k_perks10', 'k_renown10', 'silver', 'Well Rounded', 'Ten perk ranks.', { t: 'perks', n: 10 });

// ── Keeper ──
add('charm', 'ch_20', null, 'bronze', 'Homely', 'Charm 20.', { t: 'charm', n: 20 });
add('charm', 'ch_150', 'ch_20', 'silver', 'Pretty', 'Charm 150.', { t: 'charm', n: 150 });
add('charm', 'ch_500', 'ch_150', 'gold', 'Picturesque', 'Charm 500.', { t: 'charm', n: 500 });
add('charm', 'ch_1500', 'ch_500', 'star', 'Wonder of the Sky', 'Charm 1500.', { t: 'charm', n: 1500 });
add('charm', 'ch_decor10', 'ch_20', 'bronze', 'Decorator', 'Ten decorations.', { t: 'kind', kind: 'decor', n: 10, label: 'decorations' });
add('charm', 'ch_decor60', 'ch_decor10', 'silver', 'Landscaper', 'Sixty decorations.', { t: 'kind', kind: 'decor', n: 60, label: 'decorations' });
add('charm', 'ch_year1', null, 'bronze', 'First Year', 'Four seasons have passed.', { t: 'years', n: 2 });
add('charm', 'ch_year5', 'ch_year1', 'silver', 'Old Hand', 'Five years on the island.', { t: 'years', n: 6 });
add('charm', 'ch_year20', 'ch_year5', 'gold', 'Elder', 'Twenty years.', { t: 'years', n: 21 });
add('charm', 'ch_hour1', 'ch_year1', 'bronze', 'Settled In', 'An hour on the island.', { t: 'stat', key: 'playSeconds', n: 3600 });
add('charm', 'ch_hour10', 'ch_hour1', 'silver', 'Devoted', 'Ten hours.', { t: 'stat', key: 'playSeconds', n: 36000 });
add('charm', 'ch_hour50', 'ch_hour10', 'gold', 'Islander', 'Fifty hours.', { t: 'stat', key: 'playSeconds', n: 180000 });

export const ACHIEVEMENTS: AchDef[] = L;
export const ACH: Record<string, AchDef> = Object.fromEntries(L.map((a) => [a.id, a]));
