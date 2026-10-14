import { SAVE_VERSION } from '../../src/core/state';
import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { PERKS, masteryStar, masteryThresholds, xpForLevel } from '../../src/core/content/renown';
import { RECIPES } from '../../src/core/content/recipes';
import { deserialize, migrate, serialize } from '../../src/core/save';
import { checkCodex, luckyChance, machineSpeed, run } from '../../src/core/sim';
import { addXp, capacity, createState, made } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('mastery', () => {
  it('stars come at ×10 steps, scaled by tier', () => {
    const t = masteryThresholds('plank');
    expect(t).toEqual([40, 400, 4000, 40000, 400000]);
    expect(masteryThresholds('crystal')[0]).toBeLessThan(t[0]);
    expect(masteryStar('plank', 39)).toBe(0);
    expect(masteryStar('plank', 400)).toBe(2);
  });

  it('counts every way of making things and grants renown per star', () => {
    const s = sandbox(4);
    made(s, 'plank', 45);
    expect(s.events.some((e) => e.type === 'mastery' && e.item === 'plank' && e.star === 1)).toBe(true);
    expect(s.renown.xp + s.renown.level).toBeGreaterThan(0);
    // hand crafting counts
    give(s, { wood: 100 });
    A.place(s, 'workbench', 0, 0);
    A.craft(s, 'plank', 5);
    expect(s.stats.made.plank).toBe(50);
  });

  it('machines making a mastered item work faster', () => {
    const s = sandbox(4);
    give(s, { wood: 20, leaf: 10 });
    const id = A.place(s, 'composter', 1, 1).id!;
    const base = machineSpeed(s, s.buildings.get(id)!);
    made(s, 'loam', 100000);
    expect(machineSpeed(s, s.buildings.get(id)!)).toBeCloseTo(base * 1.2, 5);
  });
});

describe('renown and perks', () => {
  it('levels grant perk points', () => {
    const s = createState();
    addXp(s, xpForLevel(0) + xpForLevel(1));
    expect(s.renown.level).toBe(2);
    expect(s.renown.points).toBe(2);
  });

  it('discoveries give renown', () => {
    const s = createState();
    for (let i = 0; i < 4; i++) A.harvestAt(s, 0, 0);
    expect(s.known.has('compost')).toBe(true);
    expect(s.renown.xp + s.renown.level * 80).toBeGreaterThan(0);
  });

  it('perks cost points, cap at 3 ranks and take effect', () => {
    const s = sandbox(4);
    s.renown.points = 5;
    const cap = capacity(s);
    for (let i = 0; i < 3; i++) expect(A.takePerk(s, 'deep_cellars').ok).toBe(true);
    expect(A.takePerk(s, 'deep_cellars').ok).toBe(false);
    expect(capacity(s)).toBeGreaterThan(cap);
    expect(s.renown.points).toBe(2);
    s.renown.points = 0;
    expect(A.takePerk(s, 'haggler').ok).toBe(false);
  });

  it('respec returns every point for Marks', () => {
    const s = sandbox(4);
    s.renown.points = 3;
    A.takePerk(s, 'well_oiled'); A.takePerk(s, 'bargains');
    expect(A.respec(s).ok).toBe(false); // no Marks
    s.trade.marks = 100;
    expect(A.respec(s).ok).toBe(true);
    expect(s.renown.points).toBe(3);
    expect(s.trade.marks).toBe(90);
    expect(PERKS.length).toBe(15);
  });

  it('lucky gears raise lucky output', () => {
    const s = sandbox(4);
    const base = luckyChance(s);
    s.renown.perks.lucky_gears = 3;
    expect(luckyChance(s)).toBeCloseTo(base + 0.03, 6);
  });

  it('bargains lower market prices', () => {
    const s = sandbox(4);
    const p = A.priceOf(s, 'master');
    s.renown.perks.bargains = 3;
    expect(A.priceOf(s, 'master')).toBeLessThan(p);
  });
});

describe('luck and combos', () => {
  it('lucky cycles happen at about the expected rate', () => {
    const s = sandbox(6, 'grass');
    give(s, { wood: 200, twine: 50, plank: 50 });
    for (let i = 0; i < 12; i++) A.place(s, 'dew_catcher', i % 6, Math.floor(i / 6));
    let lucky = 0, cycles = 0;
    for (let t = 0; t < 400; t++) {
      run(s, 10);
      for (const e of s.events) if (e.type === 'lucky') lucky++;
      s.events.length = 0;
      for (const b of s.buildings.values()) { cycles += b.cycles; b.cycles = 0; A.collect(s, b.id); }
    }
    expect(lucky / cycles).toBeGreaterThan(0.008);
    expect(lucky / cycles).toBeLessThan(0.04);
  });

  it('gathering chains a combo and every fifth tap gives one more', () => {
    const s = createState(3);
    s.buildings.values().next().value!.stock = 5;
    let extra = 0, combo = 0;
    for (let i = 0; i < 5; i++) {
      const r = A.harvestAt(s, 0, 0);
      combo = r.combo ?? 0;
      if (i === 4) extra = (r.got?.wood ?? 0) - (r.crit ? 3 : 1);
      run(s, 0.3);
    }
    expect(combo).toBe(5);
    expect(extra).toBe(1);
    run(s, 3);
    s.buildings.values().next().value!.stock = 5;
    expect(A.harvestAt(s, 0, 0).combo).toBe(1);
  });

  it('bountiful harvests happen and triple the yield', () => {
    const s = createState(11);
    s.extraCapacity = 1e6;
    const tree = s.buildings.values().next().value!;
    let crits = 0;
    for (let i = 0; i < 400; i++) {
      tree.stock = 5;
      run(s, 2.5); // break the combo
      const r = A.harvestAt(s, 0, 0);
      if (r.crit) { crits++; expect(r.got?.wood).toBeGreaterThanOrEqual(3); }
    }
    expect(crits).toBeGreaterThan(10);
    expect(crits).toBeLessThan(70);
  });
});

describe('rare gems and the codex', () => {
  it('gems come from existing chains', () => {
    expect(RECIPES.sift_loam.chance?.topaz).toBeGreaterThan(0);
    expect(RECIPES.sift_gravel.chance?.ruby).toBeGreaterThan(0);
    expect(RECIPES.crush.chance?.opal).toBeGreaterThan(0);
  });

  it('completing a set grants a perk point once', () => {
    const s = sandbox(4);
    const before = s.renown.points;
    for (const g of ['topaz', 'ruby', 'opal', 'emerald'] as const) s.stats.obtained[g] = 1;
    checkCodex(s);
    checkCodex(s);
    expect(s.renown.codex).toContain('gems');
    expect(s.renown.points).toBeGreaterThanOrEqual(before + 1);
    expect(s.renown.codex.filter((c) => c === 'gems').length).toBe(1);
  });
});

describe('renown saves', () => {
  it('round-trips and migrates v4 (mastery starts from what was gathered)', () => {
    const s = sandbox(4);
    s.renown.perks.forager = 2;
    s.renown.points = 3;
    made(s, 'plank', 12);
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(d.renown.perks.forager).toBe(2);
    expect(d.stats.made.plank).toBe(12);
    const v4 = { ...serialize(s), v: 4 } as Record<string, unknown>;
    delete v4.renown;
    (v4.stats as Record<string, unknown>).made = undefined;
    (v4.stats as Record<string, unknown>).obtained = { wood: 77 };
    const m = migrate(v4);
    expect(m.v).toBe(SAVE_VERSION);
    expect(deserialize(v4).state.stats.made.wood).toBe(77);
  });
});
