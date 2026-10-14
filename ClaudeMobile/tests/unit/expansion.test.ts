import { SAVE_VERSION } from '../../src/core/state';
import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { BUILDINGS } from '../../src/core/content/buildings';
import { MARKET_BY_ID, marketPrice, makeContract, repForLevel, upgradeCost } from '../../src/core/content/trade';
import { WEATHER, weatherFor } from '../../src/core/content/weather';
import { deserialize, migrate, serialize } from '../../src/core/save';
import { fillBoard, run, weatherNow } from '../../src/core/sim';
import { addTile, createState } from '../../src/core/state';
import { give, sandbox, totalItems } from './helpers';

describe('weather', () => {
  it('is deterministic per day and seed, and day one is clear', () => {
    expect(weatherFor(0, 5).id).toBe('clear');
    for (let d = 1; d < 50; d++) expect(weatherFor(d, 9).id).toBe(weatherFor(d, 9).id);
    const ids = new Set(Array.from({ length: 400 }, (_, d) => weatherFor(d + 1, 3).id));
    expect(ids.size).toBe(WEATHER.length);
  });

  it('averages close to normal so pacing holds', () => {
    let wind = 0;
    const n = 2000;
    for (let d = 1; d <= n; d++) wind += weatherFor(d, 77).wind;
    expect(wind / n).toBeGreaterThan(0.93);
    expect(wind / n).toBeLessThan(1.08);
  });

  it('rain doubles dew', () => {
    const s = sandbox(4, 'grass');
    const rainy = Array.from({ length: 200 }, (_, d) => d).find((d) => weatherFor(d, s.seed).id === 'rain')!;
    const clear = Array.from({ length: 200 }, (_, d) => d).find((d) => d > 0 && weatherFor(d, s.seed).id === 'clear')!;
    const dew = (day: number) => {
      const t = sandbox(4, 'grass');
      t.time = day * 600 + 10;
      give(t, { wood: 10, twine: 10, plank: 10 });
      const id = A.place(t, 'dew_catcher', 1, 1).id!;
      run(t, 45);
      return t.buildings.get(id)!.cycles;
    };
    expect(dew(rainy)).toBeGreaterThanOrEqual(dew(clear) * 2 - 1);
    s.time = rainy * 600 + 1;
    expect(weatherNow(s).id).toBe('rain');
  });
});

