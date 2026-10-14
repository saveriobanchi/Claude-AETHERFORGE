import * as A from '../core/actions';
import { BUILDINGS, BUILDING_LIST, HIVE, NODE_YIELD, ORCHARD, TREE, type BuildCategory } from '../core/content/buildings';
import { MARKET, CONTRACT_REFRESH, levelSpeed, marketPrice, repForLevel, upgradable, upgradeCost } from '../core/content/trade';
import { dayIndex, weatherFor } from '../core/content/weather';
import { DISCOVERIES, DISCOVERY_LIST } from '../core/content/discoveries';
import { ITEMS, ITEM_IDS, type ItemId, type Stack } from '../core/content/items';
import { RECIPE_LIST, RECIPES, recipesFor } from '../core/content/recipes';
import { ATTUNEMENTS, FORGE_STAGES, ISLETS, LANDS, landCost, summonCost } from '../core/content/world';
import type { OfflineReport } from '../core/offline';
import { flowRates } from '../core/offline';
import { buildingUnlocked, landUnlocked, recipeUnlocked, teasers } from '../core/progression';
import { bufCap, currentRecipe, forgeNeeds, weatherNow } from '../core/sim';
import { type Building, type Dir, capacity, dayFraction, isNight, stackTotal } from '../core/state';
import type { Game } from '../game';
import { audio } from '../platform/audio';
import { clear, duration, fmt, h, img, setOnly } from './dom';
import { glyph, itemIcon, landThumb, thumb, uiIcon } from './glyphs';
import { guideNote } from './guide';

const CATS: { id: BuildCategory | 'land'; name: string }[] = [
  { id: 'land', name: 'Land' },
  { id: 'craft', name: 'Make' },
  { id: 'nature', name: 'Nature' },
  { id: 'logistics', name: 'Move' },
  { id: 'power', name: 'Power' },
  { id: 'storage', name: 'Store' },
  { id: 'aether', name: 'Aether' },
  { id: 'wonder', name: 'Wonder' },
];

const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#efe2c4" stroke-width="1.8" stroke-linejoin="round"><path d="M10.3 2.6h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><circle cx="12" cy="12" r="3.4"/></svg>';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const STATUS_TEXT: Record<string, string> = {
  working: 'Working', idle: 'Idle', noinput: 'Waiting for input', blocked: 'Output full', nopower: 'No breeze', night: 'Waiting for night', ready: 'Ready to collect',
};

