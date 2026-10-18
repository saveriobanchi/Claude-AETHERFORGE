import { describe, expect, it } from 'vitest';
import { achText, achVisible, checkAchievements } from '../../src/core/achievements';
import { ACHIEVEMENTS, ACH, ACH_BRANCHES } from '../../src/core/content/achievements';
import { ITEMS } from '../../src/core/content/items';
import { deserialize, serialize } from '../../src/core/save';
import { run } from '../../src/core/sim';
import { createState } from '../../src/core/state';

describe('achievements', () => {
  it('form a well-shaped tree: unique ids, parents in the same branch and listed first', () => {
    const seen = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(seen.has(a.id), a.id).toBe(false);
      if (a.parent) {
        expect(seen.has(a.parent), `${a.id} parent ${a.parent} listed earlier`).toBe(true);
        expect(ACH[a.parent].branch, a.id).toBe(a.branch);
      }
      if (a.goal.t === 'made') expect(ITEMS[a.goal.item], a.id).toBeDefined();
      seen.add(a.id);
    }
    for (const b of ACH_BRANCHES) expect(ACHIEVEMENTS.some((a) => a.branch === b.id && !a.parent), b.id).toBe(true);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(100);
  });

  it('cascade down a branch as goals are met, paying renown XP, and survive a save', () => {
    const s = createState(9);
    s.stats.harvests = 600;
    const xp = s.renown.xp + s.renown.level * 1000;
    checkAchievements(s);
    expect(s.achieved.has('h_first')).toBe(true);
    expect(s.achieved.has('h_500')).toBe(true);
    expect(s.achieved.has('h_5000')).toBe(false);
    expect(s.renown.xp + s.renown.level * 1000).toBeGreaterThan(xp);
    const back = deserialize(JSON.parse(JSON.stringify(serialize(s)))).state;
    expect([...back.achieved.keys()].sort()).toEqual([...s.achieved.keys()].sort());
  });

  it('stay hidden until their parent is earned, and never name unfound items', () => {
    const s = createState(9);
    expect(achVisible(s, ACH.h_500)).toBe(false);
    expect(achVisible(s, ACH.h_first)).toBe(true);
    expect(achText(s, ACH.c_mech.goal)).toContain('not yet found');
  });

  it('are checked by the running sim', () => {
    const s = createState(9);
    s.stats.harvests = 1;
    run(s, 1.1);
    expect(s.achieved.has('h_first')).toBe(true);
    expect(s.events.length >= 0).toBe(true);
  });
});
