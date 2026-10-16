import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { deserialize, serialize } from '../../src/core/save';
import { run } from '../../src/core/sim';
import { give, sandbox } from './helpers';

describe('two-item dispatchers', () => {
  it('feed a 3:1 recipe down a conveyor without jamming', () => {
    const s = sandbox(12);
    give(s, { carrot: 900, egg: 300, charcoal: 200, brick: 100, stone: 100, plank: 100, gear: 50, copper: 50 });
    const oven = A.place(s, 'oven', 6, 4, 0).id!;
    A.setRecipe(s, oven, 'stew');
    A.place(s, 'depot', 7, 4, 0);
    for (let x = 2; x <= 5; x++) A.place(s, 'belt', x, 4, 0);
    const d = A.place(s, 'dispatcher', 1, 4, 0).id!;
    A.setFilter(s, d, 'carrot');
    A.setFilter2(s, d, 'egg');
    run(s, 400);
    const mid = s.stash.stew;
    run(s, 400);
    expect(mid).toBeGreaterThan(20);
    expect(s.stash.stew - mid).toBeGreaterThan(20); // still running: no jam
    // never more of one input than the oven can hold
    const b = s.buildings.get(oven)!;
    expect(b.inBuf.egg ?? 0).toBeLessThanOrEqual(12);
  });

  it('can carry fuel as its second item', () => {
    const s = sandbox(10);
    give(s, { clay: 50, copper_grit: 400, charcoal: 100, plank: 200, stone: 200, gear: 50, copper: 50, twine: 50, brick: 50 });
    const k = A.place(s, 'kiln', 4, 4, 0).id!;
    A.setRecipe(s, k, 'smelt_copper');
    A.place(s, 'depot', 5, 4, 0);
    const d = A.place(s, 'dispatcher', 3, 4, 0).id!;
    A.setFilter(s, d, 'copper_grit');
    A.setFilter2(s, d, 'charcoal');
    const copper = s.stash.copper;
    run(s, 300);
    expect(s.stash.copper - copper).toBeGreaterThan(40);
    expect(s.buildings.get(k)!.fuel).toBeGreaterThan(0);
  });

  it('the second item is kept distinct, saved, and only dispatchers take one', () => {
    const s = sandbox(6);
    give(s, { plank: 50, gear: 20, stone: 20, wire: 20 });
    const d = A.place(s, 'dispatcher', 1, 1, 0).id!;
    A.setFilter(s, d, 'wood');
    expect(A.setFilter2(s, d, 'wood').ok).toBe(true);
    expect(s.buildings.get(d)!.filter2).toBe(null);
    A.setFilter2(s, d, 'leaf');
    const r = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(r.buildings.get(d)!.filter2).toBe('leaf');
    A.setFilter(s, d, 'leaf');
    expect(s.buildings.get(d)!.filter2).toBe(null);
    const so = A.place(s, 'sorter', 3, 3, 0).id!;
    expect(A.setFilter2(s, so, 'wood').ok).toBe(false);
  });
});
