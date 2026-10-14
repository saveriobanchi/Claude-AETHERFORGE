import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { DESIGN, DESIGNS, FOODS, MEAL_EVERY } from '../../src/core/content/people';
import { DISCOVERIES } from '../../src/core/content/discoveries';
import { RECIPES } from '../../src/core/content/recipes';
import { ITEMS } from '../../src/core/content/items';
import { contentment, housing, merchantBonus, settlerBonus } from '../../src/core/people';
import { deserialize, serialize } from '../../src/core/save';
import { defaultRecipe, machineSpeed, run } from '../../src/core/sim';
import { give, sandbox } from './helpers';

function village(n: number) {
  const s = sandbox(8, 'grass');
  for (const id of ['settlers', 'farming', 'baking', 'trade']) s.known.add(id);
  give(s, { plank: 400, brick: 200, cloth: 100, gear: 50, iron: 50, bread: 60, stone: 50 });
  for (let i = 0; i < Math.ceil(n / 2); i++) A.place(s, 'cottage', i, 0);
  run(s, 46 * n + 1);
  return s;
}

describe('farming', () => {
  it('fields grow faster on marsh, slower on frost', () => {
    const s = sandbox(6, 'grass');
    s.known.add('farming');
    give(s, { loam: 50, plank: 50, dew: 50 });
    for (const t of s.tiles.values()) if (t.x === 0) t.biome = 'marsh'; else if (t.x === 1) t.biome = 'frost';
    const wet = A.place(s, 'field', 0, 0).id!, cold = A.place(s, 'field', 1, 0).id!, plain = A.place(s, 'field', 2, 0).id!;
    const sp = (id: number) => machineSpeed(s, s.buildings.get(id)!);
    // biome crop speed applies on top of the machine speed
    expect(RECIPES.grow_wheat.stations).toContain('field');
    for (const id of [wet, cold, plain]) { A.setRecipe(s, id, 'grow_wheat'); A.load(s, id); }
    run(s, 41);
    expect(s.buildings.get(wet)!.cycles).toBeGreaterThanOrEqual(1);
    expect(s.buildings.get(plain)!.cycles).toBeGreaterThanOrEqual(1);
    expect(s.buildings.get(cold)!.cycles).toBe(0);
    expect(sp(wet)).toBeCloseTo(sp(plain), 5);
  });

  it('every new food is something settlers eat', () => {
    for (const f of ['bread', 'stew', 'pie', 'egg', 'carrot'] as const) expect(FOODS).toContain(f);
    for (const f of FOODS) expect(ITEMS[f]).toBeDefined();
  });
});

describe('settlers', () => {
  it('arrive while there is room and food, one cottage houses two', () => {
    const s = village(2);
    expect(housing(s)).toBe(2);
    expect(s.people.count).toBe(2);
    expect(s.flags.has('settler_arrived')).toBe(true);
    run(s, 200);
    expect(s.people.count).toBe(2);
  });

  it('vary their meals from what you have; variety makes them content', () => {
    const s = village(2);
    s.stash.bread = 0;
    give(s, { stew: 30, egg: 20, apple: 10 });
    run(s, MEAL_EVERY * 4);
    expect(new Set(s.people.meals).size).toBeGreaterThanOrEqual(2);
    expect(contentment(s)).toBeGreaterThan(1);
  });

  it('go hungry without food, and one leaves after a while', () => {
    const s = village(2);
    for (const f of FOODS) s.stash[f] = 0;
    run(s, 120);
    expect(contentment(s)).toBe(0);
    run(s, 400);
    expect(s.people.count).toBeLessThan(2);
    expect(s.events.some((e) => e.type === 'settler_left')).toBe(true);
  });

  it('specialists speed up their machines; merchants raise pay', () => {
    const s = village(4);
    give(s, { wood: 20, stone: 20, plank: 40 });
    const id = A.place(s, 'composter', 0, 4).id!;
    const b = s.buildings.get(id)!;
    const base = settlerBonus(s, b);
    expect(A.assignRole(s, 'forester', 1).ok).toBe(true);
    expect(A.assignRole(s, 'forester', 1).ok).toBe(true);
    expect(settlerBonus(s, b)).toBeGreaterThan(base);
    expect(merchantBonus(s)).toBe(0);
    A.assignRole(s, 'merchant', 1);
    expect(merchantBonus(s)).toBeGreaterThan(0);
    A.assignRole(s, 'smith', 1);
    expect(A.assignRole(s, 'smith', 1).ok).toBe(false); // everyone has a role
    expect(A.assignRole(s, 'mystic', -1).ok).toBe(false);
  });
});

describe('designs', () => {
  it('every design is an alternative recipe, never a default', () => {
    for (const d of DESIGNS) {
      const r = Object.values(RECIPES).find((x) => x.unlock === d.id);
      expect(r, d.id).toBeDefined();
      for (const st of r!.stations) expect(defaultRecipe(st)).not.toBe(r!.id);
      for (const n of d.needs) expect(DISCOVERIES[n], n).toBeDefined();
      expect(Object.keys(d.cost).length).toBeGreaterThan(0);
    }
  });

  it('are drafted at the table for a fixed cost, once', () => {
    const s = sandbox(6);
    give(s, { copper: 200, mechanism: 10, plank: 50, glass: 10, gear: 20 });
    expect(A.draftDesign(s, 'bp_gears').reason).toBe('Needs a Drafting Table');
    A.place(s, 'drafting_table', 0, 0);
    const copper = s.stash.copper;
    expect(A.draftDesign(s, 'bp_gears').ok).toBe(true);
    expect(s.stash.copper).toBe(copper - DESIGN.bp_gears.cost.copper!);
    expect(s.known.has('bp_gears')).toBe(true);
    expect(s.events.some((e) => e.type === 'design')).toBe(true);
    expect(A.draftDesign(s, 'bp_gears').ok).toBe(false);
    expect(A.draftDesign(s, 'bp_lattice').reason).toBe('Not enough materials');
    s.known.delete('resonance');
    expect(A.draftDesign(s, 'bp_lattice').reason).toBe('Not yet understood');
  });

  it('settlers and designs survive a save', () => {
    const s = village(2);
    A.assignRole(s, 'forester', 1);
    s.known.add('bp_clamp');
    const d = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect(d.people.count).toBe(2);
    expect(d.people.roles.forester).toBe(1);
    expect(d.known.has('bp_clamp')).toBe(true);
  });
});
