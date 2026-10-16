import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { applyOffline } from '../../src/core/offline';
import { deserialize, serialize } from '../../src/core/save';
import { machineSpeed, run } from '../../src/core/sim';
import { give, sandbox } from './helpers';

describe('review fixes', () => {
  it('offline time never drains what went into the forge', () => {
    const s = sandbox(10);
    give(s, { stone: 1000, plank: 50, gear: 20, copper: 20, twine: 20 });
    A.place(s, 'forge', 4, 4);
    const d = A.place(s, 'dispatcher', 3, 5, 0).id!;
    A.setFilter(s, d, 'stone');
    run(s, 300);
    const before = s.stash.stone;
    const rep = applyOffline(s, 3600)!;
    expect(rep.spent.stone ?? 0).toBe(0);
    expect(s.stash.stone).toBeGreaterThanOrEqual(before - 5);
  });

  it('settler roles speed up generators too, not just crafters', () => {
    const s = sandbox(8, 'grass');
    s.known.add('settlers');
    give(s, { plank: 200, brick: 100, cloth: 20, bread: 100, wood: 50, twine: 20 });
    for (let i = 0; i < 3; i++) A.place(s, 'cottage', i, 0);
    run(s, 46 * 6 + 1);
    const id = A.place(s, 'dew_catcher', 0, 4).id!;
    const base = machineSpeed(s, s.buildings.get(id)!);
    A.assignRole(s, 'mystic', 1); A.assignRole(s, 'mystic', 1);
    expect(machineSpeed(s, s.buildings.get(id)!)).toBeGreaterThan(base);
  });

  it('felling a fruit tree gives back its own sapling', () => {
    const s = sandbox(4, 'grass');
    give(s, { plum_sapling: 1 });
    A.place(s, 'plum_sapling', 1, 1);
    const b = [...s.buildings.values()][0];
    b.type = 'plum_tree'; // grown
    A.remove(s, b.id);
    expect(s.stash.plum_sapling).toBe(1);
  });

  it('saves clamp settler roles to the settlers there are, and drop unknown ambitions', () => {
    const s = sandbox(4);
    s.people.count = 1;
    s.people.roles = { smith: 5, mason: 2 };
    s.ambitions.add('exploration_2'); s.ambitions.add('land_1'); s.ambitions.add('land_7');
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(Object.values(d.people.roles).reduce((a, n) => a + (n ?? 0), 0)).toBeLessThanOrEqual(1);
    expect(d.ambitions.has('exploration_2')).toBe(false);
    expect(d.ambitions.has('land_1')).toBe(true);
    expect(d.ambitions.has('land_7')).toBe(true);
  });
});

describe('fuel', () => {
  it('a kiln fed only copper flakes keeps smelting, taking fuel from the stash', () => {
    const s = sandbox(10);
    give(s, { clay: 50, copper_grit: 400, charcoal: 20, plank: 200, stone: 200, gear: 50, copper: 50, twine: 50, brick: 50 });
    const k = A.place(s, 'kiln', 4, 4, 0).id!;
    A.setRecipe(s, k, 'smelt_copper');
    A.place(s, 'depot', 5, 4, 0);
    A.setFilter(s, A.place(s, 'dispatcher', 3, 4, 0).id!, 'copper_grit');
    const copper = s.stash.copper;
    run(s, 300);
    expect(s.stash.copper - copper).toBeGreaterThan(40);
    expect(s.stash.charcoal).toBeLessThan(20);
  });

  it('stops (and says so) when the stash has no charcoal or wood left', () => {
    const s = sandbox(10);
    give(s, { clay: 50, wood: 9, plank: 200, stone: 200, brick: 50 });
    const k = A.place(s, 'kiln', 4, 4, 0).id!;
    A.setRecipe(s, k, 'smelt_copper');
    s.stash.copper_grit = 4;
    A.load(s, k);
    s.buildings.get(k)!.fuel = 0;
    s.stash.wood = 0; s.stash.charcoal = 0;
    run(s, 30);
    expect(s.buildings.get(k)!.status).toBe('noinput');
  });
});
