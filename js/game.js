/* Pocket Singularity — browser shell: rendering, UI, input, saves.
 * Game rules live in core.js; this file only reads the authoritative `state` and draws it.
 */
(function () {
  'use strict';

  const PS = window.PS;
  const Sound = window.PSAudio;
  const Platform = window.PSPlatform;
  const C = PS.CONFIG;
  const fmt = PS.fmt;

  const SAVE_KEY = 'pocket-singularity:save';
  const BAK_KEY = 'pocket-singularity:backup';
  const BAD_KEY = 'pocket-singularity:corrupt';
  const QS = new URLSearchParams(location.search);
  const COVER = QS.has('cover');

  const COL = {
    cyan: '#6CE8FF', violet: '#A78BFA', gold: '#FFD783', coral: '#FF8B98', green: '#83F0C0',
    text: '#F0F4FF', muted: '#8D9ABA', dust: '#94ABDD', ice: '#6CE8FF'
  };

  // Sector look: background gradient, nebula blobs, star density and an ambient feature.
  const PALETTES = [
    { name: 'dust',    bg: ['#0B1224', '#070A14'], neb: ['#2A4A7A', '#1B5C72', '#23345E'], stars: 130, ambient: 'drift',   star: '#C9D6F5' },
    { name: 'belt',    bg: ['#0C1030', '#070816'], neb: ['#2B3A8A', '#46358F', '#1E2A66'], stars: 150, ambient: 'belt',    star: '#C8C6FF' },
    { name: 'moon',    bg: ['#0A1A2C', '#060B16'], neb: ['#1F6F8F', '#2A8AA8', '#1A3F66'], stars: 170, ambient: 'moon',    star: '#DFF8FF' },
    { name: 'nebula',  bg: ['#170C2C', '#090616'], neb: ['#5A2A8A', '#8A2A6A', '#3A2A8A'], stars: 140, ambient: 'nebula',  star: '#F0D8FF' },
    { name: 'nursery', bg: ['#1C130C', '#0A0810'], neb: ['#7A5520', '#8A4A3A', '#4A2A6A'], stars: 200, ambient: 'nursery', star: '#FFF0D0' }
  ];
  const SECTOR_NEWS = [
    '',
    'Unstable shards appear — they burst and drag neighbours in',
    'Ice-rich orbits · fragments worth more',
    'Volatile shard storms · fragments worth more',
    'Star crystals bloom here · fragments worth more'
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let state, stats, world, mutation, todayKey;
  const ev = [];
  let reduced = false;
  let lastWall = Date.now();
  let lastBackup = 0;
  let modalOpen = null;
  let collapsing = false;
  let frozen = false;   // test hook: behave like a tab that was killed without saving

  function now() { return Date.now(); }

  function loadState() {
    const t = now();
    const main = PS.parseSave(Platform.get(SAVE_KEY), t);
    const bak = PS.parseSave(Platform.get(BAK_KEY), t);
    let res = main;
    let notice = null;
    if (main && !main.ok) {
      try { Platform.set(BAD_KEY, Platform.get(SAVE_KEY) || ''); } catch (e) { /* ignore */ }
      if (bak && bak.ok && (main.broken || bak.state.lifetime > main.state.lifetime)) { res = bak; notice = 'Your save was damaged — restored the latest backup.'; }
      else if (main.broken) { res = null; notice = 'Your save could not be read, so a new universe was started.'; }
    }
    if (!res && bak && bak.ok) { res = bak; notice = notice || 'Restored your universe from backup.'; }
    return { state: res ? res.state : PS.createState(t), fresh: !res, notice: notice };
  }

  function save() {
    if (COVER || frozen) return;
    state.lastSeen = now();
    Platform.set(SAVE_KEY, PS.serialize(state));
  }

  function backup() {
    if (COVER || frozen) return;
    Platform.set(BAK_KEY, PS.serialize(state));
    lastBackup = performance.now();
  }

  function refreshStats() { stats = PS.derive(state, mutation); }

  function rollMutation() {
    todayKey = PS.dayKey(new Date());
    mutation = PS.mutationFor(todayKey);
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    universe: $('universe'), cv: $('cv'), matter: $('matter'), rate: $('rate'),
    sectorNum: $('sector-num'), sectorName: $('sector-name'), mut: $('mutation-chip'),
    surge: $('surge'), banner: $('banner'), toasts: $('toasts'), hint: $('hint'),
    pulse: $('btn-pulse'), pulseCd: $('pulse-cd'), msText: $('ms-text'), msVal: $('ms-val'), msFill: $('ms-fill'),
    shop: $('shop'), collapse: $('collapse-card'), atlasBtn: $('btn-atlas'), atlasCount: $('atlas-count'),
    sound: $('btn-sound'), settings: $('btn-settings'),
    modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalActions: $('modal-actions'), modalX: $('modal-x')
  };
  const ctx = el.cv.getContext('2d', { alpha: false });

  // Sets text only when it changed, so per-frame UI updates never thrash the DOM.
  const textCache = new WeakMap();
  function setText(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.textContent = s; } }
  function setHTML(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.innerHTML = s; } }

  const ICONS = {
    radius: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.4" fill="currentColor"/><circle cx="10" cy="10" r="5.4" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".75"/><circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.4 2.2" opacity=".55"/></svg>',
    density: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="5" cy="6" r="1.7"/><circle cx="11" cy="4.5" r="1.3"/><circle cx="15.5" cy="8" r="1.8"/><circle cx="8.5" cy="10.5" r="1.9"/><circle cx="4.5" cy="14.5" r="1.3"/><circle cx="12.5" cy="14" r="1.6"/><circle cx="16.5" cy="15.5" r="1.1"/></svg>',
    drones: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" fill="currentColor"/><ellipse cx="10" cy="10" rx="8" ry="4.2" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M16.8 5.2l1.8 3.4-3.8-.4z" fill="currentColor"/><path d="M3.2 14.8l-1.8-3.4 3.8.4z" fill="currentColor"/></svg>',
    resonance: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 10c1.6-4 3.4-4 5 0s3.4 4 5 0 3.4-4 6 0"/><circle cx="2" cy="10" r=".6" fill="currentColor"/><circle cx="18" cy="10" r=".6" fill="currentColor"/></svg>',
    focus: '<svg viewBox="0 0 20 20"><path d="M10 3.5 15 10l-5 6.5L5 10z" fill="currentColor"/><path d="M10 0.8v2M10 17.2v2M0.8 10h2M17.2 10h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
  };
  const FRAG_SVG = {
    f_dust: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="4" fill="#94ABDD"/></svg>',
    f_ice: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="5" fill="#6CE8FF" stroke="#E8FDFF" stroke-width="1"/></svg>',
    f_crystal: '<svg viewBox="0 0 26 26"><path d="M13 4l6 9-6 9-6-9z" fill="#FFD783"/></svg>',
    f_shard: '<svg viewBox="0 0 26 26"><path d="M13 5l7 4v8l-7 4-7-4V9z" fill="#FF8B98"/></svg>',
    comet: '<svg viewBox="0 0 26 26"><path d="M3 21 17 9" stroke="#FFD783" stroke-width="3" stroke-linecap="round" opacity=".45"/><circle cx="18" cy="8" r="4" fill="#FFF4D6"/></svg>',
    chain: '<svg viewBox="0 0 26 26" fill="none" stroke="#A78BFA" stroke-width="1.8"><circle cx="8" cy="13" r="4"/><circle cx="18" cy="13" r="4"/><circle cx="13" cy="13" r="10" stroke-dasharray="3 3" opacity=".6"/></svg>',
    sector: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="none" stroke="#6CE8FF" stroke-width="1.6"/><path d="M4 13h18" stroke="#6CE8FF" stroke-width="1.2" opacity=".6"/><circle cx="13" cy="13" r="3" fill="#6CE8FF"/></svg>',
    drones: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="3.5" fill="#83F0C0"/><path d="M13 2l2 4h-4zM24 13l-4 2v-4zM13 24l-2-4h4zM2 13l4-2v4z" fill="#83F0C0"/></svg>',
    collapse: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="#0a0a14" stroke="#A78BFA" stroke-width="2"/><path d="M13 7v12M7 13h12" stroke="#A78BFA" stroke-width="1.4" opacity=".7"/></svg>',
    golden: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="none" stroke="#FFD783" stroke-width="1.6" opacity=".6"/><path d="M13 6l4.5 7L13 20l-4.5-7z" fill="#FFD783"/></svg>',
    reaction: '<svg viewBox="0 0 26 26"><path d="M13 7l5 3v6l-5 3-5-3v-6z" fill="#FF8B98"/><circle cx="13" cy="13" r="11" fill="none" stroke="#FF8B98" stroke-width="1.2" stroke-dasharray="2 3"/></svg>'
  };
  function atlasIcon(id) {
    if (FRAG_SVG[id]) return FRAG_SVG[id];
    if (id.indexOf('chain') === 0) return FRAG_SVG.chain;
    if (/^s\d$/.test(id)) return FRAG_SVG.sector;
    if (id === 'drones25') return FRAG_SVG.drones;
    return FRAG_SVG.sector;
  }

  // Shop cards are built once; updates only touch text and classes.
  const cards = {};
  function buildShop() {
    el.shop.innerHTML = '';
    C.upgrades.forEach(function (u, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.title = u.name + ' — ' + u.desc + ' (key ' + (i + 1) + ')';
      b.innerHTML = '<span class="ic">' + ICONS[u.id] + '</span>' +
        '<span class="nm">' + u.name + '<span class="lv num"></span></span>' +
        '<span class="cost num"></span><span class="fx"></span><span class="key">' + (i + 1) + '</span>';
      b.addEventListener('click', function (e) { e.stopPropagation(); tryBuy(u.id, b); });
      el.shop.appendChild(b);
      cards[u.id] = { b: b, lv: b.querySelector('.lv'), cost: b.querySelector('.cost'), fx: b.querySelector('.fx'), cls: '' };
    });
  }

  function effectText(id, lvl) {
    const s0 = PS.derive(withLevel(id, lvl), mutation);
    const s1 = PS.derive(withLevel(id, lvl + 1), mutation);
    const max = lvl >= C.upgrades[PS.UPG[id].index].max;
    const pair = (a, b) => max ? '<em>' + a + '</em>' : a + ' → <em>' + b + '</em>';
    switch (id) {
      case 'radius': return 'Reach ' + pair(Math.round(s0.pulseRadius * 100) + '%', Math.round(s1.pulseRadius * 100) + '%');
      case 'density': return 'Inflow ' + pair(s0.spawnRate.toFixed(1) + '/s', s1.spawnRate.toFixed(1) + '/s') + ' · cap ' + (max ? s0.cap : s1.cap);
      case 'drones': return 'Passive ' + pair('+' + fmt(s0.dronePerSec) + '/s', '+' + fmt(s1.dronePerSec) + '/s');
      case 'resonance': return 'Chain ' + pair('+' + Math.round(s0.chainStep * 100) + '%', '+' + Math.round(s1.chainStep * 100) + '%') + ' per extra';
      case 'focus': return 'Value ' + pair('×' + fmtMult(s0.focusMult), '×' + fmtMult(s1.focusMult));
    }
    return '';
  }
  function fmtMult(m) { return m < 10 ? m.toFixed(2) : fmt(m); }
  const tmpState = { levels: {} };
  function withLevel(id, lvl) {
    // Shallow clone with one level changed, for previewing an upgrade's effect.
    Object.assign(tmpState, state);
    tmpState.levels = Object.assign({}, state.levels);
    tmpState.levels[id] = lvl;
    return tmpState;
  }

  let shopDirty = true;
  let lastShopUpdate = 0;
  function updateShop(force) {
    const t = performance.now();
    if (!force && !shopDirty && t - lastShopUpdate < 120) return;
    lastShopUpdate = t;
    const mode = state.settings.buyMode;
    C.upgrades.forEach(function (u) {
      const c = cards[u.id];
      const lvl = state.levels[u.id];
      const q = PS.bulkQuote(state, u.id, mode);
      const maxed = lvl >= u.max;
      const can = !maxed && q.cost <= state.matter;
      setHTML(c.lv, ' ' + lvl + '/' + u.max);
      if (maxed) setHTML(c.cost, 'MAX');
      else setHTML(c.cost, fmt(q.cost) + (q.n > 1 ? '<small>×' + q.n + '</small>' : ''));
      if (shopDirty || force) setHTML(c.fx, effectText(u.id, lvl));
      const firstTime = can && !state.milestones['buy_' + u.id];
      const cls = 'card ' + (maxed ? 'max' : can ? 'can' : 'cant') + (firstTime ? ' new' : '');
      if (c.cls !== cls) { c.cls = cls; c.b.className = cls; }
      c.b.setAttribute('aria-disabled', can ? 'false' : 'true');
    });
    shopDirty = false;
  }

  function tryBuy(id, node) {
    Sound.unlock();
    const n = PS.buy(state, id, state.settings.buyMode);
    if (!n) {
      Sound.deny();
      return;
    }
    PS.mark(state, 'buy_' + id);
    PS.mark(state, 'firstBuy');
    PS.checkProgress(state, ev);
    refreshStats();
    shopDirty = true;
    updateShop(true);
    node = node || cards[id].b;
    node.classList.remove('bought'); void node.offsetWidth; node.classList.add('bought');
    Sound.buy();
    fx.buyFlash = 1;
    if (id === 'drones') syncDrones();
    save();
  }

  function setBuyMode(m) {
    state.settings.buyMode = m;
    document.querySelectorAll('.buy-mode button').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.mode) === m); });
    shopDirty = true;
    updateShop(true);
  }

  // Collapse card -------------------------------------------------------------
  let collapseKey = '';
  function updateCollapseCard() {
    const gain = PS.stardustFor(state);
    const can = PS.canCollapse(state);
    const minName = PS.sectorInfo(C.collapse.minSector).name;
    const next = C.research.find(function (r) { return state.stardust < r.at; });
    const nextLine = next ? 'Next unlock: <b>' + next.name + '</b> at <span class="sd">' + next.at + ' ✦</span>' : 'All Stardust research unlocked';
    let key, html;
    if (!can) {
      const pct = Math.min(1, state.runTotal / PS.sectorInfo(C.collapse.minSector).at);
      key = 'L' + Math.floor(pct * 100) + state.stardust;
      html = '<div class="row"><span class="ct">Collapse</span><span class="cs">' + (state.stardust ? '<span class="sd">' + state.stardust + ' ✦</span> ×' + stats.sdMult.toFixed(2) : 'Locked') + '</span></div>' +
        '<div class="cs">Reach <b>' + minName + '</b> to fold this universe into permanent Stardust.</div>' +
        '<div class="mini-bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i></div>' +
        (state.stardust ? '<div class="cs">' + nextLine + '</div>' : '');
    } else {
      key = 'A' + gain + '_' + state.stardust;
      html = '<div class="row"><span class="ct">Collapse ready</span><span class="cs"><span class="sd">' + state.stardust + ' ✦</span></span></div>' +
        '<div class="row"><span class="cs">Gain <span class="sd">+' + gain + ' ✦</span> · Matter ×' + stats.sdMult.toFixed(2) + ' → ×' + (1 + C.collapse.step * (state.stardust + gain)).toFixed(2) + '</span>' +
        '<button class="btn violet" type="button" data-act="collapse">Collapse</button></div>' +
        '<div class="cs">' + nextLine + '</div>';
    }
    if (key !== collapseKey) { collapseKey = key; el.collapse.innerHTML = html; }
  }
  el.collapse.addEventListener('click', function (e) {
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'collapse') openCollapse();
    else openResearch();
  });

  // Milestone bar: always shows the next goal.
  function updateMilestone() {
    let text, val, pct;
    if (!state.milestones.firstBuy && !state.collapses) {
      const cost = PS.upgradeCost('radius', state.levels.radius);
      text = '<b>First upgrade</b> · Wider Event Horizon';
      val = fmt(Math.min(state.matter, cost)) + ' / ' + fmt(cost);
      pct = state.matter / cost;
    } else {
      const nxt = PS.sectorInfo(state.sector + 1);
      const cur = PS.sectorInfo(state.sector);
      text = 'Next sector · <b>' + nxt.name + '</b>';
      val = fmt(state.runTotal) + ' / ' + fmt(nxt.at);
      // Log-scaled within the sector so the bar keeps moving at big numbers.
      const lo = Math.log10(Math.max(1, cur.at)), hi = Math.log10(nxt.at), v = Math.log10(Math.max(1, state.runTotal));
      pct = state.sector === 0 ? state.runTotal / nxt.at : (v - lo) / (hi - lo);
    }
    setHTML(el.msText, text);
    setText(el.msVal, val);
    const w = (Math.max(0, Math.min(1, pct)) * 100).toFixed(1) + '%';
    if (el.msFill.style.width !== w) el.msFill.style.width = w;
  }

  let lastMatterStr = '';
  function updateHud() {
    const m = fmt(state.matter);
    if (m !== lastMatterStr) { lastMatterStr = m; el.matter.textContent = m; }
    const rate = stats.dronePerSec * (world.surge > 0 ? C.comet.surgeMult : 1);
    setText(el.rate, rate > 0 ? '+' + fmt(rate) + '/s passive' : '');
    setText(el.sectorNum, String(state.sector + 1));
    setText(el.sectorName, stats.sector.name);
    setHTML(el.mut, 'Today: <b>' + mutation.name + '</b>');
    if (world.surge > 0) {
      el.surge.hidden = false;
      setText(el.surge, 'SURGE ×' + C.comet.surgeMult + ' · ' + Math.ceil(world.surge) + 's');
      el.universe.classList.add('surging');
    } else if (!el.surge.hidden) {
      el.surge.hidden = true;
      el.universe.classList.remove('surging');
    }
    setText(el.atlasCount, PS.discoveryCount(state) + '/' + C.discoveries.length);
    const cd = Math.max(0, world.cooldown) / C.pulseCooldown;
    const w = (cd * 100).toFixed(0) + '%';
    if (el.pulseCd.style.width !== w) el.pulseCd.style.width = w;
    updateHint();
  }

  let hintMode = null;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  function updateHint() {
    let mode = '', text = '';
    const c = world.comet;
    if (c && !c.caught && Math.abs(c.x) < 1.15 && Math.abs(c.y) < 1) {
      const inRange = Math.hypot(c.x, c.y / 0.82) <= stats.pulseRadius;
      mode = inRange ? 'comet-in' : 'comet';
      text = inRange ? 'Comet in range — pulse now!' : 'A comet! Catch it in your pulse';
    } else if (!state.stats.pulses) {
      mode = 'first'; text = COARSE ? 'Tap anywhere to pulse gravity' : 'Click anywhere or press Space to pulse';
    } else if (state.stats.pulses < 4 && state.stats.captures < 6) {
      mode = 'learn'; text = 'Fragments inside the ring get pulled in';
    }
    if (mode !== hintMode) {
      hintMode = mode;
      if (mode) { el.hint.textContent = text; el.hint.classList.remove('hide'); }
      else el.hint.classList.add('hide');
      el.hint.classList.toggle('comet', mode.indexOf('comet') === 0);
    }
  }

  // Toasts & banner -----------------------------------------------------------
  function toast(html, tone) {
    const t = document.createElement('div');
    t.className = 'toast' + (tone ? ' ' + tone : '');
    t.innerHTML = html;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 3) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 3400);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3800);
  }

  let bannerTimer = 0;
  function banner(kicker, title, sub) {
    el.banner.innerHTML = '<div class="b-kicker">' + kicker + '</div><div class="b-title">' + title + '</div>' + (sub ? '<div class="b-sub">' + sub + '</div>' : '');
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, 3200);
  }

  // Modals --------------------------------------------------------------------
  function openModal(kind, title, body, actions) {
    modalOpen = kind;
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = body;
    el.modalActions.innerHTML = '';
    (actions || []).forEach(function (a) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      if (a.disabled) b.disabled = true;
      b.addEventListener('click', function (e) { e.stopPropagation(); a.fn(b); });
      el.modalActions.appendChild(b);
    });
    el.modal.hidden = false;
    Platform.gameplayStop();
    const first = el.modalActions.querySelector('.btn.primary, .btn.violet, .btn.gold') || el.modalX;
    setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }
  function closeModal() {
    if (!modalOpen) return;
    const kind = modalOpen;
    modalOpen = null;
    el.modal.hidden = true;
    if (kind === 'away' && awayPending) awayPending = null;
    if (state.stats.pulses) Platform.gameplayStart();
  }
  el.modalX.addEventListener('click', closeModal);
  el.modal.addEventListener('pointerdown', function (e) { if (e.target === el.modal) closeModal(); });

  function openCollapse() {
    if (!PS.canCollapse(state)) { openResearch(); return; }
    const gain = PS.stardustFor(state);
    const after = state.stardust + gain;
    const unlocks = C.research.filter(function (r) { return state.stardust < r.at && after >= r.at; });
    const anchor = PS.researchFlags(state).anchor;
    const body =
      '<p>Fold this universe into <b>Stardust</b>. Every future run produces more Matter.</p>' +
      '<div class="big-gain" style="color:var(--violet)">+' + gain + ' ✦ Stardust</div>' +
      '<p>Matter multiplier <b>×' + stats.sdMult.toFixed(2) + '</b> → <b style="color:var(--violet)">×' + (1 + C.collapse.step * after).toFixed(2) + '</b></p>' +
      (unlocks.length ? '<p>Unlocks: ' + unlocks.map(function (r) { return '<b style="color:var(--violet)">' + r.name + '</b> — ' + r.desc; }).join('<br>') + '</p>' : '') +
      '<div class="cols"><div><h3 class="h-reset">Resets</h3><ul><li>Matter (' + fmt(state.matter) + ')</li><li>Upgrade levels' + (anchor ? ' (except Horizon & Density)' : '') + '</li><li>Sector progress</li></ul></div>' +
      '<div><h3 class="h-keep">Stays forever</h3><ul><li>Stardust &amp; its multiplier</li><li>Atlas discoveries &amp; bonus</li><li>Stardust research</li><li>Settings</li></ul></div></div>' +
      '<p class="small">Waiting longer earns more Stardust. There is no rush — Collapse whenever you like.</p>';
    openModal('collapse', 'Collapse this universe?', body, [
      { label: 'Not yet', fn: closeModal },
      { label: 'Collapse for +' + gain + ' ✦', cls: 'violet', fn: function (b) { b.disabled = true; confirmCollapse(); } }
    ]);
  }

  function confirmCollapse() {
    if (collapsing || !PS.canCollapse(state)) return;
    collapsing = true;
    const before = state.stardust;
    const gain = PS.doCollapse(state);
    PS.checkProgress(state, ev);
    save();
    backup();
    closeModal();
    refreshStats();
    world = PS.createWorld(Math.random, state, stats);
    syncDrones();
    fx.collapse = 1.6;
    rebuildBackground(true);
    Sound.collapse();
    Platform.happytime();
    shopDirty = true;
    updateShop(true);
    banner('Universe collapsed', '+' + gain + ' Stardust', 'Matter ×' + stats.sdMult.toFixed(2) + ' · a new universe begins');
    C.research.forEach(function (r) {
      if (before < r.at && state.stardust >= r.at) setTimeout(function () { toast('<b>Research unlocked:</b> ' + r.name + ' — ' + r.desc, 'violet'); }, 1200);
    });
    collapsing = false;
  }

  function openResearch() {
    const flags = PS.researchFlags(state);
    const list = C.research.map(function (r) {
      return '<div class="rnode' + (flags[r.id] ? ' on' : '') + '"><span class="rn">' + r.name + '</span><span class="rc">' + (flags[r.id] ? 'Active' : r.at + ' ✦') + '</span><span class="rd">' + r.desc + '</span></div>';
    }).join('');
    const body = '<p>Collapse a universe after reaching <b>' + PS.sectorInfo(C.collapse.minSector).name + '</b> to earn Stardust. Each ✦ adds <b>+' + Math.round(C.collapse.step * 100) + '% Matter</b> forever, and lifetime Stardust unlocks research.</p>' +
      '<p>You have <b class="sd">' + state.stardust + ' ✦</b> · multiplier <b>×' + stats.sdMult.toFixed(2) + '</b>' + (state.collapses ? ' · ' + state.collapses + ' collapse' + (state.collapses > 1 ? 's' : '') : '') + '</p>' +
      '<div class="research">' + list + '</div>';
    openModal('research', 'Stardust research', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }

  function openAtlas() {
    const n = PS.discoveryCount(state);
    const items = C.discoveries.map(function (d) {
      const got = !!state.discoveries[d.id];
      return '<div class="ae' + (got ? '' : ' locked') + '">' + (got ? atlasIcon(d.id) : '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="8" fill="none" stroke="#27314D" stroke-width="1.6" stroke-dasharray="3 3"/></svg>') +
        '<span class="an">' + (got ? d.name : 'Undiscovered') + '</span><span class="ad">' + d.desc + '</span></div>';
    }).join('');
    const body = '<p>Each discovery permanently adds <b>+' + Math.round(C.atlasStep * 100) + '% Matter</b>, even through Collapse. Current bonus: <b style="color:var(--gold)">×' + stats.atlasMult.toFixed(2) + '</b> (' + n + '/' + C.discoveries.length + ').</p><div class="atlas">' + items + '</div>';
    openModal('atlas', 'Discovery Atlas', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }

  function openMutation() {
    const body = '<p>Every day the universe drifts into a new <b>Cosmic Mutation</b> — a free bonus for that day only. Nothing is lost when it changes.</p>' +
      '<div class="big-gain" style="color:var(--violet);font-size:22px">' + mutation.name + '</div><p><b>' + mutation.desc + '.</b></p>' +
      '<p class="small">A different mutation arrives tomorrow.</p>';
    openModal('mutation', "Today's Cosmic Mutation", body, [{ label: 'Nice', cls: 'primary', fn: closeModal }]);
  }

  function openSettings() {
    const body =
      '<div class="toggle-row"><span>Sound</span><button class="switch' + (state.settings.muted ? '' : ' on') + '" data-set="sound" type="button" aria-label="Sound"></button></div>' +
      '<div class="toggle-row"><span>Reduced motion</span><button class="switch' + (reduced ? ' on' : '') + '" data-set="motion" type="button" aria-label="Reduced motion"></button></div>' +
      '<p class="small" style="margin-top:12px">Pulse: click, tap or Space · Buy: keys 1–5 · Mute: M · Close: Esc<br>Progress saves automatically on this device.</p>' +
      (QS.has('debug') ? '<p class="small">Playtest timings (s): ' + Object.keys(state.milestones).map(function (k) { return k + ' ' + state.milestones[k]; }).join(' · ') + '</p>' : '') +
      '<p class="small">Played ' + playTimeText(state.stats.playTime) + ' · ' + fmt(state.stats.pulses) + ' pulses · best chain ' + state.stats.bestChain + ' · lifetime ' + fmt(state.lifetime) + ' Matter</p>';
    openModal('settings', 'Settings', body, [
      { label: 'Reset all progress', cls: 'danger', fn: confirmReset },
      { label: 'Done', cls: 'primary', fn: closeModal }
    ]);
    el.modalBody.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.set === 'sound') toggleMute();
        else setReduced(!reduced);
        b.classList.toggle('on', b.dataset.set === 'sound' ? !state.settings.muted : reduced);
      });
    });
  }

  function confirmReset() {
    openModal('reset', 'Erase everything?', '<p>This permanently deletes your universe, Stardust, research and Atlas on this device. It cannot be undone.</p>', [
      { label: 'Keep my universe', cls: 'primary', fn: closeModal },
      { label: 'Erase everything', cls: 'danger', fn: function () {
        Platform.remove(SAVE_KEY); Platform.remove(BAK_KEY);
        const settings = state.settings;
        state = PS.createState(now());
        state.settings = settings;
        refreshStats();
        world = PS.createWorld(Math.random, state, stats);
        syncDrones();
        rebuildBackground(true);
        shopDirty = true; collapseKey = '';
        save();
        closeModal();
      } }
    ]);
  }

  function playTimeText(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + 'h ' + m + 'm' : m + 'm ' + Math.floor(s % 60) + 's';
  }

  // Away income ----------------------------------------------------------------
  let awayPending = null;
  function grantAway(ms, viaModal) {
    const a = PS.awayGain(state, stats, ms);
    // Mark the time as consumed before anything else so a refresh can never pay it twice.
    state.lastSeen = now();
    if (a.gain <= 0 || a.ms < 1000) { save(); return; }
    PS.earn(state, a.gain);
    PS.checkProgress(state, ev);
    save();
    if (viaModal && a.ms >= 60000) {
      awayPending = { gain: a.gain, doubled: false };
      const capped = ms > C.offlineCapMs;
      const body = '<p>Your Orbital Drones kept working for <b>' + playTimeText(a.ms / 1000) + '</b>' + (capped ? ' (the 2 h maximum)' : '') + ' at ' + Math.round(stats.offlineRate * 100) + '% speed.</p>' +
        '<div class="big-gain num">+' + fmt(a.gain) + ' Matter</div>' +
        '<p class="small">Away income is capped at 2 hours. Playing is always faster.</p>';
      const actions = [{ label: 'Collect', cls: 'primary', fn: closeModal }];
      if (Platform.canRewarded()) {
        actions.unshift({ label: 'Watch ad: double it', cls: 'gold', fn: function (b) {
          b.disabled = true;
          Platform.rewarded(function (ok) {
            if (ok && awayPending && !awayPending.doubled) {
              awayPending.doubled = true;
              PS.earn(state, awayPending.gain);
              PS.checkProgress(state, ev);
              save();
              toast('<b>Doubled:</b> +' + fmt(awayPending.gain) + ' Matter', 'green');
            }
            closeModal();
          });
        } });
      }
      openModal('away', 'Welcome back', body, actions);
    } else {
      toast('<b>While you were away:</b> +' + fmt(a.gain) + ' Matter', 'green');
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function doPulse() {
    if (modalOpen) return;
    Sound.unlock();
    Platform.gameplayStart();
    PS.pulse(world, state, stats, ev, false);
  }

  el.universe.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    tapPoint = { x: e.offsetX, y: e.offsetY, t: 0 };
    doPulse();
  });
  el.universe.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.pulse.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    el.pulse.classList.add('press');
    doPulse();
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { el.pulse.addEventListener(n, function () { el.pulse.classList.remove('press'); }); });
  el.pulse.addEventListener('click', function (e) { if (e.detail === 0) doPulse(); });  // keyboard activation only

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') { closeModal(); return; }
    if (modalOpen) return;
    if (e.code === 'Space') { e.preventDefault(); doPulse(); return; }
    if (e.repeat) return;
    const n = Number(e.key);
    if (n >= 1 && n <= C.upgrades.length) { tryBuy(C.upgrades[n - 1].id); return; }
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });
  document.addEventListener('keyup', function (e) { if (e.code === 'Space' && !modalOpen) e.preventDefault(); });

  document.querySelectorAll('.buy-mode button').forEach(function (b) {
    b.addEventListener('click', function () { setBuyMode(Number(b.dataset.mode)); save(); });
  });
  el.atlasBtn.addEventListener('click', openAtlas);
  el.settings.addEventListener('click', openSettings);
  el.sound.addEventListener('click', toggleMute);
  el.mut.addEventListener('click', function (e) { e.stopPropagation(); openMutation(); });
  el.mut.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  function toggleMute() {
    state.settings.muted = !state.settings.muted;
    Sound.unlock();
    Sound.setMuted(state.settings.muted);
    el.sound.classList.toggle('muted', state.settings.muted);
    el.sound.setAttribute('aria-label', state.settings.muted ? 'Unmute sound' : 'Mute sound');
    save();
  }

  function setReduced(v) {
    reduced = v;
    state.settings.reducedMotion = v;
    document.body.classList.toggle('reduced', v);
    save();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, S = 100, K = 1;
  let bg = null, bgPrev = null;
  const fx = { shake: 0, gulp: 0, flash: 0, buyFlash: 0, collapse: 0, bgFade: 1 };
  let tapPoint = null;
  const twinkles = [];
  const particles = [];
  const floats = [];
  let drones = [];
  const MAX_PARTICLES = 260, MAX_FLOATS = 28;

  function resize() {
    const r = el.universe.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    el.cv.width = Math.round(W * DPR);
    el.cv.height = Math.round(H * DPR);
    CX = W / 2;
    CY = H / 2 + Math.min(14, H * 0.03);
    S = Math.min(W / 2 / 1.06, H / 2 / (1.06 * 0.82));
    K = Math.max(0.75, Math.min(1.9, S / 210));
    rebuildBackground(false);
  }

  function sprite(color, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, color);
    grd.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
    grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }
  const GLOW = {
    cyan: sprite('rgba(108,232,255,0.9)', 128),
    gold: sprite('rgba(255,215,131,0.95)', 128),
    violet: sprite('rgba(167,139,250,0.9)', 128),
    coral: sprite('rgba(255,139,152,0.9)', 64),
    white: sprite('rgba(255,250,235,1)', 64)
  };

  function rebuildBackground(animate) {
    if (!W) return;
    const sec = PS.sectorInfo(state.sector);
    const pal = PALETTES[sec.palette];
    if (animate && bg) { bgPrev = bg; fx.bgFade = 0; } else { bgPrev = null; fx.bgFade = 1; }
    const c = document.createElement('canvas');
    c.width = el.cv.width; c.height = el.cv.height;
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    if (sec.tier > 0 && 'filter' in g) g.filter = 'hue-rotate(' + (sec.tier * 38) + 'deg)';
    const rng = PS.mulberry32(1000 + sec.index * 7919);
    const grd = g.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.75);
    grd.addColorStop(0, pal.bg[0]);
    grd.addColorStop(1, pal.bg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // Nebula clouds.
    for (let i = 0; i < 7; i++) {
      const x = rng() * W, y = rng() * H, r = (0.25 + rng() * 0.45) * Math.max(W, H);
      const col = pal.neb[i % pal.neb.length];
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, hexA(col, 0.16 + rng() * 0.1));
      ng.addColorStop(1, hexA(col, 0));
      g.fillStyle = ng;
      g.fillRect(0, 0, W, H);
    }
    ambient(g, pal.ambient, rng);
    // Static stars.
    const n = Math.round(pal.stars * (W * H) / (580 * 400));
    for (let i = 0; i < n; i++) {
      const x = rng() * W, y = rng() * H, s = rng();
      g.globalAlpha = 0.15 + s * 0.45;
      g.fillStyle = s > 0.92 ? pal.star : '#AFC0E6';
      g.fillRect(x, y, s > 0.85 ? 1.6 : 1, s > 0.85 ? 1.6 : 1);
    }
    g.globalAlpha = 1;
    bg = c;
    twinkles.length = 0;
    for (let i = 0; i < 34; i++) twinkles.push({ x: rng() * W, y: rng() * H, p: rng() * 6.28, s: 0.6 + rng() * 1.6 });
  }

  function ambient(g, kind, rng) {
    g.save();
    if (kind === 'belt') {
      // A tilted band of faint broken rock.
      g.translate(CX, CY); g.rotate(-0.32);
      for (let i = 0; i < 260; i++) {
        const a = rng() * Math.PI * 2, rr = S * (1.25 + (rng() - 0.5) * 0.16);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.28;
        g.globalAlpha = 0.08 + rng() * 0.18;
        g.fillStyle = rng() > 0.5 ? '#8f86c8' : '#5d6aa8';
        const s = 0.8 + rng() * 2.2;
        g.fillRect(x, y, s, s * (0.6 + rng()));
      }
    } else if (kind === 'moon') {
      const r = Math.max(W, H) * 0.2, x = W * 0.86, y = H * 0.16;
      const mg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      mg.addColorStop(0, 'rgba(210,244,255,0.20)');
      mg.addColorStop(1, 'rgba(90,160,200,0.05)');
      g.fillStyle = mg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(8,20,36,0.18)';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + (rng() - 0.5) * r * 1.3, y + (rng() - 0.5) * r * 1.3, r * (0.05 + rng() * 0.13), 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(200,240,255,0.12)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    } else if (kind === 'nebula') {
      // Long swirling filaments around the core.
      g.translate(CX, CY);
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        const off = rng() * 6.28, rr0 = S * (0.7 + rng() * 0.8);
        for (let t = 0; t < 1; t += 0.02) {
          const a = off + t * 3.4, rr = rr0 * (0.6 + t * 0.6);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.6;
          if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = k % 2 ? 'rgba(220,120,200,0.07)' : 'rgba(167,139,250,0.08)';
        g.lineWidth = 10 + rng() * 26;
        g.lineCap = 'round';
        g.stroke();
      }
    } else if (kind === 'nursery') {
      // Bright young stars with diffraction spikes.
      for (let i = 0; i < 9; i++) {
        const x = rng() * W, y = rng() * H, s = 3 + rng() * 7;
        if (Math.hypot(x - CX, y - CY) < S * 0.6) continue;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(GLOW.gold, x - s * 3, y - s * 3, s * 6, s * 6);
        g.strokeStyle = 'rgba(255,230,180,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - s * 3, y); g.lineTo(x + s * 3, y); g.moveTo(x, y - s * 3); g.lineTo(x, y + s * 3); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    } else {
      // Dust Cloud: soft drifting haze lanes.
      g.translate(CX, CY); g.rotate(0.2);
      for (let i = 0; i < 3; i++) {
        const hg = g.createLinearGradient(0, -S, 0, S);
        hg.addColorStop(0, 'rgba(110,150,220,0)');
        hg.addColorStop(0.5, 'rgba(110,150,220,0.025)');
        hg.addColorStop(1, 'rgba(110,150,220,0)');
        g.fillStyle = hg;
        g.fillRect(-W, (rng() - 0.5) * S * 1.4, W * 2, S * (0.3 + rng() * 0.3));
      }
    }
    g.restore();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
  }

  function sx(x) { return CX + x * S; }
  function sy(y) { return CY + y * S; }

  function syncDrones() {
    const n = Math.min(24, state.levels.drones);
    while (drones.length < n) drones.push({ a: Math.random() * 6.28, r: 1.9 + Math.random() * 1.3, s: 0.5 + Math.random() * 0.6, tilt: (Math.random() - 0.5) * 0.6, t: Math.random() });
    drones.length = n;
  }

  function addParticle(x, y, vx, vy, life, color, size) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, color: color, size: size });
  }

  function addFloat(text, x, y, color, size, life) {
    if (floats.length >= MAX_FLOATS) floats.shift();
    floats.push({ text: text, x: x, y: y, color: color, size: size, life: life || 1.1, max: life || 1.1 });
  }

  const TYPE_COLOR = { dust: COL.dust, ice: COL.ice, crystal: COL.gold, shard: COL.coral };

  function handleEvents() {
    const coreR = PS.coreRadius(state) * S;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.t) {
        case 'pulse':
          Sound.pulse(e.auto);
          if (!e.auto) { fx.flash = 1; el.pulse.classList.add('press'); setTimeout(function () { el.pulse.classList.remove('press'); }, 90); }
          break;
        case 'capture': {
          fx.gulp = Math.min(1, fx.gulp + 0.25);
          Sound.capture(e.idx, e.type);
          const n = reduced ? 2 : e.type === 'crystal' ? 10 : 4;
          for (let k = 0; k < n; k++) {
            const a = Math.random() * 6.28, sp = (40 + Math.random() * 90) * K;
            addParticle(CX + Math.cos(a) * coreR, CY + Math.sin(a) * coreR * 0.82, Math.cos(a) * sp, Math.sin(a) * sp, 0.45 + Math.random() * 0.3, TYPE_COLOR[e.type], (1 + Math.random() * 1.4) * K);
          }
          // Only rare captures get their own number; the chain payout carries the rest.
          if (e.type === 'crystal' || e.type === 'shard') {
            const a = (e.type === 'crystal' ? -0.6 : 0.6) + (Math.random() - 0.5) * 0.5;
            addFloat('+' + fmt(e.value), CX + Math.sin(a) * coreR * 3, CY - coreR * 1.2, TYPE_COLOR[e.type], 12 * Math.min(1.3, K), 0.9);
          }
          break;
        }
        case 'swallow':
          fx.gulp = Math.min(1, fx.gulp + 0.12);
          Sound.swallow();
          break;
        case 'blast': {
          Sound.blast();
          const bx = sx(e.x), by = sy(e.y);
          particleRing(bx, by, e.r * S, COL.coral, reduced ? 6 : 18);
          blasts.push({ x: bx, y: by, r: e.r * S, t: 0 });
          break;
        }
        case 'payout':
          if (e.chain >= 2 || e.total > 0) {
            const big = e.chain >= 12 ? 1.7 : e.chain >= 5 ? 1.35 : 1;
            const color = e.chain >= 12 ? COL.gold : e.chain >= 5 ? COL.violet : COL.cyan;
            const fy = Math.max(70, CY - coreR * 2.6 - 6);
            addFloat('+' + fmt(e.total), CX, fy, COL.text, 17 * big * Math.min(1.3, K), 1.3);
            if (e.chain >= 2) addFloat('CHAIN ×' + e.chain + '  ·  ×' + e.mult.toFixed(2), CX, fy + 20 * big, color, 11 * big * Math.min(1.25, K), 1.3);
            if (e.chain >= 8 && !reduced && !e.auto) fx.shake = Math.min(1, 0.3 + e.chain * 0.03);
            if (!e.auto) Sound.payout(e.chain);
            el.matter.classList.remove('bump'); void el.matter.offsetWidth; el.matter.classList.add('bump');
          }
          break;
        case 'comet':
          Sound.comet();
          break;
        case 'surge':
          Sound.surge();
          fx.flash = 1.5;
          particleRing(CX, CY, coreR * 2, COL.gold, reduced ? 10 : 40);
          banner('Comet captured', 'Surge ×' + C.comet.surgeMult, 'All Matter ×' + C.comet.surgeMult + ' for ' + Math.round(e.dur) + ' seconds');
          Platform.happytime();
          break;
        case 'sector': {
          const sec = PS.sectorInfo(e.index);
          Sound.sector();
          rebuildBackground(true);
          refreshStats();
          shopDirty = true;
          const news = SECTOR_NEWS[e.index] || 'Fragments worth more';
          banner('Sector ' + (e.index + 1) + ' revealed', sec.name, news + ' · ×' + sec.value.toFixed(sec.value % 1 ? 2 : 0));
          Platform.happytime();
          break;
        }
        case 'discover': {
          const d = C.discoveries.find(function (x) { return x.id === e.id; });
          refreshStats();
          shopDirty = true;
          if (d) {
            setTimeout(function () { Sound.discover(); toast('<b>Discovery · ' + d.name + '</b><br>+' + Math.round(C.atlasStep * 100) + '% Matter forever'); }, 250);
            el.atlasBtn.classList.remove('flash'); void el.atlasBtn.offsetWidth; el.atlasBtn.classList.add('flash');
          }
          break;
        }
      }
    }
    ev.length = 0;
  }

  const blasts = [];
  function particleRing(x, y, r, color, n) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.28 + Math.random() * 0.2, sp = (60 + Math.random() * 120) * K;
      addParticle(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, 0.6 + Math.random() * 0.4, color, (1.2 + Math.random() * 1.6) * K);
    }
  }

  function draw(dt, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let ox = 0, oy = 0;
    if (fx.shake > 0) {
      const a = fx.shake * 4 * K;
      ox = (Math.random() - 0.5) * a; oy = (Math.random() - 0.5) * a;
      fx.shake = Math.max(0, fx.shake - dt * 4);
    }
    // Background (cross-fades on sector change).
    if (bg) {
      if (bgPrev && fx.bgFade < 1) {
        ctx.drawImage(bgPrev, 0, 0, W, H);
        ctx.globalAlpha = fx.bgFade;
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.globalAlpha = 1;
        fx.bgFade = Math.min(1, fx.bgFade + dt / 1.6);
      } else ctx.drawImage(bg, 0, 0, W, H);
    }
    ctx.save();
    ctx.translate(ox, oy);
    for (const s of twinkles) {
      const a = 0.25 + 0.35 * Math.sin(t * s.s + s.p);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#DCE6FF';
      ctx.fillRect(s.x, s.y, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;

    const coreR = PS.coreRadius(state) * S;
    const surge = world.surge > 0;
    const accent = surge ? COL.gold : COL.cyan;

    // Pulse range: a quiet ellipse so the player can see what a pulse will reach.
    const R = stats.pulseRadius * S;
    const cometIn = world.comet && !world.comet.caught && Math.hypot(world.comet.x, world.comet.y / 0.82) <= stats.pulseRadius;
    const ready = world.cooldown <= 0;
    ctx.setLineDash([4 * K, 6 * K]);
    ctx.lineDashOffset = -t * 8;
    ctx.strokeStyle = cometIn ? hexA(COL.gold, 0.55 + 0.25 * Math.sin(t * 10)) : hexA(surge ? COL.gold : COL.cyan, ready ? 0.22 : 0.1);
    ctx.lineWidth = cometIn ? 1.6 : 1;
    ctx.beginPath(); ctx.ellipse(CX, CY, R, R * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Tap feedback at the touch point (the gravity well itself is always the core).
    if (tapPoint && !reduced) {
      tapPoint.t += dt;
      const p = tapPoint.t / 0.3;
      if (p >= 1) tapPoint = null;
      else {
        ctx.strokeStyle = hexA(COL.cyan, 0.35 * (1 - p));
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tapPoint.x, tapPoint.y, 6 + p * 16, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Pulse rings.
    for (const r of world.rings) {
      const rr = Math.min(r.max, r.t * C.ringSpeed) * S;
      const life = r.max / C.ringSpeed + 0.45;
      const a = Math.max(0, 1 - r.t / life);
      const col = r.auto ? COL.violet : accent;
      ctx.globalAlpha = a * (r.auto ? 0.5 : 0.9);
      ctx.strokeStyle = col;
      ctx.lineWidth = (r.auto ? 1.5 : 2.5) * K * (0.6 + a);
      ctx.beginPath(); ctx.ellipse(CX, CY, Math.max(1, rr), Math.max(1, rr * 0.82), 0, 0, Math.PI * 2); ctx.stroke();
      if (!r.auto) {
        ctx.globalAlpha = a * 0.08;
        ctx.fillStyle = col;
        ctx.fill();
        const rr2 = Math.max(1, rr * 0.82);
        ctx.globalAlpha = a * 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(CX, CY, rr2, rr2 * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Shard blasts.
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.t += dt;
      const p = b.t / 0.35;
      if (p >= 1) { blasts.splice(i, 1); continue; }
      ctx.strokeStyle = hexA(COL.coral, 0.7 * (1 - p));
      ctx.lineWidth = 2 * K;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * p + 1, b.r * p * 0.82 + 1, 0, 0, Math.PI * 2); ctx.stroke();
    }

    drawDisk(t, coreR, true);

    // Fragments.
    for (const f of world.frags) drawFragment(f, t);

    drawCore(t, coreR, surge);
    fx.gulp = Math.max(0, fx.gulp - dt * 5);
    fx.flash = Math.max(0, fx.flash - dt * 3);
    drawDisk(t, coreR, false);
    drawDrones(dt, coreR);
    drawComet(t);

    // Particles.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Floating numbers.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      const p = 1 - f.life / f.max;
      const rise = (reduced ? 10 : 26) * p * K;
      const pop = p < 0.12 ? 0.75 + p / 0.12 * 0.25 : 1;
      ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      ctx.font = '800 ' + Math.round(f.size * pop) + 'px ' + getComputedFont();
      ctx.fillStyle = 'rgba(8,11,22,0.65)';
      ctx.fillText(f.text, f.x + 1, f.y - rise + 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - rise);
    }
    ctx.globalAlpha = 1;

    // Collapse flash.
    if (fx.collapse > 0) {
      ctx.globalAlpha = Math.min(1, fx.collapse) * 0.8;
      ctx.fillStyle = '#05040c';
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.globalCompositeOperation = 'lighter';
      const s = (1.6 - fx.collapse) * Math.max(W, H) * 1.2;
      ctx.drawImage(GLOW.violet, CX - s / 2, CY - s / 2, s, s);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      fx.collapse -= dt;
    }
    ctx.restore();
  }

  let fontCache = '';
  function getComputedFont() {
    if (!fontCache) fontCache = getComputedStyle(document.body).fontFamily || 'sans-serif';
    return fontCache;
  }

  function drawFragment(f, t) {
    const p = PS.fragPos(f);
    const x = sx(p.x), y = sy(p.y);
    const falling = f.state === PS.FALL && f.delay <= 0;
    let a = f.alpha * (f.inRange || f.state === PS.FALL ? 1 : 0.72);
    if (falling) {
      // Streak toward the core.
      if (f.lx !== undefined) {
        ctx.strokeStyle = TYPE_COLOR[f.type];
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6 * K;
        ctx.beginPath(); ctx.moveTo(f.lx, f.ly); ctx.lineTo(x, y); ctx.stroke();
      }
      f.lx = x; f.ly = y;
      const pr = Math.min(1, f.t / f.dur);
      a *= 1 - pr * 0.3;
    } else if (f.state === PS.FALL) {
      a = 1;  // caught, ring still travelling to it
    }
    const sz = f.size * K * (falling ? 1 - Math.min(1, f.t / f.dur) * 0.5 : 1);
    ctx.globalAlpha = a;
    switch (f.type) {
      case 'dust':
        ctx.fillStyle = COL.dust;
        ctx.beginPath(); ctx.arc(x, y, 2.9 * sz, 0, Math.PI * 2); ctx.fill();
        break;
      case 'ice':
        ctx.fillStyle = COL.ice;
        ctx.beginPath(); ctx.arc(x, y, 3.6 * sz, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#E8FDFF'; ctx.lineWidth = 1.1;
        ctx.stroke();
        break;
      case 'crystal': {
        ctx.globalCompositeOperation = 'lighter';
        const gs = 22 * sz * (0.9 + 0.15 * Math.sin(t * 3 + f.wob));
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(GLOW.gold, x - gs / 2, y - gs / 2, gs, gs);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a;
        const s = 5.6 * sz;
        ctx.fillStyle = COL.gold;
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 0.75, y); ctx.lineTo(x, y + s * 1.2); ctx.lineTo(x - s * 0.75, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 0.3, y - s * 0.2); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
        break;
      }
      case 'shard': {
        const s = 5 * sz, flick = 0.85 + 0.15 * Math.sin(t * 13 + f.wob);
        ctx.globalAlpha = a * flick;
        ctx.fillStyle = COL.coral;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = f.spin + k * Math.PI / 3;
          const px = x + Math.cos(ang) * s, py = y + Math.sin(ang) * s;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(40,10,16,0.55)';
        ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDisk(t, coreR, back) {
    // Accretion disk: back half is drawn behind fragments and core, front half in front.
    const stage = PS.coreStage(state);
    const rings = 3 + stage;
    const tilt = 0.32;
    const s0 = back ? Math.PI : 0, s1 = back ? Math.PI * 2 : Math.PI;
    for (let i = 0; i < rings; i++) {
      const rr = coreR * (1.4 + i * 0.36);
      const k = i / Math.max(1, rings - 1);
      const col = stage >= 3 && i === 0 ? COL.gold : k < 0.5 ? COL.cyan : COL.violet;
      // Solid faint base ring, then a brighter rotating dashed layer on top.
      ctx.strokeStyle = hexA(col, (0.32 - k * 0.2) * (back ? 0.6 : 1));
      ctx.lineWidth = Math.max(1, (3.2 - k * 1.6) * K);
      ctx.beginPath(); ctx.ellipse(CX, CY, rr, rr * tilt, -0.12, s0, s1); ctx.stroke();
      ctx.strokeStyle = hexA(col, (0.75 - k * 0.4) * (back ? 0.6 : 1));
      ctx.lineWidth = Math.max(1, (2 - k * 0.9) * K);
      ctx.setLineDash([coreR * (1.4 + k), coreR * (0.5 + k * 0.6)]);
      ctx.lineDashOffset = -t * coreR * (2.2 - k * 1.2) * (i % 2 ? 1 : 1.3);
      ctx.beginPath(); ctx.ellipse(CX, CY, rr, rr * tilt, -0.12, s0, s1); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawCore(t, coreR, surge) {
    const gulp = fx.gulp, flash = fx.flash;
    const r = coreR * (1 + gulp * 0.09 + flash * 0.04);
    const stage = PS.coreStage(state);
    ctx.globalCompositeOperation = 'lighter';
    const gs = r * (5.4 + flash * 1.6 + gulp * 0.8) * (1 + 0.03 * Math.sin(t * 2));
    ctx.globalAlpha = 0.42 + flash * 0.25;
    ctx.drawImage(surge ? GLOW.gold : GLOW.cyan, CX - gs / 2, CY - gs / 2, gs, gs);
    if (stage >= 4 || state.stardust > 0) {
      const vs = gs * 1.5;
      ctx.globalAlpha = 0.18;
      ctx.drawImage(GLOW.violet, CX - vs / 2, CY - vs / 2, vs, vs);
    }
    if (stage >= 2) {
      // Polar jets.
      const jl = r * (3.2 + stage * 0.6) * (1 + 0.06 * Math.sin(t * 5));
      const jg = ctx.createLinearGradient(CX, CY - jl, CX, CY + jl);
      jg.addColorStop(0, 'rgba(167,139,250,0)');
      jg.addColorStop(0.5, 'rgba(167,139,250,0.35)');
      jg.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = jg;
      ctx.beginPath(); ctx.moveTo(CX - r * 0.18, CY); ctx.lineTo(CX - r * 0.05, CY - jl); ctx.lineTo(CX + r * 0.05, CY - jl); ctx.lineTo(CX + r * 0.18, CY);
      ctx.lineTo(CX + r * 0.05, CY + jl); ctx.lineTo(CX - r * 0.05, CY + jl); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Event horizon.
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
    // Photon ring.
    ctx.strokeStyle = surge ? COL.gold : COL.cyan;
    ctx.globalAlpha = 0.85 + flash * 0.15;
    ctx.lineWidth = Math.max(1.2, 1.6 * K + flash * 1.5);
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CX, CY, r * 1.12, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  let droneTick = 0;
  function drawDrones(dt, coreR) {
    if (!drones.length) return;
    droneTick += dt;
    const emit = droneTick > 0.5;
    if (emit) droneTick = 0;
    ctx.fillStyle = COL.green;
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      d.a += dt * d.s * (reduced ? 0.4 : 1);
      const x = CX + Math.cos(d.a) * coreR * d.r * 1.25;
      const y = CY + Math.sin(d.a) * coreR * d.r * 0.5 + Math.cos(d.a) * coreR * d.tilt;
      const s = 2.6 * K;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(d.a + Math.PI / 2);
      ctx.globalAlpha = Math.sin(d.a) > 0 ? 0.95 : 0.55;
      ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (emit && i === Math.floor(Math.random() * drones.length) && !reduced) {
        addParticle(x, y, (CX - x) * 2.2, (CY - y) * 2.2, 0.4, COL.green, 1.6 * K);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawComet(t) {
    const c = world.comet;
    if (!c) return;
    const x = sx(c.x), y = sy(c.y);
    const sp = Math.hypot(c.vx, c.vy) || 1;
    const tl = 0.42 * S;
    const tx = x - c.vx / sp * tl, ty = y - c.vy / sp * tl;
    const g = ctx.createLinearGradient(x, y, tx, ty);
    g.addColorStop(0, 'rgba(255,240,200,0.85)');
    g.addColorStop(1, 'rgba(255,215,131,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 4 * K;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineWidth = 1.5 * K;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx + (ty - y) * 0.08, ty - (tx - x) * 0.08); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'lighter';
    const gs = 34 * K * (1 + 0.15 * Math.sin(t * 9));
    ctx.drawImage(GLOW.gold, x - gs / 2, y - gs / 2, gs, gs);
    ctx.drawImage(GLOW.white, x - gs / 4, y - gs / 4, gs / 2, gs / 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let lastFrame = performance.now();
  let saveClock = 0;
  function frame(tNow) {
    requestAnimationFrame(frame);
    const wall = now();
    const gap = wall - lastWall;
    lastWall = wall;
    if (gap > C.awayThresholdMs && !COVER && !Platform.adActive) {
      // The tab was hidden or the device slept: treat the gap as time away.
      grantAway(gap, gap >= 60000 && !modalOpen);
      lastFrame = tNow;
    }
    let dt = (tNow - lastFrame) / 1000;
    lastFrame = tNow;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    if (Platform.adActive) dt = 0;

    // Day rollover while playing.
    if (PS.dayKey(new Date()) !== todayKey) {
      rollMutation(); refreshStats(); shopDirty = true;
      toast('<b>New Cosmic Mutation:</b> ' + mutation.name + ' — ' + mutation.desc, 'violet');
    }

    if (!COVER) PS.step(world, state, stats, dt, ev);
    handleEvents();
    draw(dt, tNow / 1000);
    updateHud();
    updateShop(false);
    updateMilestone();
    updateCollapseCard();

    saveClock += dt;
    if (saveClock > 5) { saveClock = 0; save(); }
    if (performance.now() - lastBackup > 60000) backup();
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function boot() {
    const loaded = loadState();
    state = loaded.state;
    rollMutation();
    refreshStats();
    PS.checkProgress(state, null);
    refreshStats();
    world = PS.createWorld(Math.random, state, stats);
    reduced = state.settings.reducedMotion === null ? matchMedia('(prefers-reduced-motion: reduce)').matches : state.settings.reducedMotion;
    document.body.classList.toggle('reduced', reduced);
    Sound.setMuted(state.settings.muted);
    el.sound.classList.toggle('muted', state.settings.muted);
    buildShop();
    setBuyMode(state.settings.buyMode);
    syncDrones();
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(el.universe);
    else window.addEventListener('resize', resize);

    if (COVER) setupCover();

    // Time away since the last save.
    if (!loaded.fresh && !COVER) {
      const away = now() - state.lastSeen;
      if (away < 0) state.lastSeen = now();   // clock moved backwards: grant nothing
      else if (away > C.awayThresholdMs) grantAway(away, true);
    }
    if (loaded.notice) setTimeout(function () { toast('<b>Save:</b> ' + loaded.notice, 'violet'); }, 600);
    if (!COVER) { save(); backup(); }

    lastWall = now();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
    Platform.loadingStop();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { save(); Sound.suspend(); Platform.gameplayStop(); }
      else { Sound.resume(); if (state.stats.pulses && !modalOpen) Platform.gameplayStart(); }
    });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);

    Platform.on('ready', function () {
      Platform.loadingStop();
      // Adopt a cloud save only if it is further along than what we loaded.
      const cloud = PS.parseSave(Platform.getCloud(SAVE_KEY), now());
      if (cloud && cloud.ok && cloud.state.lifetime > state.lifetime + 1) {
        state = cloud.state;
        refreshStats();
        world = PS.createWorld(Math.random, state, stats);
        syncDrones(); rebuildBackground(false); shopDirty = true; collapseKey = '';
        Sound.setMuted(state.settings.muted);
        toast('<b>Save:</b> loaded your synced universe.', 'violet');
      }
      save();
    });
    Platform.on('mute', function (m) { Sound.setExternalMute(m); });
    Platform.on('pause', function (p) { if (p) Sound.setExternalMute(true); else Sound.setExternalMute(false); });

    // Debug/test handle. Single-player only; nothing here can affect other players.
    window.__ps = {
      get state() { return state; }, get world() { return world; }, get stats() { return stats; },
      PS: PS, save: save, refresh: function () { refreshStats(); shopDirty = true; syncDrones(); rebuildBackground(false); collapseKey = ''; },
      pulse: doPulse,
      freeze: function () { frozen = true; }
    };
  }

  // Staged scene for store art: `index.html?cover=1`.
  function setupCover() {
    document.body.classList.add('cover');
    const tag = document.createElement('div');
    tag.className = 'cover-title';
    tag.innerHTML = '<div class="ct1">Pocket</div><div class="ct2">Singularity</div>';
    el.universe.appendChild(tag);
    const sector = Number(QS.get('sector') || 3);
    state.lifetime = 5e9; state.stardust = 6;
    state.levels.drones = 9;
    state.runTotal = PS.sectorInfo(sector).at; state.sector = sector;
    refreshStats();
    syncDrones();
    rebuildBackground(false);
    const rng = PS.mulberry32(7);
    world = PS.createWorld(rng, state, stats);
    const types = ['dust', 'dust', 'ice', 'ice', 'crystal', 'shard', 'dust', 'ice'];
    world.frags.length = 0;
    for (let i = 0; i < 46; i++) {
      world.frags.push({ type: types[i % types.length], r: 0.3 + rng() * 0.75, a: rng() * 6.28, size: 0.9 + rng() * 0.5, spin: rng() * 6, wob: rng() * 6, state: PS.ORBIT, alpha: 1, inRange: true, t: 0, delay: 0, dur: 1, r0: 0, a0: 0 });
    }
    world.rings.push({ t: 0.18, max: 0.9, auto: false });
    world.comet = { x: 0.7, y: -0.42, vx: -0.2, vy: 0.08, t: 0, life: 99, caught: false, fall: 0 };
  }

  boot();
})();
