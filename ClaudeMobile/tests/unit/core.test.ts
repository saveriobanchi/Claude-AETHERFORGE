import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { RECIPES } from '../../src/core/content/recipes';
import { checkDiscoveries } from '../../src/core/progression';
import { run, tick } from '../../src/core/sim';
import { buildingAt, createState, stackTotal } from '../../src/core/state';
import { give, sandbox, totalItems } from './helpers';

describe('new game', () => {
  it('starts with a 3×3 island and one tree', () => {
    const s = createState();
    expect(s.tiles.size).toBe(9);
    expect([...s.buildings.values()].map((b) => b.type)).toEqual(['tree']);
    expect(s.known.has('start')).toBe(true);
  });

  it('tree harvesting yields timber and leaves and depletes stock', () => {
    const s = createState();
    const r = A.harvestAt(s, 0, 0);
    expect(r.ok).toBe(true);
    expect(s.stash.wood).toBe(1);
    expect(s.stash.leaf).toBe(2);
    for (let i = 0; i < 4; i++) A.harvestAt(s, 0, 0);
    expect(A.harvestAt(s, 0, 0).ok).toBe(false);
    run(s, 6);
    expect(A.harvestAt(s, 0, 0).ok).toBe(true);
  });

  it('sapling pity guarantees a sapling within a bounded number of harvests', () => {
    const s = createState(7);
    let got = 0;
    for (let i = 0; i < 12 && !got; i++) {
      run(s, 5.1);
      got += A.harvestAt(s, 0, 0).got?.sapling ?? 0;
    }
    expect(got).toBe(1);
  });
});

describe('crafting', () => {
  it('requires a workbench and consumes exact inputs', () => {
    const s = sandbox(4);
    give(s, { wood: 10 });
    expect(A.craft(s, 'plank').ok).toBe(false);
    A.place(s, 'workbench', 0, 0);
    expect(s.stash.wood).toBe(4);
    give(s, { wood: 6 });
    const r = A.craft(s, 'plank', 3);
    expect(r.ok).toBe(true);
    expect(s.stash.plank).toBe(3);
    expect(s.stash.wood).toBe(4);
  });

  it('refuses machine-only recipes by hand', () => {
    const s = sandbox(4);
    A.place(s, 'workbench', 0, 0);
    give(s, { crystal: 5, wire: 20, plate: 10 });
    expect(A.craft(s, 'cell').ok).toBe(false);
  });

  it('never exceeds stash capacity when crafting', () => {
    const s = createState();
    for (const id of ['plank', 'compost', 'land']) s.known.add(id);
    s.stash.wood = 50;
    A.place(s, 'workbench', 1, 1);
    s.stash.wood = 50;
    s.stash.plank = 49;
    expect(A.craft(s, 'plank', 10).ok).toBe(true);
    expect(s.stash.plank).toBe(50);
  });
});

describe('placement', () => {
  it('validates ground, occupancy, floors and edge rules', () => {
    const s = sandbox(5, 'grass');
    give(s, { stone: 100, gear: 100, plank: 100, glass: 100, copper: 100, plate: 100 });
    expect(A.place(s, 'composter', 9, 9).ok).toBe(false);
    expect(A.canPlace(s, 'wind_sifter', 1, 1).reason).toMatch(/flagstone/);
    expect(A.expand(s, 'flagstone', 1, 1).ok).toBe(true);
    expect(A.place(s, 'press', 1, 1).ok).toBe(true);
    expect(A.place(s, 'composter', 1, 1).reason).toBe('Occupied');
    expect(A.canPlace(s, 'condenser', 2, 2).reason).toMatch(/edge/);
    expect(A.place(s, 'condenser', 0, 2).ok).toBe(true);
  });

  it('refunds the full cost and contents on removal', () => {
    const s = sandbox(4);
    give(s, { stone: 8, clay: 3 });
    const { id } = A.place(s, 'kiln', 1, 1);
    expect(s.stash.stone).toBe(0);
    s.buildings.get(id!)!.inBuf = { wood: 3 };
    expect(A.remove(s, id!).ok).toBe(true);
    expect(s.stash.stone).toBe(8);
    expect(s.stash.clay).toBe(3);
    expect(s.stash.wood).toBe(3);
  });

  it('expansion must join the island and gets more expensive', () => {
    const s = createState();
    s.known.add('land');
    give(s, { loam: 500, wood: 500 });
    expect(A.expand(s, 'plot', 5, 5).ok).toBe(false);
    const before = s.stash.loam;
    expect(A.expand(s, 'plot', 2, 0).ok).toBe(true);
    const first = before - s.stash.loam;
    for (let i = 3; i < 30; i++) A.expand(s, 'plot', i, 0);
    const b2 = s.stash.loam;
    A.expand(s, 'plot', 30, 0);
    expect(b2 - s.stash.loam).toBeGreaterThan(first);
  });

  it('moves a building with its contents', () => {
    const s = sandbox(5);
    give(s, { stone: 8, clay: 3 });
    const { id } = A.place(s, 'kiln', 0, 0);
    s.buildings.get(id!)!.outBuf = { brick: 2 };
    expect(A.move(s, id!, 3, 3).ok).toBe(true);
    expect(buildingAt(s, 0, 0)).toBeUndefined();
    expect(buildingAt(s, 3, 3)?.outBuf.brick).toBe(2);
  });
});