describe('trading post', () => {
  const withPost = () => {
    const s = sandbox(6);
    give(s, { plank: 50, stone: 50, twine: 50 });
    s.stats.obtained = { plank: 100, stone: 100, brick: 10, twine: 5 };
    const r = A.place(s, 'trading_post', 0, 2);
    expect(r.ok).toBe(true);
    run(s, 0.2);
    return { s, id: r.id! };
  };

  it('must touch the edge', () => {
    const s = sandbox(6);
    give(s, { plank: 50, stone: 50, twine: 50 });
    expect(A.place(s, 'trading_post', 2, 2).ok).toBe(false);
    expect(A.place(s, 'trading_post', 0, 2).ok).toBe(true);
  });

  it('posts three contracts for items the player has made', () => {
    const { s } = withPost();
    expect(s.trade.board.every((c) => c && ['plank', 'stone', 'brick', 'twine'].includes(c.item))).toBe(true);
    expect(new Set(s.trade.board.map((c) => c!.item)).size).toBe(3);
  });

  it('accepts only wanted items from conveyors and pays Marks on completion', () => {
    const { s } = withPost();
    const c = s.trade.board[0]!;
    give(s, { [c.item]: c.n } as never);
    for (let i = 0; i < c.n; i++) expect(A.handOver(s, 0).ok || c.got >= c.n).toBe(true);
    expect(s.trade.marks).toBe(c.marks);
    expect(s.trade.board[0]).toBeNull();
    run(s, 21);
    expect(s.trade.board[0]).not.toBeNull();
  });

  it('belts deliver into the post', () => {
    const { s } = withPost();
    const c = s.trade.board[1]!;
    give(s, { gear: 10, plank: 10, stone: 10, [c.item]: c.n + 5 } as never);
    const d = A.place(s, 'dispatcher', 2, 2, 2).id!;
    A.setFilter(s, d, c.item);
    A.place(s, 'belt', 1, 2, 2);
    run(s, c.n * 0.6 + 10);
    expect(s.trade.done).toBeGreaterThanOrEqual(1);
    expect(s.trade.earned).toBeGreaterThan(0);
  });

  it('skip swaps a contract and has a cooldown', () => {
    const { s } = withPost();
    const before = s.trade.board[2]!.item;
    expect(A.skipContract(s, 2).ok).toBe(true);
    expect(s.trade.board[2]!.item).not.toBe(before);
    expect(A.skipContract(s, 1).ok).toBe(false);
    run(s, 91);
    expect(A.skipContract(s, 1).ok).toBe(true);
  });

  it('reputation raises the trade level and contract sizes', () => {
    const c0 = makeContract(['plank'], 0, 0.5, 0.5)!;
    const c5 = makeContract(['plank'], 5, 0.5, 0.5)!;
    expect(c5.n).toBeGreaterThan(c0.n);
    expect(c5.marks).toBeGreaterThan(c0.marks);
    const { s } = withPost();
    s.trade.rep = repForLevel(0) - 1;
    const c = s.trade.board[0]!;
    give(s, { [c.item]: c.n } as never);
    A.handOver(s, 0);
    expect(s.trade.level).toBeGreaterThanOrEqual(1);
  });

  it('conserves items (contract goods leave the world, nothing else)', () => {
    const { s } = withPost();
    const before = totalItems(s);
    const c = s.trade.board[0]!;
    give(s, { [c.item]: 3 } as never);
    const r = A.handOver(s, 0);
    expect(totalItems(s)).toBe(before + 3 - (r.got?.[c.item] ?? 0));
  });
});

describe('market', () => {
  it('sells for Marks with rising prices and unlocks discoveries', () => {
    const s = sandbox(4, 'grass');
    s.known.delete('orchard'); s.known.delete('apiary');
    s.trade.marks = 200;
    const p0 = marketPrice(MARKET_BY_ID.fruit, 0);
    expect(A.buy(s, 'fruit').ok).toBe(true);
    expect(s.stash.fruit_sapling).toBe(1);
    expect(s.known.has('orchard')).toBe(true);
    expect(s.trade.marks).toBe(200 - p0);
    expect(marketPrice(MARKET_BY_ID.fruit, 1)).toBeGreaterThanOrEqual(p0);
    expect(A.buy(s, 'hive').ok).toBe(true);
    expect(s.known.has('apiary')).toBe(true);
    expect(A.buy(s, 'hive').ok).toBe(false); // one-time
  });

  it('refuses without Marks', () => {
    const s = sandbox(4);
    expect(A.buy(s, 'copper').ok).toBe(false);
  });
});

describe('upgrades', () => {
  it('costs double each level, needs Marks for IV–V and master tools beyond III', () => {
    const def = BUILDINGS.kiln;
    expect(upgradeCost(def, 2).items.stone).toBe(16);
    expect(upgradeCost(def, 3).items.stone).toBe(32);
    expect(upgradeCost(def, 4).marks).toBe(15);
    const s = sandbox(4);
    s.known.delete('master');
    give(s, { stone: 1000, clay: 1000 });
    const id = A.place(s, 'kiln', 1, 1).id!;
    expect(A.upgrade(s, id).ok).toBe(true);
    expect(A.upgrade(s, id).ok).toBe(true);
    expect(A.upgrade(s, id).ok).toBe(false); // level III cap without master tools
    s.known.add('master');
    expect(A.upgrade(s, id).ok).toBe(false); // needs Marks
    s.trade.marks = 100;
    expect(A.upgrade(s, id).ok).toBe(true);
    expect(s.buildings.get(id)!.level).toBe(4);
  });

  it('makes machines faster', () => {
    const cycles = (level: number) => {
      const s = sandbox(4);
      give(s, { stone: 100, clay: 100, leaf: 1000, plank: 1000, wood: 1000 });
      const id = A.place(s, 'composter', 1, 1).id!;
      s.buildings.get(id)!.level = level;
      for (let i = 0; i < 8; i++) { A.load(s, id); run(s, 10); A.collect(s, id); }
      return s.buildings.get(id)!.cycles;
    };
    expect(cycles(3)).toBeGreaterThan(cycles(1) * 1.4);
  });
});

