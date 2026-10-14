import { BUILDINGS } from './content/buildings';
import type { ItemId, Stack } from './content/items';
import {
  ARRIVE_EVERY, BLUEPRINTS, DESTINATION, FOODS, HOME_CAPACITY, IDLE_BONUS, LEAVE_AFTER, MAX_CREW, MEAL_EVERY, MEMORY,
  ROLES, type Role, SPECIALIST_BONUS,
} from './content/people';
import { type Building, type GameState, canAfford, pay, rand, stashAdd } from './state';

/** Settlers: housing, meals, contentment and the roles the player assigns. */

export function housing(s: GameState): number {
  let n = 0;
  for (const b of s.buildings.values()) if (BUILDINGS[b.type].kind === 'home') n += HOME_CAPACITY;
  return n;
}

/** Settlers at home (not away on an expedition). */
export function present(s: GameState): number {
  return Math.max(0, s.people.count - s.people.away);
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

/** Effective specialists in a role (scaled down while some are away). */
export function specialists(s: GameState, role: Role): number {
  const a = assigned(s), here = present(s);
  const n = s.people.roles[role] ?? 0;
  return a > here && a > 0 ? (n * here) / a : n;
}

export function idle(s: GameState): number {
  return Math.max(0, present(s) - assigned(s));
}

const ROLE_OF: Record<string, Role> = {};
for (const r of ROLES) for (const t of r.types) ROLE_OF[t] = r.id;

/** Speed multiplier settlers give a machine. */
export function settlerBonus(s: GameState, b: Building): number {
  const c = contentment(s);
  if (!c) return 1;
  const role = ROLE_OF[b.type];
  return 1 + IDLE_BONUS * idle(s) + (role ? SPECIALIST_BONUS * specialists(s, role) * c : 0);
}

/** Merchants raise contract pay. */
export function merchantBonus(s: GameState): number {
  return SPECIALIST_BONUS * specialists(s, 'merchant') * contentment(s);
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
  const every = MEAL_EVERY / Math.max(1, present(s));
  while (p.mealT >= every) {
    p.mealT -= every;
    if (eat(s)) p.hungry = 0;
    else p.hungry += every;
  }
  if (p.hungry > LEAVE_AFTER || p.count > Math.max(room, p.away)) {
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

// ───────────────────────── expeditions ─────────────────────────

export function destinationOpen(s: GameState, id: string): boolean {
  const d = DESTINATION[id];
  return !!d && s.known.has(d.needs);
}

export function canLaunch(s: GameState, dock: number, dest: string, crew: number): string {
  const d = DESTINATION[dest];
  if (!d || !destinationOpen(s, dest)) return 'Not charted yet';
  if (s.voyages.some((v) => v.dock === dock)) return 'The ship is away';
  if (crew < 1 || crew > MAX_CREW) return 'Crew of 1–3';
  if (present(s) - 0 < crew) return `Needs ${crew} settler${crew > 1 ? 's' : ''} at home`;
  if (!canAfford(s, d.provisions)) return 'Not enough provisions';
  return '';
}

export function launch(s: GameState, dock: number, dest: string, crew: number): string {
  const why = canLaunch(s, dock, dest, crew);
  if (why) return why;
  const d = DESTINATION[dest];
  pay(s, d.provisions);
  s.people.away += crew;
  s.voyages.push({ dock, dest, crew, t: d.time, total: d.time });
  return '';
}

function roll(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

/** Resolve a returning voyage: loot scaled by crew, blueprint rolls. */
function returnHome(s: GameState, v: GameState['voyages'][number]): void {
  const d = DESTINATION[v.dest];
  const got: Stack = {};
  for (const l of d.loot) {
    if (rand(s) >= Math.min(1, l.chance * (1 + 0.25 * (v.crew - 1)))) continue;
    const n = Math.round(roll(s, l.min, l.max) * (1 + 0.5 * (v.crew - 1)));
    const fit = stashAdd(s, l.item, n);
    if (fit) got[l.item] = (got[l.item] ?? 0) + fit;
  }
  let bp: string | null = null;
  for (let i = 0; i < v.crew && !bp; i++) {
    if (rand(s) < d.blueprint) {
      const unknown = BLUEPRINTS.filter((b) => !s.known.has(b));
      if (unknown.length) bp = unknown[Math.floor(rand(s) * unknown.length)];
    }
  }
  if (bp) s.known.add(bp);
  s.people.away = Math.max(0, s.people.away - v.crew);
  s.stats.voyages = (s.stats.voyages ?? 0) + 1;
  s.lastVoyage = { dest: v.dest, got, blueprint: bp };
  s.events.push({ type: 'voyage', dest: v.dest, got, blueprint: bp });
}

export function tickVoyages(s: GameState, dt: number): void {
  if (!s.voyages.length) return;
  for (const v of s.voyages) v.t -= dt;
  const done = s.voyages.filter((v) => v.t <= 0 || !s.buildings.has(v.dock));
  if (!done.length) return;
  s.voyages = s.voyages.filter((v) => !done.includes(v));
  for (const v of done) returnHome(s, v);
}
