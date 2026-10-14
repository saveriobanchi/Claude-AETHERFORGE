import { BUILDINGS } from './content/buildings';
import { FRUIT_BY_TREE } from './content/biomes';
import { AMBITIONS, AMBITION_XP, LADDER_RUNGS, PATHS, type AmbitionDef, type Goal, type PathId, CHARM_XP, charmMilestones, legacyAmbition } from './content/ambitions';
import { MAX_LEVEL } from './content/trade';
import { BLUEPRINTS } from './content/people';
import { ITEMS, type ItemId } from './content/items';
import { checkDiscoveries } from './progression';
import { type GameState, addXp, stashAdd } from './state';

/**
 * Island charm: the sum of decor charm. Variety pays — the first ten of a
 * kind count fully, more count a quarter.
 */
export function charm(s: GameState): number {
  const per = new Map<string, number>();
  for (const b of s.buildings.values()) {
    const c = BUILDINGS[b.type].charm;
    if (c) per.set(b.type, (per.get(b.type) ?? 0) + 1);
  }
  let total = 0;
  for (const [type, n] of per) {
    const c = BUILDINGS[type].charm ?? 0;
    total += c * Math.min(n, 10) + c * 0.25 * Math.max(0, n - 10);
  }
  return Math.floor(total);
}

function count(s: GameState, type: string): number {
  let n = 0;
  for (const b of s.buildings.values()) if (type === '*fruit' ? !!FRUIT_BY_TREE[b.type] : b.type === type) n++;
  return n;
}

/** Current value of a goal's measure. */
export function goalValue(s: GameState, g: Goal): number {
  switch (g.t) {
    case 'built': return count(s, g.type);
    case 'made': return s.stats.made[g.item] ?? 0;
    case 'tiles': return s.tiles.size;
    case 'contracts': return s.trade.done;
    case 'charm': return charm(s);
    case 'level': { let m = 0; for (const b of s.buildings.values()) m = Math.max(m, b.level); return m; }
    case 'biomes': { const set = new Set<string>(); for (const t of s.tiles.values()) if (t.floor === 'grass' && t.biome) set.add(t.biome); return set.size; }
    case 'islets': return s.islets.docked;
    case 'forge': return Math.max(0, s.forge.stage);
    case 'resonance': return s.forge.level;
    case 'renown': return s.renown.level + 1;
    case 'codex': return s.renown.codex.length;
    case 'settlers': return s.people.count;
    case 'blueprints': return BLUEPRINTS.filter((b) => s.known.has(b)).length;
    case 'maxed': { let n = 0; for (const b of s.buildings.values()) if (b.level >= MAX_LEVEL) n++; return n; }
  }
}

export function goalDone(s: GameState, g: Goal): boolean {
  return goalValue(s, g) >= g.n;
}

/** Player-facing line for a goal. */
export function goalText(g: Goal): string {
  switch (g.t) {
    case 'built': return g.label ?? `Build ${g.n > 1 ? g.n + ' × ' : 'a '}${BUILDINGS[g.type]?.name ?? g.type}`;
    case 'made': return `Make ${g.n} ${ITEMS[g.item].name}`;
    case 'tiles': return `Grow the island to ${g.n} tiles`;
    case 'contracts': return `Fill ${g.n} trade contracts`;
    case 'charm': return `Reach ${g.n} charm`;
    case 'level': return `Upgrade a machine to level ${['', 'I', 'II', 'III', 'IV', 'V'][g.n]}`;
    case 'biomes': return g.n > 1 ? `Shape ${g.n} different biomes` : 'Shape a marsh, dune or frost tile';
    case 'islets': return `Bring ${g.n} islets home`;
    case 'forge': return 'Complete the Aetherforge';
    case 'resonance': return `Reach resonance ${g.n}`;
    case 'renown': return `Reach renown ${g.n}`;
    case 'codex': return `Complete ${g.n} codex sets`;
    case 'settlers': return `Be home to ${g.n} settlers`;
    case 'blueprints': return g.n > 1 ? `Draft ${g.n} designs` : 'Draft a design';
    case 'maxed': return `Upgrade ${g.n} machines to level V`;
  }
}

/** The open rung of a path (the first not yet achieved), or null when the path is done. */
export function openRung(s: GameState, path: PathId): AmbitionDef {
  const hand = AMBITIONS.find((a) => a.path === path && !s.ambitions.has(a.id));
  if (hand) return hand;
  let r = LADDER_RUNGS + 1;
  while (s.ambitions.has(`${path}_${r}`)) r++;
  return legacyAmbition(path, r);
}

export function openAmbitions(s: GameState): AmbitionDef[] {
  return PATHS.map((p) => openRung(s, p.id));
}

/** 0..1 — the mean fraction of each goal. */
export function progress(s: GameState, a: AmbitionDef): number {
  return a.goals.reduce((t, g) => t + Math.min(1, goalValue(s, g) / g.n), 0) / a.goals.length;
}

/** The ambition shown on the quest card: the pinned one, else the open one closest to done. */
export function focus(s: GameState): AmbitionDef | null {
  const open = openAmbitions(s);
  const pin = open.find((a) => a.id === s.pinned);
  if (pin) return pin;
  let best: AmbitionDef | null = null, bp = -1;
  for (const a of open) { const p = progress(s, a); if (p > bp) { bp = p; best = a; } }
  return best;
}

function payReward(s: GameState, a: AmbitionDef): void {
  const r = a.reward;
  if (r.items) for (const k in r.items) stashAdd(s, k as ItemId, r.items[k as ItemId] ?? 0);
  if (r.marks) { s.trade.marks += r.marks; s.trade.earned += r.marks; }
  if (r.points) s.renown.points += r.points;
  s.flags.add('amb_' + a.id);
  addXp(s, AMBITION_XP);
}

/** Achieve every open ambition whose goals are met (rungs climb in order); award charm milestones. */
export function checkAmbitions(s: GameState): void {
  let any = false;
  for (let guard = 0; guard < AMBITIONS.length; guard++) {
    const a = openAmbitions(s).find((x) => x.goals.every((g) => goalDone(s, g)));
    if (!a) break;
    s.ambitions.add(a.id);
    payReward(s, a);
    if (s.pinned === a.id) s.pinned = null;
    s.events.push({ type: 'ambition', id: a.id });
    any = true;
  }
  if (any) checkDiscoveries(s);
  const ch = charm(s);
  for (const m of charmMilestones(ch)) {
    if (s.flags.has('charm_' + m)) continue;
    s.flags.add('charm_' + m);
    addXp(s, CHARM_XP);
    s.events.push({ type: 'charm', milestone: m });
  }
}
