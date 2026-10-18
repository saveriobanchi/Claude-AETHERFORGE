import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { legacyAmbition } from '../../src/core/content/ambitions';
import { marketPrice, MARKET_BY_ID } from '../../src/core/content/trade';
import { deserialize, serialize } from '../../src/core/save';
import { run } from '../../src/core/sim';
import { addTile, createState, key } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('marks stay sane', () => {
  it('legacy rungs pay gently, never compounding into billions', () => {
    const r40 = legacyAmbition('trade', 44).reward.marks ?? 0;
    expect(r40).toBeLessThan(5000);
    expect(legacyAmbition('trade', 6).reward.marks).toBeGreaterThan(legacyAmbition('trade', 5).reward.marks ?? 0);
  });

  it('repeat market purchases are capped at 4× the base price', () => {
    const m = MARKET_BY_ID.copper;
    expect(marketPrice(m, 500)).toBe(m.price * 4);
  });

  it('a v7 save inflated by legacy rewards is repaired on load', () => {
    const s = createState(1);
    const d = serialize(s) as ReturnType<typeof serialize> & { v: number };
    const ambitions = Array.from({ length: 40 }, (_, i) => `trade_${5 + i}`);
    const legit = 1234;
    // what the old rungs paid, and how much of that was more than the new rungs pay
    let old = 0, excess = 0;
    for (let L = 1; L <= 40; L++) {
      const paid = Math.round(150 * 1.5 ** (L - 1));
      old += paid;
      excess += Math.max(0, paid - (legacyAmbition('trade', 4 + L).reward.marks ?? 0));
    }
    const raw = { ...d, v: 7, ambitions, trade: { ...d.trade, marks: legit + old, earned: legit + old } };
    const { state } = deserialize(JSON.parse(JSON.stringify(raw)));
    expect(state.trade.marks).toBe(legit + old - excess);
    expect(state.trade.marks).toBeLessThan(1e6);
  });
});

describe('wisp roost', () => {
  it('one trip brings inputs and carries outputs home; eight sawmills run near full speed', () => {
    const s = sandbox(12);
    give(s, { coil: 2, skystone: 8, plate: 6, wood: 4000, plank: 400, gear: 400, stone: 400, twine: 50 });
    for (let i = 0; i < 6; i++) A.place(s, 'windmill', 11, i);
    A.place(s, 'roost', 5, 5);
    for (let i = 0; i < 8; i++) A.place(s, 'sawmill', 2 + (i % 4) * 2, i < 4 ? 3 : 7);
    const p0 = s.stash.plank;
    run(s, 120);
    // 8 mills × 40 cycles × 2 planks = 640 at best
    expect(s.stash.plank - p0).toBeGreaterThan(540);
  });

  it('upgrading a roost adds wisps', () => {
    const s = sandbox(8);
    give(s, { coil: 20, skystone: 80, plate: 60 });
    s.trade.marks = 1000;
    const r = A.place(s, 'roost', 3, 3);
    run(s, 0.1);
    expect(s.wisps.length).toBe(4);
    expect(A.upgrade(s, r.id!).ok).toBe(true);
    run(s, 0.1);
    expect(s.wisps.length).toBe(6);
  });
});

describe('clearing ground', () => {
  it('takes an empty tile away, refunds half, and keeps the island whole', () => {
    const s = sandbox(5, 'grass');
    const before = s.stash.loam;
    expect(A.expand(s, 'clear', 0, 0).ok).toBe(true);
    expect(s.tiles.has(key(0, 0))).toBe(false);
    expect(s.stash.loam).toBeGreaterThan(before);
    // a one-tile bridge cannot be cut
    addTile(s, 5, 2, 'grass');
    addTile(s, 6, 2, 'grass');
    expect(A.canExpand(s, 'clear', 5, 2).ok).toBe(false);
    expect(A.canExpand(s, 'clear', 6, 2).ok).toBe(true);
  });

  it('will not clear ground under a building or shrink below the start', () => {
    const s = sandbox(5, 'grass');
    give(s, { wood: 50 });
    A.place(s, 'composter', 2, 2);
    expect(A.canExpand(s, 'clear', 2, 2).reason).toBe('Clear it first');
    const t = createState(3);
    expect(A.canExpand(t, 'clear', 1, 1).ok).toBe(false);
  });

  it('re-laying a cleared tile costs more than clearing gave back', () => {
    const s = sandbox(6, 'grass');
    give(s, { loam: 500, wood: 500 });
    const l0 = s.stash.loam, w0 = s.stash.wood;
    A.expand(s, 'clear', 0, 0);
    A.expand(s, 'plot', 0, 0);
    expect(s.stash.loam + s.stash.wood).toBeLessThan(l0 + w0);
  });
});

describe('audit fixes', () => {
  it('removing a roost does not duplicate what its wisps carry', async () => {
    const { totalItems } = await import('./helpers');
    const s = sandbox(10);
    give(s, { coil: 2, skystone: 8, plate: 6, wood: 300, stone: 30, clay: 10, twine: 20, plank: 40, gear: 20 });
    A.place(s, 'windmill', 9, 0); A.place(s, 'windmill', 9, 1);
    const r = A.place(s, 'roost', 4, 4);
    A.place(s, 'kiln', 6, 4);
    run(s, 3);
    const w = s.wisps.find((x) => x.roost === r.id)!;
    w.carry = 'wood'; w.n = 8; s.stash.wood -= 8;
    const before = totalItems(s);
    A.remove(s, r.id!);
    run(s, 0.1);
    // only the roost's own cost comes back on top of what existed
    expect(totalItems(s) - before).toBe(2 + 8 + 6);
  });

  it('a dispatcher will not spin items into a depot', () => {
    const s = sandbox(6);
    give(s, { plank: 60, copper: 10, gear: 10, wood: 20, stone: 10 });
    const d = A.place(s, 'dispatcher', 2, 2, 0);
    A.place(s, 'depot', 3, 2);
    A.setFilter(s, d.id!, 'plank');
    const del = s.stats.delivered;
    run(s, 10);
    expect(s.stats.delivered).toBe(del);
  });

  it('skipping a contract leaves the other slots cooling down', () => {
    const s = createState(5);
    s.stats.obtained = { wood: 10, plank: 10, stone: 10 };
    s.trade.board = [{ item: 'wood', n: 10, got: 0, marks: 5 }, null, null];
    s.trade.refresh = [0, 20, 20];
    expect(A.skipContract(s, 0).ok).toBe(true);
    expect(s.trade.board[0]).not.toBeNull();
    expect(s.trade.board[1]).toBeNull();
    expect(s.trade.board[2]).toBeNull();
  });

  it('settler bonuses grow with diminishing returns', async () => {
    const { effectiveSpecialists } = await import('../../src/core/people');
    expect(effectiveSpecialists(1)).toBeGreaterThan(0.9);
    expect(effectiveSpecialists(100)).toBeLessThan(15);
  });

  it('removing an upgraded machine gives back half of the upgrades', () => {
    const s = sandbox(6);
    give(s, { wood: 1000 });
    s.trade.marks = 100;
    const c = A.place(s, 'composter', 2, 2);
    expect(A.upgrade(s, c.id!).ok).toBe(true); // level 2 costs 16 wood
    const w = s.stash.wood;
    A.remove(s, c.id!);
    expect(s.stash.wood - w).toBe(8 + 8);
  });
});
