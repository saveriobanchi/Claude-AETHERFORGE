import { achProgress, achText, achValue, achVisible } from '../core/achievements';
import { ACHIEVEMENTS, ACH_BRANCHES, ACH, type AchDef, type AchGoal, type BranchId, type Medal, achXp } from '../core/content/achievements';
import { AMBITIONS } from '../core/content/ambitions';
import { BUILDINGS } from '../core/content/buildings';
import { DISCOVERY_LIST } from '../core/content/discoveries';
import { ITEMS, type ItemId, type Stack } from '../core/content/items';
import { BLUEPRINTS } from '../core/content/people';
import { RECIPE_LIST } from '../core/content/recipes';
import { seasonFor, yearFor } from '../core/content/seasons';
import { teasers } from '../core/progression';
import type { GameState } from '../core/state';
import { duration, fmt, h, img } from './dom';
import { glyph, itemIcon, landThumb, thumb, uiIcon } from './glyphs';

export type JournalTab = 'chronicle' | 'achievements' | 'records' | 'designs';

export interface JournalCtx {
  s: GameState;
  /** Re-drawing in place (a feat was tapped): leave the scroll positions alone. */
  keepView?: boolean;
  tab: JournalTab;
  branch: BranchId;
  selected: string | null;
  onTab: (t: JournalTab) => void;
  onBranch: (b: BranchId) => void;
  onSelect: (id: string) => void;
  openAmbitions: () => void;
}

const MEDAL_NAME: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', star: 'Starlit' };

/** An icon for an achievement: its item when known, else something that fits the measure. */
export function achIcon(s: GameState, a: AchDef): string {
  const g = a.goal;
  const branch = ACH_BRANCHES.find((b) => b.id === a.branch)!;
  const fallback = branchIcon(branch.icon);
  return goalIcon(s, g) ?? fallback;
}

export function branchIcon(icon: string): string {
  const [kind, name] = icon.split(':');
  return kind === 'item' ? itemIcon(name as ItemId) : uiIcon(name);
}

function goalIcon(s: GameState, g: AchGoal): string | null {
  switch (g.t) {
    case 'made': return (s.stats.obtained[g.item] ?? 0) > 0 ? itemIcon(g.item) : null;
    case 'built': return thumb('fruit_tree');
    case 'kind': return thumb(({ crafter: 'kiln', belt: 'belt', windmill: 'windmill', roost: 'roost', home: 'cottage', decor: 'fountain' } as Record<string, string>)[g.kind] ?? 'workbench');
    case 'tiles': return landThumb('grass');
    case 'paved': return landThumb('stone');
    case 'biomes': return landThumb('marsh');
    case 'contracts': case 'tradeLevel': return uiIcon('market');
    case 'earned': return uiIcon('marks');
    case 'settlers': return uiIcon('settler');
    case 'islets': return uiIcon('island');
    case 'forge': case 'resonance': return thumb('forge');
    case 'discoveries': return uiIcon('research');
    case 'stars': return uiIcon('star');
    case 'codex': return uiIcon('book');
    case 'ambitions': return uiIcon('ambition');
    case 'blueprints': return thumb('drafting_table');
    case 'renown': return uiIcon('island');
    case 'perks': case 'level': case 'maxed': return uiIcon('upgrade');
    case 'charm': return uiIcon('charm');
    case 'tended': return uiIcon('leaf');
    case 'years': return uiIcon('compass');
    case 'stat': return g.key === 'harvests' ? itemIcon('wood') : g.key === 'bestCombo' ? uiIcon('leaf') : g.key === 'crafted' ? uiIcon('craft') : g.key === 'delivered' ? thumb('belt') : g.key === 'playSeconds' ? uiIcon('w_clear') : null;
    default: return null;
  }
}

/** "Year 2, Spring" for a sim time. */
function when(t: number): string {
  return `Year ${yearFor(t)}, ${seasonFor(t).name}`;
}

