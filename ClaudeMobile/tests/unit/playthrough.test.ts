import { describe, expect, it } from 'vitest';
import { DISCOVERY_LIST } from '../../src/core/content/discoveries';
import { Bot } from '../bot';

/**
 * End-to-end balance proof: a scripted player reaches every discovery and
 * completes the Aetherforge using only the public action API. Fails on any
 * softlock, impossible recipe or unreachable unlock.
 */
describe('full playthrough', () => {
  it('reaches every discovery and completes the Aetherforge', () => {
    const bot = new Bot(99, 80);
    bot.verbose = !!process.env.BOT_VERBOSE;
    const until = (id: string, step: () => void) => {
      let g = 0;
      while (!bot.s.known.has(id)) {
        step();
        if (++g > 4000) throw new Error(`never discovered ${id}: ${bot.status()}`);
      }
    };

    process.on('exit', () => undefined);
    const dump = () => console.log('TIMELINE ' + bot.timeline.map((e) => `${e.id}@${(e.t / 60).toFixed(0)}m`).join(' '));
    let tWind = 0, tAether = 0, tForgeKnown = 0;
    try {
    bot.build('workbench');
    until('compost', () => bot.ensure('leaf', bot.s.stash.leaf + 4));
    bot.ensure('loam', 4);
    until('sieve', () => {
      if (bot.s.tiles.size < 13) bot.growIsland(true);
      bot.ensure('loam', 8);
      bot.ensure('fiber', 3);
      bot.wait(5);
    });
    until('stone', () => bot.ensure('pebble', bot.s.stash.pebble + 4));
    until('clay', () => bot.ensure('stone', 2));
    until('kiln', () => bot.ensure('clay', 2));
    bot.ensure('copper', 3);
    bot.ensure('gear', 3);
    bot.buildGrove();
    until('wind', () => { bot.ensure('copper', 7); bot.wait(20); bot.collectAll(); });
    tWind = bot.t;
    bot.buildGrove();
    bot.automate('compost', 3);
    bot.automate('sift_loam', 2);
    bot.automate('press', 1);
    bot.automate('charcoal', 1);
    bot.automate('smelt_copper', 1);
    until('mill', () => bot.ensure('stone', 32));
    bot.automate('crush', 1);
    bot.automate('sift_gravel', 1);
    until('iron', () => bot.ensure('iron_grit', 3));
    bot.ensure('sand', 2);
    bot.automate('smelt_iron', 1);
    // trade: contracts for Marks, then the market's orchard, hives and lanterns
    until('trade', () => bot.wait(10));
    bot.buy('fruit');
    bot.buy('hive');
    bot.buy('lanterns');
    until('assembler', () => bot.ensure('iron', 6));
    bot.build('assembler');
    bot.buildGrove();
    bot.automate('compost', 2);
    bot.automate('saw', 1);
    bot.automate('gear', 1);
    until('tinker', () => bot.ensure('gear', 20));
    bot.buy('master');
    until('aether', () => { bot.ensure('mechanism', 4); bot.ensure('lens', 2); });
    tAether = bot.t;
    until('distill', () => bot.ensure('mist', 4));
    bot.automate('distill', 1);
    until('night', () => bot.ensure('aether', 1));
    until('resonance', () => bot.ensure('stardust', 2));
    bot.automate('skystone', 1);
    until('skystone', () => bot.ensure('skystone', 2));
    until('pylon', () => bot.ensure('crystal', 2));
    bot.automate('crystal', 1);
    until('beacon', () => { bot.ensure('crystal', 6); if (bot.s.tiles.size < 36) bot.growIsland(false); });
    bot.summonAll();
    bot.build('drill');
    bot.automate('sunmetal', 1);
    until('wisps', () => { bot.ensure('crystal', 15); if (bot.countOf('assembler') < 2) bot.build('assembler'); });
    bot.build('roost');
    until('forge', () => { bot.ensure('sunmetal', 4); bot.ensure('amber', 1); });
    tForgeKnown = bot.t;
    bot.automate('plate', 1);
    bot.automate('wire', 1);
    // the Heart stage eats copper (wire, sunmetal): widen the copper line first
    bot.automate('crush', 1);
    bot.automate('sift_gravel', 2);
    bot.automate('smelt_copper', 1);
    // and the Heart stage's sunmetal: more iron, aether and a second crucible
    bot.automate('smelt_iron', 1);
    bot.automate('distill', 1);
    bot.automate('sunmetal', 1);
    bot.buildForge();
    // the chapter line through the Great Work (chapter 9)
    bot.doChapters(9);
    } finally { dump(); }

    const missing = DISCOVERY_LIST.filter((d) => !bot.s.known.has(d.id)).map((d) => d.id);
    const fmt = (t: number) => `${(t / 3600).toFixed(2)}h`;
    console.log(`wind ${fmt(tWind)} · aether ${fmt(tAether)} · forge known ${fmt(tForgeKnown)} · forge complete ${fmt(bot.t)} · tiles ${bot.s.tiles.size} · buildings ${bot.s.buildings.size}`);
    console.log(bot.timeline.map((e) => `${e.id}@${(e.t / 60).toFixed(0)}m`).join(' '));
    expect(missing).toEqual([]);
    expect(bot.s.forge.stage).toBe(3);
  }, 600_000);
});
