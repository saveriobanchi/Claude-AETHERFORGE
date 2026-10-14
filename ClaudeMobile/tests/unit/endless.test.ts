import { describe, expect, it } from 'vitest';
import * as A from '../../src/core/actions';
import { AMBITIONS, LADDER_RUNGS, PATHS, ambitionById, charmMilestones, roman } from '../../src/core/content/ambitions';
import { PERK, masteryStar, nextStarAt } from '../../src/core/content/renown';
import { SEASONS, SEASON_DAYS, seasonFor, yearFor } from '../../src/core/content/seasons';
import { DAY_LENGTH } from '../../src/core/content/world';
import { checkAmbitions, goalText, openRung } from '../../src/core/ambitions';
import { machineSpeed, masteryBonus } from '../../src/core/sim';
import { made } from '../../src/core/state';
import { give, sandbox } from './helpers';

describe('legacy ambitions never run out', () => {
  it('every path continues past its hand-written rungs with harder goals', () => {
    const s = sandbox(4);
    for (const a of AMBITIONS) s.ambitions.add(a.id);
    for (const p of PATHS) {
      const a = openRung(s, p.id);
      expect(a.rung).toBe(LADDER_RUNGS + 1);
      expect(a.goals.length).toBeGreaterThan(0);
      for (const g of a.goals) expect(goalText(g).length).toBeGreaterThan(5);
      const later = ambitionById(`${p.id}_${LADDER_RUNGS + 10}`)!;
      expect(later.goals[0].n).toBeGreaterThan(a.goals[0].n);
      expect(later.reward.marks!).toBeGreaterThan(a.reward.marks!);
    }
    expect(ambitionById('land_99999')).toBe(null);
    expect(ambitionById('nope_5')).toBe(null);
  });

  it('a legacy rung completes, pays and opens the next', () => {
    const s = sandbox(14);
    for (const a of AMBITIONS) s.ambitions.add(a.id);
    s.trade.done = 100 + 60; // trade legacy I
    const pts = s.renown.points;
    checkAmbitions(s);
    expect(s.ambitions.has('trade_5')).toBe(true);
    expect(s.renown.points).toBeGreaterThanOrEqual(pts + 1);
    expect(openRung(s, 'trade').id).toBe('trade_6');
    expect(A.pinAmbition(s, 'trade_6').ok).toBe(true);
    expect(A.pinAmbition(s, 'trade_9').ok).toBe(false);
  });

  it('roman numerals and endless charm milestones', () => {
    expect(roman(4)).toBe('IV');
    expect(roman(14)).toBe('XIV');
    expect(roman(1999)).toBe('MCMXCIX');
    expect(charmMilestones(2600)).toEqual([20, 60, 150, 300, 600, 1000, 1500, 2000, 2500]);
  });
});

describe('legend perks', () => {
  it('have no rank cap and keep stacking', () => {
    const s = sandbox(4);
    give(s, { wood: 20, leaf: 10 });
    const id = A.place(s, 'composter', 1, 1).id!;
    const base = machineSpeed(s, s.buildings.get(id)!);
    s.renown.points = 20;
    for (let i = 0; i < 20; i++) expect(A.takePerk(s, 'craftsman').ok).toBe(true);
    expect(PERK.craftsman.max).toBe(Infinity);
    expect(machineSpeed(s, s.buildings.get(id)!)).toBeGreaterThan(base * 1.3);
  });
});

describe('grandmaster stars', () => {
  it('mastery goes past V, the speed bonus caps at V', () => {
    expect(masteryStar('plank', nextStarAt('plank', 7))).toBe(8);
    const s = sandbox(4);
    made(s, 'plank', nextStarAt('plank', 6));
    expect(s.events.some((e) => e.type === 'mastery' && e.star === 7)).toBe(true);
    expect(masteryBonus(s, 'plank')).toBeCloseTo(1.25, 6);
  });
});

describe('seasons', () => {
  it('cycle every four days, through the year', () => {
    expect(seasonFor(0).id).toBe('spring');
    expect(seasonFor(DAY_LENGTH * SEASON_DAYS).id).toBe('summer');
    expect(seasonFor(DAY_LENGTH * SEASON_DAYS * 3 + 1).id).toBe('winter');
    expect(seasonFor(DAY_LENGTH * SEASON_DAYS * 4).id).toBe('spring');
    expect(yearFor(DAY_LENGTH * SEASON_DAYS * 4)).toBe(2);
    // every season helps something and hinders something
    for (const se of SEASONS) {
      const v = [se.crop, se.regrow, se.wind, se.dew, se.hive];
      expect(Math.max(...v)).toBeGreaterThan(1);
    }
  });
});