describe('orchards and hives', () => {
  it('fruit saplings grow into fruit trees that give apples', () => {
    const s = sandbox(4, 'grass');
    give(s, { fruit_sapling: 1 });
    const id = A.place(s, 'fruit_sapling', 1, 1).id!;
    run(s, 50);
    expect(s.buildings.get(id)!.type).toBe('fruit_tree');
    const r = A.harvestAt(s, 1, 1);
    expect(r.got?.apple).toBe(1);
  });

  it('hives need trees nearby, make honey and pollinate fruit trees', () => {
    const s = sandbox(5, 'grass');
    give(s, { plank: 100, twine: 100 });
    const lonely = A.place(s, 'hive', 0, 0).id!;
    run(s, 30);
    expect(s.buildings.get(lonely)!.status).toBe('noinput');
    give(s, { fruit_sapling: 2 });
    A.place(s, 'fruit_sapling', 2, 2);
    A.place(s, 'fruit_sapling', 3, 3);
    const hive = A.place(s, 'hive', 3, 2).id!;
    run(s, 80);
    const h = s.buildings.get(hive)!;
    expect(h.outBuf.honey ?? 0).toBeGreaterThan(0);
    expect(A.harvestAt(s, 2, 2).got?.apple).toBe(2);
  });

  it('new recipes run in their stations', () => {
    const s = sandbox(4);
    give(s, { apple: 40, honey: 10, charcoal: 10, stone: 50, gear: 20, clay: 10, wax: 10, twine: 10, plank: 20 });
    const press = A.place(s, 'press', 1, 1).id!;
    expect(A.setRecipe(s, press, 'cider').ok).toBe(true);
    const kiln = A.place(s, 'kiln', 2, 2).id!;
    expect(A.setRecipe(s, kiln, 'preserves').ok).toBe(true);
    s.power.ratio = 1;
    A.place(s, 'windmill', 3, 3);
    for (let i = 0; i < 5; i++) { A.load(s, press); A.load(s, kiln); run(s, 10); }
    expect(s.buildings.get(press)!.cycles).toBeGreaterThan(0);
    expect(s.buildings.get(kiln)!.cycles).toBeGreaterThan(0);
    give(s, { wood: 10 });
    expect(A.place(s, 'workbench', 0, 0).ok).toBe(true);
    expect(A.craft(s, 'candle').ok).toBe(true);
    expect(s.stash.candle).toBe(2);
  });
});

describe('saves', () => {
  it('round-trips trade, levels and the world seed', () => {
    const s = sandbox(6);
    give(s, { plank: 50, stone: 50, twine: 50 });
    s.stats.obtained = { plank: 10 };
    A.place(s, 'trading_post', 0, 2);
    fillBoard(s, true);
    s.trade.marks = 42;
    const k = A.place(s, 'kiln', 2, 2);
    give(s, { stone: 100, clay: 100 });
    s.buildings.get(k.id ?? 0)!;
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(d.trade.marks).toBe(42);
    expect(d.trade.board[0]?.item).toBe(s.trade.board[0]?.item);
    expect(d.seed).toBe(s.seed);
  });

  it('migrates v2 saves', () => {
    const s = createState(5);
    addTile(s, 2, 0, 'grass');
    const v2 = { ...serialize(s), v: 2 } as Record<string, unknown>;
    delete v2.trade; delete v2.seed;
    const m = migrate(v2);
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.trade.marks).toBe(0);
    const d = deserialize(v2).state;
    expect(d.tiles.size).toBe(10);
    expect([...d.buildings.values()][0].level).toBe(1);
  });
});
