import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/core/content/recipes';
import { DESIGN } from '../../src/core/content/people';
import { plotCost } from '../../src/core/content/world';
import { run } from '../../src/core/sim';
import { sandbox } from './helpers';

describe('economy pacing', () => {
  it('big islands grow more tall grass', () => {
    const count = (n: number) => { const s = sandbox(n, 'grass'); run(s, 19); return [...s.buildings.values()].filter((b) => b.type === 'tuft').length; };
    expect(count(15)).toBeGreaterThan(count(5));
  });

  it('loam has roots besides leaves, and copper a better sieve', () => {
    expect(RECIPES.mulch.outputs.loam).toBeGreaterThan(0);
    expect(RECIPES.pulp.outputs.loam).toBeGreaterThan(0);
    expect(DESIGN.bp_fine_mesh).toBeDefined();
    expect(RECIPES.bp_fine_mesh.chance!.copper_grit).toBeGreaterThan(RECIPES.sift_loam.chance!.copper_grit ?? 0);
  });

  it('plots grow in a straight line past a hundred extra tiles', () => {
    const step = (t: number) => (plotCost(t + 1).loam ?? 0) - (plotCost(t).loam ?? 0);
    expect(Math.abs(step(300) - step(400))).toBeLessThanOrEqual(1);
  });
});
