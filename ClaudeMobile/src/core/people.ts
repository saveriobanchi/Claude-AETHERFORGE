import { BUILDINGS } from './content/buildings';
import type { ItemId } from './content/items';
import {
  ARRIVE_EVERY, DESIGN, FOODS, HOME_CAPACITY, IDLE_BONUS, LEAVE_AFTER, MEAL_EVERY, MEMORY,
  ROLES, type Role, SPECIALIST_BONUS,
} from './content/people';
import { seasonFor } from './content/seasons';
import { type Building, type GameState, canAfford, pay } from './state';

/** Settlers: housing, meals, contentment and the roles the player assigns. */

export function housing(s: GameState): number {
  let n = 0;
  for (const b of s.buildings.values()) if (BUILDINGS[b.type].kind === 'home') n += HOME_CAPACITY;
  return n;
}

export function present(s: GameState): number {
  return s.people.count;
}

export function assigned(s: GameState): number {
  return ROLES.reduce((a, r) => a + (s.people.roles[r.id] ?? 0), 0);
}

/** 1 + 0.1 per distinct food in recent meals (beyond the first), +10% with charm 60; 0 when hungry. */
export function contentment(s: GameState): number {
  const p = s.people;
  if (!p.count || p.hungry > 0) return 0;
  const variety = new Set(p.meals).size;
  return Math.min(1.5, 1 + 0.1 * Math.max(0, variety - 1)) + (s.cache.charm >= 60 ? 0.1 : 0);
}

export function specialists(s: GameState, role: Role): number {
  return s.people.roles[role] ?? 0;
}

export function idle(s: GameState): number {
  return Math.max(0, present(s) - assigned(s));
}

const ROLE_OF: Record<string, Role> = {};
for (const r of ROLES) for (const t of r.types) ROLE_OF[t] = r.id;

/**
 * Specialists help less and less as a role fills up: ten count as about
 * six, a hundred as about twelve. Keeps big towns strong but finite.
 */
export const effectiveSpecialists = (n: number) => n / (1 + n / 15);
/** Idle hands help a little, up to +15%. */
const idleBonus = (n: number) => Math.min(0.15, IDLE_BONUS * n);

/** Speed multiplier settlers give a machine. */
export function settlerBonus(s: GameState, b: Building): number {
  const c = contentment(s);
  if (!c) return 1;
  const role = ROLE_OF[b.type];
  return 1 + idleBonus(idle(s)) + (role ? SPECIALIST_BONUS * effectiveSpecialists(specialists(s, role)) * c : 0);
}

/** Merchants raise contract pay. */
export function merchantBonus(s: GameState): number {
  return SPECIALIST_BONUS * effectiveSpecialists(specialists(s, 'merchant')) * contentment(s);
}

export function assign(s: GameState, role: Role, delta: number): boolean {
  const cur = s.people.roles[role] ?? 0;
  if (delta > 0 && assigned(s) >= s.people.count) return false;
  if (delta < 0 && cur <= 0) return false;
  s.people.roles[role] = cur + delta;
  return true;
}

/** Settlers prefer what they have not eaten lately; among equals, what there is most of. */
function eat(s: GameState): boolean {
  const recent = (f: ItemId) => s.people.meals.filter((m) => m === f).length;
  let best: ItemId | null = null;
  for (const f of FOODS) {
    if (s.stash[f] <= 0) continue;
    if (!best || recent(f) < recent(best) || (recent(f) === recent(best) && s.stash[f] > s.stash[best])) best = f;
  }
  if (!best) return false;
  s.stash[best]--;
  s.people.meals.push(best);
  if (s.people.meals.length > MEMORY) s.people.meals.shift();
  return true;
}

export function tickPeople(s: GameState, dt: number): void {
  const p = s.people;
  const room = housing(s);
  const hasFood = FOODS.some((f) => s.stash[f] > 0);
  if (p.count < room && hasFood) {
    p.arriveT += dt;
    if (p.arriveT >= ARRIVE_EVERY) {
      p.arriveT = 0;
      p.count++;
      s.flags.add('settler_arrived');
      s.events.push({ type: 'settler', n: p.count });
    }
  } else p.arriveT = 0;
  if (!p.count) { p.hungry = 0; return; }
  p.mealT += dt;
  const every = MEAL_EVERY / Math.max(1, present(s)) / seasonFor(s.time).appetite;
  while (p.mealT >= every) {
    p.mealT -= every;
    if (eat(s)) p.hungry = 0;
    else p.hungry += every;
  }
  if (p.hungry > LEAVE_AFTER || p.count > room) {
    p.count = Math.max(0, p.count - 1);
    p.hungry = 0;
    s.events.push({ type: 'settler_left', n: p.count });
    // un-assign from the largest role if over-assigned
    while (assigned(s) > p.count) {
      const r = ROLES.slice().sort((a, b) => (p.roles[b.id] ?? 0) - (p.roles[a.id] ?? 0))[0];
      p.roles[r.id] = Math.max(0, (p.roles[r.id] ?? 0) - 1);
    }
  }
}

// ───────────────────────── designs ─────────────────────────

export function hasDraftingTable(s: GameState): boolean {
  for (const b of s.buildings.values()) if (b.type === 'drafting_table') return true;
  return false;
}

/** Why a design cannot be drafted yet ('' when it can). */
export function canDraft(s: GameState, id: string): string {
  const d = DESIGN[id];
  if (!d) return 'Unknown design';
  if (s.known.has(id)) return 'Already drafted';
  if (!hasDraftingTable(s)) return 'Needs a Drafting Table';
  if (!d.needs.every((n) => s.known.has(n))) return 'Not yet understood';
  if (!canAfford(s, d.cost)) return 'Not enough materials';
  return '';
}

/** Pay the cost and learn the design (its recipe becomes a choice on its machine). */
export function draft(s: GameState, id: string): string {
  const why = canDraft(s, id);
  if (why) return why;
  pay(s, DESIGN[id].cost);
  s.known.add(id);
  s.events.push({ type: 'design', id });
  return '';
}