export function buildJournal(c: JournalCtx): HTMLElement {
  const s = c.s;
  const designs = BLUEPRINTS.filter((b) => s.known.has(b));
  const tabs: [JournalTab, string, string][] = [
    ['chronicle', 'Chronicle', glyph('journal')],
    ['achievements', 'Feats', uiIcon('star')],
    ['records', 'Records', uiIcon('compass')],
  ];
  if (designs.length) tabs.push(['designs', 'Designs', uiIcon('research')]);
  const ribbons = h('div', { class: 'ribbons', role: 'tablist' },
    ...tabs.map(([id, name, icon]) => h('button', { class: `ribbon r-${id}` + (c.tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(c.tab === id), onclick: () => c.onTab(id) }, img(icon), h('span', { text: name }))));
  const page = h('div', { class: 'page scroll' });
  if (c.tab === 'chronicle') chronicle(c, page);
  else if (c.tab === 'achievements') feats(c, page);
  else if (c.tab === 'records') records(s, page);
  else designsPage(s, page);
  return h('div', { class: 'book' }, ribbons, page);
}

// ───────────────────────── chronicle ─────────────────────────

function chronicle(c: JournalCtx, page: HTMLElement): void {
  const s = c.s;
  const legacy = s.ambitions.size > AMBITIONS.length || AMBITIONS.every((a) => s.ambitions.has(a.id));
  page.append(h('button', { class: 'leaf-card link', onclick: () => c.openAmbitions() },
    img(uiIcon('ambition')),
    h('div', {}, h('div', { class: 'kicker', text: `Ambitions · ${s.ambitions.size} achieved` }), h('div', { class: 'title', text: 'Choose your next ambition ›' }),
      h('p', { text: legacy ? 'Legacy ambitions never run out: every path goes on, a little harder each time.' : 'Seven paths, all open at once. Grow in the order you like.' }))));
  const riddles = teasers(s);
  if (riddles.length) {
    const box = h('div', { class: 'riddles' }, h('div', { class: 'kicker', text: 'Unanswered' }));
    for (const r of riddles) box.append(h('div', { class: 'riddle' }, h('span', { class: 'q', text: '?' }), h('span', { class: 'rt', text: r.hint }), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(r.progress * 100)}%` }))));
    page.append(box);
  }
  const known = DISCOVERY_LIST.filter((d) => s.known.has(d.id) && d.id !== 'start');
  page.append(h('div', { class: 'flourish', text: '❦' }));
  const tl = h('ol', { class: 'timeline' });
  known.slice().reverse().forEach((d, i) => {
    const n = known.length - i;
    tl.append(h('li', { class: 'tl' + (i === 0 ? ' newest' : '') }, h('span', { class: 'num', text: String(n) }),
      h('div', { class: 'tl-body' }, h('div', { class: 'title', text: d.title }), h('p', { class: 'dropcap', text: d.text }))));
  });
  tl.append(h('li', { class: 'tl first' }, h('span', { class: 'num', text: '✦' }), h('div', { class: 'tl-body' }, h('div', { class: 'title', text: 'Awakening' }), h('p', { class: 'dropcap', text: 'A small island in a wide sky. A tree, some grass, and you.' }))));
  page.append(tl);
}

// ───────────────────────── achievements ─────────────────────────

interface Node { a: AchDef; depth: number; col: number; kids: Node[] }

/** Lay a branch out as a tree: roots on top, leaves spread across columns, parents centred over children. */
function layout(branch: BranchId): { nodes: Node[]; cols: number; rows: number } {
  const list = ACHIEVEMENTS.filter((a) => a.branch === branch);
  const by = new Map<string, Node>(list.map((a) => [a.id, { a, depth: 0, col: 0, kids: [] }]));
  const roots: Node[] = [];
  for (const n of by.values()) {
    const p = n.a.parent ? by.get(n.a.parent) : undefined;
    if (p) p.kids.push(n); else roots.push(n);
  }
  let next = 0, rows = 0;
  const place = (n: Node, depth: number): void => {
    n.depth = depth;
    rows = Math.max(rows, depth + 1);
    // the main chain (a child sharing the parent's measure) runs straight down the middle
    n.kids.sort((x, y) => Number(y.a.goal.t === n.a.goal.t) - Number(x.a.goal.t === n.a.goal.t));
    if (!n.kids.length) { n.col = next++; return; }
    for (const k of n.kids) place(k, depth + 1);
    n.col = n.kids[0].col;
  };
  for (const r of roots) place(r, 0);
  return { nodes: [...by.values()], cols: next, rows };
}

function feats(c: JournalCtx, page: HTMLElement): void {
  const s = c.s;
  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter((a) => s.achieved.has(a.id));
  const pct = Math.round((got.length / total) * 100);
  const medals = (['bronze', 'silver', 'gold', 'star'] as Medal[]).map((m) => [m, got.filter((a) => a.medal === m).length, ACHIEVEMENTS.filter((a) => a.medal === m).length] as const);
  page.append(h('div', { class: 'feat-sum' },
    h('div', { class: 'ring', style: `--p:${pct}` }, h('b', { text: String(got.length) }), h('small', { text: `of ${total}` })),
    h('div', { class: 'sum-r' },
      h('div', { class: 'kicker', text: `Feats · ${pct}% of the book` }),
      h('div', { class: 'medals' }, ...medals.map(([m, n, of]) => h('span', { class: `medal-chip m-${m}`, title: MEDAL_NAME[m] }, h('i'), h('span', { text: `${n}/${of}` })))),
      recent(s))));
  // branch chips
  const chips = h('div', { class: 'branches scroll-x' });
  for (const b of ACH_BRANCHES) {
    const all = ACHIEVEMENTS.filter((a) => a.branch === b.id);
    const n = all.filter((a) => s.achieved.has(a.id)).length;
    const ready = all.some((a) => !s.achieved.has(a.id) && achVisible(s, a) && achProgress(s, a) >= 1);
    chips.append(h('button', { class: 'branch' + (c.branch === b.id ? ' on' : '') + (n === all.length ? ' full' : ''), onclick: () => c.onBranch(b.id) },
      img(branchIcon(b.icon)), h('span', { class: 'bn', text: b.name }), h('span', { class: 'bc', text: `${n}/${all.length}` }),
      h('span', { class: 'bbar' }, h('i', { style: `width:${Math.round((n / all.length) * 100)}%` })), ready ? h('span', { class: 'dot' }) : null));
  }
  page.append(chips);
  const br = ACH_BRANCHES.find((b) => b.id === c.branch)!;
  page.append(h('div', { class: 'branch-head' }, h('div', { class: 'title', text: br.name }), h('p', { text: br.desc })));

  // the tree
  const { nodes, cols, rows } = layout(c.branch);
  const CW = 80, RH = 112, PAD = 12;
  const W = Math.max(cols * CW + PAD * 2, 0), H = rows * RH + PAD;
  const cx = (n: Node) => PAD + n.col * CW + CW / 2;
  const cy = (n: Node) => PAD + n.depth * RH + 28;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('class', 'links');
  const byId = new Map(nodes.map((n) => [n.a.id, n]));
  for (const n of nodes) {
    const p = n.a.parent ? byId.get(n.a.parent) : undefined;
    if (!p) continue;
    const x1 = cx(p), y1 = cy(p) + 26, x2 = cx(n), y2 = cy(n) - 26, my = (y1 + y2) / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`);
    path.setAttribute('class', s.achieved.has(n.a.id) ? 'done' : s.achieved.has(p.a.id) ? 'open' : 'locked');
    svg.append(path);
  }
  const canvas = h('div', { class: 'tree-canvas', style: `width:${W}px;height:${H}px` });
  canvas.append(svg as unknown as HTMLElement);
  for (const n of nodes) {
    const a = n.a;
    const done = s.achieved.has(a.id), vis = achVisible(s, a);
    const p = achProgress(s, a);
    const cls = `node m-${a.medal}` + (done ? ' done' : vis ? (p >= 1 ? ' ready' : ' open') : ' locked') + (c.selected === a.id ? ' sel' : '');
    canvas.append(h('button', { class: cls, style: `left:${cx(n) - CW / 2}px;top:${cy(n) - 28}px;width:${CW}px;--p:${Math.round(p * 100)}`, 'aria-label': vis ? a.name : 'Hidden feat', onclick: () => c.onSelect(a.id) },
      h('span', { class: 'medallion' }, vis ? img(achIcon(s, a)) : h('span', { class: 'q', text: '?' })),
      vis && !done ? h('span', { class: 'np' }, h('i')) : null,
      h('span', { class: 'nl', text: vis ? a.name : '???' })));
  }
  const viewport = h('div', { class: 'tree-view' + (W > 360 ? ' wide' : '') }, canvas);
  page.append(viewport);
  page.append(detail(c));
  // centre the selected (or first open) node in view once laid out
  const focusId = c.selected ?? nodes.find((n) => !s.achieved.has(n.a.id) && achVisible(s, n.a))?.a.id;
  const fn = focusId ? byId.get(focusId) : undefined;
  if (c.keepView) return;
  if (fn) requestAnimationFrame(() => { viewport.scrollLeft = Math.max(0, cx(fn) - viewport.clientWidth / 2); });
  requestAnimationFrame(() => {
    const on = chips.querySelector('.branch.on') as HTMLElement | null;
    if (on) chips.scrollLeft = Math.max(0, on.offsetLeft - chips.offsetLeft - (chips.clientWidth - on.offsetWidth) / 2);
  });
}

function recent(s: GameState): HTMLElement {
  const last = [...s.achieved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => ACH[id]).filter(Boolean);
  if (!last.length) return h('div', { class: 'recent muted', text: 'Your first feats are close. Look below.' });
  return h('div', { class: 'recent' }, h('span', { class: 'muted', text: 'Latest: ' }), last.map((a) => a.name).join(' · '));
}

function detail(c: JournalCtx): HTMLElement {
  const s = c.s;
  const a = c.selected ? ACH[c.selected] : ACHIEVEMENTS.find((x) => x.branch === c.branch && !s.achieved.has(x.id) && achVisible(s, x)) ?? ACHIEVEMENTS.find((x) => x.branch === c.branch)!;
  const done = s.achieved.has(a.id), vis = achVisible(s, a);
  const box = h('div', { class: `ach-detail m-${a.medal}` + (done ? ' done' : '') });
  if (!vis) {
    const p = a.parent ? ACH[a.parent] : null;
    box.append(h('div', { class: 'ad-h' }, h('span', { class: 'medallion small locked' }, h('span', { class: 'q', text: '?' })), h('div', {}, h('div', { class: 'title', text: 'A hidden feat' }), h('div', { class: 'kicker', text: `${MEDAL_NAME[a.medal]} · +${achXp(a)} renown` }))),
      h('p', { text: p && achVisible(s, p) ? `Earn “${p.name}” to reveal it.` : 'Keep going down this branch to reveal it.' }));
    return box;
  }
  const v = Math.min(a.goal.n, achValue(s, a.goal));
  const earnedAt = s.achieved.get(a.id);
  box.append(h('div', { class: 'ad-h' }, h('span', { class: 'medallion small' }, img(achIcon(s, a))),
    h('div', {}, h('div', { class: 'title', text: a.name }), h('div', { class: 'kicker', text: `${MEDAL_NAME[a.medal]} · +${achXp(a)} renown` }))),
  h('p', { class: 'flavor', text: a.flavor }),
  h('div', { class: 'goal' + (done ? ' done' : '') }, h('span', { class: 'tick', text: done ? '✓' : '' }), h('span', { class: 'gt', text: achText(s, a.goal) }), h('span', { class: 'num', text: `${fmt(v)}/${fmt(a.goal.n)}` })),
  h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(achProgress(s, a) * 100)}%` })));
  if (done && earnedAt !== undefined) box.append(h('div', { class: 'earned', text: `Earned in ${when(earnedAt)}` }));
  return box;
}

// ───────────────────────── records ─────────────────────────

function records(s: GameState, page: HTMLElement): void {
  const st = s.stats;
  const count = (pred: (type: string) => boolean) => [...s.buildings.values()].filter((b) => pred(b.type)).length;
  const tile = (icon: string, label: string, value: string) => h('div', { class: 'rec' }, img(icon), h('div', { class: 'rv', text: value }), h('div', { class: 'rl', text: label }));
  page.append(h('div', { class: 'kicker center', text: `${when(s.time)} · ${duration(st.playSeconds)} on the island` }));
  const grid = h('div', { class: 'records' },
    tile(landThumb('grass'), 'Ground', `${s.tiles.size} tiles`),
    tile(uiIcon('charm'), 'Charm', String(s.cache.charm)),
    tile(uiIcon('ambition'), 'Ambitions', String(s.ambitions.size)),
    tile(uiIcon('star'), 'Feats', `${s.achieved.size}/${ACHIEVEMENTS.length}`),
    tile(thumb('workbench'), 'Structures', String(count((t) => !['tree', 'tuft', 'sapling', 'elder_tree'].includes(t) && BUILDINGS[t].kind !== 'node'))),
    tile(thumb('tree'), 'Trees', String(count((t) => BUILDINGS[t].kind === 'tree'))),
    tile(itemIcon('wood'), 'Gathered by hand', fmt(st.harvests)),
    tile(thumb('belt'), 'Delivered by machine', fmt(st.delivered)),
    tile(uiIcon('craft'), 'Crafted by hand', fmt(st.crafted)),
    tile(uiIcon('leaf'), 'Best combo', String(st.bestCombo ?? 0)),
    tile(uiIcon('marks'), 'Marks earned', fmt(s.trade.earned)),
    tile(uiIcon('market'), 'Contracts', fmt(s.trade.done)),
    tile(uiIcon('research'), 'Discoveries', String(DISCOVERY_LIST.filter((d) => d.id !== 'start' && s.known.has(d.id)).length)),
    s.people.count ? tile(uiIcon('settler'), 'Settlers', String(s.people.count)) : null,
    s.islets.docked ? tile(uiIcon('island'), 'Drifters home', String(s.islets.docked)) : null,
    s.forge.stage >= 3 ? tile(thumb('forge'), 'Resonance', String(s.forge.level)) : null);
  page.append(grid);
  // most made goods
  const top = (Object.keys(st.made) as ItemId[]).filter((k) => (st.made[k] ?? 0) > 0).sort((a, b) => (st.made[b] ?? 0) - (st.made[a] ?? 0)).slice(0, 8);
  if (top.length) {
    const max = st.made[top[0]] ?? 1;
    page.append(h('div', { class: 'flourish', text: '❦' }), h('div', { class: 'kicker center', text: 'Most made' }));
    const list = h('div', { class: 'made-list' });
    for (const k of top) list.append(h('div', { class: 'mk-row' }, img(itemIcon(k)), h('span', { class: 'mn', text: ITEMS[k].name }), h('span', { class: 'mb' }, h('i', { style: `width:${Math.max(3, Math.round(((st.made[k] ?? 0) / max) * 100))}%` })), h('span', { class: 'mv', text: fmt(st.made[k] ?? 0) })));
    page.append(list);
  }
}

// ───────────────────────── designs ─────────────────────────

function designsPage(s: GameState, page: HTMLElement): void {
  const fmtStack = (st: Stack) => Object.keys(st).map((k) => `${st[k as ItemId]} ${ITEMS[k as ItemId].name}`).join(' + ');
  for (const bp of BLUEPRINTS) {
    const r = RECIPE_LIST.find((x) => x.unlock === bp);
    if (!r || !s.known.has(bp)) continue;
    const out = Object.keys(r.outputs)[0] as ItemId;
    page.append(h('div', { class: 'leaf-card' }, img(itemIcon(out)),
      h('div', {}, h('div', { class: 'title', text: r.name }), h('p', { text: `${fmtStack(r.inputs)} → ${fmtStack(r.outputs)}` }),
        h('p', { class: 'muted', text: `In the ${r.stations.map((x) => BUILDINGS[x]?.name ?? x).join(' or ')}. Choose it on the machine.` }))));
  }
}

