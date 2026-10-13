import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { applyOffline, flowRates } from '../../src/core/offline';
import { deserialize, exportText, importText, migrate, serialize } from '../../src/core/save';
import { run } from '../../src/core/sim';
import { SAVE_VERSION, createState } from '../../src/core/state';
import { give, sandbox } from './helpers';

function busyWorld() {
  const s = sandbox(10);
  give(s, { gear: 50, plank: 50, stone: 50, twine: 20, copper: 10, loam: 200, pebble: 40 });
  A.place(s, 'windmill', 9, 9);
  const sifter = A.place(s, 'wind_sifter', 2, 2, 0).id!;
  A.place(s, 'depot', 3, 2);
  const d = A.place(s, 'dispatcher', 0, 2, 0).id!;
  A.setFilter(s, d, 'loam');
  A.place(s, 'belt', 1, 2, 0);
  void sifter;
  run(s, 60);
  return s;
}

describe('save / load', () => {
  it('round-trips a running world exactly', () => {
    const s = busyWorld();
    const json = JSON.parse(JSON.stringify(serialize(s, { x: 1, y: 2, zoom: 1.5 })));
    const { state: r, view } = deserialize(json);
    r.extraCapacity = s.extraCapacity;
    r.topoDirty = true;
    expect(view).toEqual({ x: 1, y: 2, zoom: 1.5 });
    expect(r.tiles.size).toBe(s.tiles.size);
    expect(r.buildings.size).toBe(s.buildings.size);
    expect(r.stash).toEqual(s.stash);
    expect([...r.known].sort()).toEqual([...s.known].sort());
    // continuing both produces the same result (deterministic)
    run(s, 30);
    run(r, 30);
    expect(r.stash).toEqual(s.stash);
  });

  it('export/import text survives', () => {
    const s = busyWorld();
    const t = exportText(s);
    expect(t.startsWith('AETHERFORGE1:')).toBe(true);
    const { state } = importText(t);
    expect(state.stash).toEqual(s.stash);
  });

  it('migrates a v1 save', () => {
    const v1 = {
      v: 1, rng: 5, time: 100,
      tiles: [[0, 0, 'grass'], [1, 0, 'grass']],
      buildings: [[1, 'tree', 0, 0, 0, { stock: 3 }]],
      stash: [['wood', 12], ['leaf', 4]],
      stats: { obtained: { wood: 12 } }, known: ['start', 'compost'], flags: [], nextId: 2, savedAt: 0,
    };
    const m = migrate(JSON.parse(JSON.stringify(v1)));
    expect(m.v).toBe(SAVE_VERSION);
    const { state } = deserialize(v1);
    expect(state.stash.wood).toBe(12);
    expect(state.buildings.get(1)?.stock).toBe(3);
    expect(state.forge.stage).toBe(-1);
  });

  it('rejects garbage and newer versions, tolerates unknown content', () => {
    expect(() => deserialize(null)).toThrow();
    expect(() => deserialize({ v: 999 })).toThrow();
    const s = createState();
    const d = serialize(s);
    d.buildings.push([99, 'not_a_building', 5, 5, 0, {}]);
    (d.stash as Record<string, number>).unobtainium = 5;
    const { state } = deserialize(JSON.parse(JSON.stringify(d)));
    expect(state.buildings.size).toBe(1);
    expect((state.stash as Record<string, number>).unobtainium).toBeUndefined();
  });
});

describe('offline progression', () => {
  it('measures automated flow and applies it capped and at reduced efficiency', () => {
    const s = busyWorld();
    run(s, 240);
    const { rate } = flowRates(s);
    expect(rate.pebble ?? 0).toBeGreaterThan(0);
    expect(rate.loam ?? 0).toBeLessThan(0);
    const before = { ...s.stash };
    const rep = applyOffline(s, 3600)!;
    expect(rep).toBeTruthy();
    // the loam supply runs out: gains are limited by it
    expect(s.stash.loam).toBeGreaterThanOrEqual(0);
    expect(rep.gained.pebble ?? 0).toBeLessThanOrEqual(2 * before.loam + 2);
  });

  it('caps very long absences', () => {
    const s = sandbox(4);
    s.flow.hist = [{ dt: 300, inn: { wood: 300 }, out: {} }];
    const rep = applyOffline(s, 100 * 3600)!;
    expect(rep.counted).toBe(4 * 3600);
    expect(rep.gained.wood).toBe(Math.floor(1 * 4 * 3600 * 0.5));
  });

  it('short absences are simulated exactly', () => {
    const s = createState();
    const t0 = s.time;
    expect(applyOffline(s, 30)).toBeNull();
    expect(s.time - t0).toBeCloseTo(30, 0);
  });
});
