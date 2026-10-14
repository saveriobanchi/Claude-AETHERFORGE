import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { BUILDINGS, BUILDING_LIST } from '../../src/core/content/buildings';
import { AMBITIONS, PATHS, charmTradeBonus } from '../../src/core/content/ambitions';
import { DISCOVERIES } from '../../src/core/content/discoveries';
import { checkAmbitions as checkChapters, charm, focus, goalText, goalValue, openAmbitions, openRung } from '../../src/core/ambitions';
import { deserialize, migrate, serialize } from '../../src/core/save';
import { fillBoard, run } from '../../src/core/sim';
import { SAVE_VERSION, createState } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('ambitions', () => {
  it('every path has a ladder, every goal names something real and reads well', () => {
    expect(PATHS.length).toBe(7);
    for (const p of PATHS) expect(AMBITIONS.filter((a) => a.path === p.id).length).toBeGreaterThanOrEqual(4);
    for (const a of AMBITIONS) for (const g of a.goals) {
      if (g.t === 'built' && g.type !== '*fruit') expect(BUILDINGS[g.type], g.type).toBeDefined();
      expect(goalText(g).length).toBeGreaterThan(5);
    }
    for (const a of AMBITIONS) if (a.reward.unlock) expect(DISCOVERIES[a.reward.unlock]).toBeDefined();
    // all five decor pattern sets are reachable from ambitions
    expect(AMBITIONS.filter((a) => a.reward.unlock?.startsWith('patterns')).length).toBe(5);
  });

  it('every path is open at once on a new world', () => {
    const s = createState(4);
    expect(openAmbitions(s).length).toBe(PATHS.length);
    expect(openAmbitions(s).every((a) => a.rung === 1)).toBe(true);
  });

  it('a new world achieves Land I from play and opens Land II', () => {
    const s = createState(4);
    s.stash.wood = 50; s.stash.loam = 100;
    A.place(s, 'workbench', -1, -1);
    s.known.add('compost'); s.known.add('land');
    A.place(s, 'composter', 1, 1);
    for (const [x, y] of [[2, 0], [2, 1], [-2, 0], [0, 2]]) A.expand(s, 'plot', x, y);
    run(s, 1.1);
    expect(s.ambitions.has('land_1')).toBe(true);
    expect(s.known.has('patterns1')).toBe(true);
    expect(s.events.some((e) => e.type === 'ambition' && e.id === 'land_1')).toBe(true);
    expect(openRung(s, 'land')!.id).toBe('land_2');
  });

  it('paths are independent: a later path completes without the others', () => {
    const s = sandbox(8);
    // Industry II's goals met, Industry I's not: the ladder climbs in order
    give(s, { plank: 100, stone: 100, gear: 50, twine: 20, copper: 20, wood: 20 });
    s.stats.made.gear = 20;
    A.place(s, 'harvester', 1, 1);
    A.place(s, 'depot', 2, 1);
    for (let x = 0; x < 6; x++) A.place(s, 'belt', x, 5);
    checkChapters(s);
    expect(s.ambitions.has('industry_2')).toBe(false);
    // Trade I on its own
    A.place(s, 'trading_post', 0, 3);
    s.trade.done = 3;
    checkChapters(s);
    expect(s.ambitions.has('trade_1')).toBe(true);
    expect(s.ambitions.has('land_1')).toBe(false);
  });

  it('rewards are paid once and rungs climb', () => {
    const s = sandbox(6);
    s.ambitions.add('trade_1'); // next: A Known Name
    s.trade.done = 15;
    s.stats.made.plank = 200;
    const marks = s.trade.marks, points = s.renown.points;
    checkChapters(s); checkChapters(s);
    expect(s.ambitions.has('trade_2')).toBe(true);
    expect(s.trade.marks).toBe(marks + 30);
    expect(s.renown.points).toBe(points + 1);
  });

  it('the quest card follows the pinned ambition, else the nearest one', () => {
    const s = sandbox(6);
    const near = focus(s)!;
    expect(openAmbitions(s)).toContain(near);
    expect(A.pinAmbition(s, 'aether_1').ok).toBe(true);
    expect(focus(s)!.id).toBe('aether_1');
    expect(A.pinAmbition(s, 'aether_1').ok).toBe(true); // toggles off
    expect(s.pinned).toBe(null);
    expect(A.pinAmbition(s, 'aether_2').ok).toBe(false); // only the open rung of a path
  });
});

