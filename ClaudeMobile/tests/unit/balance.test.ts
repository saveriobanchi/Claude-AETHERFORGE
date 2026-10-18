import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { goalValue } from '../../src/core/ambitions';
import { legacyAmbition } from '../../src/core/content/ambitions';
import { makeContract } from '../../src/core/content/trade';
import { resonanceRequest } from '../../src/core/content/world';
import { checkDiscoveries } from '../../src/core/progression';
import { createState, stackTotal } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('balance', () => {
  it('felling the first tree before any sapling is found does not lock the game', () => {
    const s = createState(3);
    const tree = [...s.buildings.values()].find((b) => b.type === 'tree')!;
    expect(A.remove(s, tree.id).ok).toBe(true);
    checkDiscoveries(s);
    expect(s.stash.sapling).toBe(1);
    expect(s.known.has('sapling')).toBe(true);
    expect(A.place(s, 'sapling', tree.x, tree.y).ok).toBe(true);
  });

  it('resonance keeps climbing but stays reachable', () => {
    const total = (to: number) => { let t = 0; for (let l = 0; l < to; l++) t += stackTotal(resonanceRequest(l)); return t; };
    expect(total(40)).toBeLessThan(2_000_000);
    // requests mix different goods each level, so compare a stretch of levels
    expect(total(35) - total(30)).toBeGreaterThan(total(25) - total(20));
  });

  it('the perfectionist path asks for ever more fully upgraded machines', () => {
    const n = (r: number) => legacyAmbition('invention', r).goals[0].n;
    expect(n(10) / n(5)).toBeGreaterThan(5);
  });

  it('gem contracts ask for a single gem', () => {
    for (let i = 0; i < 20; i++) {
      const c = makeContract(['ruby'], 15, i / 20, 0.99)!;
      expect(c.n).toBe(1);
    }
  });

  it('a tended tree does not count as an upgraded machine', () => {
    const s = sandbox(5, 'grass');
    give(s, { sapling: 1, loam: 100, twine: 50 });
    const t = A.place(s, 'sapling', 2, 2);
    s.buildings.get(t.id!)!.type = 'tree';
    A.upgrade(s, t.id!);
    expect(goalValue(s, { t: 'level', n: 2 })).toBeLessThan(2);
  });
});
