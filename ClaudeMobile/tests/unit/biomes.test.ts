import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { BIOMES, FRUITS } from '../../src/core/content/biomes';
import { BUILDINGS } from '../../src/core/content/buildings';
import { MARKET_BY_ID } from '../../src/core/content/trade';
import { deserialize, migrate, serialize } from '../../src/core/save';
import { biomeAt, run, tuftYield } from '../../src/core/sim';
import { tileAt } from '../../src/core/state';
import { give, sandbox } from './helpers';

const meadowIsle = (size = 6) => sandbox(size, 'grass');

describe('biome conversion', () => {
  it('turns grass into a biome, keeps trees and buildings, and costs its materials', () => {
    const s = meadowIsle();
    give(s, { sand: 8, wood: 10 });
    A.place(s, 'workbench', 1, 1);
    expect(A.expand(s, 'dunes', 1, 1).ok).toBe(true);
    expect(tileAt(s, 1, 1)!.biome).toBe('dunes');
    expect(s.stash.sand).toBe(4);
    expect(s.buildings.size).toBe(1);
    expect(A.expand(s, 'dunes', 1, 1).ok).toBe(false); // already dunes
  });

  it('needs grass and the discovery', () => {
    const s = sandbox(4, 'stone');
    give(s, { sand: 8 });
    expect(A.expand(s, 'dunes', 1, 1).ok).toBe(false);
    const g = meadowIsle(4);
    g.known.delete('dunes');
    give(g, { sand: 8 });
    expect(A.expand(g, 'dunes', 1, 1).ok).toBe(false);
  });

  it('meadow restores the default biome', () => {
    const s = meadowIsle();
    give(s, { dew: 3, loam: 10 });
    A.expand(s, 'marsh', 2, 2);
    expect(biomeAt(s, 2, 2)!.id).toBe('marsh');
    A.expand(s, 'meadow', 2, 2);
    expect(tileAt(s, 2, 2)!.biome).toBeUndefined();
  });
});

describe('biomes vary existing mechanics', () => {
  const at = (biome: 'meadow' | 'marsh' | 'dunes', setup: (s: ReturnType<typeof meadowIsle>) => number, secs: number) => {
    const s = meadowIsle(4);
    if (biome !== 'meadow') for (const t of s.tiles.values()) t.biome = biome;
    const id = setup(s);
    run(s, secs);
    return s.buildings.get(id)!;
  };

  it('dew catchers fill faster in marsh and slower in dunes', () => {
    const dew = (b: 'meadow' | 'marsh' | 'dunes') => at(b, (s) => { give(s, { wood: 9, twine: 9, plank: 9 }); return A.place(s, 'dew_catcher', 1, 1).id!; }, 60).cycles;
    expect(dew('marsh')).toBeGreaterThan(dew('meadow'));
    expect(dew('dunes')).toBeLessThan(dew('meadow'));
  });

  it('island trees yield by biome: pines give double timber, willows more leaves', () => {
    for (const [biome, wood, leaf] of [['frost', 2, 1], ['marsh', 1, 3], ['meadow', 1, 2]] as const) {
      const s = meadowIsle(4);
      for (const t of s.tiles.values()) t.biome = biome === 'meadow' ? undefined : biome;
      s.stash.sapling = 1;
      const id = A.place(s, 'sapling', 2, 2).id!;
      s.buildings.get(id)!.progress = 1e6;
      run(s, 0.1);
      const r = A.harvestAt(s, 2, 2);
      expect(r.got?.wood).toBe(wood);
      expect(r.got?.leaf).toBe(leaf);
    }
  });

  it('reeds in marsh give more fiber', () => {
    expect(BIOMES.marsh.tuftFiber).toBeGreaterThan(BIOMES.meadow.tuftFiber);
    const s = meadowIsle(4);
    tileAt(s, 1, 1)!.biome = 'marsh';
    expect(tuftYield(s, 1, 1)).toBe(4);
    expect(tuftYield(s, 2, 2)).toBe(2);
  });

  it('frost windmills make more breeze', () => {
    const gen = (biome: 'meadow' | 'frost') => {
      const s = meadowIsle(4);
      if (biome === 'frost') for (const t of s.tiles.values()) t.biome = 'frost';
      give(s, { plank: 20, gear: 10, twine: 10 });
      A.place(s, 'windmill', 1, 1);
      run(s, 1);
      return s.power.gen;
    };
    expect(gen('frost')).toBeGreaterThan(gen('meadow') * 1.2);
  });

  it('compost rots faster in marsh', () => {
    const cyc = (biome: 'meadow' | 'marsh') => {
      const s = meadowIsle(4);
      if (biome === 'marsh') for (const t of s.tiles.values()) t.biome = 'marsh';
      give(s, { wood: 20, leaf: 400 });
      const id = A.place(s, 'composter', 1, 1).id!;
      for (let i = 0; i < 6; i++) { A.load(s, id); run(s, 10); A.collect(s, id); }
      return s.buildings.get(id)!.cycles;
    };
    expect(cyc('marsh')).toBeGreaterThan(cyc('meadow'));
  });
});

