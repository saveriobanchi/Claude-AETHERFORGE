import { BUILDINGS } from './content/buildings';
import { FRUIT_BY_TREE } from './content/biomes';
import { CHAPTERS, CHARM_MILESTONES, CHARM_XP, type ChapterDef, type Goal } from './content/chapters';
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
  }
}

/** The active chapter, or null when every chapter is done. */
export function activeChapter(s: GameState): ChapterDef | null {
  return CHAPTERS[s.chapters] ?? null;
}

function payReward(s: GameState, c: ChapterDef): void {
  const r = c.reward;
  if (r.items) for (const k in r.items) stashAdd(s, k as ItemId, r.items[k as ItemId] ?? 0);
  if (r.marks) { s.trade.marks += r.marks; s.trade.earned += r.marks; }
  if (r.points) s.renown.points += r.points;
  s.flags.add('chapter_' + c.id);
  addXp(s, 60);
}

/** Complete every finished chapter in order; award charm milestones. */
export function checkChapters(s: GameState): void {
  let c = activeChapter(s);
  let guard = 0;
  while (c && c.goals.every((g) => goalDone(s, g)) && guard++ < CHAPTERS.length) {
    payReward(s, c);
    s.chapters++;
    s.events.push({ type: 'chapter', id: c.id });
    c = activeChapter(s);
  }
  if (guard) checkDiscoveries(s);
  const ch = charm(s);
  for (const m of CHARM_MILESTONES) {
    if (ch < m || s.flags.has('charm_' + m)) continue;
    s.flags.add('charm_' + m);
    addXp(s, CHARM_XP);
    s.events.push({ type: 'charm', milestone: m });
  }
}
