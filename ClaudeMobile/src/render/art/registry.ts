import * as M from '../vox/buildings';
import * as N from '../vox/nature';
import type { SpriteDef } from './sprite';
import { pack } from '../artpack';

const makers: Record<string, () => SpriteDef> = {
  tree: N.treeSprite,
  elder_tree: N.elderTreeSprite,
  sapling: M.sapling,
  tuft: M.tuft,
  node_vein: () => M.node('node_vein'),
  node_spring: () => M.node('node_spring'),
  node_shard: () => M.node('node_shard'),
  workbench: M.workbench,
  composter: M.composter,
  sieve: M.sieve,
  dew_catcher: M.dewCatcher,
  clay_tub: M.clayTub,
  kiln: M.kiln,
  harvester: M.harvester,
  wind_sifter: M.windSifter,
  sawmill: M.sawmill,
  press: M.press,
  millstone: M.millstone,
  furnace: M.furnace,
  assembler: M.assembler,
  condenser: M.condenser,
  distiller: M.distiller,
  star_net: M.starNet,
  resonator: M.resonator,
  crucible: M.crucible,
  drill: M.drill,
  depot: M.depot,
  dispatcher: M.dispatcher,
  splitter: () => M.splitter(false),
  sorter: () => M.splitter(true),
  crate: () => M.storage('crate'),
  silo: () => M.storage('silo'),
  warehouse: () => M.storage('warehouse'),
  windmill: M.windmill,
  engine: M.engine,
  pylon: M.pylon,
  beacon: M.beacon,
  roost: M.roost,
  forge: M.forge,
};

const cache = new Map<string, SpriteDef>();

export function spriteFor(type: string): SpriteDef {
  let s = cache.get(type);
  if (!s) {
    s = pack.sprites.get(type) ?? makeSprite(type);
    cache.set(type, s);
  }
  return s;
}

/** Generate a sprite from its voxel model (ignores the pre-baked pack). */
export function makeSprite(type: string): SpriteDef {
  const mk = makers[type];
  if (!mk) throw new Error('No sprite for ' + type);
  return mk();
}

export function hasSprite(type: string): boolean {
  return type in makers;
}

export const SPRITE_TYPES = Object.keys(makers);
