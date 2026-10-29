import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { BUILDINGS } from '../../src/core/content/buildings';
import { DISCOVERIES } from '../../src/core/content/discoveries';
import { FOODS, MEMORY } from '../../src/core/content/people';
import { RECIPES } from '../../src/core/content/recipes';
import { upgradeCost } from '../../src/core/content/trade';
import { run } from '../../src/core/sim';
import { give, sandbox } from './helpers';

describe('material expansion', () => {
  it('metalwork: steel in the furnace, springs, and a mechanism that saves copper', () => {
    const s = sandbox(6);
    give(s, { iron: 40, charcoal: 40, plank: 50, gear: 50, stone: 50, brick: 50, copper: 20, twine: 20 });
    A.place(s, 'windmill', 5, 0); A.place(s, 'windmill', 5, 1); // the bellows need breeze
    const f = A.place(s, 'furnace', 2, 2);
    expect(f.ok).toBe(true);
    expect(A.setRecipe(s, f.id!, 'steel').ok).toBe(true);
    A.load(s, f.id!);
    run(s, 30);
    expect(s.buildings.get(f.id!)!.outBuf.steel ?? 0).toBeGreaterThan(0);
    // spring mechanism gives two mechanisms for one gear instead of two gears and two wire
    expect(RECIPES.spring_mech.outputs.mechanism).toBe(2);
    expect(DISCOVERIES.steel.after).toContain('iron');
  });

  it('level V is master work and needs steel; lower levels do not', () => {
    expect(upgradeCost(BUILDINGS.kiln, 5).items.steel).toBeGreaterThan(0);
    expect(upgradeCost(BUILDINGS.kiln, 4).items.steel ?? 0).toBe(0);
  });

  it('kitchen: three new dishes settlers eat, and a longer memory for variety', () => {
    for (const d of ['soup', 'jam', 'honey_cake'] as const) {
      expect(FOODS, d).toContain(d);
      expect(Object.values(RECIPES).some((r) => r.outputs[d]), d).toBe(true);
    }
    expect(MEMORY).toBeGreaterThanOrEqual(10);
  });
});