describe('decor and charm', () => {
  it('decor unlocks by pattern and adds charm, with variety rewarded', () => {
    const s = sandbox(14, 'grass');
    give(s, { plank: 1000, leaf: 1000 });
    for (let i = 0; i < 12; i++) A.place(s, 'plank_path', i, 0);
    expect(charm(s)).toBe(10 + Math.floor(0.5)); // 10 full + 2 at a quarter
    for (let i = 0; i < 2; i++) A.place(s, 'hedge', i, 2);
    expect(charm(s)).toBe(10 + 4);
  });

  it('every decor piece has charm and a cost', () => {
    const decor = BUILDING_LIST.filter((b) => b.kind === 'decor');
    expect(decor.length).toBeGreaterThanOrEqual(20);
    for (const d of decor) { expect(d.charm, d.id).toBeGreaterThan(0); expect(Object.keys(d.cost).length, d.id).toBeGreaterThan(0); }
  });

  it('charm raises contract pay and milestones give renown once', () => {
    expect(charmTradeBonus(0)).toBe(0);
    expect(charmTradeBonus(50)).toBeCloseTo(0.1);
    expect(charmTradeBonus(1000)).toBe(0.3);
    const s = sandbox(10, 'grass');
    give(s, { plank: 500, stone: 500, twine: 50 });
    for (let i = 0; i < 6; i++) A.place(s, 'bench', i, 0);
    for (let i = 0; i < 6; i++) A.place(s, 'fence', i, 1);
    expect(charm(s)).toBe(18);
    for (let i = 0; i < 2; i++) A.place(s, 'well', i * 2, 3);
    checkChapters(s); checkChapters(s);
    expect(s.flags.has('charm_20')).toBe(true);
    expect(s.events.filter((e) => e.type === 'charm').length).toBe(1);
    // pay with charm
    s.stats.obtained = { plank: 10 };
    A.place(s, 'trading_post', 0, 9);
    fillBoard(s, true);
    run(s, 0.1);
    const c = s.trade.board[0]!;
    give(s, { [c.item]: c.n } as never);
    const before = s.trade.marks;
    A.handOver(s, 0);
    expect(s.trade.marks - before).toBeGreaterThan(c.marks);
  });

  it('goal values track the world', () => {
    const s = sandbox(6, 'grass');
    for (const t of s.tiles.values()) if (t.x === 0) t.biome = 'marsh';
    for (const t of s.tiles.values()) if (t.x === 1) t.biome = 'frost';
    expect(goalValue(s, { t: 'biomes', n: 1 })).toBe(2);
    expect(goalValue(s, { t: 'tiles', n: 1 })).toBe(36);
  });
});

describe('ambition saves', () => {
  it('round-trips and migrates v6 chapters (ambitions catch up from the world)', () => {
    const s = sandbox(6);
    s.ambitions.add('land_1'); s.pinned = 'trade_1';
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(d.ambitions.has('land_1')).toBe(true);
    expect(d.pinned).toBe('trade_1');
    const v6 = { ...serialize(s), v: 6, chapters: 4 } as Record<string, unknown>;
    delete v6.ambitions; delete v6.people; delete v6.voyages;
    expect(migrate(v6).v).toBe(SAVE_VERSION);
    const m = deserialize(v6).state;
    expect(m.ambitions.size).toBe(0);
    expect(m.people.count).toBe(0);
    expect(m.voyages).toEqual([]);
  });
});
