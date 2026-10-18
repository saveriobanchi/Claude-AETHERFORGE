import { goalText, goalValue } from './ambitions';
import { ACHIEVEMENTS, ACH, type AchDef, type AchGoal, achXp } from './content/achievements';
import { BUILDINGS } from './content/buildings';
import { DISCOVERY_LIST } from './content/discoveries';
import { ITEMS } from './content/items';
import { masteryStar } from './content/renown';
import { yearFor } from './content/seasons';
import { type GameState, addXp } from './state';

/** Current value of an achievement's measure. */
export function achValue(s: GameState, g: AchGoal): number {
  switch (g.t) {
    case 'stat': return s.stats[g.key] ?? 0;
    case 'earned': return s.trade.earned;
    case 'tradeLevel': return s.trade.level;
    case 'discoveries': return DISCOVERY_LIST.filter((d) => d.id !== 'start' && s.known.has(d.id)).length;
    case 'stars': { let n = 0; for (const k in s.stats.made) n += masteryStar(k as keyof typeof ITEMS, s.stats.made[k as keyof typeof ITEMS] ?? 0); return n; }
    case 'ambitions': return s.ambitions.size;
    case 'kind': { let n = 0; for (const b of s.buildings.values()) if (BUILDINGS[b.type].kind === g.kind) n++; return n; }
    case 'years': return yearFor(s.time);
    case 'paved': { let n = 0; for (const t of s.tiles.values()) if (t.floor !== 'grass') n++; return n; }
    case 'perks': { let n = 0; for (const k in s.renown.perks) n += s.renown.perks[k] ?? 0; return n; }
    default: return goalValue(s, g);
  }
}

/** Player-facing line for an achievement's goal. Items not yet found stay unnamed. */
export function achText(s: GameState, g: AchGoal): string {
  switch (g.t) {
    case 'stat': {
      if (g.key === 'playSeconds') return `Spend ${Math.round(g.n / 3600)} hour${g.n >= 7200 ? 's' : ''} on the island`;
      const what = { harvests: 'Gather by hand', delivered: 'Deliver by machine', crafted: 'Craft by hand', built: 'Build', bestCombo: 'Chain a gathering combo of' }[g.key];
      return `${what} ${g.n.toLocaleString('en')}${g.key === 'harvests' ? ' times' : g.key === 'bestCombo' ? ' taps' : g.key === 'delivered' ? ' items' : g.key === 'crafted' ? ' items' : ''}`;
    }
    case 'earned': return `Earn ${g.n.toLocaleString('en')} Marks in all`;
    case 'tradeLevel': return `Reach trade level ${g.n}`;
    case 'discoveries': return `Make ${g.n} discoveries`;
    case 'stars': return `Earn ${g.n} mastery star${g.n > 1 ? 's' : ''}`;
    case 'ambitions': return `Achieve ${g.n} ambitions`;
    case 'kind': return `Have ${g.n} ${g.label}`;
    case 'years': return `See year ${g.n} begin`;
    case 'paved': return `Pave ${g.n} tiles`;
    case 'perks': return `Take ${g.n} perk ranks`;
    case 'made': return (s.stats.obtained[g.item] ?? 0) > 0 ? goalText(g) : `Make ${g.n.toLocaleString('en')} of something not yet found`;
    default: return goalText(g);
  }
}

/** A branch root, or an achievement whose parent is earned: its goal can be read. */
export function achVisible(s: GameState, a: AchDef): boolean {
  return !a.parent || s.achieved.has(a.parent);
}

export function achProgress(s: GameState, a: AchDef): number {
  return s.achieved.has(a.id) ? 1 : Math.max(0, Math.min(1, achValue(s, a.goal) / a.goal.n));
}

/** Earn every open achievement whose goal is met; a parent opens its children (checked again next second). */
export function checkAchievements(s: GameState): void {
  for (const a of ACHIEVEMENTS) {
    if (s.achieved.has(a.id) || !achVisible(s, a)) continue;
    if (achValue(s, a.goal) < a.goal.n) continue;
    s.achieved.set(a.id, s.time);
    addXp(s, achXp(a));
    s.events.push({ type: 'achievement', id: a.id });
  }
}

export { ACH };
