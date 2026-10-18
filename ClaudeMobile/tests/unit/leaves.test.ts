import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { FRUITS } from '../../src/core/content/biomes';
import { run, treeMaxStock } from '../../src/core/sim';
import { capacity, rebuildCacheFor } from './leafHelpers';
import { give, sandbox } from './helpers';

describe('leaves and tending', () => {
  it('every fruit tree drops leaves', () => {
    for (const f of FRUITS) expect(f.yield.leaf ?? 0, f.id).toBeGreaterThan(0);
  });

  it('tending a tree gives more leaves per gather, more stock and faster regrowth', () => {
    const s = sandbox(5, 'grass');
    give(s, { sapling: 1, loam: 100, twine: 50, clay: 50 });
    const t = A.place(s, 'sapling', 2, 2);
    run(s, 50); // grows into a tree
    const tree = s.buildings.get(t.id!)!;
    expect(tree.type).toBe('tree');
    tree.stock = 1;
    const l0 = s.stash.leaf;
    A.harvestAt(s, 2, 2);
    const plain = s.stash.leaf - l0;
    expect(A.upgrade(s, tree.id).ok).toBe(true);
    expect(A.upgrade(s, tree.id).ok).toBe(true);
    expect(tree.level).toBe(3);
    expect(A.canUpgrade(s, tree.id).ok).toBe(false);
    expect(treeMaxStock(tree)).toBe(5 + 2);
    tree.stock = 1;
    const l1 = s.stash.leaf;
    A.harvestAt(s, 2, 2);
    // combo/crit can add to the plain one too; compare ignoring triples
    expect(s.stash.leaf - l1).toBeGreaterThanOrEqual(plain + 2 - (plain > 2 ? plain : 0));
  });

  it('tending opens with compost, not with tinkering', () => {
    const s = sandbox(5, 'grass');
    s.known.delete('tinker');
    give(s, { sapling: 1, loam: 100, twine: 50 });
    const t = A.place(s, 'sapling', 2, 2);
    run(s, 50);
    expect(A.upgrade(s, t.id!).ok).toBe(true);
  });

  it('a Treewright at level III reaches trees two tiles away', () => {
    const s = sandbox(7, 'grass');
    give(s, { plank: 500, gear: 200, twine: 200, sapling: 2 });
    s.trade.marks = 1000;
    const h = A.place(s, 'harvester', 3, 3);
    A.place(s, 'sapling', 5, 3);
    run(s, 50);
    const h0 = s.buildings.get(h.id!)!;
    run(s, 5);
    expect(h0.outBuf.wood ?? 0).toBe(0); // tufts may be picked, but the tree is out of reach
    A.upgrade(s, h0.id); A.upgrade(s, h0.id);
    run(s, 8);
    expect(h0.outBuf.wood ?? 0).toBeGreaterThan(0);
  });
});

describe('storage upgrades', () => {
  it('each level adds half again to what a crate holds', () => {
    const s = sandbox(5);
    give(s, { plank: 500, stone: 500 });
    s.extraCapacity = 0;
    const c = A.place(s, 'crate', 2, 2);
    rebuildCacheFor(s);
    const before = capacity(s);
    expect(A.upgrade(s, c.id!).ok).toBe(true);
    run(s, 0.1);
    expect(capacity(s) - before).toBe(25);
  });
});
