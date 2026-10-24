/* Pocket Singularity — browser shell: pixel rendering, UI, input, saves.
 * Game rules live in core.js; this file only reads the authoritative `state` and draws it.
 */
(function () {
  'use strict';

  const PS = window.PS;
  const SPR = window.PSSprites;
  const Sound = window.PSAudio;
  const Platform = window.PSPlatform;
  const C = PS.CONFIG;
  const P = SPR.PAL;
  const fmt = PS.fmt;

  const SAVE_KEY = 'pocket-singularity:save';
  const BAK_KEY = 'pocket-singularity:backup';
  const BAD_KEY = 'pocket-singularity:corrupt';
  const QS = new URLSearchParams(location.search);
  const COVER = QS.has('cover');
  const RARITY_COL = ['#94b0c2', '#41a6f6', '#a884f3', '#ffcd75'];

  // Sector looks: dithered sky gradient stops and an ambient scene (all palette keys).
  const SKIES = [
    { stops: ['k', '0', '8'], neb: ['8', 'f'], ambient: 'planet' },
    { stops: ['k', '0', 'f'], neb: ['f', '8'], ambient: 'belt' },
    { stops: ['k', '0', '7'], neb: ['8', '7'], ambient: 'moon' },
    { stops: ['k', '0', '1'], neb: ['1', 'f'], ambient: 'nebula' },
    { stops: ['k', '0', '1'], neb: ['2', '1'], ambient: 'nursery' }
  ];
  const SECTOR_NEWS = [
    '',
    'Unstable shards appear: they burst and drag neighbours in',
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
      if (bak && bak.ok && (main.broken || bak.state.lifetime > main.state.lifetime)) { res = bak; notice = 'Your save was damaged, so the latest backup was restored.'; }
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
    universe: $('universe'), cv: $('cv'), matter: $('matter'), rate: $('rate'), singuLv: $('singu-lv'), xp: $('xp-fill'),
    sectorNum: $('sector-num'), sectorName: $('sector-name'), mut: $('mutation-chip'),
    surge: $('surge'), banner: $('banner'), toasts: $('toasts'), hint: $('hint'),
    reel: $('reel'), reelResult: $('reel-result'), reelFill: $('reel-fill'), reelVal: $('reel-val'),
    oc: $('overcharge'), ocTimer: $('oc-timer'),
    pulse: $('btn-pulse'), pulseCd: $('pulse-cd'), msText: $('ms-text'), msVal: $('ms-val'), msFill: $('ms-fill'),
    shop: $('shop'), collapse: $('collapse-card'), atlasBtn: $('btn-atlas'), atlasCount: $('atlas-count'),
    tickets: $('btn-tickets'), ticketCount: $('ticket-count'),
    sound: $('btn-sound'), settings: $('btn-settings'),
    capBadge: $('cap-badge'), mTickets: $('m-tickets'), pull1: $('pull1'), pull10: $('pull10'), daily: $('daily'),
    odds: $('odds'), collection: $('collection'), colCount: $('col-count'), machine: $('machine-art'),
    modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalActions: $('modal-actions'), modalX: $('modal-x')
  };
  const ctx = el.cv.getContext('2d', { alpha: false });

  // Sets text only when it changed, so per-frame UI updates never thrash the DOM.
  const textCache = new WeakMap();
  function setText(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.textContent = s; } }
  function setHTML(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.innerHTML = s; } }
  function setWidth(node, frac) {
    const w = (Math.max(0, Math.min(1, frac || 0)) * 100).toFixed(1) + '%';
    if (node.style.width !== w) node.style.width = w;
  }

  function staticArt() {
    $('brand-icon').src = SPR.url('singu', 2);
    $('ticket-icon').innerHTML = SPR.img('ticket', 1.5);
    $('atlas-icon').innerHTML = SPR.img('star', 2);
    $('m-ticket-icon').innerHTML = SPR.img('ticket', 1.5);
    el.machine.innerHTML = SPR.img('machine', 3);
    el.reel.querySelectorAll('.slot img').forEach(function (img) { img.src = SPR.url('singu', 1); });
  }

  // Shop cards are built once; updates only touch text and classes.
  const cards = {};
  function buildShop() {
    el.shop.innerHTML = '';
    C.upgrades.forEach(function (u, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.title = u.name + ': ' + u.desc + ' (key ' + (i + 1) + ')';
      btn.innerHTML = '<span class="ic">' + SPR.img('up_' + u.id, 2) + '</span>' +
        '<span class="nm">' + u.name + '<span class="lv num"></span></span>' +
        '<span class="cost num"></span><span class="fx"></span><span class="key">' + (i + 1) + '</span>';
      btn.addEventListener('click', function (e) { e.stopPropagation(); tryBuy(u.id, btn); });
      el.shop.appendChild(btn);
      cards[u.id] = { b: btn, lv: btn.querySelector('.lv'), cost: btn.querySelector('.cost'), fx: btn.querySelector('.fx'), cls: '' };
    });
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
  function effectText(id, lvl) {
    const s0 = PS.derive(withLevel(id, lvl), mutation);
    const s1 = PS.derive(withLevel(id, lvl + 1), mutation);
    const max = lvl >= PS.UPG[id].max;
    const pair = (a, c) => max ? '<em>' + a + '</em>' : a + ' > <em>' + c + '</em>';
    switch (id) {
      case 'radius': return 'Reach ' + pair(Math.round(s0.pulseRadius * 100) + '%', Math.round(s1.pulseRadius * 100) + '%');
      case 'density': return 'Inflow ' + pair(s0.spawnRate.toFixed(1) + '/s', s1.spawnRate.toFixed(1) + '/s');
      case 'drones': return 'Passive ' + pair('+' + fmt(s0.dronePerSec) + '/s', '+' + fmt(s1.dronePerSec) + '/s');
      case 'resonance': return 'Chain ' + pair('+' + Math.round(s0.chainStep * 100) + '%', '+' + Math.round(s1.chainStep * 100) + '%') + ' each';
      case 'focus': return 'Value ' + pair('×' + fmtMult(s0.focusMult), '×' + fmtMult(s1.focusMult));
      case 'luck': return 'Lucky ' + pair(Math.round(s0.luckChance * 100) + '%', Math.round(s1.luckChance * 100) + '%') + ' · reel ' + Math.round(max ? s0.reelNeed : s1.reelNeed);
    }
    return '';
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
      setHTML(c.lv, u.max >= 100 ? ' Lv ' + lvl : ' ' + lvl + '/' + u.max);
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
    if (!n) { Sound.deny(); return; }
    PS.mark(state, 'buy_' + id);
    PS.mark(state, 'firstBuy');
    PS.checkProgress(state, ev);
    refreshStats();
    shopDirty = true;
    updateShop(true);
    node = node || cards[id].b;
    node.classList.remove('bought'); void node.offsetWidth; node.classList.add('bought');
    Sound.buy();
    if (id === 'drones') syncDrones();
    save();
  }

  function setBuyMode(m) {
    state.settings.buyMode = m;
    document.querySelectorAll('.buy-mode button').forEach(function (btn) { btn.classList.toggle('on', Number(btn.dataset.mode) === m); });
    shopDirty = true;
    updateShop(true);
  }

  // Tabs ------------------------------------------------------------------------
  let tab = 'upgrades';
  function setTab(name) {
    tab = name;
    document.querySelectorAll('.tab').forEach(function (btn) { btn.classList.toggle('on', btn.dataset.tab === name); });
    $('tab-upgrades').hidden = name !== 'upgrades';
    $('tab-capsules').hidden = name !== 'capsules';
    if (name === 'capsules') { collectionKey = ''; updateCapsules(true); }
  }
  document.querySelectorAll('.tab').forEach(function (btn) { btn.addEventListener('click', function () { setTab(btn.dataset.tab); }); });

  // Capsules ----------------------------------------------------------------------
  let collectionKey = '';
  let hatching = false;
  let hatchCleanup = null;
  function canDaily() { return state.dailyGift !== todayKey; }
  function updateCapsules(force) {
    const G = C.gacha;
    setText(el.ticketCount, fmt(state.tickets));
    setText(el.mTickets, fmt(state.tickets));
    el.capBadge.hidden = !((state.tickets >= G.cost || canDaily()) && tab !== 'capsules');
    if (tab !== 'capsules' && !force) return;
    setHTML(el.pull1.querySelector('small'), String(G.cost));
    setHTML(el.pull10.querySelector('small'), String(G.cost10));
    el.pull1.disabled = state.tickets < G.cost || hatching;
    el.pull10.disabled = state.tickets < G.cost10 || hatching;
    el.daily.hidden = !canDaily();
    const odds = PS.gachaOdds(state);
    const g = state.gacha;
    const pctTxt = (p) => p >= 0.995 ? '100%' : p < 0.0005 ? '0%' : (p * 100).toFixed(p < 0.1 ? 1 : 0) + '%';
    setHTML(el.odds, 'Next hatch: ' + G.rarities.map(function (r, i) { return '<b class="r' + i + '">' + r.name + ' ' + pctTxt(odds[i]) + '</b>'; }).join(' · ') +
      '<br>Epic+ guaranteed within <b>' + (G.pityEpic - g.sinceEpic) + '</b> · Legendary within <b>' + (G.pityLegend - g.sinceLegend) + '</b> · ×10 always has a Rare+');
    const key = JSON.stringify(state.critters);
    if (key !== collectionKey) {
      collectionKey = key;
      setText(el.colCount, Object.keys(state.critters).length + '/' + C.critters.length);
      el.collection.innerHTML = C.critters.map(function (c) {
        const own = state.critters[c.id];
        return '<div class="crit ra' + c.rarity + (own ? '' : ' locked') + '" title="' + (own ? c.name + ': ' + PS.critterText(c, own.stars) : G.rarities[c.rarity].name + ' critter, not hatched yet') + '">' +
          SPR.img('critter_' + c.id, 2) + '<span class="cn">' + (own ? c.name : '???') + '</span><span class="st">' + (own ? '★'.repeat(own.stars) : G.rarities[c.rarity].name) + '</span></div>';
      }).join('');
      syncPets();
    }
  }
  el.tickets.addEventListener('click', function () { setTab('capsules'); });
  el.pull1.addEventListener('click', function () { doPull(1); });
  el.pull10.addEventListener('click', function () { doPull(10); });
  el.daily.addEventListener('click', function () {
    const n = PS.claimDaily(state, todayKey);
    if (n) { Sound.unlock(); Sound.ticket(); toast('<b>Daily gift:</b> +' + n + ' tickets', 'pink'); save(); updateCapsules(true); }
  });

  function doPull(count) {
    if (hatching) return;
    Sound.unlock();
    const res = PS.pull(state, count, Math.random);
    if (!res) { Sound.deny(); return; }
    hatching = true;
    save();
    refreshStats();
    shopDirty = true;
    updateCapsules(true);
    el.machine.classList.remove('shake'); void el.machine.offsetWidth; el.machine.classList.add('shake');
    Sound.crank();
    if (res.length === 1) hatchOne(res[0]); else hatchMany(res);
  }

  function critterName(id) { return PS.CRIT[id].name; }

  function resultTag(r) {
    if (r.isNew) return '<span class="tag">NEW!</span>';
    if (r.starUp) return '<span class="tag up">★ UP! ' + '★'.repeat(r.stars) + '</span>';
    if (r.refund) return '<span class="tag up">+' + r.refund + ' tickets</span>';
    return '<span class="tag up">+1 copy</span>';
  }

  function finishHatch() {
    hatching = false;
    hatchCleanup = null;
    collectionKey = '';
    updateCapsules(true);
    save();
  }

  function hatchOne(r) {
    const c = PS.CRIT[r.id];
    const body = '<div class="hatch"><div class="stage"><div class="rays"></div><div class="capsule" style="--cap:' + RARITY_COL[0] + '"></div></div>' +
      '<div class="reveal-text"></div></div>';
    openModal('hatch', 'Hatching…', body, []);
    const stage = el.modalBody.querySelector('.stage');
    const cap = el.modalBody.querySelector('.capsule');
    const rays = el.modalBody.querySelector('.rays');
    const text = el.modalBody.querySelector('.reveal-text');
    const timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    let done = false;
    function reveal() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      cap.remove();
      rays.className = 'rays on r' + r.rarity;
      stage.insertAdjacentHTML('beforeend', '<div class="crit-big">' + SPR.img('critter_' + r.id, 6) + '</div>');
      text.innerHTML = '<div class="rarity" style="color:' + RARITY_COL[r.rarity] + '">' + C.gacha.rarities[r.rarity].name + '</div>' +
        '<div class="cname">' + c.name + '</div><div class="cbonus">' + PS.critterText(c, r.stars) + '</div>' + resultTag(r);
      el.modalTitle.textContent = r.isNew ? 'New critter!' : 'Hatched!';
      Sound.reveal(r.rarity);
      if (r.rarity === 3) { fx.flash = 2; Platform.happytime(); }
      setActions([{ label: 'Yay!', cls: 'primary', fn: closeModal }]);
      finishHatch();
    }
    // The capsule colour teases the rarity: it climbs through lower colours before settling.
    later(380, function () { Sound.drop(); cap.classList.add('wobble'); });
    for (let i = 0; i < 6; i++) {
      later(520 + i * 150, function () {
        Sound.wobble();
        cap.style.setProperty('--cap', RARITY_COL[Math.min(r.rarity, Math.floor((i / 5) * (r.rarity + 1)))]);
      });
    }
    later(520 + 6 * 150 + 120, reveal);
    setActions([{ label: 'Skip', fn: reveal }]);
    hatchCleanup = reveal;
  }

  function hatchMany(list) {
    const body = '<div class="hatch"><div class="multi">' + list.map(function (r, i) {
      return '<div class="cell" data-i="' + i + '"><div class="mini-cap" style="--cap:' + RARITY_COL[0] + '"></div></div>';
    }).join('') + '</div><p class="small">Best: <b class="best">…</b></p></div>';
    openModal('hatch', 'Hatching ×10…', body, []);
    const cells = el.modalBody.querySelectorAll('.cell');
    let i = 0, done = false;
    const best = list.reduce(function (a, c) { return c.rarity > a.rarity ? c : a; }, list[0]);
    function open(k) {
      const r = list[k], cell = cells[k];
      cell.className = 'cell ra' + r.rarity;
      cell.innerHTML = SPR.img('critter_' + r.id, 2) + '<span>' + critterName(r.id) + '</span>' + resultTag(r);
    }
    const iv = setInterval(function () {
      if (i >= list.length) { finish(); return; }
      open(i);
      if (list[i].rarity >= 2) Sound.reveal(list[i].rarity === 3 ? 2 : 1); else Sound.wobble();
      i++;
    }, 230);
    function finish() {
      if (done) return;
      done = true;
      clearInterval(iv);
      for (; i < list.length; i++) open(i);
      el.modalBody.querySelector('.best').textContent = critterName(best.id) + ' (' + C.gacha.rarities[best.rarity].name + ')';
      el.modalTitle.textContent = 'Hatched ×10!';
      Sound.reveal(best.rarity);
      if (best.rarity === 3) { fx.flash = 2; Platform.happytime(); }
      setActions([{ label: 'Yay!', cls: 'primary', fn: closeModal }]);
      finishHatch();
    }
    setActions([{ label: 'Skip', fn: finish }]);
    hatchCleanup = finish;
  }

  // Collapse card -------------------------------------------------------------
  let collapseKey = '';
  function updateCollapseCard() {
    const gain = PS.stardustFor(state);
    const can = PS.canCollapse(state);
    const minName = PS.sectorInfo(C.collapse.minSector).name;
    const next = C.research.find(function (r) { return state.stardust < r.at; });
    const nextLine = next ? 'Next unlock: <b>' + next.name + '</b> at <span class="sd">' + next.at + '</span>' : 'All Stardust research unlocked';
    let key, html;
    if (!can) {
      const pct = Math.min(1, Math.log10(1 + state.runTotal) / Math.log10(1 + PS.sectorInfo(C.collapse.minSector).at));
      key = 'L' + Math.floor(pct * 100) + '_' + state.stardust;
      html = '<div class="row"><span class="ct">Collapse</span><span class="cs">' + (state.stardust ? '<span class="sd">' + state.stardust + ' Stardust</span> ×' + stats.sdMult.toFixed(2) : 'Locked') + '</span></div>' +
        '<div class="cs">Reach <b>' + minName + '</b> to fold this universe into permanent Stardust.</div>' +
        '<div class="mini-bar"><i style="width:' + (pct * 100).toFixed(1) + '%"></i></div>' +
        (state.stardust ? '<div class="cs">' + nextLine + '</div>' : '');
    } else {
      key = 'A' + gain + '_' + state.stardust;
      html = '<div class="row"><span class="ct">Collapse ready!</span><span class="cs"><span class="sd">' + state.stardust + ' Stardust</span></span></div>' +
        '<div class="row"><span class="cs">Gain <span class="sd">+' + gain + '</span> · Matter ×' + stats.sdMult.toFixed(2) + ' > ×' + (1 + C.collapse.step * (state.stardust + gain)).toFixed(2) + '</span>' +
        '<button class="btn violet" type="button" data-act="collapse">Collapse</button></div>' +
        '<div class="cs">' + nextLine + '</div>';
    }
    if (key !== collapseKey) { collapseKey = key; el.collapse.innerHTML = html; }
  }
  el.collapse.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (btn && btn.dataset.act === 'collapse') openCollapse();
    else openResearch();
  });

  // Milestone and Star Reel meters: the next goal is always visible.
  function updateMilestone() {
    let text, val, pct;
    if (!state.milestones.firstBuy && !state.collapses) {
      const cost = PS.upgradeCost('radius', state.levels.radius);
      text = '<b>First upgrade</b> · Event Horizon';
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
    setWidth(el.msFill, pct);
    const need = Math.ceil(stats.reelNeed);
    const charge = world.reel ? need : Math.floor(state.reelCharge);
    setText(el.reelVal, world.reel ? 'SPIN!' : charge + ' / ' + need);
    setWidth(el.reelFill, charge / need);
    el.reelFill.parentNode.classList.toggle('full', !!world.reel);
  }

  let lastMatterStr = '';
  function updateHud() {
    const m = fmt(state.matter);
    if (m !== lastMatterStr) { lastMatterStr = m; el.matter.textContent = m; }
    const rate = stats.dronePerSec * (world.surge > 0 ? C.comet.surgeMult : 1);
    setText(el.rate, rate > 0 ? '+' + fmt(rate) + '/s passive' : '');
    setText(el.singuLv, String(state.singuLevel));
    const lo = state.singuLevel ? PS.singuNext(state.singuLevel - 1) : 0, hi = PS.singuNext(state.singuLevel);
    setWidth(el.xp, (state.lifetime - lo) / (hi - lo));
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
    setWidth(el.pulseCd, Math.max(0, world.cooldown) / C.pulseCooldown);
    // Overcharge offer.
    if (world.overcharge && !modalOpen) {
      if (el.oc.hidden) { el.oc.hidden = false; Sound.ticket(); }
      setWidth(el.ocTimer, world.overcharge.t / C.overcharge.window);
    } else if (!el.oc.hidden) el.oc.hidden = true;
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
      text = inRange ? 'Comet in range! Pulse now!' : 'A comet! Catch it in your pulse';
    } else if (!state.stats.pulses) {
      mode = 'first'; text = COARSE ? 'Tap anywhere to feed Singu' : 'Click anywhere or press Space to feed Singu';
    } else if (state.stats.pulses < 4 && state.stats.captures < 6) {
      mode = 'learn'; text = 'Bits inside the dotted ring get pulled in';
    }
    if (world.overcharge && !modalOpen) mode = '';
    if (mode !== hintMode) {
      hintMode = mode;
      if (mode) { el.hint.textContent = text; el.hint.classList.remove('hide'); }
      else el.hint.classList.add('hide');
      el.hint.classList.toggle('comet', mode.indexOf('comet') === 0);
    }
  }

  // Star Reel overlay -----------------------------------------------------------
  const REEL_ICONS = { dust: 'dust', ice: 'ice', shard: 'shard', crystal: 'crystal', comet: 'comet', singu: 'singu' };
  let reelAnim = null, reelHide = 0;
  function startReelAnim(e) {
    const slots = el.reel.querySelectorAll('.slot');
    const imgs = el.reel.querySelectorAll('.slot img');
    el.reel.hidden = false;
    el.reel.classList.remove('jackpot');
    el.reelResult.innerHTML = '&nbsp;';
    clearTimeout(reelHide);
    slots.forEach(function (s) { s.classList.add('spin'); s.classList.remove('hit'); });
    const ids = Object.keys(REEL_ICONS);
    const stopAt = [0.8, 1.25, C.reel.spin];
    const t0 = performance.now();
    if (reelAnim) clearInterval(reelAnim);
    const stopped = [false, false, false];
    reelAnim = setInterval(function () {
      const t = (performance.now() - t0) / 1000;
      for (let i = 0; i < 3; i++) {
        if (stopped[i]) continue;
        if (t >= stopAt[i]) {
          stopped[i] = true;
          imgs[i].src = SPR.url(REEL_ICONS[e.symbols[i]], 1);
          slots[i].classList.remove('spin');
          const hit = i > 0 && e.symbols.slice(0, i + 1).filter(function (s) { return s === e.symbols[i]; }).length >= 2;
          Sound.reelStop(hit);
        } else {
          imgs[i].src = SPR.url(REEL_ICONS[ids[Math.floor(Math.random() * ids.length)]], 1);
        }
      }
      if (!stopped[2]) Sound.reelTick();
      else { clearInterval(reelAnim); reelAnim = null; }
    }, 70);
  }
  function showReelResult(e) {
    const slots = el.reel.querySelectorAll('.slot');
    const counts = {};
    e.symbols.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    e.symbols.forEach(function (s, i) { if (counts[s] >= 2) slots[i].classList.add('hit'); });
    const big = e.result === 'singu3' || e.result === 'comet3' || e.result === 'crystal3';
    el.reelResult.innerHTML = e.name + '<small>+' + fmt(e.matter) + ' Matter' + (e.tickets ? ' · +' + e.tickets + ' tickets' : '') + (e.surge ? ' · SURGE!' : '') + '</small>';
    if (big) el.reel.classList.add('jackpot');
    Sound.reelWin(big);
    if (e.result === 'singu3') { banner('Star Reel', 'SINGU JACKPOT!', '+' + fmt(e.matter) + ' Matter · +' + e.tickets + ' tickets'); fx.flash = 2; Platform.happytime(); singuMood('happy', 4); }
    else if (e.result !== 'none' && e.result !== 'pair') singuMood('happy', 1.5);
    burst(CX, CY - 6, big ? 40 : 14, ['4', 'c', 'p']);
    clearTimeout(reelHide);
    reelHide = setTimeout(function () { el.reel.hidden = true; }, 2100);
  }

  // Overcharge -----------------------------------------------------------------
  el.oc.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  el.oc.addEventListener('click', function (e) {
    e.stopPropagation();
    Sound.unlock();
    el.oc.hidden = true;
    if (PS.overcharge(world, state, ev)) save();
  });

  // Toasts & banner -----------------------------------------------------------
  function toast(html, tone) {
    const t = document.createElement('div');
    t.className = 'toast' + (tone ? ' ' + tone : '');
    t.innerHTML = html;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 2) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 3200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
  }

  let bannerTimer = 0;
  function banner(kicker, title, sub) {
    el.banner.innerHTML = '<div class="b-kicker">' + kicker + '</div><div class="b-title">' + title + '</div>' + (sub ? '<div class="b-sub">' + sub + '</div>' : '');
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, 3000);
  }

  // Modals --------------------------------------------------------------------
  function setActions(actions) {
    el.modalActions.innerHTML = '';
    (actions || []).forEach(function (a) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (a.cls || '');
      btn.textContent = a.label;
      if (a.disabled) btn.disabled = true;
      btn.addEventListener('click', function (e) { e.stopPropagation(); a.fn(btn); });
      el.modalActions.appendChild(btn);
    });
    const first = el.modalActions.querySelector('.btn.primary, .btn.violet, .btn.gold') || el.modalActions.querySelector('.btn') || el.modalX;
    setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }
  function openModal(kind, title, body, actions) {
    modalOpen = kind;
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = body;
    setActions(actions);
    el.modal.hidden = false;
    Platform.gameplayStop();
  }
  function closeModal() {
    if (!modalOpen) return;
    if (modalOpen === 'hatch' && hatchCleanup) hatchCleanup();
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
      '<div class="big-gain" style="color:var(--lav)">+' + gain + ' Stardust</div>' +
      '<p>Matter multiplier <b>×' + stats.sdMult.toFixed(2) + '</b> > <b style="color:var(--lav)">×' + (1 + C.collapse.step * after).toFixed(2) + '</b></p>' +
      (unlocks.length ? '<p>Unlocks: ' + unlocks.map(function (r) { return '<b style="color:var(--lav)">' + r.name + '</b>: ' + r.desc; }).join('<br>') + '</p>' : '') +
      '<div class="cols"><div><h3 class="h-reset">Resets</h3><ul><li>Matter (' + fmt(state.matter) + ')</li><li>Upgrade levels' + (anchor ? ' (except Horizon &amp; Density)' : '') + '</li><li>Sector progress</li></ul></div>' +
      '<div><h3 class="h-keep">Stays forever</h3><ul><li>Stardust</li><li>Critters &amp; tickets</li><li>Singu level</li><li>Atlas &amp; research</li></ul></div></div>' +
      '<p class="small">Waiting longer earns more Stardust. There is no rush: Collapse whenever you like.</p>';
    openModal('collapse', 'Collapse this universe?', body, [
      { label: 'Not yet', fn: closeModal },
      { label: 'Collapse for +' + gain, cls: 'violet', fn: function (btn) { btn.disabled = true; confirmCollapse(); } }
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
      if (before < r.at && state.stardust >= r.at) setTimeout(function () { toast('<b>Research unlocked:</b> ' + r.name + ': ' + r.desc, 'violet'); }, 1200);
    });
    collapsing = false;
  }

  function openResearch() {
    const flags = PS.researchFlags(state);
    const list = C.research.map(function (r) {
      return '<div class="rnode' + (flags[r.id] ? ' on' : '') + '"><span class="rn">' + r.name + '</span><span class="rc">' + (flags[r.id] ? 'Active' : r.at + ' SD') + '</span><span class="rd">' + r.desc + '</span></div>';
    }).join('');
    const body = '<p>Collapse a universe after reaching <b>' + PS.sectorInfo(C.collapse.minSector).name + '</b> to earn Stardust. Each one adds <b>+' + Math.round(C.collapse.step * 100) + '% Matter</b> forever, and lifetime Stardust unlocks research.</p>' +
      '<p>You have <b class="sd">' + state.stardust + ' Stardust</b> · multiplier <b>×' + stats.sdMult.toFixed(2) + '</b>' + (state.collapses ? ' · ' + state.collapses + ' collapse' + (state.collapses > 1 ? 's' : '') : '') + '</p>' +
      '<div class="research">' + list + '</div>';
    openModal('research', 'Stardust research', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }

  function openAtlas() {
    const n = PS.discoveryCount(state);
    const items = C.discoveries.map(function (d) {
      const got = !!state.discoveries[d.id];
      return '<div class="ae ' + (got ? 'got' : 'locked') + '"><span class="an">' + (got ? d.name : '???') + '</span><span class="ad">' + d.desc + '</span></div>';
    }).join('');
    const body = '<p>Each discovery permanently adds <b>+' + Math.round(C.atlasStep * 100) + '% Matter</b> and gives <b>' + C.tickets.discovery + ' tickets</b>. Current bonus: <b style="color:var(--butter)">×' + stats.atlasMult.toFixed(2) + '</b> (' + n + '/' + C.discoveries.length + ').</p><div class="atlas">' + items + '</div>';
    openModal('atlas', 'Discovery Atlas', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }

  function openMutation() {
    const body = '<p>Every day the universe drifts into a new <b>Cosmic Mutation</b>, a free bonus for that day. Nothing is lost when it changes.</p>' +
      '<div class="big-gain" style="color:var(--pink);font-size:24px">' + mutation.name + '</div><p><b>' + mutation.desc + '.</b></p>' +
      '<p class="small">A different mutation arrives tomorrow' + (canDaily() ? ', and your daily gift of ' + C.tickets.daily + ' tickets is waiting in the Capsules tab' : '') + '.</p>';
    openModal('mutation', "Today's Cosmic Mutation", body, [{ label: 'Nice', cls: 'primary', fn: closeModal }]);
  }

  function openSettings() {
    const body =
      '<div class="toggle-row"><span>Sound</span><button class="switch' + (state.settings.muted ? '' : ' on') + '" data-set="sound" type="button" aria-label="Sound"></button></div>' +
      '<div class="toggle-row"><span>Reduced motion</span><button class="switch' + (reduced ? ' on' : '') + '" data-set="motion" type="button" aria-label="Reduced motion"></button></div>' +
      '<p class="small" style="margin-top:12px">Pulse: click, tap or Space · Buy: keys 1-6 · Mute: M · Close: Esc<br>Progress saves automatically on this device.</p>' +
      '<p class="small">Capsule odds are shown on the Capsules tab. Tickets are earned only by playing and cannot be bought.</p>' +
      (QS.has('debug') ? '<p class="small">Playtest timings (s): ' + Object.keys(state.milestones).map(function (k) { return k + ' ' + state.milestones[k]; }).join(' · ') + '</p>' : '') +
      '<p class="small">Played ' + playTimeText(state.stats.playTime) + ' · ' + fmt(state.stats.pulses) + ' pulses · best chain ' + state.stats.bestChain + ' · ' + fmt(state.stats.lucky) + ' lucky pulses · ' + fmt(state.gacha.pulls) + ' hatches · lifetime ' + fmt(state.lifetime) + ' Matter</p>';
    openModal('settings', 'Settings', body, [
      { label: 'Reset all progress', cls: 'danger', fn: confirmReset },
      { label: 'Done', cls: 'primary', fn: closeModal }
    ]);
    el.modalBody.querySelectorAll('[data-set]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.set === 'sound') toggleMute();
        else setReduced(!reduced);
        btn.classList.toggle('on', btn.dataset.set === 'sound' ? !state.settings.muted : reduced);
      });
    });
  }

  function confirmReset() {
    openModal('reset', 'Erase everything?', '<p>This permanently deletes your universe, Stardust, critters, tickets and Atlas on this device. It cannot be undone.</p>', [
      { label: 'Keep my universe', cls: 'primary', fn: closeModal },
      { label: 'Erase everything', cls: 'danger', fn: function () {
        Platform.remove(SAVE_KEY); Platform.remove(BAK_KEY);
        const settings = state.settings;
        state = PS.createState(now());
        state.settings = settings;
        refreshStats();
        world = PS.createWorld(Math.random, state, stats);
        syncDrones(); syncPets();
        rebuildBackground(true);
        shopDirty = true; collapseKey = ''; collectionKey = '';
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
      const body = '<p>Your Orbital Drones kept Singu fed for <b>' + playTimeText(a.ms / 1000) + '</b>' + (capped ? ' (the 2 h maximum)' : '') + ' at ' + Math.round(stats.offlineRate * 100) + '% speed.</p>' +
        '<div class="big-gain num">+' + fmt(a.gain) + ' Matter</div>' +
        '<p class="small">Away income is capped at 2 hours. Playing is always faster.</p>';
      const actions = [{ label: 'Collect', cls: 'primary', fn: closeModal }];
      if (Platform.canRewarded()) {
        actions.unshift({ label: 'Watch ad: double it', cls: 'gold', fn: function (btn) {
          btn.disabled = true;
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
      openModal('away', 'Welcome back!', body, actions);
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
    idleTime = 0;
    PS.pulse(world, state, stats, ev, false);
  }

  function toArt(e) {
    const r = el.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * BW / r.width, y: (e.clientY - r.top) * BH / r.height };
  }
  el.universe.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    const a = toArt(e);
    look.x = a.x; look.y = a.y; look.t = 1.5;
    tapPoint = { x: a.x, y: a.y, t: 0 };
    doPulse();
  });
  el.universe.addEventListener('pointermove', function (e) {
    const a = toArt(e);
    look.x = a.x; look.y = a.y; look.t = 1;
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

  document.querySelectorAll('.buy-mode button').forEach(function (btn) {
    btn.addEventListener('click', function () { setBuyMode(Number(btn.dataset.mode)); save(); });
  });
  el.atlasBtn.addEventListener('click', openAtlas);
  el.settings.addEventListener('click', openSettings);
  el.sound.addEventListener('click', toggleMute);
  el.mut.addEventListener('click', function (e) { e.stopPropagation(); openMutation(); });

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
  // Pixel rendering
  // ---------------------------------------------------------------------------
  // The universe is drawn into a small buffer (BW×BH art pixels) and scaled up by an integer.
  const buf = document.createElement('canvas');
  const b = buf.getContext('2d');
  let W = 0, H = 0, DPR = 1, PXS = 2, BW = 1, BH = 1, KK = 2, CX = 0, CY = 0, S = 100;
  let bg = null, bgPrev = null;
  const fx = { shake: 0, gulp: 0, flash: 0, collapse: 0, bgFade: 1, lucky: 0, ocWin: 0, ocLose: 0 };
  let tapPoint = null;
  const look = { x: 0, y: 0, t: 0 };
  const twinkles = [];
  const particles = [];
  const floats = [];
  const blasts = [];
  let drones = [];
  let pets = [];
  const MAX_PARTICLES = 320, MAX_FLOATS = 26;
  let idleTime = 0;
  const mood = { kind: '', t: 0, blink: 2.5, blinkT: 0, munch: 0 };

  function singuMood(kind, secs) { if (kind === 'happy' || !mood.t || mood.kind !== 'happy') { mood.kind = kind; mood.t = secs; } }

  // Large screens (fullscreen) scale the whole UI up so text stays readable.
  let uiScale = 1;
  const appEl = document.getElementById('app');
  function fitApp() {
    const s = COVER ? 1 : Math.max(1, Math.min(innerWidth / 960, innerHeight / 540));
    uiScale = s < 1.15 ? 1 : Math.floor(s * 8) / 8;
    if (uiScale === 1) { appEl.style.cssText = ''; return; }
    appEl.style.width = (innerWidth / uiScale) + 'px';
    appEl.style.height = (innerHeight / uiScale) + 'px';
    appEl.style.transform = 'scale(' + uiScale + ')';
    appEl.style.transformOrigin = '0 0';
  }

  function resize() {
    DPR = Math.min(3, window.devicePixelRatio || 1) * uiScale;
    // Layout size (before the UI transform), so the canvas matches its box exactly.
    W = Math.max(1, el.universe.clientWidth);
    H = Math.max(1, el.universe.clientHeight);
    PXS = Math.max(2, Math.min(8, Math.floor(Math.min(W, H) / 150)));
    BW = Math.ceil(W / PXS); BH = Math.ceil(H / PXS);
    KK = Math.max(1, Math.round(PXS * DPR));
    el.cv.width = BW * KK; el.cv.height = BH * KK;
    el.cv.style.width = BW * PXS + 'px'; el.cv.style.height = BH * PXS + 'px';
    el.cv.style.left = Math.floor((W - BW * PXS) / 2) + 'px';
    el.cv.style.top = Math.floor((H - BH * PXS) / 2) + 'px';
    buf.width = BW; buf.height = BH;
    CX = Math.floor(BW / 2);
    CY = Math.floor(BH / 2) + 3;
    S = Math.min(BW / 2 / 1.06, BH / 2 / (1.06 * 0.82));
    for (const k in patterns) delete patterns[k];
    rebuildBackground(false);
  }

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y, v) { return v * 16 > BAYER[((y & 3) << 2) | (x & 3)]; }
  function rgb(key) { const n = parseInt(P[key].slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

  // Dithered fill patterns for flashes, cached per colour and density.
  const patterns = {};
  function pattern(key, level) {
    const id = key + level;
    if (patterns[id]) return patterns[id];
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const g = c.getContext('2d');
    g.fillStyle = P[key];
    for (let i = 0; i < 16; i++) if (BAYER[i] < level) g.fillRect(i & 3, i >> 2, 1, 1);
    patterns[id] = b.createPattern(c, 'repeat');
    return patterns[id];
  }

  function rebuildBackground(animate) {
    if (!BW) return;
    const sec = PS.sectorInfo(state.sector);
    const skin = SKIES[(sec.palette + sec.tier * 2) % SKIES.length];
    const amb = SKIES[sec.palette].ambient;
    if (animate && bg) { bgPrev = bg; fx.bgFade = 0; } else { bgPrev = null; fx.bgFade = 1; }
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const g = c.getContext('2d');
    const img = g.createImageData(BW, BH);
    const d = img.data;
    const stops = skin.stops.map(rgb);
    const neb = skin.neb.map(rgb);
    const rng = PS.mulberry32(1000 + sec.index * 7919);
    const blobs = [];
    for (let i = 0; i < 5; i++) blobs.push({ x: rng() * BW, y: rng() * BH, r: (0.2 + rng() * 0.3) * Math.max(BW, BH), k: i % 2 });
    const maxd = Math.hypot(BW, BH) * 0.6;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      // Sky: darker at the top, warmer toward the bottom, in dithered bands.
      const v = Math.min(0.999, Math.max(0, 0.03 + 0.63 * (y / BH) + 0.25 * (Math.hypot(x - CX, y - CY) / maxd)));
      // Mostly flat bands; dithering only in the narrow seam between two bands.
      const f = v * (stops.length - 1);
      const i0 = Math.floor(f), fr = f - i0;
      let col = fr > 0.7 && dith(x, y, (fr - 0.7) / 0.3) ? stops[Math.min(stops.length - 1, i0 + 1)] : stops[i0];
      // Soft nebula clouds: a solid core with a dithered rim.
      let n = 0, nk = 0;
      for (const bl of blobs) { const q = 1 - Math.hypot(x - bl.x, (y - bl.y) * 1.6) / bl.r; if (q > n) { n = q; nk = bl.k; } }
      if (n > 0.5 || (n > 0.3 && dith(x, y, (n - 0.3) / 0.2))) col = neb[nk];
      const o = (y * BW + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    ambient(g, amb, rng);
    // Static stars.
    const count = Math.round(BW * BH / 110);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * BW), y = Math.floor(rng() * BH), s = rng();
      g.fillStyle = s > 0.9 ? P.c : s > 0.6 ? P.d : P.e;
      g.fillRect(x, y, 1, 1);
      if (s > 0.985) { g.fillStyle = P.e; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
    }
    bg = c;
    twinkles.length = 0;
    for (let i = 0; i < 28; i++) twinkles.push({ x: Math.floor(rng() * BW), y: Math.floor(rng() * BH), p: rng() * 6.28, s: 0.8 + rng() * 1.8, big: rng() > 0.7 });
  }

  function disc(g, x0, y0, r, colorFn) {
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let dx = -hw; dx <= hw; dx++) { const c = colorFn(dx, dy); if (c) { g.fillStyle = P[c]; g.fillRect(x0 + dx, y0 + dy, 1, 1); } }
    }
  }

  function ambient(g, kind, rng) {
    if (kind === 'planet') {
      // A small ringed planet resting in the lower left.
      const r = Math.max(6, Math.round(Math.min(BW, BH) * 0.09)), x0 = Math.round(BW * 0.13), y0 = Math.round(BH * 0.78);
      disc(g, x0, y0, r, function (dx, dy) { const l = (dx + dy) / r; return l > 0.5 ? '2' : l > -0.3 ? (dith(dx + 64, dy + 64, 0.5 - l) ? '3' : '2') : ((dy + 64) % 3 === 0 ? '4' : '3'); });
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const x = Math.round(x0 + Math.cos(a) * r * 1.9), y = Math.round(y0 + Math.sin(a) * r * 0.45);
        if (Math.sin(a) < 0 && Math.hypot(x - x0, y - y0) < r) continue;
        g.fillStyle = P['4']; g.fillRect(x, y, 1, 1);
      }
    } else if (kind === 'belt') {
      for (let i = 0; i < 160; i++) {
        const t = rng(), x = Math.round(t * BW), y = Math.round(BH * 0.2 + t * BH * 0.5 + (rng() - 0.5) * BH * 0.14);
        const s = rng() > 0.85 ? 2 : 1;
        g.fillStyle = rng() > 0.5 ? P.e : P.f;
        g.fillRect(x, y, s + 1, s);
        if (s > 1) { g.fillStyle = P.d; g.fillRect(x, y, 1, 1); }
      }
    } else if (kind === 'moon') {
      const r = Math.round(Math.min(BW, BH) * 0.2), x0 = Math.round(BW * 0.88), y0 = Math.round(BH * 0.86);
      const craters = [];
      for (let i = 0; i < 6; i++) craters.push([(rng() - 0.5) * r * 1.3, (rng() - 0.5) * r * 1.3, r * (0.08 + rng() * 0.15)]);
      disc(g, x0, y0, r, function (dx, dy) {
        for (const c of craters) if (Math.hypot(dx - c[0], dy - c[1]) < c[2]) return 'e';
        const l = (dx + dy) / (r * 1.4);
        return l > 0.45 ? (dith(dx + 64, dy + 64, 0.6) ? 'e' : 'd') : l > 0 ? 'd' : (dith(dx + 64, dy + 64, 0.3) ? 'c' : 'd');
      });
    } else if (kind === 'nebula') {
      for (let k = 0; k < 4; k++) {
        const off = rng() * 6.28, rr = Math.min(BW, BH) * (0.35 + rng() * 0.35);
        for (let t = 0; t < 1; t += 0.004) {
          const a = off + t * 3.4, r2 = rr * (0.6 + t * 0.6);
          const x = Math.round(CX + Math.cos(a) * r2 * 1.3), y = Math.round(CY + Math.sin(a) * r2 * 0.6);
          if (dith(x, y, 0.5)) { g.fillStyle = k % 2 ? P['2'] : P.w; g.fillRect(x, y, 2, 1); }
        }
      }
    } else if (kind === 'nursery') {
      for (let i = 0; i < 10; i++) {
        const x = Math.round(rng() * BW), y = Math.round(rng() * BH), s = 2 + Math.floor(rng() * 3);
        if (Math.hypot(x - CX, y - CY) < S * 0.55) continue;
        g.fillStyle = P['4'];
        g.fillRect(x - s, y, s * 2 + 1, 1); g.fillRect(x, y - s, 1, s * 2 + 1);
        g.fillStyle = P.c; g.fillRect(x, y, 1, 1);
        g.fillStyle = P['3']; g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x - 1, y + 1, 1, 1);
      }
    }
  }

  function sx(x) { return Math.round(CX + x * S); }
  function sy(y) { return Math.round(CY + y * S); }

  function syncDrones() {
    const n = Math.min(16, state.levels.drones);
    while (drones.length < n) drones.push({ a: Math.random() * 6.28, r: 1.55 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.6 });
    drones.length = n;
  }

  // The best critters you own float around Singu.
  function syncPets() {
    const owned = C.critters.filter(function (c) { return state.critters[c.id]; })
      .sort(function (a, c) { return c.rarity - a.rarity || state.critters[c.id].stars - state.critters[a.id].stars; })
      .slice(0, 6);
    pets = owned.map(function (c, i) { return { id: c.id, phase: i / Math.max(1, owned.length) * Math.PI * 2, bob: Math.random() * 6 }; });
  }

  function addParticle(x, y, vx, vy, life, key) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, key: key });
  }
  function burst(x, y, n, keys) {
    if (reduced) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28, sp = 15 + Math.random() * 45;
      addParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, 0.4 + Math.random() * 0.5, keys[k % keys.length]);
    }
  }

  // Floating text lives in CSS pixels on the full-resolution canvas so it stays crisp.
  function addFloat(text, x, y, color, size, life, shadow) {
    if (floats.length >= MAX_FLOATS) floats.shift();
    floats.push({ text: text, x: x, y: y, color: color, size: size, life: life || 1.1, max: life || 1.1, shadow: shadow || P['0'] });
  }

  const SINGU_SCALE = 1.3;   // Singu is drawn a little larger than its rules radius so the face reads
  const TYPE_KEYS = { dust: ['d', 'c'], ice: ['b', 'a'], crystal: ['4', 'c'], shard: ['3', '2'] };

  function handleEvents() {
    const coreR = PS.coreRadius(state) * S * SINGU_SCALE;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.t) {
        case 'pulse':
          Sound.pulse(e.auto);
          if (!e.auto) { fx.flash = Math.max(fx.flash, 0.6); el.pulse.classList.add('press'); setTimeout(function () { el.pulse.classList.remove('press'); }, 90); }
          if (e.lucky > 1) {
            fx.lucky = 1;
            Sound.lucky();
            addFloat('LUCKY ×' + (+e.lucky.toFixed(1)) + '!', CX * PXS, Math.max(40, (CY - coreR * 3.4) * PXS), P['5'], 26, 1.4, P['6']);
            burst(CX, CY, 24, ['5', '6', '4']);
            singuMood('happy', 1.5);
          }
          break;
        case 'capture': {
          fx.gulp = Math.min(1, fx.gulp + 0.3);
          mood.munch = 0.35;
          Sound.capture(e.idx, e.type);
          const keys = TYPE_KEYS[e.type];
          for (let k = 0; k < (reduced ? 2 : e.type === 'crystal' ? 8 : 4); k++) {
            const a = Math.random() * 6.28, sp = 20 + Math.random() * 40;
            addParticle(CX + Math.cos(a) * coreR, CY + Math.sin(a) * coreR * 0.8, Math.cos(a) * sp, Math.sin(a) * sp, 0.35 + Math.random() * 0.3, keys[k % 2]);
          }
          break;
        }
        case 'swallow':
          fx.gulp = Math.min(1, fx.gulp + 0.12);
          mood.munch = 0.2;
          Sound.swallow();
          break;
        case 'blast':
          Sound.blast();
          blasts.push({ x: sx(e.x), y: sy(e.y), r: e.r * S, t: 0 });
          burst(sx(e.x), sy(e.y), 14, ['3', '2', '4']);
          break;
        case 'payout': {
          if (e.total <= 0) break;
          const big = e.chain >= 12 ? 1.5 : e.chain >= 5 ? 1.25 : 1;
          const color = e.lucky > 1 ? P['5'] : e.chain >= 12 ? P['4'] : e.chain >= 5 ? P.p : P.c;
          const fy = Math.max(46, (CY - coreR * 2.4) * PXS - 10);
          addFloat('+' + fmt(e.total), CX * PXS, fy, color, Math.round(18 * big), 1.2);
          if (e.chain >= 2) addFloat('CHAIN ×' + e.chain, CX * PXS, fy + 20 * big, e.chain >= 12 ? P['4'] : P.b, Math.round(13 * big), 1.2);
          if (e.chain >= 8 && !reduced && !e.auto) fx.shake = Math.min(1, 0.3 + e.chain * 0.03);
          if (e.chain >= 8) singuMood('happy', 1.2);
          if (!e.auto) Sound.payout(e.chain);
          el.matter.classList.remove('bump'); void el.matter.offsetWidth; el.matter.classList.add('bump');
          break;
        }
        case 'tickets':
          Sound.ticket();
          addFloat('+' + e.n + ' TICKET' + (e.n > 1 ? 'S' : ''), CX * PXS + 70, (CY - coreR * 1.5) * PXS, P['4'], 13, 1.4, P['2']);
          el.tickets.classList.remove('flash'); void el.tickets.offsetWidth; el.tickets.classList.add('flash');
          break;
        case 'level':
          Sound.level();
          addFloat('SINGU LV ' + e.level + '!', CX * PXS, (CY + coreR * 2.6) * PXS, P.p, 15, 1.6, P['1']);
          burst(CX, CY, 16, ['p', 'c', 'v']);
          singuMood('happy', 1.2);
          break;
        case 'comet':
          Sound.comet();
          break;
        case 'surge':
          Sound.surge();
          fx.flash = 1.5;
          burst(CX, CY, 40, ['4', 'c', '3']);
          banner('Comet captured', 'Surge ×' + C.comet.surgeMult, 'All Matter ×' + C.comet.surgeMult + ' for ' + Math.round(e.dur) + ' seconds');
          singuMood('star', e.dur);
          Platform.happytime();
          break;
        case 'reelStart':
          startReelAnim(e);
          break;
        case 'reel':
          showReelResult(e);
          break;
        case 'overcharge':
          Sound.overcharge(e.win);
          if (e.win) {
            fx.ocWin = 1;
            burst(CX, CY, 50, ['4', '5', 'c', 'p']);
            addFloat('OVERCHARGED! +' + fmt(e.amount), CX * PXS, (CY - 20) * PXS, P['5'], 22, 1.6, P['6']);
            singuMood('happy', 2);
          } else {
            fx.ocLose = 1;
            burst(CX, CY, 20, ['e', 'f', 'd']);
            addFloat('Fizzled... -' + fmt(e.amount), CX * PXS, (CY - 20) * PXS, P.p, 18, 1.6, P['1']);
            singuMood('dizzy', 1.6);
          }
          break;
        case 'sector': {
          const sec = PS.sectorInfo(e.index);
          Sound.sector();
          rebuildBackground(true);
          refreshStats();
          shopDirty = true;
          const news = SECTOR_NEWS[e.index] || 'Fragments worth more';
          banner('Sector ' + (e.index + 1) + ' revealed', sec.name, news + ' · +' + C.tickets.sector + ' tickets');
          Platform.happytime();
          break;
        }
        case 'discover': {
          const d = C.discoveries.find(function (x) { return x.id === e.id; });
          refreshStats();
          shopDirty = true;
          if (d) {
            setTimeout(function () { Sound.discover(); toast('<b>' + d.name + '</b> discovered · +' + Math.round(C.atlasStep * 100) + '% · +' + C.tickets.discovery + ' tickets'); }, 250);
            el.atlasBtn.classList.remove('flash'); void el.atlasBtn.offsetWidth; el.atlasBtn.classList.add('flash');
          }
          break;
        }
      }
    }
    ev.length = 0;
  }

  function ellipse(cx, cy, rx, ry, key, dotted, phase) {
    if (rx < 1) return;
    const steps = Math.max(24, Math.ceil(Math.PI * 2 * rx));
    b.fillStyle = P[key];
    let lastX = null, lastY = null;
    for (let i = 0; i < steps; i++) {
      if (dotted && ((i + (phase || 0)) % dotted) !== 0) continue;
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      if (x === lastX && y === lastY) continue;
      lastX = x; lastY = y;
      b.fillRect(x, y, 1, 1);
    }
  }

  function sprite(name, x, y) {
    const s = SPR.get(name);
    b.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  }

  function draw(dt, t) {
    b.setTransform(1, 0, 0, 1, 0, 0);
    let ox = 0, oy = 0;
    if (fx.shake > 0) {
      const a = Math.ceil(fx.shake * 2);
      ox = Math.round((Math.random() - 0.5) * a * 2); oy = Math.round((Math.random() - 0.5) * a * 2);
      fx.shake = Math.max(0, fx.shake - dt * 4);
    }
    // Background, dissolving through an ordered-dither mask on sector change.
    if (bg) {
      b.drawImage(bg, 0, 0);
      if (bgPrev && fx.bgFade < 1) {
        const lvl = Math.floor((1 - fx.bgFade) * 16);
        b.fillStyle = b.createPattern(bgPrev, 'no-repeat');
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          if (BAYER[(y << 2) | x] >= lvl) continue;
          for (let yy = y; yy < BH; yy += 4) for (let xx = x; xx < BW; xx += 4) b.fillRect(xx, yy, 1, 1);
        }
        fx.bgFade = Math.min(1, fx.bgFade + dt / 1.2);
        if (fx.bgFade >= 1) bgPrev = null;
      }
    }
    b.save();
    b.translate(ox, oy);
    // Twinkles.
    for (const s of twinkles) {
      const v = Math.sin(t * s.s + s.p);
      if (v < 0.3) continue;
      b.fillStyle = v > 0.85 ? P.c : P.d;
      b.fillRect(s.x, s.y, 1, 1);
      if (s.big && v > 0.9) { b.fillStyle = P.e; b.fillRect(s.x - 1, s.y, 1, 1); b.fillRect(s.x + 1, s.y, 1, 1); b.fillRect(s.x, s.y - 1, 1, 1); b.fillRect(s.x, s.y + 1, 1, 1); }
    }

    const coreR = PS.coreRadius(state) * S * SINGU_SCALE;
    const surge = world.surge > 0;

    // Pulse range: a dotted ellipse so the player can see what a pulse will reach.
    const R = stats.pulseRadius * S;
    const cometIn = world.comet && !world.comet.caught && Math.hypot(world.comet.x, world.comet.y / 0.82) <= stats.pulseRadius;
    const ready = world.cooldown <= 0;
    ellipse(CX, CY, R, R * 0.82, cometIn ? (Math.floor(t * 8) % 2 ? '4' : '3') : surge ? '3' : ready ? 'd' : 'e', cometIn ? 2 : 4, Math.floor(t * 6));

    // Tap feedback.
    if (tapPoint && !reduced) {
      tapPoint.t += dt;
      const p = tapPoint.t / 0.25;
      if (p >= 1) tapPoint = null;
      else ellipse(tapPoint.x, tapPoint.y, 2 + p * 6, 2 + p * 6, 'b', 2);
    }

    // Pulse rings.
    for (const r of world.rings) {
      const rr = Math.min(r.max, r.t * C.ringSpeed) * S;
      const life = r.max / C.ringSpeed + 0.45;
      const a = 1 - r.t / life;
      if (a <= 0) continue;
      const key = r.auto ? 'v' : surge ? '4' : 'b';
      if (a > 0.25) ellipse(CX, CY, rr, rr * 0.82, key, a > 0.6 ? 0 : 2);
      if (!r.auto && a > 0.4) ellipse(CX, CY, rr * 0.86, rr * 0.86 * 0.82, a > 0.7 ? 'a' : '9', 3);
    }

    // Shard blasts.
    for (let i = blasts.length - 1; i >= 0; i--) {
      const bl = blasts[i];
      bl.t += dt;
      const p = bl.t / 0.35;
      if (p >= 1) { blasts.splice(i, 1); continue; }
      ellipse(bl.x, bl.y, bl.r * p + 1, (bl.r * p + 1) * 0.82, p < 0.5 ? '3' : '2', p < 0.5 ? 0 : 2);
    }

    drawPets(t, coreR, true);
    drawDisk(t, coreR, true);
    for (const f of world.frags) drawFragment(f, t);
    drawSingu(t, coreR, surge, dt);
    drawDisk(t, coreR, false);
    drawDrones(dt, coreR);
    drawPets(t, coreR, false);
    drawComet(t);

    // Particles.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3;
      if (p.life / p.max < 0.3 && (Math.floor(t * 20) + i) % 2) continue;  // pixel flicker as it fades
      b.fillStyle = P[p.key];
      b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }

    // Dithered flashes.
    if (fx.lucky > 0) { b.fillStyle = pattern('5', Math.ceil(fx.lucky * 3)); b.fillRect(0, 0, BW, BH); fx.lucky = Math.max(0, fx.lucky - dt * 5); }
    if (fx.ocWin > 0) { b.fillStyle = pattern('4', Math.ceil(fx.ocWin * 7)); b.fillRect(0, 0, BW, BH); fx.ocWin = Math.max(0, fx.ocWin - dt * 2); }
    if (fx.ocLose > 0) { b.fillStyle = pattern('0', Math.ceil(fx.ocLose * 9)); b.fillRect(0, 0, BW, BH); fx.ocLose = Math.max(0, fx.ocLose - dt * 1.5); }
    if (fx.flash > 1) { b.fillStyle = pattern('c', Math.ceil((fx.flash - 1) * 8)); b.fillRect(0, 0, BW, BH); }
    if (fx.collapse > 0) {
      b.fillStyle = pattern('k', Math.max(1, Math.min(15, Math.ceil(fx.collapse * 10)))); b.fillRect(0, 0, BW, BH);
      const rr = (1.6 - fx.collapse) * Math.max(BW, BH);
      ellipse(CX, CY, rr, rr * 0.82, 'v', 2);
      fx.collapse -= dt;
    }
    b.restore();

    // Upscale to the screen canvas.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW * KK, BH * KK);

    // Floating text in CSS pixels.
    const k = KK / PXS;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      const p = 1 - f.life / f.max;
      const rise = Math.round((reduced ? 8 : 22) * Math.min(1, p * 2));
      if (p > 0.75 && Math.floor(t * 16) % 2) continue;  // blink out, retro style
      ctx.font = '700 ' + f.size + 'px Cozy, monospace';
      ctx.fillStyle = f.shadow;
      ctx.fillText(f.text, f.x + 2, f.y - rise + 2);
      ctx.fillText(f.text, f.x - 1, f.y - rise - 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - rise);
    }
  }

  function drawFragment(f, t) {
    const p = PS.fragPos(f);
    const x = sx(p.x), y = sy(p.y);
    if (f.alpha < 1 && (Math.floor(t * 20) % 2 || f.alpha < 0.4)) return;  // spawn in with a pixel blink
    const falling = f.state === PS.FALL && f.delay <= 0;
    if (falling) {
      // Streak of pixels toward the core.
      const keys = TYPE_KEYS[f.type];
      if (!f.trail) f.trail = [];
      f.trail.unshift([x, y]);
      if (f.trail.length > 5) f.trail.length = 5;
      for (let i = 1; i < f.trail.length; i++) { b.fillStyle = P[keys[i % 2]]; b.fillRect(f.trail[i][0], f.trail[i][1], 1, 1); }
      const pr = Math.min(1, f.t / f.dur);
      if (pr > 0.65) { b.fillStyle = P[keys[0]]; b.fillRect(x - 1, y - 1, 2, 2); return; }
    }
    let name = f.type;
    if (f.type === 'dust' && Math.floor(t * 3 + f.wob) % 2) name = 'dust2';
    if (f.type === 'crystal' && Math.floor(t * 4 + f.wob) % 4 === 0) name = 'crystal2';
    if (f.type === 'shard' && Math.floor(t * 8 + f.wob) % 2) name = 'shard2';
    const bob = f.type === 'crystal' ? Math.round(Math.sin(t * 3 + f.wob)) : 0;
    sprite(name, x, y + bob);
    if (f.state === PS.FALL && !falling) { b.fillStyle = P.c; b.fillRect(x, y - 4, 1, 1); }
  }

  function drawDisk(t, coreR, back) {
    // Accretion disk as rotating bands of warm pixels. Back half behind Singu, front half in front.
    const stage = PS.coreStage(state);
    const surge = world.surge > 0;
    const rings = 2 + Math.min(3, stage);
    const bands = surge ? ['4', 'c', '4', '3'] : ['4', '3', '2', '3'];
    for (let i = 0; i < rings; i++) {
      const rx = coreR * (1.55 + i * 0.32), ry = Math.max(2, rx * 0.3);
      const steps = Math.ceil(Math.PI * 2 * rx * 1.2);
      const spin = t * (0.9 - i * 0.12);
      const outer = i === rings - 1 && stage >= 2;
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const sn = Math.sin(a);
        if (back ? sn >= 0 : sn < 0) continue;
        if (i > 0 && (s + i) % (i + 1) === 0) continue;
        const band = Math.floor(((a + spin) / (Math.PI * 2)) * 10 + i) % bands.length;
        const key = outer ? (s % 2 ? 'v' : 'w') : bands[(band + 4) % bands.length];
        b.fillStyle = P[key];
        b.fillRect(Math.round(CX + Math.cos(a) * rx), Math.round(CY + sn * ry), 1, 1);
      }
    }
    // Jets at higher stages.
    if (!back && stage >= 3) {
      const len = Math.round(coreR * (0.8 + stage * 0.25));
      for (let j = 2; j < len; j++) {
        if (!dith(CX, j + Math.floor(t * 20), 1 - j / len)) continue;
        b.fillStyle = P[j % 3 ? 'v' : 'c'];
        b.fillRect(CX, CY - Math.round(coreR) - j, 1, 1);
        b.fillRect(CX, CY + Math.round(coreR) + j, 1, 1);
      }
    }
  }

  function drawSingu(t, coreR, surge, dt) {
    // Expression state.
    mood.t = Math.max(0, mood.t - dt);
    if (!mood.t) mood.kind = '';
    mood.munch = Math.max(0, mood.munch - dt);
    mood.blink -= dt;
    if (mood.blink <= 0) { mood.blinkT = 0.12; mood.blink = 2 + Math.random() * 3.5; }
    mood.blinkT = Math.max(0, mood.blinkT - dt);
    idleTime += dt;
    look.t = Math.max(0, look.t - dt);

    const R = Math.max(5, Math.round(coreR * (1 + fx.gulp * 0.12)));
    const bobY = reduced ? 0 : Math.round(Math.sin(t * 2.2) * 0.8);
    const cx = CX, cy = CY + bobY;
    const squash = fx.gulp > 0.5 ? 1 : 0;
    // Glow halo (dithered).
    const haloKey = surge ? '3' : '9';
    for (let dy = -R - 3; dy <= R + 3; dy++) for (let dx = -R - 3; dx <= R + 3; dx++) {
      const d = Math.hypot(dx, dy * 1.05);
      if (d > R + 0.5 && d < R + 3.5 && dith(cx + dx, cy + dy, (R + 3.5 - d) / 3 * (0.55 + Math.min(1, fx.flash) * 0.3))) { b.fillStyle = P[haloKey]; b.fillRect(cx + dx, cy + dy, 1, 1); }
    }
    // Body with a photon rim.
    const rim = P[surge ? '4' : 'b'];
    for (let dy = -R + squash; dy <= R - squash; dy++) {
      const hw = Math.floor(Math.sqrt(R * R - dy * dy)) + squash;
      b.fillStyle = P.k;
      b.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
      b.fillStyle = rim;
      b.fillRect(cx - hw, cy + dy, 1, 1); b.fillRect(cx + hw, cy + dy, 1, 1);
    }
    const capW = Math.floor(Math.sqrt(Math.max(0, R * R - (R - squash) * (R - squash)))) + 1;
    b.fillStyle = rim;
    b.fillRect(cx - capW, cy - R + squash, capW * 2 + 1, 1);
    b.fillRect(cx - capW, cy + R - squash, capW * 2 + 1, 1);
    b.fillStyle = P.c;
    b.fillRect(cx - Math.round(R * 0.55), cy - Math.round(R * 0.62), 1, 1);
    b.fillRect(cx - Math.round(R * 0.68), cy - Math.round(R * 0.45), 1, 1);

    // Face.
    const sleepy = idleTime > 25 && !mood.kind;
    const ex = Math.max(2, Math.round(R * 0.4));
    const ew = Math.max(2, Math.round(R * 0.24)), eh = Math.max(2, Math.round(R * 0.32));
    const ey = cy - Math.round(R * 0.18);
    let lx = 0, ly = 0;
    if (look.t > 0) {
      const dx = look.x - cx, dy = look.y - cy, d = Math.hypot(dx, dy) || 1;
      lx = Math.sign(Math.round(dx / d)); ly = Math.sign(Math.round(dy / d));
    }
    for (const side of [-1, 1]) {
      const x0 = cx + side * ex - Math.floor(ew / 2), y0 = ey - Math.floor(eh / 2);
      b.fillStyle = P.c;
      if (mood.kind === 'happy' || sleepy) {
        // ^ ^ happy eyes, or – – sleepy eyes.
        if (sleepy) b.fillRect(x0, y0 + Math.floor(eh / 2), ew, 1);
        else for (let i = 0; i < ew; i++) b.fillRect(x0 + i, y0 + Math.round(Math.abs(i - (ew - 1) / 2)), 1, 1);
      } else if (mood.kind === 'dizzy') {
        const s = Math.min(ew, eh);
        for (let i = 0; i < s; i++) { b.fillRect(x0 + i, y0 + i, 1, 1); b.fillRect(x0 + s - 1 - i, y0 + i, 1, 1); }
      } else if (mood.blinkT > 0) {
        b.fillRect(x0, y0 + Math.floor(eh / 2), ew, 1);
      } else {
        // Big glossy pupils with a white rim and a sparkle: reads as "cute" at any size.
        b.fillStyle = mood.kind === 'star' ? P['4'] : P.c;
        b.fillRect(x0, y0, ew, eh);
        const pw = Math.max(1, ew - 1), ph = Math.max(1, eh - 1);
        const px = x0 + (lx > 0 ? 1 : 0), py = y0 + (ly < 0 ? 0 : 1);
        b.fillStyle = mood.kind === 'star' ? P['3'] : P['8'];
        b.fillRect(px, py, pw, ph);
        b.fillStyle = P.c;
        b.fillRect(px, py, 1, 1);
        if (pw >= 3 && ph >= 3) b.fillRect(px + pw - 1, py + ph - 2, 1, 1);
      }
      // Blush.
      b.fillStyle = P.p;
      const bw = Math.max(1, Math.round(R * 0.15));
      b.fillRect(side > 0 ? x0 + ew : x0 - bw, ey + Math.ceil(eh / 2) + 1, bw, 1);
    }
    // Mouth.
    const my = ey + Math.ceil(eh / 2) + Math.max(2, Math.round(R * 0.18));
    const mw = Math.max(2, Math.round(R * 0.22));
    if (mood.munch > 0) {
      const open = Math.max(1, Math.round(mw * 0.6 * (0.5 + Math.abs(Math.sin(t * 30)) * 0.5)));
      b.fillStyle = P['2']; b.fillRect(cx - Math.floor(mw / 2), my, mw, open + 1);
      b.fillStyle = P.p; b.fillRect(cx - Math.floor(mw / 2) + 1, my + open, Math.max(1, mw - 2), 1);
    } else if (mood.kind === 'happy' || mood.kind === 'star') {
      b.fillStyle = P.p;
      for (let i = -mw; i <= mw; i++) b.fillRect(cx + i, my + (Math.abs(i) < mw ? 1 : 0), 1, 1);
      b.fillStyle = P['2']; b.fillRect(cx - mw + 1, my + 1, mw * 2 - 1, 1);
    } else if (mood.kind === 'dizzy') {
      b.fillStyle = P.p; for (let i = -mw; i <= mw; i++) b.fillRect(cx + i, my + (i & 1), 1, 1);
    } else {
      // Little cat mouth: w
      b.fillStyle = P.p;
      b.fillRect(cx - 2, my, 1, 1); b.fillRect(cx - 1, my + 1, 1, 1); b.fillRect(cx, my, 1, 1); b.fillRect(cx + 1, my + 1, 1, 1); b.fillRect(cx + 2, my, 1, 1);
    }
    if (sleepy) {
      const zt = (t % 2) / 2;
      b.fillStyle = P.d;
      const zx = cx + R + 2 + Math.round(zt * 4), zy = cy - R - Math.round(zt * 6);
      b.fillRect(zx, zy, 3, 1); b.fillRect(zx + 1, zy + 1, 1, 1); b.fillRect(zx, zy + 2, 3, 1);
    }
  }

  let droneTick = 0;
  function drawDrones(dt, coreR) {
    if (!drones.length) return;
    droneTick += dt;
    const emit = droneTick > 0.5;
    if (emit) droneTick = 0;
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      d.a += dt * d.s * (reduced ? 0.4 : 1);
      const x = CX + Math.cos(d.a) * coreR * d.r * 1.9, y = CY + Math.sin(d.a) * coreR * d.r * 0.7;
      if (Math.sin(d.a) < -0.2 && Math.hypot(x - CX, y - CY) < coreR) continue;
      sprite('drone', x, y);
      if (emit && i === Math.floor(Math.random() * drones.length) && !reduced) addParticle(x, y, (CX - x) * 2.2, (CY - y) * 2.2, 0.4, '5');
    }
  }

  function drawPets(t, coreR, back) {
    if (!pets.length) return;
    const rx = Math.max(coreR * 3.3, 26), ry = rx * 0.42;
    for (const pet of pets) {
      const a = pet.phase + t * 0.22;
      const sn = Math.sin(a);
      if (back ? sn >= 0 : sn < 0) continue;
      const x = CX + Math.cos(a) * rx;
      const y = CY + sn * ry + Math.round(Math.sin(t * 3 + pet.bob) * 1.5) - 2;
      sprite('critter_' + pet.id, x, y);
    }
  }

  function drawComet(t) {
    const c = world.comet;
    if (!c) return;
    const x = sx(c.x), y = sy(c.y);
    const sp = Math.hypot(c.vx, c.vy) || 1;
    const ux = -c.vx / sp, uy = -c.vy / sp;
    const len = Math.round(0.4 * S);
    const keys = ['c', '4', '4', '3', '3', '2', '1'];
    for (let i = 2; i < len; i++) {
      const fr = i / len;
      const wob = Math.round(Math.sin(i * 0.7 - t * 12) * fr * 1.5);
      const px = Math.round(x + ux * i - uy * wob), py = Math.round(y + uy * i + ux * wob);
      if (!dith(px, py, 1 - fr * 0.9)) continue;
      b.fillStyle = P[keys[Math.min(keys.length - 1, Math.floor(fr * keys.length))]];
      b.fillRect(px, py, 1, 1);
    }
    sprite('cometHead', x, y);
    if (Math.floor(t * 6) % 2) { b.fillStyle = P.c; b.fillRect(x - 3, y, 1, 1); b.fillRect(x + 3, y, 1, 1); b.fillRect(x, y - 3, 1, 1); b.fillRect(x, y + 3, 1, 1); }
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
      toast('<b>New day!</b> ' + mutation.name + ': ' + mutation.desc + '. Daily gift ready.', 'violet');
    }

    if (!COVER) PS.step(world, state, stats, dt, ev);
    for (let i = 0; i < ev.length; i++) if (ev[i].t === 'level' || ev[i].t === 'discover') { refreshStats(); break; }
    handleEvents();
    draw(dt, tNow / 1000);
    updateHud();
    updateShop(false);
    updateMilestone();
    updateCollapseCard();
    updateCapsules(false);

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
    staticArt();
    buildShop();
    setBuyMode(state.settings.buyMode);
    syncDrones();
    syncPets();
    fitApp();
    resize();
    window.addEventListener('resize', fitApp);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(el.universe);
    else window.addEventListener('resize', resize);
    if (document.fonts && document.fonts.load) Promise.all(['400 16px Cozy', '700 16px Cozy'].map(function (f) { return document.fonts.load(f, 'Ab12'); })).catch(function () {});

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
        syncDrones(); syncPets(); rebuildBackground(false); shopDirty = true; collapseKey = ''; collectionKey = '';
        Sound.setMuted(state.settings.muted);
        toast('<b>Save:</b> loaded your synced universe.', 'violet');
      }
      save();
    });
    Platform.on('mute', function (m) { Sound.setExternalMute(m); });
    Platform.on('pause', function (p) { Sound.setExternalMute(!!p); });

    // Debug/test handle. Single-player only; nothing here can affect other players.
    window.__ps = {
      get state() { return state; }, get world() { return world; }, get stats() { return stats; },
      PS: PS, save: save,
      refresh: function () { refreshStats(); shopDirty = true; syncDrones(); syncPets(); rebuildBackground(false); collapseKey = ''; collectionKey = ''; },
      pulse: doPulse,
      freeze: function () { frozen = true; },
      setTab: setTab
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
    ['cat', 'dragon', 'jelly', 'penguin', 'frog', 'whale'].forEach(function (id) { state.critters[id] = { stars: 3, copies: 0 }; });
    refreshStats();
    syncDrones(); syncPets();
    rebuildBackground(false);
    const rng = PS.mulberry32(7);
    world = PS.createWorld(rng, state, stats);
    const types = ['dust', 'dust', 'ice', 'ice', 'crystal', 'shard', 'dust', 'ice'];
    world.frags.length = 0;
    for (let i = 0; i < 40; i++) {
      world.frags.push({ type: types[i % types.length], r: 0.42 + rng() * 0.62, a: rng() * 6.28, size: 1, spin: rng() * 6, wob: rng() * 6, state: PS.ORBIT, alpha: 1, inRange: true, t: 0, delay: 0, dur: 1, r0: 0, a0: 0 });
    }
    world.rings.push({ t: 0.16, max: 0.9, auto: false });
    world.comet = { x: 0.75, y: -0.45, vx: -0.2, vy: 0.08, t: 0, life: 99, caught: false, fall: 0 };
    mood.kind = 'happy'; mood.t = 1e9;
  }

  boot();
})();
