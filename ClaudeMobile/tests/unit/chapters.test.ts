import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { BUILDINGS, BUILDING_LIST } from '../../src/core/content/buildings';
import { CHAPTERS, charmTradeBonus } from '../../src/core/content/chapters';
import { DISCOVERIES } from '../../src/core/content/discoveries';
import { activeChapter, charm, checkChapters, goalText, goalValue } from '../../src/core/chapters';
import { deserialize, migrate, serialize } from '../../src/core/save';
import { fillBoard, run } from '../../src/core/sim';
import { SAVE_VERSION, createState } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('chapters', () => {
  it('every goal names something real and reads well', () => {
    for (const c of CHAPTERS) for (const g of c.goals) {
      if (g.t === 'built' && g.type !== '*fruit') expect(BUILDINGS[g.type], g.type).toBeDefined();
      expect(goalText(g).length).toBeGreaterThan(5);
    }
    for (const c of CHAPTERS) if (c.reward.unlock) expect(DISCOVERIES[c.reward.unlock]).toBeDefined();
  });

  it('a new world starts at chapter 1 and completes it from play', () => {
    const s = createState(4);
    expect(activeChapter(s)!.id).toBe(1);
    s.stash.wood = 50; s.stash.loam = 100;
    A.place(s, 'workbench', -1, -1);
    s.known.add('compost'); s.known.add('land');
    A.place(s, 'composter', 1, 1);
    for (const [x, y] of [[2, 0], [2, 1], [-2, 0], [0, 2]]) A.expand(s, 'plot', x, y);
    run(s, 1.1);
    expect(s.chapters).toBe(1);
    expect(s.known.has('patterns1')).toBe(true);
    expect(s.events.some((e) => e.type === 'chapter' && e.id === 1)).toBe(true);
    expect(activeChapter(s)!.id).toBe(2);
  });

  it('only the active chapter can complete, in order', () => {
    const s = sandbox(8);
    // chapter 3's goals met, chapter 1's not (no composter)
    give(s, { plank: 100, stone: 100, gear: 50, twine: 20, copper: 20, wood: 20 });
    s.stats.made.gear = 20;
    A.place(s, 'harvester', 1, 1);
    A.place(s, 'depot', 2, 1);
    for (let x = 0; x < 6; x++) A.place(s, 'belt', x, 5);
    checkChapters(s);
    expect(s.chapters).toBe(0);
  });

  it('rewards are paid once', () => {
    const s = sandbox(6);
    s.chapters = 3; // chapter 4: windmills, planks, trading post, contracts
    give(s, { plank: 200, gear: 20, twine: 20, stone: 20 });
    A.place(s, 'windmill', 1, 1); A.place(s, 'windmill', 2, 2);
    s.stats.made.plank = 200;
    A.place(s, 'trading_post', 0, 3);
    s.trade.done = 3;
    const marks = s.trade.marks, points = s.renown.points;
    checkChapters(s); checkChapters(s);
    expect(s.chapters).toBe(4);
    expect(s.trade.marks).toBe(marks + 20);
    expect(s.renown.points).toBe(points + 1);
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

describe('chapter saves', () => {
  it('round-trips and migrates v5 (finished chapters catch up)', () => {
    const s = sandbox(6);
    s.chapters = 4;
    expect(deserialize(JSON.parse(JSON.stringify(serialize(s)))).state.chapters).toBe(4);
    const v5 = { ...serialize(s), v: 5 } as Record<string, unknown>;
    delete v5.chapters;
    expect(migrate(v5).v).toBe(SAVE_VERSION);
    expect(deserialize(v5).state.chapters).toBe(0);
  });
});
