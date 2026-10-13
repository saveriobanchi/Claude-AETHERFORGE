import * as M from './machines';
import * as N from './nature';
import type { SpriteDef } from './sprite';

const makers: Record<string, () => SpriteDef> = {
  tree: N.treeSprite,
  elder_tree: N.elderTreeSprite,
  sapling: N.saplingSprite,
  tuft: N.tuftSprite,
  node_vein: () => N.nodeSprite('node_vein'),
  node_spring: () => N.nodeSprite('node_spring'),
  node_shard: () => N.nodeSprite('node_shard'),
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
    const mk = makers[type];
    if (!mk) throw new Error('No sprite for ' + type);
    s = mk();
    cache.set(type, s);
  }
  return s;
}

export function hasSprite(type: string): boolean {
  return type in makers;
}

export const SPRITE_TYPES = Object.keys(makers);