export class UI {
  private g: Game;
  private root: HTMLElement;
  private res!: HTMLElement;
  private note!: HTMLElement;
  private quest!: HTMLElement;
  private lvlEl!: HTMLElement;
  private lvlBar!: HTMLElement;
  private clockEl!: HTMLElement;
  private weatherImg!: HTMLImageElement;
  private weatherId = '';
  private questIcon!: HTMLImageElement;
  private btnBuild!: HTMLButtonElement;
  private btnCraft!: HTMLButtonElement;
  private btnStash!: HTMLButtonElement;
  private btnJournal!: HTMLButtonElement;
  private savedEl!: HTMLElement;
  private build!: HTMLElement;
  private craft!: HTMLElement;
  private side!: HTMLElement;
  private modalWrap!: HTMLElement;
  private modal!: HTMLElement;
  private toasts!: HTMLElement;
  private hintEl!: HTMLElement;
  private observeExit!: HTMLElement;
  private devEl!: HTMLElement;
  private fpsEl!: HTMLElement;
  private tab: BuildCategory | 'land' = 'land';
  private buildOpen = false;
  private craftOpen = false;
  private recent: ItemId[] = ['wood', 'leaf'];
  private prevStash = new Map<ItemId, number>();
  private hudTimer = 0;
  private panelSig = '';
  private panelBar: HTMLElement | null = null;
  private discQueue: string[] = [];
  private discShowing = false;
  private hintTimer = 0;
  private lastNote = '';
  private devTaps = 0;
  private fpsAcc = { t: 0, n: 0 };
  private wasCraftVisible = false;
  private craftSig = '';
  private buildSig = '';
  private lastKnownAtOpen = -1;

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.root = root;
    this.mount();
  }

  private mount(): void {
    const r = this.root;
    clear(r);
    // HUD — island card (top left), resources + settings + day clock (top
    // right), quest card (bottom left), nav bar with the big Build (bottom).
    this.res = h('div', { class: 'res-strip panel' });
    this.lvlEl = h('span', { class: 'lvl' });
    this.lvlBar = h('i');
    const banner = h('div', { class: 'banner panel', onclick: () => this.openJournal() },
      h('div', { class: 'portrait' }, img(uiIcon('island'))),
      h('div', { class: 't' }, h('div', { class: 'isle', text: 'Emberleaf Isle' }), h('div', { class: 'lvlrow' }, this.lvlEl, h('div', { class: 'bar xp' }, this.lvlBar))));
    this.weatherImg = img(uiIcon('w_clear'));
    this.clockEl = h('button', { class: 'clock', title: 'Time and weather', 'aria-label': 'Weather', onclick: () => this.showWeather() }, this.weatherImg, h('span', { class: 'time' }));
    const plus = h('button', { class: 'res-plus', 'aria-label': 'Open stash', onclick: () => { audio.unlock(); this.openStash(); } }, '+');
    const menu = this.iconBtn('gear', 'Menu', () => this.openSettings());
    menu.innerHTML = GEAR_SVG;
    const top = h('div', { class: 'hud-top' }, banner, h('div', { class: 'hud-right' }, h('div', { class: 'res-wrap' }, this.res, plus), menu));
    const left = h('div', { class: 'hud-left' }, this.iconBtn('compass', 'Centre view', () => this.g.view.cam.focus(0, -10, this.g.defaultZoom())));
    this.note = h('div', { class: 'qtext' });
    this.questIcon = img(uiIcon('book'));
    this.quest = h('button', { class: 'quest panel hide', onclick: () => this.openJournal() }, h('div', { class: 'qicon' }, this.questIcon), h('div', { class: 'qbody' }, h('div', { class: 'caps', text: 'Next step' }), this.note), h('span', { class: 'chev', text: '›' }));
    this.btnBuild = this.mainBtn('build', 'Build', () => this.toggleBuild());
    this.btnBuild.classList.add('big');
    this.btnCraft = this.mainBtn('craft', 'Craft', () => this.toggleCraft());
    this.btnStash = this.mainBtn('stash', 'Inventory', () => this.openStash(), 'Stash');
    this.btnJournal = this.mainBtn('book', 'Journal', () => this.openJournal());
    const obs = this.mainBtn('island', 'World', () => this.g.toggleObserve(), 'Observe');
    const bottom = h('div', { class: 'hud-bottom nav panel' }, obs, this.btnStash, this.btnBuild, this.btnCraft, this.btnJournal);
    this.savedEl = h('div', { class: 'saved' }, h('i'), 'Saved');
    const hud = h('div', { class: 'hud passthrough' }, top, left, this.clockEl, this.quest, bottom, this.savedEl);
    hud.style.position = 'absolute';
    hud.style.inset = '0';
    this.build = h('div', { class: 'sheet' });
    this.craft = h('div', { class: 'sheet' });
    this.side = h('div', { class: 'side auto' });
    this.modalWrap = h('div', { class: 'modal-wrap', onclick: (e: MouseEvent) => { if (e.target === this.modalWrap) this.closeModal(); } });
    this.modal = h('div', { class: 'modal panel' });
    this.modalWrap.append(this.modal);
    this.toasts = h('div', { class: 'toasts' });
    this.hintEl = h('div', { class: 'hint-toast' });
    this.observeExit = h('button', { class: 'icon-btn observe-exit', onclick: () => this.g.toggleObserve() }, img(glyph('eye')));
    this.devEl = h('div', { class: 'dev panel' });
    this.fpsEl = h('div', { class: 'fps' });
    r.append(hud, this.build, this.craft, this.side, this.modalWrap, this.toasts, this.hintEl, this.observeExit, this.devEl, this.fpsEl);
    this.btnCraft.style.display = 'none';
    this.wasCraftVisible = false;
    this.renderDev();
  }

  reset(): void {
    this.recent = ['wood', 'leaf'];
    this.prevStash.clear();
    this.closeAll();
    this.wasCraftVisible = false;
    this.btnCraft.style.display = 'none';
    this.refreshAll();
  }

  private iconBtn(name: string, title: string, fn: () => void): HTMLButtonElement {
    return h('button', { class: 'icon-btn', title, 'aria-label': title, onclick: () => { audio.unlock(); fn(); } }, img(uiIcon(name)));
  }

  private mainBtn(name: string, label: string, fn: () => void, aria = label): HTMLButtonElement {
    return h('button', { class: 'main-btn', 'aria-label': aria, onclick: () => { audio.unlock(); fn(); } }, h('span', { class: 'ico' }, img(uiIcon(name))), h('span', { class: 'lbl', text: label }));
  }

  // ───────────────────────── per-frame ─────────────────────────

  frame(dt: number): void {
    this.hudTimer += dt;
    if (this.hudTimer > 0.25) {
      this.hudTimer = 0;
      this.refreshHud();
      this.refreshPanel();
      if (this.craftOpen) this.renderCraft();
      if (this.buildOpen && this.g.mode.kind === 'play') this.renderBuildIfChanged();
      if (this.g.mode.kind !== 'play') this.renderPlacing();
    }
    if (this.panelBar && this.g.selected !== null) {
      const b = this.g.s.buildings.get(this.g.selected);
      if (b) this.panelBar.style.width = `${Math.round(this.progressOf(b) * 100)}%`;
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt * 1000;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('show');
    }
    if (this.g.settings.fps) {
      this.fpsAcc.t += dt;
      this.fpsAcc.n++;
      if (this.fpsAcc.t > 0.5) {
        const st = this.g.view.stats();
        this.fpsEl.textContent = `${Math.round(this.fpsAcc.n / this.fpsAcc.t)} fps · ${this.g.view.frameMs.toFixed(1)}ms · ${st.sprites}b ${st.items}i ${st.particles}p`;
        this.fpsAcc = { t: 0, n: 0 };
      }
    }
  }

  refreshAll(): void {
    this.refreshHud();
    this.panelSig = '';
    this.refreshPanel();
    this.craftSig = '';
    if (this.craftOpen) this.renderCraft();
    if (this.buildOpen) this.renderBuild();
    this.renderPlacing();
  }

  private refreshHud(): void {
    const s = this.g.s;
    // recently changed items float to the front
    for (const id of ITEM_IDS) {
      const n = s.stash[id];
      const p = this.prevStash.get(id);
      if (p !== undefined && n > p) {
        this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 12);
      }
      this.prevStash.set(id, n);
    }
    const shown = this.recent.filter((id) => s.stash[id] > 0).slice(0, window.innerWidth < 900 ? 4 : 6);
    const cap = capacity(s);
    const sig = shown.map((id) => `${id}:${s.stash[id]}`).join('|') + `|${cap}|${s.power.gen.toFixed(0)}/${s.power.demand}|${s.trade.marks}|${s.known.has('trade')}`;
    if (sig !== this.res.dataset.sig) {
      this.res.dataset.sig = sig;
      clear(this.res);
      if (s.known.has('trade')) this.res.append(h('span', { class: 'chip marks', title: 'Marks (trade)' }, img(uiIcon('marks')), h('span', { class: 'num', text: fmt(s.trade.marks) })));
      for (const id of shown) {
        const chip = h('span', { class: 'chip' + (s.stash[id] >= cap ? ' full' : ''), title: ITEMS[id].name }, img(itemIcon(id)), h('span', { class: 'num', text: fmt(s.stash[id]) }));
        this.res.append(chip);
      }
      if (!shown.length) this.res.append(h('span', { class: 'chip muted', style: 'padding-left:8px;font-size:0.8rem' }, 'Empty-handed'));
      const hasWind = [...s.buildings.values()].some((b) => b.type === 'windmill' || b.type === 'engine');
      if (hasWind) {
        const low = s.power.ratio < 0.999 && s.power.demand > 0;
        this.res.append(h('span', { class: 'chip power' + (low ? ' low' : ''), title: 'Breeze made / used' }, h('span', { class: 'num', text: `≋ ${Math.round(s.power.gen)}/${Math.round(s.power.demand)}` })));
      }
    }
    // note
    const n = this.g.observe ? null : guideNote(s);
    if ((n ?? '') !== this.lastNote) {
      this.lastNote = n ?? '';
      if (n) {
        this.note.textContent = n;
        this.quest.classList.remove('hide');
        const named = BUILDING_LIST.find((d) => n.includes(d.name));
        this.questIcon.src = named ? thumb(named.id) : uiIcon('book');
      }
      else this.quest.classList.add('hide');
    }
    // level = discoveries made; the bar shows how much of the world is known
    const lvl = s.known.size;
    if (this.lvlEl.textContent !== `Lv. ${lvl}`) {
      this.lvlEl.textContent = `Lv. ${lvl}`;
      this.lvlBar.style.width = `${Math.round((lvl / DISCOVERY_LIST.length) * 100)}%`;
    }
    // day clock: daylight (0–0.68 of a cycle) spans 05:00–20:00, night the rest
    const df = dayFraction(s);
    const hours = df < 0.68 ? 5 + (df / 0.68) * 15 : 20 + ((df - 0.68) / 0.32) * 9;
    const mins = Math.floor((hours % 24) * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(Math.floor((mins % 60) / 10) * 10).padStart(2, '0');
    const time = this.clockEl.querySelector('.time')!;
    if (time.textContent !== `${hh}:${mm}`) {
      time.textContent = `${hh}:${mm}`;
      this.clockEl.classList.toggle('night', isNight(s));
      const w = weatherNow(s).id;
      if (this.weatherId !== w) { this.weatherId = w; this.weatherImg.src = uiIcon('w_' + w); this.clockEl.dataset.weather = w; }
    }
    // main buttons
    const craftVisible = A.hasWorkbench(s);
    if (craftVisible !== this.wasCraftVisible) {
      this.btnCraft.style.display = craftVisible ? '' : 'none';
      if (craftVisible) { this.btnCraft.classList.remove('reveal'); void this.btnCraft.offsetWidth; this.btnCraft.classList.add('reveal'); }
      this.wasCraftVisible = craftVisible;
    }
    const newBuild = this.unseenBuildables().length > 0;
    this.setDot(this.btnBuild, newBuild && !this.buildOpen);
    this.btnBuild.classList.toggle('on', this.buildOpen || this.g.mode.kind !== 'play');
    this.btnCraft.classList.toggle('on', this.craftOpen);
    document.body.classList.toggle('sheet-open', this.buildOpen || this.craftOpen || this.g.mode.kind !== 'play');
    const newRecipes = RECIPE_LIST.some((r) => r.stations.includes('hand') && recipeUnlocked(s, r.id) && !s.flags.has('seen:r:' + r.id));
    this.setDot(this.btnCraft, newRecipes && !this.craftOpen);
    this.setDot(this.btnJournal, !s.flags.has('seen:journal:' + s.known.size));
  }

  private setDot(el: HTMLElement, on: boolean): void {
    const d = el.querySelector('.dot');
    if (on && !d) el.append(h('i', { class: 'dot' }));
    else if (!on && d) d.remove();
  }

  // ───────────────────────── build tray ─────────────────────────

  toggleBuild(): void {
    if (this.g.mode.kind !== 'play') { this.g.setMode({ kind: 'play' }); this.openBuild(); return; }
    if (this.buildOpen) this.closeBuild(); else this.openBuild();
  }

  private openBuild(): void {
    this.closeCraft();
    this.g.select(null, false);
    this.buildOpen = true;
    // start on the most relevant tab
    const avail = this.availableCats();
    if (!avail.includes(this.tab)) this.tab = avail[0] ?? 'craft';
    // jump to newly discovered things only once per discovery, never on every open
    if (this.g.s.known.size !== this.lastKnownAtOpen) {
      this.lastKnownAtOpen = this.g.s.known.size;
      const order = CATS.map((c) => c.id);
      const unseen = this.unseenBuildables().sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
      if (unseen.length) this.tab = unseen[0].cat;
    }
    this.renderBuild();
    this.build.classList.add('open');
    audio.play('open');
    this.refreshHud();
  }

  private closeBuild(): void {
    if (!this.buildOpen && this.g.mode.kind === 'play') return;
    this.buildOpen = false;
    this.build.classList.remove('open');
    if (this.g.mode.kind !== 'play') this.g.setMode({ kind: 'play' });
    this.refreshHud();
  }

  private availableCats(): (BuildCategory | 'land')[] {
    const s = this.g.s;
    return CATS.map((c) => c.id).filter((id) => (id === 'land' ? LANDS.some((l) => landUnlocked(s, l.id)) : BUILDING_LIST.some((b) => b.category === id && buildingUnlocked(s, b.id))));
  }

  private unseenBuildables(): { id: string; cat: BuildCategory | 'land' }[] {
    const s = this.g.s;
    const out: { id: string; cat: BuildCategory | 'land' }[] = [];
    for (const l of LANDS) if (landUnlocked(s, l.id) && !s.flags.has('seen:b:' + l.id)) out.push({ id: l.id, cat: 'land' });
    for (const b of BUILDING_LIST) if (buildingUnlocked(s, b.id) && !s.flags.has('seen:b:' + b.id)) out.push({ id: b.id, cat: b.category });
    return out;
  }

  private renderBuildIfChanged(): void {
    const s = this.g.s;
    const sig = this.tab + '|' + this.availableCats().join() + '|' + ITEM_IDS.map((i) => s.stash[i]).join(',') + '|' + s.tiles.size;
    if (sig !== this.buildSig) this.renderBuild();
  }

  private renderBuild(): void {
    this.build.classList.remove('placing-mode');
    const s = this.g.s;
    const sTab = this.tab;
    this.buildSig = sTab + '|' + this.availableCats().join() + '|' + ITEM_IDS.map((i) => s.stash[i]).join(',') + '|' + s.tiles.size;
    if (this.g.mode.kind !== 'play') return this.renderPlacing();
    const panel = h('div', { class: 'panel tray' });
    const tabs = h('div', { class: 'tabs' });
    const unseen = new Set(this.unseenBuildables().map((u) => u.cat));
    for (const c of CATS) {
      if (!this.availableCats().includes(c.id)) continue;
      tabs.append(h('button', { class: 'tab' + (c.id === this.tab ? ' on' : ''), onclick: () => { this.tab = c.id; audio.play('tap'); this.renderBuild(); } }, c.name, unseen.has(c.id) ? h('i', { class: 'dot' }) : null));
    }
    tabs.append(h('div', { style: 'flex:1' }));
    tabs.append(h('button', { class: 'tab', onclick: () => { this.g.setMode({ kind: 'remove' }); audio.play('tap'); } }, img(glyph('trash'), 'px', 'Remove'), ''));
    tabs.append(h('button', { class: 'tab', onclick: () => this.closeBuild(), 'aria-label': 'Close' }, img(glyph('close'))));
    const cards = h('div', { class: 'cards' });
    if (this.tab === 'land') {
      for (const l of LANDS) {
        if (!landUnlocked(s, l.id)) continue;
        const cost = landCost(l.id, s.tiles.size);
        const afford = A.canAfford(s, cost);
        const isNew = !s.flags.has('seen:b:' + l.id);
        cards.append(h('button', { class: 'card' + (afford ? '' : ' poor'), onclick: () => this.pickLand(l.id) },
          isNew ? h('span', { class: 'new', text: 'NEW' }) : null,
          h('div', { class: 'pic' }, img(landThumb(l.floor))), h('div', { class: 'nm', text: l.name }), this.costEl(cost)));
      }
    } else {
      for (const b of BUILDING_LIST) {
        if (b.category !== this.tab || !buildingUnlocked(s, b.id)) continue;
        const afford = A.canAfford(s, b.cost);
        const isNew = !s.flags.has('seen:b:' + b.id);
        const count = [...s.buildings.values()].filter((x) => x.type === b.id).length;
        if (b.kind === 'forge' && count) continue;
        cards.append(h('button', { class: 'card' + (afford ? '' : ' poor'), title: b.desc, onclick: () => this.pickBuilding(b.id) },
          isNew ? h('span', { class: 'new', text: 'NEW' }) : null,
          h('div', { class: 'pic' }, img(thumb(b.id))), h('div', { class: 'nm', text: b.name }), this.costEl(b.cost)));
      }
    }
    panel.append(tabs, cards);
    setOnly(this.build, panel);
    // mark this tab's items as seen
    for (const u of this.unseenBuildables()) if (u.cat === this.tab) s.flags.add('seen:b:' + u.id);
  }

  private pickBuilding(type: string): void {
    audio.play('select');
    const def = BUILDINGS[type];
    if (!A.canAfford(this.g.s, def.cost)) { this.g.fail(A.missing(this.g.s, def.cost)); return; }
    this.g.setMode({ kind: 'build', type, dir: 0 });
  }

  private pickLand(id: string): void {
    audio.play('select');
    this.g.setMode({ kind: 'land', land: id });
  }

  onMode(): void {
    if (this.g.mode.kind !== 'play') {
      this.buildOpen = true;
      this.closeCraft();
      this.build.classList.add('open');
      this.renderPlacing();
    } else if (this.buildOpen) this.renderBuild();
    this.refreshHud();
  }

  private renderPlacing(): void {
    const m = this.g.mode;
    if (m.kind === 'play') return;
    const s = this.g.s;
    let pic = '', name = '', hint = '', cost: Stack | null = null, rot = false;
    if (m.kind === 'build') {
      const d = BUILDINGS[m.type];
      pic = thumb(m.type); name = d.name; cost = d.cost; rot = !!d.rotatable;
      hint = d.draggable ? 'Tap to place · drag to lay a line · two fingers to look around' : d.edge ? 'Tap a spot touching the edge' : d.floors && !d.floors.includes('grass') ? 'Needs flagstone or skystone ground' : d.nearNode ? 'Place beside an islet heart' : 'Tap to place';
      if (rot) hint += ' · ⟳ sets its output';
    } else if (m.kind === 'land') {
      const l = LANDS.find((x) => x.id === m.land)!;
      pic = landThumb(l.floor); name = l.name; cost = landCost(m.land, s.tiles.size);
      hint = l.mode === 'new' ? 'Tap beside the edge · drag to lay several' : 'Tap grass to pave it · drag for more';
    } else if (m.kind === 'remove') {
      pic = glyph('trash'); name = 'Remove'; hint = 'Tap a building to take it back (full refund) · drag for many';
    } else if (m.kind === 'move') {
      const b = s.buildings.get(m.id);
      pic = b ? thumb(b.type) : ''; name = 'Move ' + (b ? BUILDINGS[b.type].name : ''); hint = 'Tap the new spot'; rot = !!(b && BUILDINGS[b.type].rotatable);
    }
    const sig = `${m.kind}|${name}|${JSON.stringify(cost)}|${cost ? A.canAfford(s, cost) : ''}|${'dir' in m ? m.dir : ''}|${cost ? Object.keys(cost).map((k) => s.stash[k as ItemId]).join() : ''}`;
    if (this.build.dataset.sig === sig && this.build.querySelector('.placing')) return;
    this.build.dataset.sig = sig;
    const dirArrow = 'dir' in m ? ['↘', '↙', '↖', '↗'][m.dir] : '';
    const bar = h('div', { class: 'panel placing' },
      h('button', { class: 'close', 'aria-label': 'Back', onclick: () => { this.g.setMode({ kind: 'play' }); this.openBuild(); } }, h('span', { class: 'title', style: 'font-size:1.3rem', text: '‹' })),
      h('div', { class: 'pic' }, img(pic)),
      h('div', { class: 't' }, h('div', { class: 'nm', text: name }), cost ? this.costEl(cost) : null, h('div', { class: 'hint', text: hint })),
      rot ? h('button', { class: 'btn', onclick: () => this.g.rotateMode(), 'aria-label': 'Rotate' }, img(glyph('rotate')), dirArrow) : null,
      h('button', { class: 'btn primary', onclick: () => { this.g.setMode({ kind: 'play' }); this.closeBuild(); audio.play('close'); } }, img(glyph('check')), 'Done'));
    this.build.classList.add('placing-mode');
    setOnly(this.build, bar);
  }

  costEl(cost: Stack, have = true): HTMLElement {
    const s = this.g.s;
    const el = h('span', { class: 'cost' });
    for (const k in cost) {
      const item = k as ItemId;
      const n = cost[item] ?? 0;
      el.append(h('span', { class: have && s.stash[item] < n ? 'lack' : '', title: ITEMS[item].name }, img(itemIcon(item)), fmt(n)));
    }
    return el;
  }

  // ───────────────────────── craft ─────────────────────────

  toggleCraft(): void {
    if (this.craftOpen) this.closeCraft();
    else {
      this.closeBuild();
      this.g.select(null, false);
      this.craftOpen = true;
      this.craftSig = '';
      this.renderCraft();
      this.craft.classList.add('open');
      audio.play('open');
    }
    this.refreshHud();
  }

  private closeCraft(): void {
    if (!this.craftOpen) return;
    this.craftOpen = false;
    this.craft.classList.remove('open');
    this.refreshHud();
  }

  private renderCraft(): void {
    const s = this.g.s;
    const list = RECIPE_LIST.filter((r) => r.stations.includes('hand') && recipeUnlocked(s, r.id));
    const sig = list.map((r) => r.id + ':' + A.maxCraftable(s, r.id)).join('|');
    if (sig === this.craftSig) return;
    this.craftSig = sig;
    const grid = h('div', { class: 'recipes scroll' });
    for (const r of list) {
      s.flags.add('seen:r:' + r.id);
      const out = Object.keys(r.outputs)[0] as ItemId;
      const max = A.maxCraftable(s, r.id);
      const doCraft = (n: number) => {
        const res = this.g.act(() => A.craft(s, r.id, n), 'craft');
        if (res.ok && res.got) this.floaterCenter(res.got);
      };
      grid.append(h('div', { class: 'recipe' },
        h('div', { class: 'out' }, img(itemIcon(out)), h('span', { class: 'num muted', style: 'font-size:0.72rem', text: `×${r.outputs[out]}` })),
        h('div', { class: 't' }, h('div', { class: 'nm', text: r.name }), this.costEl(r.inputs), h('div', { class: 'muted', style: 'font-size:0.7rem', text: `have ${fmt(s.stash[out])}` })),
        h('div', { class: 'btns' },
          h('button', { class: 'btn' + (max < 1 ? ' off' : ''), onclick: () => doCraft(1) }, '1'),
          h('button', { class: 'btn' + (max < 5 ? ' off' : ''), onclick: () => doCraft(5) }, '5'),
          h('button', { class: 'btn' + (max < 1 ? ' off' : ''), onclick: () => doCraft(Math.max(1, max)) }, 'All'))));
    }
    const panel = h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('div', { class: 'thumb' }, img(thumb('workbench'))), h('div', { class: 't' }, h('div', { class: 'name', text: 'Workbench' }), h('div', { class: 'sub', text: 'Craft by hand from your stash' })), h('button', { class: 'close', onclick: () => this.closeCraft() }, img(glyph('close')))),
      grid);
    setOnly(this.craft, panel);
  }

  // ───────────────────────── context panel ─────────────────────────

  onSelect(): void {
    this.panelSig = '';
    if (this.g.selected !== null) { this.closeBuild(); this.closeCraft(); }
    this.refreshPanel();
  }

  private progressOf(b: Building): number {
    const def = BUILDINGS[b.type];
    if (def.kind === 'crafter' || def.kind === 'manual') { const r = currentRecipe(b) ?? RECIPES[b.recipe ?? '']; return r && b.working ? b.progress / r.time : 0; }
    if (def.kind === 'generator') return b.progress / (def.produces?.every ?? 1);
    if (def.kind === 'drill') { const n = this.nodeOf(b); return n ? b.progress / NODE_YIELD[n.type].every : 0; }
    if (def.kind === 'harvester') return b.timer / 1.5;
    if (def.kind === 'tree') return b.stock / (b.type === 'elder_tree' ? TREE.elderMaxStock : b.type === 'fruit_tree' ? ORCHARD.maxStock : TREE.maxStock);
    if (def.kind === 'hive') return b.progress / (def.produces?.every ?? 15);
    if (def.kind === 'sapling') return b.progress / TREE.saplingGrowTime;
    if (def.kind === 'beacon' && this.g.s.islets.summon) return 1 - this.g.s.islets.summon.t / 45;
    return 0;
  }

  private nodeOf(b: Building): Building | undefined {
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      for (const n of this.g.s.buildings.values()) if (n.x === b.x + dx && n.y === b.y + dy && BUILDINGS[n.type].kind === 'node') return n;
    }
    return undefined;
  }

  private refreshPanel(): void {
    const id = this.g.selected;
    const s = this.g.s;
    const b = id !== null ? s.buildings.get(id) : undefined;
    if (!b) {
      if (this.side.classList.contains('open')) { this.side.classList.remove('open'); document.body.classList.remove('side-open'); }
      this.panelSig = '';
      this.panelBar = null;
      return;
    }
    const def = BUILDINGS[b.type];
    const sig = [b.id, b.type, b.status, b.recipe, b.filter, b.dir, JSON.stringify(b.inBuf), JSON.stringify(b.outBuf), Math.floor(b.fuel), Math.floor(b.stock),
      def.kind === 'forge' || def.kind === 'beacon' ? JSON.stringify(s.forge) + JSON.stringify(s.islets) + ITEM_IDS.map((i) => s.stash[i]).join() : '',
      def.kind === 'windmill' || def.kind === 'engine' ? Math.round(s.power.gen) + '/' + s.power.demand : '',
      def.kind === 'dispatcher' || def.kind === 'sorter' ? Object.keys(s.stats.obtained).length : '',
      Math.floor(this.progressOf(b) * (def.kind === 'sapling' ? 20 : 0)),
      b.level, upgradable(def) ? s.trade.marks + ':' + s.known.has('tinker') + s.known.has('master') : '',
      def.kind === 'post' ? JSON.stringify(s.trade) : '',
    ].join('|');
    if (sig === this.panelSig) return;
    this.panelSig = sig;
    const panel = h('div', { class: 'panel' });
    const statusCls = b.status;
    let statusText = STATUS_TEXT[b.status] ?? '';
    const r = currentRecipe(b);
    if (b.status === 'noinput' && r) {
      const miss = Object.keys(r.inputs).find((k) => (b.inBuf[k as ItemId] ?? 0) < (r.inputs[k as ItemId] ?? 0));
      statusText = miss ? `Needs ${ITEMS[miss as ItemId].name}` : r.fuel && b.fuel < (r.fuel ?? 0) ? 'Needs fuel' : statusText;
    }
    if (def.kind === 'harvester' && b.status === 'noinput') statusText = 'No trees ready nearby';
    if (def.kind === 'hive' && b.status === 'noinput') statusText = 'Needs trees within reach';
    if (def.kind === 'post') statusText = '';
    if (['tree', 'sapling', 'node', 'storage', 'workbench', 'depot', 'forge', 'beacon', 'pylon', 'splitter', 'sorter', 'manual'].includes(def.kind)) statusText = '';
    const head = h('div', { class: 'panel-head' },
      h('div', { class: 'thumb' }, img(thumb(b.type))),
      h('div', { class: 't' }, h('div', { class: 'name', text: def.name + (b.level > 1 ? ' · ' + ROMAN[b.level] : '') }),
        statusText ? h('div', { class: 'status ' + statusCls }, h('i'), statusText) : h('div', { class: 'sub', text: def.desc })),
      h('button', { class: 'close', 'aria-label': 'Close', onclick: () => { this.g.select(null); audio.play('close'); } }, img(glyph('close'))));
    const body = h('div', { class: 'panel-body scroll' });
    this.panelBar = null;
    this.fillPanel(body, b);
    panel.append(head, body);
    const prevBar = this.panelBar;
    setOnly(this.side, panel);
    // keep the live progress bar pointing at the node actually in the DOM
    if (prevBar) this.panelBar = this.side.querySelector('.bar > i') ?? prevBar;
    this.side.classList.add('open');
    document.body.classList.add('side-open');
  }

  private bar(cls = ''): HTMLElement {
    const i = h('i');
    this.panelBar = i;
    return h('div', { class: 'bar ' + cls }, i);
  }

  private section(title: string, right: string, ...children: HTMLElement[]): HTMLElement {
    return h('div', { class: 'sect' }, h('div', { class: 'sect-h' }, h('span', { text: title }), right ? h('span', { class: 'r', text: right }) : null), ...children);
  }

  private slot(item: ItemId, text: string, lack = false): HTMLElement {
    return h('span', { class: 'slot' + (lack ? ' lack' : ''), title: ITEMS[item].name }, img(itemIcon(item)), h('span', { class: 'num', text }));
  }

  private fillPanel(body: HTMLElement, b: Building): void {
    const g = this.g, s = g.s;
    const def = BUILDINGS[b.type];
    const actions = h('div', { class: 'actions' });
    const addCommon = () => {
      if (def.rotatable) actions.append(h('button', { class: 'btn', onclick: () => g.act(() => A.rotate(s, b.id), 'tap') }, img(glyph('rotate')), 'Turn'));
      if (def.removable !== false && def.kind !== 'tree' && def.kind !== 'node') {
        actions.append(h('button', { class: 'btn', onclick: () => { g.setMode({ kind: 'move', id: b.id, dir: b.dir }); audio.play('tap'); } }, img(glyph('move')), 'Move'));
        actions.append(h('button', { class: 'btn', onclick: () => { const x = b.x, y = b.y; g.select(null, false); g.tryRemove(x, y); } }, img(glyph('trash')), 'Remove'));
      }
    };
    switch (def.kind) {
      case 'tree': {
        const max = b.type === 'elder_tree' ? TREE.elderMaxStock : b.type === 'fruit_tree' ? ORCHARD.maxStock : TREE.maxStock;
        body.append(h('div', { class: 'caps', text: 'Ready to gather' }), h('div', { class: 'num', style: 'font-size:1.1rem', text: `${Math.floor(b.stock)} / ${max}` }), this.bar());
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Tap the tree in the world to gather. Treewrights beside it can do this for you.' }));
        actions.append(h('button', { class: 'btn primary', onclick: () => { const r = A.harvestAt(s, b.x, b.y); if (r.ok) { audio.play('harvest'); g.markDirty(); this.floaterCenter(r.got ?? {}); } else g.fail(r.reason || 'Regrowing'); } }, img(glyph('hand')), 'Gather'));
        if (b.type === 'tree' || b.type === 'fruit_tree') actions.append(h('button', { class: 'btn', onclick: () => g.tryRemove(b.x, b.y) }, img(glyph('trash')), 'Fell'));
        break;
      }
      case 'sapling':
        body.append(h('div', { class: 'caps', text: 'Growing' }), this.bar(), h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'It will become a tree on its own.' }));
        break;
      case 'workbench':
        body.append(h('div', { class: 'muted', style: 'font-size:0.86rem', text: 'Everything you craft by hand happens here.' }));
        actions.append(h('button', { class: 'btn primary', onclick: () => { g.select(null, false); this.toggleCraft(); } }, img(glyph('craft')), 'Craft'));
        addCommon();
        break;
      case 'manual': {
        const rr = RECIPES[b.recipe ?? 'sift_loam'];
        body.append(this.recipeFlow(b, rr, true), this.bar());
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Each tap sifts. Uses loam from your stash.' }));
        actions.append(h('button', { class: 'btn primary', style: 'min-height:52px;flex:2', onclick: () => {
          const res = A.tapManual(s, b.id);
          if (res.ok) { audio.play('sift'); g.markDirty(); g.view.pulse(b.id, 0.5); if (res.got && Object.keys(res.got).length) { this.floaterCenter(res.got); audio.play('collect'); } this.panelSig = ''; } else g.fail(res.reason);
        } }, img(glyph('hand')), 'Sift'));
        addCommon();
        break;
      }
      case 'crafter': {
        const list = recipesFor(b.type).filter((rr) => recipeUnlocked(s, rr.id));
        if (list.length > 1) {
          const chips = h('div', { class: 'chips' });
          for (const rr of list) {
            const out = Object.keys(rr.outputs)[0] as ItemId;
            chips.append(h('button', { class: 'rchip' + (rr.id === b.recipe ? ' on' : ''), onclick: () => g.act(() => A.setRecipe(s, b.id, rr.id), 'select') }, img(itemIcon(out)), rr.name));
          }
          body.append(chips);
        }
        const rr = currentRecipe(b);
        if (rr) {
          // Production: what one cycle takes and makes, with its timer
          const prod = h('div', { class: 'flow' });
          for (const k in rr.inputs) prod.append(this.slot(k as ItemId, `${rr.inputs[k as ItemId]}`, (b.inBuf[k as ItemId] ?? 0) < (rr.inputs[k as ItemId] ?? 0)));
          prod.append(h('span', { class: 'arrow', text: '→' }));
          for (const k in rr.outputs) prod.append(this.slot(k as ItemId, `${rr.outputs[k as ItemId]}`));
          const boost = (g.s.cache.boost.get(b.id) ?? 1);
          const speed = boost * levelSpeed(b.level);
          body.append(this.section('Production', `⏱ ${(rr.time / speed).toFixed(1)}s`, prod, this.bar()));
          // Inventory: what is buffered inside the machine
          const inv = h('div', { class: 'flow inv' });
          const cap = bufCap(def, b);
          for (const k in rr.inputs) inv.append(this.slot(k as ItemId, `${fmt(b.inBuf[k as ItemId] ?? 0)}/${(rr.inputs[k as ItemId] ?? 0) * 2}`));
          for (const k in rr.outputs) inv.append(this.slot(k as ItemId, `${fmt(b.outBuf[k as ItemId] ?? 0)}/${cap}`));
          const info: string[] = [];
          if (rr.fuel) info.push(`fuel ${Math.floor(b.fuel)}`);
          if (boost > 1) info.push('resonating ×1.5');
          if (def.power) info.push(`uses ${def.power} breeze`);
          body.append(this.section('Inventory', info.join(' · '), inv));
        }
        actions.append(h('button', { class: 'btn', onclick: () => g.act(() => A.load(s, b.id), 'load') }, 'Load'));
        actions.append(h('button', { class: 'btn' + (stackTotal(b.outBuf) ? ' primary' : ''), onclick: () => { const res = g.act(() => A.collect(s, b.id), 'collect'); if (res.ok && res.got) this.floaterCenter(res.got); } }, 'Collect'));
        addCommon();
        if (!s.known.has('belts')) body.append(h('div', { class: 'muted', style: 'font-size:0.76rem', text: 'Load fills it from your stash. Its output faces the brass arrow on the ground.' }));
        break;
      }
      case 'generator': {
        const p = def.produces!;
        body.append(h('div', { class: 'flow' }, h('span', { class: 'arrow', text: p.nightOnly ? '☾' : '≋' }), this.slot(p.item, fmt(b.outBuf[p.item] ?? 0))), this.bar());
        body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: `About one every ${p.every}s${p.nightOnly ? ', only at night' : ''}${def.power ? ` · uses ${def.power} breeze` : ''}.` }));
        if (p.nightOnly) body.append(h('div', { class: 'caps', text: isNight(s) ? 'Night — the sky is falling' : 'Day — waiting' }));
        actions.append(h('button', { class: 'btn' + (stackTotal(b.outBuf) ? ' primary' : ''), onclick: () => { const res = g.act(() => A.collect(s, b.id), 'collect'); if (res.ok && res.got) this.floaterCenter(res.got); } }, 'Collect'));
        addCommon();
        break;
      }
      case 'harvester':
      case 'drill': {
        const outs = Object.keys(b.outBuf) as ItemId[];
        const flow = h('div', { class: 'flow' });
        if (!outs.length) flow.append(h('span', { class: 'muted', style: 'font-size:0.8rem', text: def.kind === 'drill' ? (this.nodeOf(b) ? 'Drilling…' : 'Not beside an islet heart') : 'Basket empty' }));
        for (const k of outs) flow.append(this.slot(k, fmt(b.outBuf[k] ?? 0)));
        body.append(flow, this.bar());
        body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: def.kind === 'harvester' ? 'Gathers from trees and tall grass on the eight tiles around it, then sends it out its front.' : 'Pulls from the heart beside it.' }));
        actions.append(h('button', { class: 'btn' + (outs.length ? ' primary' : ''), onclick: () => { const res = g.act(() => A.collect(s, b.id), 'collect'); if (res.ok && res.got) this.floaterCenter(res.got); } }, 'Collect'));
        addCommon();
        break;
      }
      case 'dispatcher':
      case 'sorter': {
        body.append(h('div', { class: 'caps', text: def.kind === 'dispatcher' ? 'Send out' : 'Let through' }));
        const chips = h('div', { class: 'chips' });
        const obtained = ITEM_IDS.filter((i) => (s.stats.obtained[i] ?? 0) > 0);
        chips.append(h('button', { class: 'rchip' + (!b.filter ? ' on' : ''), onclick: () => g.act(() => A.setFilter(s, b.id, null), 'select') }, 'None'));
        for (const it of obtained) chips.append(h('button', { class: 'rchip' + (b.filter === it ? ' on' : ''), title: ITEMS[it].name, onclick: () => g.act(() => A.setFilter(s, b.id, it), 'select') }, img(itemIcon(it))));
        body.append(chips);
        body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: def.kind === 'dispatcher' ? 'Pulls the chosen item from your stash and pushes it out the front, about 2½ per second.' : 'The chosen item goes straight on; everything else turns left or right.' }));
        addCommon();
        break;
      }
      case 'splitter':
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Takes items from behind and shares them left, ahead and right in turn.' }));
        addCommon();
        break;
      case 'depot':
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Machines and conveyors pointing into a depot fill your stash. If the stash is full, extra spills away.' }));
        body.append(h('div', { class: 'stats' }, h('span', { text: 'Delivered (all depots)' }), h('span', { class: 'num', text: fmt(s.stats.delivered) })));
        addCommon();
        break;
      case 'storage':
        body.append(h('div', { class: 'stats' }, h('span', { text: 'Adds to every item' }), h('span', { class: 'num', text: '+' + fmt(def.capacity ?? 0) }), h('span', { text: 'Stash holds' }), h('span', { class: 'num', text: fmt(capacity(s)) + ' each' })));
        addCommon();
        break;
      case 'windmill':
      case 'engine': {
        body.append(h('div', { class: 'stats' },
          h('span', { text: 'Breeze made (island)' }), h('span', { class: 'num', text: Math.round(s.power.gen).toString() }),
          h('span', { text: 'Breeze wanted' }), h('span', { class: 'num', text: Math.round(s.power.demand).toString() }),
          h('span', { text: 'Wind' }), h('span', { class: 'num', text: Math.round(s.power.wind * 100) + '%' })));
        if (def.kind === 'engine') {
          body.append(h('div', { class: 'flow' }, this.slot('aether', fmt(b.inBuf.aether ?? 0))));
          body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: 'Burns aether only when windmills fall short.' }));
          actions.append(h('button', { class: 'btn', onclick: () => g.act(() => A.load(s, b.id), 'load') }, 'Load'));
        } else body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: 'Windmills at the island edge catch more wind.' }));
        addCommon();
        break;
      }
      case 'pylon':
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Machines within two tiles work half again as fast. Fields do not stack.' }));
        addCommon();
        break;
      case 'roost': {
        const n = (s.cache.roostTargets.get(b.id) ?? []).length;
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: 'Its wisps carry finished goods home and bring machines what they lack — within five tiles.' }));
        body.append(h('div', { class: 'stats' }, h('span', { text: 'Machines in reach' }), h('span', { class: 'num', text: String(n) })));
        addCommon();
        break;
      }
      case 'beacon': this.fillBeacon(body, actions, b); addCommon(); break;
      case 'post': this.fillPost(body, actions); addCommon(); break;
      case 'hive': {
        const trees = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy])).filter(([dx, dy]) => (dx || dy) && [...s.buildings.values()].some((t) => t.x === b.x + dx && t.y === b.y + dy && BUILDINGS[t.type].kind === 'tree')).length;
        body.append(h('div', { class: 'flow' }, this.slot('honey', fmt(b.outBuf.honey ?? 0)), this.slot('wax', fmt(b.outBuf.wax ?? 0))), this.bar());
        body.append(h('div', { class: 'stats' }, h('span', { text: 'Trees within reach' }), h('span', { class: 'num', text: String(trees) }), h('span', { text: 'Honey every' }), h('span', { class: 'num', text: trees ? `${(15 / ((1 + HIVE.perTree * Math.min(HIVE.maxTrees, trees)) * levelSpeed(b.level))).toFixed(1)}s` : '—' })));
        body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: 'More trees nearby, more honey. Fruit trees beside a hive bear an extra apple.' }));
        actions.append(h('button', { class: 'btn' + (stackTotal(b.outBuf) ? ' primary' : ''), onclick: () => { const res = g.act(() => A.collect(s, b.id), 'collect'); if (res.ok && res.got) this.floaterCenter(res.got); } }, 'Collect'));
        addCommon();
        break;
      }
      case 'forge': this.fillForge(body, actions); break;
      case 'node': {
        const y = NODE_YIELD[b.type];
        const flow = h('div', { class: 'flow' });
        for (const e of y.table) flow.append(this.slot(e.item, ''));
        body.append(h('div', { class: 'muted', style: 'font-size:0.82rem', text: def.desc }), flow);
        if (!s.known.has('drill')) body.append(h('div', { class: 'muted', style: 'font-size:0.78rem', text: 'You will need a way to tap it.' }));
        break;
      }
      default:
        addCommon();
    }
    if (actions.childElementCount) body.append(actions);
    if (upgradable(def) && s.known.has('tinker')) body.append(this.upgradeSection(b));
  }

  private upgradeSection(b: Building): HTMLElement {
    const g = this.g, s = g.s;
    const def = BUILDINGS[b.type];
    const max = A.maxLevel(s);
    const row = h('div', { class: 'upgrade' });
    const pips = h('span', { class: 'pips' });
    for (let i = 1; i <= 5; i++) pips.append(h('i', { class: i <= b.level ? 'on' : i > max ? 'lock' : '' }));
    if (b.level >= 5) row.append(pips, h('span', { class: 'muted', style: 'font-size:0.74rem', text: 'Fully upgraded' }));
    else {
      const c = upgradeCost(def, b.level + 1);
      const can = A.canUpgrade(s, b.id);
      const cost = this.costEl(c.items);
      if (c.marks) cost.append(h('span', { class: s.trade.marks < c.marks ? 'lack' : '' }, img(uiIcon('marks')), String(c.marks)));
      row.append(pips, b.level >= max ? h('span', { class: 'muted', style: 'font-size:0.72rem', text: 'Master tools from the market unlock IV–V' }) : cost,
        h('button', { class: 'btn small' + (can.ok ? ' primary' : ''), disabled: b.level >= max, onclick: () => { const r = g.act(() => A.upgrade(s, b.id), 'craft'); if (r.ok) { g.view.pulse(b.id, 0.8); this.hint(`${def.name} is now level ${ROMAN[b.level]}.`); } } }, img(uiIcon('upgrade')), ROMAN[b.level + 1]));
    }
    return this.section('Upgrade', `+25% speed per level`, row);
  }

  private fillPost(body: HTMLElement, actions: HTMLElement): void {
    const g = this.g, s = g.s, tr = s.trade;
    const need = repForLevel(tr.level);
    const head = h('div', { class: 'trade-head' }, h('span', { class: 'marks' }, img(uiIcon('marks')), h('span', { class: 'num', text: fmt(tr.marks) })),
      h('span', { class: 'caps', text: `Trade level ${tr.level + 1}` }), h('div', { class: 'bar xp' }, h('i', { style: `width:${Math.round((tr.rep / need) * 100)}%` })));
    body.append(head);
    tr.board.forEach((c, i) => {
      if (!c) {
        body.append(h('div', { class: 'contract empty' }, h('span', { class: 'muted', text: `A new trader arrives in ${Math.ceil(tr.refresh[i] || CONTRACT_REFRESH)}s…` })));
        return;
      }
      const have = s.stash[c.item];
      const pct = Math.round((c.got / c.n) * 100);
      body.append(h('div', { class: 'contract' },
        h('div', { class: 'ci' }, img(itemIcon(c.item))),
        h('div', { class: 'ct' }, h('div', { class: 'nm', text: `${fmt(c.n)} ${ITEMS[c.item].name}` }), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('div', { class: 'sub', text: `${fmt(c.got)} / ${fmt(c.n)} · you have ${fmt(have)}` })),
        h('div', { class: 'cr' }, h('span', { class: 'reward' }, img(uiIcon('marks')), h('span', { class: 'num', text: String(c.marks) })),
          h('div', { class: 'cb' },
            h('button', { class: 'btn small' + (have ? ' primary' : ''), title: 'Hand over from your stash', onclick: () => { const r = g.act(() => A.handOver(s, i), 'collect'); if (r.ok) this.panelSig = ''; } }, 'Give'),
            h('button', { class: 'btn small ghost', title: tr.skipCd > 0 ? `Next swap in ${Math.ceil(tr.skipCd)}s` : 'Swap for another contract', onclick: () => { g.act(() => A.skipContract(s, i), 'tap'); this.panelSig = ''; } }, '↻')))));
    });
    body.append(h('div', { class: 'muted', style: 'font-size:0.74rem', text: 'Conveyors pointing into the post fill contracts too. Only wanted goods are taken.' }));
    actions.append(h('button', { class: 'btn primary', onclick: () => this.openMarket() }, img(uiIcon('market'), 'ui'), 'Market'));
  }

  openMarket(): void {
    const g = this.g, s = g.s;
    const list = h('div', { class: 'market scroll' });
    const render = () => {
      clear(list);
      for (const m of MARKET) {
        if (!A.marketVisible(s, m.id)) continue;
        const price = marketPrice(m, s.trade.bought[m.id] ?? 0);
        const icon = m.gives ? itemIcon(Object.keys(m.gives)[0] as ItemId) : uiIcon(m.id === 'master' ? 'upgrade' : m.id === 'hive' ? 'market' : 'marks');
        list.append(h('div', { class: 'offer' }, h('div', { class: 'ci' }, img(m.id === 'hive' ? thumb('hive') : m.id === 'lanterns' ? thumb('lantern') : icon)),
          h('div', { class: 'ct' }, h('div', { class: 'nm', text: m.name }), h('div', { class: 'sub', text: m.desc })),
          h('button', { class: 'btn small' + (s.trade.marks >= price ? ' primary' : ''), onclick: () => { const r = g.act(() => A.buy(s, m.id), 'collect'); if (r.ok) { this.hint(`Bought: ${m.name}`); render(); head.querySelector('.sub')!.textContent = `You have ${fmt(s.trade.marks)} Marks`; } } }, img(uiIcon('marks')), String(price))));
      }
    };
    const head = this.modalHead('Market', `You have ${fmt(s.trade.marks)} Marks`, uiIcon('market'));
    render();
    this.openModal(h('div', { style: 'display:flex;flex-direction:column;min-height:0;max-height:inherit' }, head, list));
  }

  private showWeather(): void {
    const s = this.g.s;
    const day = dayIndex(s.time);
    const w = weatherFor(day, s.seed), n = weatherFor(day + 1, s.seed);
    this.hint(`${w.name}: ${w.desc} Tomorrow: ${n.name.toLowerCase()}.`, false, 4200);
  }

  private recipeFlow(b: Building, r: (typeof RECIPES)[string], fromStash: boolean): HTMLElement {
    const s = this.g.s;
    const flow = h('div', { class: 'flow' });
    for (const k in r.inputs) {
      const item = k as ItemId;
      const need = r.inputs[item] ?? 0;
      const have = fromStash ? s.stash[item] : b.inBuf[item] ?? 0;
      flow.append(this.slot(item, fromStash ? `×${need}` : fmt(have), have < need));
    }
    flow.append(h('span', { class: 'arrow', text: '→' }));
    for (const k in r.outputs) {
      const item = k as ItemId;
      flow.append(this.slot(item, fromStash ? `×${r.outputs[item]}` : fmt(b.outBuf[item] ?? 0)));
    }
    if (r.chance) for (const k in r.chance) {
      const item = k as ItemId;
      const known = (s.stats.obtained[item] ?? 0) > 0;
      flow.append(known ? this.slot(item, fromStash ? '?' : fmt(b.outBuf[item] ?? 0)) : h('span', { class: 'slot', title: 'Something else, sometimes' }, h('span', { class: 'title', style: 'font-size:1.2rem;color:var(--dim)', text: '?' })));
    }
    return flow;
  }

  private fillBeacon(body: HTMLElement, actions: HTMLElement, b: Building): void {
    const s = this.g.s;
    const sm = s.islets.summon;
    if (sm) {
      body.append(h('div', { class: 'caps', text: 'Something is drifting closer' }), this.bar('aether'));
      return;
    }
    if (s.islets.docked >= ISLETS.length) {
      body.append(h('div', { class: 'muted', style: 'font-size:0.86rem', text: 'No more drifters answer. The sky is yours.' }));
      return;
    }
    const cost = summonCost(s.islets.docked);
    body.append(h('div', { class: 'muted', style: 'font-size:0.84rem', text: 'Somewhere in the haze, an islet is listening. It will dock beside the beacon.' }), this.costEl(cost));
    actions.append(h('button', { class: 'btn primary', onclick: () => { const r = this.g.act(() => A.summon(s, b.id), 'discover'); if (r.ok) this.panelSig = ''; } }, img(glyph('spark')), 'Call'));
    body.append(h('div', { class: 'caps', text: `${s.islets.docked} drifter${s.islets.docked === 1 ? '' : 's'} home` }));
  }

  private fillForge(body: HTMLElement, actions: HTMLElement): void {
    const s = this.g.s, f = s.forge;
    if (f.stage < FORGE_STAGES.length) {
      const st = FORGE_STAGES[f.stage];
      body.append(h('div', { class: 'caps', text: `Stage ${f.stage + 1} of ${FORGE_STAGES.length} · ${st.name}` }));
      const flow = h('div', { class: 'flow' });
      for (const k in st.needs) {
        const item = k as ItemId;
        const need = st.needs[item] ?? 0, got = f.progress[item] ?? 0;
        flow.append(this.slot(item, `${fmt(got)}/${fmt(need)}`, got < need));
      }
      body.append(flow);
      const total = stackTotal(st.needs), have = stackTotal(f.progress);
      const bar = h('div', { class: 'bar aether' }, h('i', { style: `width:${Math.round((have / total) * 100)}%` }));
      body.append(bar, h('div', { class: 'muted', style: 'font-size:0.78rem', text: 'Contribute from your stash, or send it there by conveyor.' }));
      actions.append(h('button', { class: 'btn primary', onclick: () => this.g.act(() => A.contribute(s), 'craft') }, 'Contribute'));
      return;
    }
    body.append(h('div', { class: 'caps', text: `Resonance ${f.level}` }));
    const need = forgeNeeds(s);
    const flow = h('div', { class: 'flow' });
    for (const k in f.request) {
      const item = k as ItemId;
      const req = f.request[item] ?? 0;
      flow.append(this.slot(item, `${fmt(req - (need[item] ?? 0))}/${fmt(req)}`, (need[item] ?? 0) > 0));
    }
    body.append(h('div', { class: 'muted', style: 'font-size:0.8rem', text: 'The Aetherforge asks for more. Each answer kindles a spark.' }), flow);
    body.append(h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => this.g.act(() => A.contribute(s), 'craft') }, 'Contribute')));
    body.append(h('div', { class: 'caps', text: `Sparks · ${f.sparks}` }));
    const list = h('div', { class: 'chips' });
    for (const a of ATTUNEMENTS) {
      const rank = f.attune[a.id] ?? 0;
      const maxed = rank >= a.max;
      list.append(h('button', { class: 'rchip' + (rank ? ' on' : ''), title: a.desc, onclick: () => {
        const r = this.g.act(() => A.attune(s, a.id), 'discover');
        if (r.ok) { this.hint(`${a.name}: ${a.desc}`, false, 2600); if (a.id === 'bloom') { this.g.view.bloom = true; this.g.view.forceTerrain(); } }
      } }, `${a.name}${a.max > 1 ? ` ${rank}/${a.max}` : rank ? ' ✓' : ''}`, maxed ? '' : h('span', { class: 'muted', style: 'margin-left:4px', text: `· ${a.cost(rank)}` })));
    }
    body.append(list);
  }

  // ───────────────────────── modals ─────────────────────────

  private openModal(content: HTMLElement, wide = false): void {
    clear(this.modal);
    this.modal.className = 'modal panel' + (wide ? ' wide' : '');
    this.modal.append(content);
    this.modalWrap.classList.add('open');
    audio.play('open');
  }

  closeModal(): void {
    if (!this.modalWrap.classList.contains('open')) return;
    this.modalWrap.classList.remove('open');
    audio.play('close');
  }

  closeAll(): void {
    this.closeModal();
    this.closeBuild();
    this.closeCraft();
  }

  private modalHead(title: string, sub: string, icon: string): HTMLElement {
    return h('div', { class: 'panel-head' }, h('div', { class: 'thumb' }, img(icon)), h('div', { class: 't' }, h('div', { class: 'name', text: title }), h('div', { class: 'sub', text: sub })), h('button', { class: 'close', onclick: () => this.closeModal() }, img(glyph('close'))));
  }

  openStash(): void {
    const s = this.g.s;
    const cap = capacity(s);
    const grid = h('div', { class: 'stash-grid scroll' });
    const items = ITEM_IDS.filter((i) => (s.stats.obtained[i] ?? 0) > 0 || s.stash[i] > 0);
    for (const id of items) {
      grid.append(h('div', { class: 'stash-item' + (s.stash[id] >= cap ? ' full' : ''), title: ITEMS[id].desc }, img(itemIcon(id)), h('span', { class: 'num', text: fmt(s.stash[id]) }), h('span', { class: 'nm', text: ITEMS[id].name })));
    }
    if (!items.length) grid.append(h('div', { class: 'muted', text: 'Nothing yet. The tree is a good start.' }));
    const { rate } = flowRates(s);
    const flows = ITEM_IDS.filter((i) => Math.abs(rate[i] ?? 0) > 0.004);
    const content = h('div', { style: 'display:flex;flex-direction:column;min-height:0;max-height:inherit' },
      this.modalHead('Stash', `Holds ${fmt(cap)} of each item`, glyph('stash')), grid,
      flows.length ? h('div', { class: 'cap' }, h('span', { class: 'caps', text: 'Automated / min' }), ...flows.map((i) => h('span', { style: 'display:inline-flex;align-items:center;gap:2px' }, img(itemIcon(i), 'px'), h('span', { class: 'num', text: ((rate[i] ?? 0) > 0 ? '+' : '') + Math.round((rate[i] ?? 0) * 60) })))) : null);
    content.querySelectorAll('.cap img').forEach((el) => { (el as HTMLElement).style.width = '16px'; (el as HTMLElement).style.height = '16px'; });
    this.openModal(content, true);
  }

  openJournal(): void {
    const s = this.g.s;
    s.flags.add('seen:journal:' + s.known.size);
    this.refreshHud();
    const entries = h('div', { class: 'entries scroll' });
    const riddles = teasers(s);
    if (riddles.length) {
      const box = h('div', { class: 'entry' }, h('div', { class: 'caps', text: 'Unanswered' }));
      for (const r of riddles) box.append(h('div', { class: 'riddle' }, h('span', { style: 'flex:1', text: r.hint }), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(r.progress * 100)}%` }))));
      entries.append(box);
    }
    const known = DISCOVERY_LIST.filter((d) => s.known.has(d.id)).reverse();
    for (const d of known) entries.append(h('div', { class: 'entry' }, h('div', { class: 'h', text: d.title }), h('p', { text: d.text })));
    const st = s.stats;
    const count = (pred: (b: Building) => boolean) => [...s.buildings.values()].filter(pred).length;
    entries.append(h('div', { class: 'entry' }, h('div', { class: 'caps', text: 'Records' }), h('div', { class: 'stats' },
      h('span', { text: 'Time in this world' }), h('span', { class: 'num', text: duration(st.playSeconds) }),
      h('span', { text: 'Ground' }), h('span', { class: 'num', text: `${s.tiles.size} tiles` }),
      h('span', { text: 'Structures' }), h('span', { class: 'num', text: String(count((b) => !['tree', 'tuft', 'sapling', 'elder_tree'].includes(b.type) && BUILDINGS[b.type].kind !== 'node')) }),
      h('span', { text: 'Trees' }), h('span', { class: 'num', text: String(count((b) => b.type === 'tree')) }),
      h('span', { text: 'Gathered by hand' }), h('span', { class: 'num', text: fmt(st.harvests) }),
      h('span', { text: 'Delivered by machine' }), h('span', { class: 'num', text: fmt(st.delivered) }),
      h('span', { text: 'Discoveries' }), h('span', { class: 'num', text: `${s.known.size - 1}` }),
      s.islets.docked ? h('span', { text: 'Drifters home' }) : null, s.islets.docked ? h('span', { class: 'num', text: String(s.islets.docked) }) : null,
      s.forge.stage >= 3 ? h('span', { text: 'Resonance' }) : null, s.forge.stage >= 3 ? h('span', { class: 'num', text: String(s.forge.level) }) : null)));
    this.openModal(h('div', { style: 'display:flex;flex-direction:column;min-height:0;max-height:inherit' }, this.modalHead('Journal', 'What you have learned', glyph('journal')), entries));
  }

  openSettings(): void {
    const g = this.g, st = g.settings;
    const slider = (label: string, key: 'master' | 'sfx' | 'ambience') => {
      const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(st[key]) }) as HTMLInputElement;
      input.addEventListener('input', () => { st[key] = +input.value; g.saveSettings(); });
      input.addEventListener('change', () => audio.play('tap'));
      return h('div', { class: 'row' }, h('label', { text: label }), input);
    };
    const toggle = (label: string, key: 'haptics' | 'reduced' | 'bubbles' | 'fps', after?: () => void) => {
      const t = h('button', { class: 'toggle' + (st[key] ? ' on' : ''), 'aria-label': label, onclick: () => { st[key] = !st[key]; t.classList.toggle('on', st[key]); g.saveSettings(); audio.play('tap'); after?.(); } });
      return h('div', { class: 'row' }, h('label', { text: label }), t);
    };
    const seg = <T extends string | number>(label: string, opts: [T, string][], cur: T, set: (v: T) => void) => {
      const box = h('div', { class: 'seg' });
      for (const [v, name] of opts) box.append(h('button', { class: v === cur ? 'on' : '', onclick: () => { set(v); g.saveSettings(); audio.play('tap'); box.querySelectorAll('button').forEach((b) => b.classList.remove('on')); (box.children[opts.findIndex((o) => o[0] === v)] as HTMLElement).classList.add('on'); } }, name));
      return h('div', { class: 'row' }, h('label', { text: label }), box);
    };
    const area = h('textarea', { placeholder: 'Paste an exported world here…' }) as HTMLTextAreaElement;
    const version = h('div', { class: 'legal', text: 'Aetherforge 1.0 · a Claude one-shot build', onclick: () => { if (++this.devTaps >= 7) { st.dev = true; g.saveSettings(); this.renderDev(); this.hint('Developer tools enabled.'); } } });
    const form = h('div', { class: 'form scroll' },
      h('div', { class: 'caps', text: 'Sound' }), slider('Volume', 'master'), slider('Effects', 'sfx'), slider('Ambience & music', 'ambience'),
      h('div', { class: 'caps', text: 'Feel' }), toggle('Vibration', 'haptics'), toggle('Reduce motion', 'reduced'), toggle('Machine status bubbles', 'bubbles'),
      h('div', { class: 'caps', text: 'Display' }),
      seg('Interface size', [[0.9, 'S'], [1, 'M'], [1.15, 'L']] as [number, string][], st.ui, (v) => { st.ui = v; }),
      seg('Effects quality', [['low', 'Light'], ['high', 'Full']] as ['low' | 'high', string][], st.quality, (v) => { st.quality = v; st.qualityChosen = true; }),
      st.dev ? toggle('Show frame rate', 'fps', () => this.fpsEl.classList.toggle('show', st.fps)) : null,
      h('div', { class: 'caps', text: 'Your world' }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { const ok = await g.save(); this.hint(ok ? 'World saved.' : 'Could not save.', !ok); } }, 'Save now'),
        h('button', { class: 'btn', onclick: () => this.exportWorld(area) }, 'Export'),
        h('button', { class: 'btn', onclick: () => { const r = g.importSave(area.value); this.hint(r.ok ? 'World imported.' : r.reason ?? 'Import failed', !r.ok, 3000); if (r.ok) this.closeModal(); } }, 'Import')),
      area,
      h('div', { class: 'actions' }, h('button', { class: 'btn danger', onclick: () => this.confirmReset() }, 'Start a new world…')),
      h('div', { class: 'caps', text: 'About' }),
      h('div', { class: 'legal', html: 'All world art, icons and sound are original and generated in code for this game. Fonts: <b>Pixelify Sans</b> (The Pixelify Sans Project Authors) and <b>Atkinson Hyperlegible</b> (Braille Institute), both under the SIL Open Font License 1.1. Rendering by PixiJS (MIT).' }),
      version);
    this.openModal(h('div', { style: 'display:flex;flex-direction:column;min-height:0;max-height:inherit' }, this.modalHead('Settings', 'Your world saves itself as you play', glyph('menu')), form));
  }

  private exportWorld(area: HTMLTextAreaElement): void {
    const text = this.g.exportSave();
    area.value = text;
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `aetherforge-${new Date().toISOString().slice(0, 10)}.txt` });
      document.body.append(a);
      a.click();
      a.remove();
    } catch { /* fall back to the text box */ }
    try { void navigator.clipboard?.writeText(text); } catch { /* ignore */ }
    this.hint('World exported — also copied to the clipboard.', false, 2600);
  }

  private confirmReset(): void {
    const content = h('div', { class: 'away' },
      h('div', { class: 'h', text: 'Start over?' }),
      h('div', { class: 'muted', text: 'This world will be replaced by a single seed of land. A safety copy is kept on this device.' }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => this.openSettings() }, 'Keep my world'),
        h('button', { class: 'btn danger', onclick: async () => { await this.g.resetWorld(); this.closeModal(); this.hint('A new seed of land.'); } }, 'Start over')));
    this.openModal(content);
  }

  showAway(rep: OfflineReport): void {
    const gains = h('div', { class: 'gains' });
    const items = Object.keys(rep.gained) as ItemId[];
    for (const k of items.slice(0, 16)) gains.append(h('span', { class: 'rchip' }, img(itemIcon(k)), '+' + fmt(rep.gained[k] ?? 0)));
    const content = h('div', { class: 'away' },
      h('div', { class: 'caps', text: 'While you were away' }),
      h('div', { class: 'h', text: duration(rep.seconds) }),
      items.length ? gains : h('div', { class: 'muted', text: 'The island rested. Trees regrew; nothing else stirred.' }),
      items.length ? h('div', { class: 'legal', text: `Your machines kept working at an easier pace${rep.counted < rep.seconds ? `, for up to ${duration(rep.counted)}` : ''}.` }) : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => this.closeModal() }, 'Back to the island')));
    this.openModal(content);
  }

  // ───────────────────────── feedback ─────────────────────────

  discovery(id: string): void {
    if (id === 'start') return;
    this.discQueue.push(id);
    if (!this.discShowing) this.nextDiscovery();
    this.refreshAll();
  }

  private nextDiscovery(): void {
    const id = this.discQueue.shift();
    if (!id) { this.discShowing = false; return; }
    this.discShowing = true;
    const d = DISCOVERIES[id];
    const el = h('div', { class: 'discovery' }, h('div', { class: 'caps', text: 'Discovery' }), h('div', { class: 'h', text: d.title }), h('p', { text: d.text }));
    this.toasts.append(el);
    window.setTimeout(() => {
      el.classList.add('out');
      window.setTimeout(() => { el.remove(); this.nextDiscovery(); }, 420);
    }, 4200);
  }

  hint(text: string, bad = false, ms = 1800): void {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('bad', bad);
    this.hintEl.classList.add('show');
    this.hintTimer = ms;
  }

  floater(sx: number, sy: number, items: Stack): void {
    const el = h('div', { class: 'floater', style: `left:${sx}px;top:${sy - 30}px` });
    for (const k in items) el.append(h('span', { style: 'display:inline-flex;align-items:center' }, '+' + items[k as ItemId], img(itemIcon(k as ItemId))));
    if (!el.childElementCount) return;
    this.root.append(el);
    window.setTimeout(() => el.remove(), 1150);
  }

  private floaterCenter(items: Stack): void {
    this.floater(window.innerWidth / 2, window.innerHeight * 0.45, items);
  }

  flashFull(item: ItemId): void {
    if (!this.g.s.known.has('storage') && !this.g.s.known.has('belts')) this.hint(`Your stash can't hold more ${ITEMS[item].name}.`, true, 2400);
  }

  dirty(): void { /* autosave is handled by the game loop */ }

  saved(): void {
    this.savedEl.classList.add('show');
    window.setTimeout(() => this.savedEl.classList.remove('show'), 1200);
  }

  wakeObserve(): void {
    this.observeExit.classList.add('wake');
    window.setTimeout(() => this.observeExit.classList.remove('wake'), 2500);
  }

  // ───────────────────────── developer tools ─────────────────────────

  renderDev(): void {
    const g = this.g;
    if (!g.settings.dev) { this.devEl.classList.remove('open'); return; }
    this.fpsEl.classList.toggle('show', g.settings.fps);
    clear(this.devEl);
    const btn = (label: string, fn: () => void) => h('button', { class: 'btn', onclick: () => { fn(); g.ui.refreshAll(); } }, label);
    let open = false;
    const body = h('div', { class: 'grid', style: 'display:none' },
      btn('+500 all', () => { for (const id of ITEM_IDS) g.s.stash[id] += 500; g.s.extraCapacity = Math.max(g.s.extraCapacity, 5000); g.s.topoDirty = true; }),
      btn('Unlock all', () => { for (const d of DISCOVERY_LIST) g.s.known.add(d.id); }),
      btn('Speed ×1', () => { g.speed = 1; }),
      btn('Speed ×10', () => { g.speed = 10; }),
      btn('Speed ×60', () => { g.speed = 60; }),
      btn('Night/day', () => { g.s.time += 300; }),
      btn('FPS', () => { g.settings.fps = !g.settings.fps; this.fpsEl.classList.toggle('show', g.settings.fps); }),
      btn('Demo world', () => g.devDemo()),
      btn('Flows', () => { const { rate } = flowRates(g.s); this.hint(Object.entries(rate).map(([k, v]) => `${k}:${((v ?? 0) * 60).toFixed(1)}/m`).join(' ') || 'No automated flow yet', false, 5000); }),
      btn('States', () => { const c: Record<string, number> = {}; for (const b of g.s.buildings.values()) c[b.status] = (c[b.status] ?? 0) + 1; this.hint(JSON.stringify(c), false, 4000); }),
      btn('Dev off', () => { g.settings.dev = false; g.saveSettings(); this.renderDev(); }));
    this.devEl.append(h('button', { class: 'btn', style: 'width:100%', onclick: () => { open = !open; body.style.display = open ? 'grid' : 'none'; } }, 'DEV'), body);
    this.devEl.classList.add('open');
  }
}

export type { Dir };