describe('fruit species', () => {
  it('every species has a tree, a sapling building, an item and a market offer', () => {
    for (const f of FRUITS) {
      expect(BUILDINGS[f.tree].kind).toBe('tree');
      expect(BUILDINGS[f.sapling].growsInto).toBe(f.tree);
      expect(MARKET_BY_ID[f.id === 'apple' ? 'fruit' : f.id]).toBeDefined();
    }
  });

  it('each sapling grows into its own tree and gives its own fruit', () => {
    for (const f of FRUITS) {
      const s = meadowIsle(4);
      for (const t of s.tiles.values()) t.biome = f.home === 'meadow' ? undefined : f.home;
      give(s, { [f.seed]: 1 } as never);
      const id = A.place(s, f.sapling, 1, 1).id!;
      run(s, 50);
      expect(s.buildings.get(id)!.type).toBe(f.tree);
      expect(A.harvestAt(s, 1, 1).got?.[f.fruit]).toBeGreaterThan(0);
    }
  });

  it('fruit trees regrow at half speed away from home', () => {
    const regrown = (home: boolean) => {
      const s = meadowIsle(4);
      if (!home) for (const t of s.tiles.values()) t.biome = 'frost';
      give(s, { orange_sapling: 1 });
      for (const t of s.tiles.values()) if (home) t.biome = 'dunes';
      const id = A.place(s, 'orange_sapling', 1, 1).id!;
      run(s, 50);
      const b = s.buildings.get(id)!;
      b.stock = 0; b.timer = 0;
      run(s, 36);
      return b.stock;
    };
    expect(regrown(true)).toBeGreaterThanOrEqual(regrown(false) * 2 - 1);
    expect(regrown(true)).toBeGreaterThan(regrown(false));
  });

  it('a fruit basket needs every fruit', () => {
    const s = meadowIsle(4);
    give(s, { wood: 10, apple: 2, cherry: 2, orange: 2, date: 2, pear: 2, plum: 1, twine: 1 });
    A.place(s, 'workbench', 0, 0);
    expect(A.craft(s, 'basket').ok).toBe(false);
    give(s, { plum: 1 });
    expect(A.craft(s, 'basket').ok).toBe(true);
    expect(s.stash.fruit_basket).toBe(1);
  });
});

describe('biome saves', () => {
  it('round-trips tile biomes and migrates v3', () => {
    const s = meadowIsle(4);
    tileAt(s, 1, 2)!.biome = 'frost';
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(tileAt(d, 1, 2)!.biome).toBe('frost');
    expect(tileAt(d, 0, 0)!.biome).toBeUndefined();
    const v3 = { ...serialize(s), v: 3 };
    expect(migrate(v3).v).toBe(4);
  });
});