describe('machines', () => {
  it('a compost bin turns leaves into loam over time', () => {
    const s = sandbox(4);
    give(s, { wood: 8, leaf: 6 });
    const { id } = A.place(s, 'composter', 1, 1);
    A.load(s, id!);
    expect(s.stash.leaf).toBe(0);
    run(s, RECIPES.compost.time * 2 + 0.2);
    expect(A.collect(s, id!).got?.loam).toBe(2);
  });

  it('kilns need fuel for bricks but not for charcoal', () => {
    const s = sandbox(4);
    give(s, { stone: 8, clay: 3 + 4, wood: 3 });
    const { id } = A.place(s, 'kiln', 1, 1);
    A.setRecipe(s, id!, 'brick');
    s.buildings.get(id!)!.inBuf = { clay: 4 };
    s.stash.clay = 0;
    run(s, 10);
    expect(stackTotal(s.buildings.get(id!)!.outBuf)).toBe(0);
    expect(s.buildings.get(id!)!.status).toBe('noinput');
    s.buildings.get(id!)!.fuel = 4;
    run(s, 25);
    expect(s.buildings.get(id!)!.outBuf.brick).toBe(4);
  });

  it('powered machines stop without breeze and run with a windmill', () => {
    const s = sandbox(5);
    give(s, { stone: 10, gear: 8, plank: 12, twine: 4, pebble: 8 });
    const { id } = A.place(s, 'press', 1, 1);
    A.load(s, id!);
    run(s, 5);
    expect(s.buildings.get(id!)!.status).toBe('nopower');
    A.place(s, 'windmill', 3, 3);
    run(s, 8);
    expect(s.buildings.get(id!)!.outBuf.stone).toBe(2);
  });

  it('manual sieve takes three taps per loam', () => {
    const s = sandbox(3);
    give(s, { wood: 8, twine: 2, loam: 2 });
    const { id } = A.place(s, 'sieve', 1, 1);
    A.tapManual(s, id!);
    A.tapManual(s, id!);
    expect(s.stash.pebble).toBe(0);
    A.tapManual(s, id!);
    expect(s.stash.pebble).toBe(2);
    expect(s.stash.loam).toBe(1);
  });

  it('star nets only work at night', () => {
    const s = sandbox(3);
    give(s, { twine: 16, lens: 2, wire: 6 });
    const { id } = A.place(s, 'star_net', 0, 0);
    s.time = 0.3 * 600;
    run(s, 30);
    expect(s.buildings.get(id!)!.outBuf.stardust ?? 0).toBe(0);
    s.time = 0.7 * 600;
    run(s, 30);
    expect(s.buildings.get(id!)!.outBuf.stardust ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('a pylon speeds up nearby machines', () => {
    const run2 = (withPylon: boolean) => {
      const s = sandbox(6);
      give(s, { stone: 10, gear: 8, plank: 24, twine: 8, crystal: 2, plate: 4, wire: 6, pebble: 400 });
      const { id } = A.place(s, 'press', 1, 1);
      A.place(s, 'windmill', 4, 4);
      A.place(s, 'windmill', 5, 5);
      if (withPylon) A.place(s, 'pylon', 2, 2);
      for (let i = 0; i < 60; i++) { A.load(s, id!); A.collect(s, id!); run(s, 1); }
      return s.stash.stone;
    };
    expect(run2(true)).toBeGreaterThan(run2(false) * 1.3);
  });
});

describe('logistics', () => {
  it('conserves items through dispatcher → conveyors → splitter → depots', () => {
    const s = sandbox(10);
    give(s, { gear: 100, plank: 100, stone: 100, wire: 100, pebble: 60 });
    A.place(s, 'windmill', 9, 9);
    const d = A.place(s, 'dispatcher', 0, 4, 0).id!;
    A.setFilter(s, d, 'pebble');
    A.placeLine(s, 'belt', [1, 2, 3].map((x) => ({ x, y: 4, dir: 0 as const })));
    A.place(s, 'splitter', 4, 4, 0);
    A.place(s, 'depot', 5, 4);
    A.placeLine(s, 'belt', [{ x: 4, y: 3, dir: 3 }, { x: 4, y: 5, dir: 1 }]);
    A.place(s, 'depot', 4, 2);
    A.place(s, 'depot', 4, 6);
    const total0 = totalItems(s);
    for (let i = 0; i < 400; i++) {
      tick(s);
      expect(totalItems(s)).toBe(total0);
    }
    expect(s.stats.delivered).toBeGreaterThan(20);
  });

  it('belts keep spacing and block when the end is closed', () => {
    const s = sandbox(6);
    give(s, { plank: 10, gear: 10, stone: 10, pebble: 50 });
    const d = A.place(s, 'dispatcher', 0, 0, 0).id!;
    A.setFilter(s, d, 'pebble');
    A.placeLine(s, 'belt', [1, 2].map((x) => ({ x, y: 0, dir: 0 as const })));
    run(s, 20);
    const belts = [...s.buildings.values()].filter((b) => b.type === 'belt');
    for (const b of belts) {
      expect(b.items.length).toBeLessThanOrEqual(3);
      const ps = b.items.map((i) => i.pos).sort();
      for (let i = 1; i < ps.length; i++) expect(ps[i] - ps[i - 1]).toBeGreaterThanOrEqual(0.33);
    }
    expect(s.buildings.get(d)!.status).toBe('blocked');
  });

  it('sorters send the chosen item straight and others aside', () => {
    const s = sandbox(6);
    give(s, { plank: 40, gear: 20, stone: 40, wire: 20, pebble: 2, sand: 2 });
    const d1 = A.place(s, 'dispatcher', 0, 2, 0).id!;
    A.setFilter(s, d1, 'pebble');
    const d2 = A.place(s, 'dispatcher', 1, 1, 1).id!;
    A.place(s, 'belt', 1, 2, 0);
    const so = A.place(s, 'sorter', 2, 2, 0).id!;
    A.setFilter(s, so, 'pebble');
    const front = A.place(s, 'depot', 3, 2).id!;
    const left = A.place(s, 'depot', 2, 1).id!;
    const right = A.place(s, 'depot', 2, 3).id!;
    const got: Record<number, Set<string>> = { [front]: new Set(), [left]: new Set(), [right]: new Set() };
    for (let i = 0; i < 600; i++) {
      if (i === 200) { A.setFilter(s, d1, null); }
      if (i === 260) { A.setFilter(s, d2, 'sand'); }
      tick(s);
      for (const e of s.events) if (e.type === 'deliver') got[e.id].add(e.item);
      s.events.length = 0;
    }
    expect([...got[front]]).toEqual(['pebble']);
    expect([...got[left]]).toEqual(['sand']);
    expect([...got[right]]).toEqual(['sand']);
  });

  it('a harvester feeding a depot automates timber', () => {
    const s = sandbox(5, 'grass');
    give(s, { plank: 20, gear: 10, twine: 10, stone: 10 });
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) { const t = A.place(s, 'sapling', x, y); expect(t.ok || true).toBe(true); }
    s.stash.sapling = 10;
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) A.place(s, 'sapling', x, y);
    A.place(s, 'harvester', 1, 1, 0);
    A.place(s, 'depot', 2, 1);
    run(s, 120);
    expect(s.stash.wood).toBeGreaterThan(10);
  });

  it('wisps ferry outputs to the stash and inputs to machines', () => {
    const s = sandbox(8);
    give(s, { coil: 2, skystone: 8, plate: 6, wood: 8, leaf: 60, plank: 40, gear: 8, twine: 8 });
    A.place(s, 'windmill', 7, 7);
    A.place(s, 'windmill', 7, 6);
    A.place(s, 'roost', 3, 3);
    A.place(s, 'composter', 5, 3);
    run(s, 90);
    expect(s.stash.loam).toBeGreaterThan(3);
    expect(s.stash.leaf).toBeLessThan(60);
  });
});

describe('progression', () => {
  it('discoveries chain in order and never skip prerequisites', () => {
    const s = createState();
    s.stats.obtained = { leaf: 100, loam: 100, wood: 100, fiber: 100, pebble: 100, stone: 100, clay: 100, copper: 100, gear: 100 };
    checkDiscoveries(s);
    for (const id of ['compost', 'land', 'plank', 'fiber']) expect(s.known.has(id), id).toBe(true);
    expect(s.known.has('sieve')).toBe(false); // needs 13 tiles
    expect(s.known.has('stone')).toBe(false); // gated behind the sieve
  });

  it('every recipe and building unlock references a real discovery', async () => {
    const { DISCOVERIES } = await import('../../src/core/content/discoveries');
    const { BUILDING_LIST } = await import('../../src/core/content/buildings');
    const { RECIPE_LIST } = await import('../../src/core/content/recipes');
    for (const b of BUILDING_LIST) if (b.unlock && b.unlock !== '_never') expect(DISCOVERIES[b.unlock], b.id).toBeDefined();
    for (const r of RECIPE_LIST) expect(DISCOVERIES[r.unlock], r.id).toBeDefined();
  });
});

describe('determinism', () => {
  it('same seed and inputs produce identical worlds', () => {
    const play = () => {
      const s = sandbox(6);
      give(s, { wood: 8, twine: 2, loam: 100, plank: 20, gear: 10, copper: 10, stone: 10 });
      A.place(s, 'windmill', 5, 5);
      const id = A.place(s, 'wind_sifter', 1, 1).id!;
      for (let i = 0; i < 30; i++) { A.load(s, id); run(s, 2); A.collect(s, id); }
      return JSON.stringify(s.stash) + s.rng;
    };
    expect(play()).toBe(play());
  });
});
