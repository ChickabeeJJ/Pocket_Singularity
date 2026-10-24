/* Pocket Singularity — browser shell: UI, input, saves. The scene is drawn by render.js.
 * Game rules live in core.js; this file only reads the authoritative `state` and shows it.
 */
(function () {
  'use strict';

  const PS = window.PS;
  const SPR = window.PSSprites;
  const Sound = window.PSAudio;
  const Platform = window.PSPlatform;
  const Scene = window.PSScene;
  const C = PS.CONFIG;
  const CT = PS.CT;
  const fmt = PS.fmt;
  SPR.setPets(CT.PETS);

  const SAVE_KEY = 'pocket-singularity:save';
  const BAK_KEY = 'pocket-singularity:backup';
  const BAD_KEY = 'pocket-singularity:corrupt';
  const QS = new URLSearchParams(location.search);
  const COVER = QS.has('cover');
  const RARITY_COL = SPR.RARITY_HEX;
  const RARITY_NAMES = C.gacha.rarities.map(function (r) { return r.name; });
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
  // DOM helpers
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    scene: $('universe'), cv: $('cv'), matter: $('matter'), perPulse: $('per-pulse'), perSec: $('per-sec'), multChip: $('mult-chip'),
    combo: document.querySelector('.combo'), comboFill: $('combo-fill'), comboVal: $('combo-val'),
    tickets: $('btn-tickets'), ticketCount: $('ticket-count'), shards: $('btn-shards'), shardCount: $('shard-count'), sdBtn: $('btn-stardust'), sdCount: $('sd-count'),
    hint: $('hint'), hintText: $('hint-text'), sectorNum: $('sector-num'), sectorName: $('sector-name'), mut: $('mutation-chip'),
    leader: $('btn-leader'), settings: $('btn-settings'), sound: $('btn-sound'), atlasBtn: $('btn-atlas'), giftChip: $('gift-chip'), giftText: $('gift-text'),
    formNum: $('form-num'), formName: $('form-name'), formNext: $('form-next'), formFill: $('form-fill'),
    msText: $('ms-text'), msFill: $('ms-fill'), reelVal: $('reel-val'), reelFill: $('reel-fill'),
    reel: $('reel'), reelResult: $('reel-result'), surge: $('surge'), banner: $('banner'), toasts: $('toasts'), oc: $('overcharge'), ocTimer: $('oc-timer'),
    tabs: $('tabs'),
    gens: $('gens'), goals: $('goals'),
    upCount: $('up-count'), buyAll: $('buy-all'), catalog: $('catalog'), upNext: $('up-next'), shop: $('shop'), collapse: $('collapse-card'),
    machine: $('machine'), mTickets: $('m-tickets'), pull1: $('pull1'), pull10: $('pull10'), odds: $('odds'), collection: $('collection'), colCount: $('col-count'), petBonus: $('pet-bonus'),
    forge: $('forge'), equipped: $('equipped'), slotCount: $('slot-count'), relicSum: $('relic-sum'), invCount: $('inv-count'), fuseRow: $('fuse-row'), inventory: $('inventory'),
    rewards: $('tab-rewards'),
    achCount: $('ach-count'), achBonus: $('ach-bonus'), claimAll: $('claim-all'), trophies: $('trophies'),
    modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalActions: $('modal-actions'), modalX: $('modal-x')
  };
  const badges = {};
  el.tabs.querySelectorAll('.tab').forEach(function (b) { badges[b.dataset.tab] = b.querySelector('.badge'); });

  // Sets text only when it changed, so per-frame UI updates never thrash the DOM.
  const textCache = new WeakMap();
  function setText(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.textContent = s; } }
  function setHTML(node, s) { if (textCache.get(node) !== s) { textCache.set(node, s); node.innerHTML = s; } }
  function setWidth(node, frac) {
    const w = (Math.max(0, Math.min(1, frac || 0)) * 100).toFixed(1) + '%';
    if (node.style.width !== w) node.style.width = w;
  }
  function setClass(node, cls) { if (node.className !== cls) node.className = cls; }
  function flash(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  function fmtMult(m) { return m < 10 ? m.toFixed(2) : fmt(m); }

  // Sprite name for an upgrade-catalog icon key.
  function iconSprite(key) {
    if (/^gen\d+$/.test(key)) return key;
    if (key === 'clover') return 'up_luck';
    if (key === 'ticket' || key === 'ice' || key === 'crystal' || key === 'shard' || key === 'comet') return key;
    return 'icon_' + key;
  }
  function relicSprite(r) {
    const noun = CT.RELICS.stats.find(function (s) { return s.k === r.a[0].k; }).noun;
    return 'relic_' + noun + '_' + r.r;
  }

  function staticArt() {
    $('ticket-icon').innerHTML = SPR.img('ticket', 1.5);
    $('shard-icon').innerHTML = SPR.img('icon_shardc', 1);
    $('sd-icon').innerHTML = SPR.img('stardust', 1.5);
    $('leader-icon').innerHTML = SPR.img('icon_leader', 1.25);
    $('atlas-icon').innerHTML = SPR.img('star', 1.5);
    $('gift-icon').innerHTML = SPR.img('icon_gift2', 1.25);
    $('m-ticket-icon').innerHTML = SPR.img('ticket', 1.5);
    el.tabs.querySelectorAll('.ti').forEach(function (n) { n.innerHTML = SPR.img(n.dataset.icon, 1.5); });
    el.reel.querySelectorAll('.slot img').forEach(function (img) { img.src = SPR.url('singu', 1); });
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  let tab = 'harvest';
  const TAB_NAMES = ['harvest', 'upgrades', 'pets', 'relics', 'rewards', 'trophies'];
  function setTab(name) {
    tab = name;
    el.tabs.querySelectorAll('.tab').forEach(function (btn) { btn.classList.toggle('on', btn.dataset.tab === name); btn.setAttribute('aria-selected', btn.dataset.tab === name); });
    TAB_NAMES.forEach(function (n) { $('tab-' + n).hidden = n !== name; });
    dirty.all = true;
    updatePanel(true);
  }
  el.tabs.addEventListener('click', function (e) { const b = e.target.closest('.tab'); if (b) { Sound.unlock(); setTab(b.dataset.tab); } });

  const dirty = { all: true };
  function markDirty() { dirty.all = true; }

  // ---------------------------------------------------------------------------
  // Harvest tab: generators and next goals
  // ---------------------------------------------------------------------------
  const genRows = {};
  function buildGens() {
    el.gens.innerHTML = '';
    CT.GENERATORS.forEach(function (g, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card gen';
      b.innerHTML = '<span class="gi">' + SPR.img('gen' + i, 2) + '<span class="go num"></span></span><span class="gn"></span><span class="gr num"></span><span class="gm"><i></i></span><span class="gc num"></span>';
      b.addEventListener('click', function () { tryBuyGen(g.id, b); });
      el.gens.appendChild(b);
      genRows[g.id] = { b: b, n: b.querySelector('.gn'), o: b.querySelector('.go'), r: b.querySelector('.gr'), m: b.querySelector('.gm i'), c: b.querySelector('.gc'), g: g, i: i };
    });
  }

  function updateGens() {
    const mode = state.settings.buyMode;
    let shownLocked = false;
    CT.GENERATORS.forEach(function (g) {
      const row = genRows[g.id];
      const vis = PS.genVisible(state, g.id);
      if (!vis) {
        row.b.hidden = shownLocked;
        if (!shownLocked) {
          shownLocked = true;
          setClass(row.b, 'card gen locked');
          setText(row.n, '???');
          setText(row.o, '');
          setText(row.r, 'Unlocks near ' + fmt(g.cost * 0.6) + ' Matter eaten');
          setWidth(row.m, state.lifetime / (g.cost * 0.6));
          setHTML(row.c, fmt(g.cost));
        }
        return;
      }
      row.b.hidden = false;
      const owned = state.gens[g.id] || 0;
      const q = PS.genQuote(state, g.id, mode);
      const can = q.cost <= state.matter;
      setText(row.n, g.name);
      setText(row.o, owned ? String(owned) : '');
      const rate = stats.genRates[g.id] || 0;
      const each = g.rate * stats.globalMult * (1 + stats.critters.gen + stats.relics.gen);
      setText(row.r, owned ? '+' + fmt(rate) + '/s · ' + Math.round(rate / Math.max(1e-9, stats.genPerSec) * 100) + '%' : '+' + fmt(each) + '/s each · ' + g.desc);
      const nm = PS.nextGenMilestone(owned);
      const prev = CT.GEN_MILESTONES[CT.GEN_MILESTONES.indexOf(nm) - 1] || 0;
      setWidth(row.m, nm ? (owned - prev) / (nm - prev) : 1);
      row.b.title = g.name + ': ' + g.desc + (nm ? ' · own ' + nm + ' for ×2 output' : '');
      setHTML(row.c, fmt(q.cost) + '<small>Buy ×' + q.n + '</small>');
      setClass(row.b, 'card gen ' + (can ? 'can' : 'cant'));
    });
  }

  function tryBuyGen(id, node) {
    Sound.unlock();
    const before = state.gens[id] || 0;
    const n = PS.buyGen(state, id, state.settings.buyMode);
    if (!n) { Sound.deny(); return; }
    PS.mark(state, 'firstBuy');
    PS.checkProgress(state, ev);
    refreshStats();
    Scene.sync();
    markDirty();
    if (node) flash(node, 'bought');
    Sound.buy();
    if (PS.genMilestones(before + n) > PS.genMilestones(before)) toast('<b>' + PS.GEN[id].name + ' ×2!</b> ' + (before + n) + ' owned: output doubled', 'green');
    save();
  }

  function formProgress() {
    const cur = CT.FORMS[state.form], nxt = CT.FORMS[state.form + 1];
    if (!nxt) return 1;
    const lo = Math.log10(Math.max(1, cur.at)), hi = Math.log10(nxt.at), v = Math.log10(Math.max(1, state.lifetime));
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  }

  function goalsHTML() {
    const out = [];
    // Closest harvester milestone.
    let best = null;
    CT.GENERATORS.forEach(function (g) {
      const n = state.gens[g.id] || 0;
      if (!n) return;
      const nm = PS.nextGenMilestone(n);
      if (!nm) return;
      const cost = PS.genCost(g.id, n, nm - n);
      if (!best || cost < best.cost) best = { g: g, nm: nm, n: n, cost: cost };
    });
    if (best) out.push('<div class="goal">' + SPR.img('gen' + best.g.index, 1) + '<span>Own <b>' + best.nm + '</b> ' + best.g.name + 's: <b>×2</b></span><span class="gbar"><i style="width:' + (best.n / best.nm * 100).toFixed(0) + '%"></i></span></div>');
    const av = PS.availableUpgrades(state);
    if (av.length) {
      const u = av[0];
      out.push('<div class="goal">' + SPR.img(iconSprite(u.icon), 1) + '<span>Upgrade: <b>' + u.name + '</b></span><span class="gbar"><i style="width:' + Math.min(100, state.matter / u.cost * 100).toFixed(0) + '%"></i></span></div>');
    }
    const f = CT.FORMS[state.form + 1];
    if (f) out.push('<div class="goal">' + SPR.img('singu', 1) + '<span>Grow into <b>' + f.name + '</b>: ×' + CT.FORM_MULT + ' Matter</span><span class="gbar"><i style="width:' + (formProgress() * 100).toFixed(0) + '%"></i></span></div>');
    return out.join('');
  }

  function setBuyMode(m) {
    state.settings.buyMode = m;
    document.querySelectorAll('.buy-mode button').forEach(function (btn) { btn.classList.toggle('on', Number(btn.dataset.mode) === m); });
    markDirty();
  }
  document.querySelectorAll('.buy-mode button').forEach(function (btn) {
    btn.addEventListener('click', function () { setBuyMode(Number(btn.dataset.mode)); save(); });
  });

  // ---------------------------------------------------------------------------
  // Upgrades tab: catalog, Singu powers, Collapse
  // ---------------------------------------------------------------------------
  const STAT_TEXT = {
    pulses: 'Pulse {n} times', lifetime: 'Eat {n} Matter in total', captures: 'Swallow {n} fragments', comets: 'Catch {n} comets',
    lucky: 'Land {n} Lucky Pulses', spins: 'Spin the Star Reel {n} times', hatches: 'Hatch {n} capsules', pets: 'Own {n} pets', ach: 'Unlock {n} trophies',
    comboMaxed: 'Max your combo {n} times', bestChain: 'Make a chain of {n}', relicsMade: 'Forge {n} relics', upgrades: 'Buy {n} upgrades'
  };
  function needText(need) {
    if (need.stat.indexOf('gen:') === 0) { const g = PS.GEN[need.stat.slice(4)]; return 'Own ' + fmt(need.n) + ' ' + (g ? g.name : need.stat.slice(4)) + (need.n > 1 ? 's' : ''); }
    const t = STAT_TEXT[need.stat];
    return t ? t.replace('{n}', fmt(need.n)) : need.stat + ' ' + fmt(need.n);
  }

  let catalogKey = '';
  const upCells = [];
  function updateCatalog() {
    const av = PS.availableUpgrades(state).slice(0, 48);
    const key = av.map(function (u) { return u.id; }).join(',');
    if (key !== catalogKey) {
      catalogKey = key;
      upCells.length = 0;
      el.catalog.innerHTML = av.length ? av.map(function (u) {
        return '<button type="button" class="up" data-up="' + u.id + '" title="' + u.name + ': ' + u.desc + '"><span class="ui">' + SPR.img(iconSprite(u.icon), 2) + '</span><span class="uc num">' + fmt(u.cost) + '</span></button>';
      }).join('') : '<div class="empty">No upgrades available right now. Keep growing to unlock more.</div>';
      el.catalog.querySelectorAll('.up').forEach(function (b) { upCells.push({ b: b, u: PS.UPGI[b.dataset.up] }); });
    }
    let affordable = 0;
    upCells.forEach(function (c) { const can = c.u.cost <= state.matter; if (can) affordable++; setClass(c.b, 'up' + (can ? ' can' : '')); });
    el.buyAll.disabled = affordable === 0;
    setText(el.buyAll, affordable ? 'Buy all affordable (' + affordable + ')' : 'Buy all affordable');
    setText(el.upCount, Object.keys(state.bought).length + ' / ' + CT.UPGRADES.length);
    // The next locked upgrade, so there is always something to aim for.
    let next = null;
    for (const u of CT.UPGRADES) if (!state.bought[u.id] && !PS.upgradeUnlocked(state, u) && (!next || u.cost < next.cost)) next = u;
    setHTML(el.upNext, next ? 'Next unlock: <b>' + next.name + '</b> · ' + needText(next.need) : 'Every upgrade unlocked!');
  }
  el.catalog.addEventListener('click', function (e) {
    const b = e.target.closest('[data-up]');
    if (!b) return;
    const u = PS.UPGI[b.dataset.up];
    if (!PS.buyUpgrade(state, u.id)) { Sound.deny(); toast('<b>' + u.name + '</b>: ' + u.desc + ' · ' + fmt(u.cost) + ' Matter'); return; }
    afterUpgrade([u]);
  });
  el.buyAll.addEventListener('click', function () {
    const got = [];
    for (const u of PS.availableUpgrades(state)) { if (u.cost > state.matter) break; if (PS.buyUpgrade(state, u.id)) got.push(u); }
    if (!got.length) { Sound.deny(); return; }
    afterUpgrade(got);
  });
  function afterUpgrade(list) {
    Sound.unlock();
    PS.mark(state, 'firstBuy');
    PS.checkProgress(state, ev);
    refreshStats();
    Scene.sync();
    markDirty();
    Sound.buy();
    Scene.onEvent({ t: 'buy' });
    toast(list.length === 1 ? '<b>' + list[0].name + '</b> · ' + list[0].desc : '<b>' + list.length + ' upgrades</b> bought', 'green');
    save();
  }

  const powCards = {};
  function buildPowers() {
    el.shop.innerHTML = '';
    C.upgrades.forEach(function (u) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card pow';
      btn.title = u.name + ': ' + u.desc;
      btn.innerHTML = '<span class="ic">' + SPR.img('up_' + u.id, 2) + '</span><span class="nm">' + u.name + '<span class="lv num"></span></span><span class="cost num"></span><span class="fx"></span>';
      btn.addEventListener('click', function () { tryBuyPower(u.id, btn); });
      el.shop.appendChild(btn);
      powCards[u.id] = { b: btn, lv: btn.querySelector('.lv'), cost: btn.querySelector('.cost'), fx: btn.querySelector('.fx') };
    });
  }
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
      case 'resonance': return 'Chain ' + pair('+' + Math.round(s0.chainStep * 100) + '%', '+' + Math.round(s1.chainStep * 100) + '%') + ' each';
      case 'focus': return 'Value ' + pair('×' + fmtMult(s0.focusMult), '×' + fmtMult(s1.focusMult));
      case 'luck': return 'Lucky ' + pair(Math.round(s0.luckChance * 100) + '%', Math.round(s1.luckChance * 100) + '%');
    }
    return '';
  }
  let powKey = '';
  function updatePowers() {
    const mode = state.settings.buyMode;
    const k = JSON.stringify(state.levels) + mode + mutation.id + Object.keys(state.critters).length;
    const fresh = k !== powKey;
    powKey = k;
    C.upgrades.forEach(function (u) {
      const c = powCards[u.id];
      const lvl = state.levels[u.id];
      const q = PS.bulkQuote(state, u.id, mode);
      const maxed = lvl >= u.max;
      const can = !maxed && q.cost <= state.matter;
      setHTML(c.lv, u.max >= 100 ? 'Lv ' + lvl : lvl + '/' + u.max);
      setHTML(c.cost, maxed ? 'MAX' : fmt(q.cost) + (q.n > 1 ? ' ×' + q.n : ''));
      if (fresh) setHTML(c.fx, effectText(u.id, lvl));
      setClass(c.b, 'card pow ' + (maxed ? 'max' : can ? 'can' : 'cant'));
    });
  }
  function tryBuyPower(id, node) {
    Sound.unlock();
    const n = PS.buy(state, id, state.settings.buyMode);
    if (!n) { Sound.deny(); return; }
    PS.mark(state, 'firstBuy');
    PS.checkProgress(state, ev);
    refreshStats();
    markDirty();
    flash(node, 'bought');
    Sound.buy();
    save();
  }

  let collapseKey = '';
  function updateCollapseCard() {
    const gain = PS.stardustFor(state);
    const can = PS.canCollapse(state);
    const minName = PS.sectorInfo(C.collapse.minSector).name;
    const next = C.research.find(function (r) { return state.stardust < r.at; });
    const nextLine = next ? 'Next research: <b>' + next.name + '</b> at <span class="sd">' + next.at + '</span>' : 'All Stardust research unlocked';
    let key, html;
    if (!can) {
      const p = Math.min(1, Math.log10(1 + state.runTotal) / Math.log10(1 + PS.sectorInfo(C.collapse.minSector).at));
      key = 'L' + Math.floor(p * 100) + '_' + state.stardust;
      html = '<div class="row"><span class="ct">Collapse</span><span class="cs">' + (state.stardust ? '<span class="sd">' + state.stardust + ' Stardust</span> ×' + stats.sdMult.toFixed(2) : 'Locked') + '</span></div>' +
        '<div class="cs">Reach <b>' + minName + '</b> to fold this universe into permanent Stardust (+' + Math.round(C.collapse.step * 100) + '% Matter each).</div>' +
        '<div class="mini-bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>' +
        (state.stardust ? '<div class="cs">' + nextLine + '</div>' : '');
    } else {
      key = 'A' + gain + '_' + state.stardust;
      html = '<div class="row"><span class="ct">Collapse ready!</span><span class="cs"><span class="sd">' + state.stardust + ' Stardust</span></span></div>' +
        '<div class="row"><span class="cs">Gain <span class="sd">+' + gain + '</span> · Matter ×' + stats.sdMult.toFixed(2) + ' > ×' + (1 + C.collapse.step * (state.stardust + gain)).toFixed(2) + '</span>' +
        '<button class="btn violet sm" type="button" data-act="collapse">Collapse</button></div>' +
        '<div class="cs">' + nextLine + '</div>';
    }
    if (key !== collapseKey) { collapseKey = key; el.collapse.innerHTML = html; }
  }
  el.collapse.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (btn && btn.dataset.act === 'collapse') openCollapse();
    else openResearch();
  });

  // ---------------------------------------------------------------------------
  // Pets tab: capsule machine, odds, collection
  // ---------------------------------------------------------------------------
  const mctx = el.machine.getContext('2d');
  let machineFrame = -1;
  function drawMachine(f) {
    if (f === machineFrame) return;
    machineFrame = f;
    mctx.clearRect(0, 0, 56, 72);
    mctx.drawImage(SPR.get('machine' + f), 0, 0);
  }
  let crankUntil = 0;

  let collectionKey = '';
  let hatching = false;
  let hatchCleanup = null;
  function updatePets() {
    const G = C.gacha;
    setText(el.mTickets, fmt(state.tickets));
    setHTML(el.pull1.querySelector('small'), String(G.cost));
    setHTML(el.pull10.querySelector('small'), String(G.cost10));
    el.pull1.disabled = state.tickets < G.cost || hatching;
    el.pull10.disabled = state.tickets < G.cost10 || hatching;
    const odds = PS.gachaOdds(state);
    const g = state.gacha;
    const pctTxt = (p) => p >= 0.995 ? '100%' : p < 0.0005 ? '0%' : (p * 100).toFixed(p < 0.1 ? 1 : 0) + '%';
    setHTML(el.odds, 'Next hatch: ' + G.rarities.map(function (r, i) { return '<b class="r' + i + '">' + r.name + ' ' + pctTxt(odds[i]) + '</b>'; }).join(' · ') +
      '<br>Epic+ within <b>' + (G.pityEpic - g.sinceEpic) + '</b> · Legendary within <b>' + (G.pityLegend - g.sinceLegend) + '</b> · Mythic within <b>' + (G.pityMythic - g.sinceMythic) + '</b> · ×10 always has a Rare+');
    const key = JSON.stringify(state.critters);
    if (key !== collectionKey) {
      collectionKey = key;
      setText(el.colCount, Object.keys(state.critters).length + '/' + C.critters.length);
      setText(el.petBonus, 'Pets: ×' + fmtMult(stats.critterMult * stats.petMult) + ' Matter');
      // Owned pets first (rarest first), then the ones still to find (most likely first).
      const sorted = C.critters.slice().sort(function (a, b) {
        const oa = state.critters[a.id] ? 1 : 0, ob = state.critters[b.id] ? 1 : 0;
        return ob - oa || (oa ? b.rarity - a.rarity : a.rarity - b.rarity);
      });
      el.collection.innerHTML = sorted.map(function (c) {
        const own = state.critters[c.id];
        return '<div class="crit ra' + c.rarity + (own ? '' : ' locked') + '" title="' + (own ? c.name + ': ' + PS.critterText(c, own.stars) : RARITY_NAMES[c.rarity] + ' pet, not hatched yet') + '">' +
          SPR.img('pet_' + c.id, 2) + '<span class="cn">' + (own ? c.name : '???') + '</span><span class="st r' + c.rarity + '">' + (own ? '★'.repeat(own.stars) : RARITY_NAMES[c.rarity]) + '</span></div>';
      }).join('');
      Scene.sync();
    }
  }
  el.pull1.addEventListener('click', function () { doPull(1); });
  el.pull10.addEventListener('click', function () { doPull(10); });
  el.tickets.addEventListener('click', function () { setTab('pets'); });

  function doPull(count) {
    if (hatching) return;
    Sound.unlock();
    const res = PS.pull(state, count, Math.random);
    if (!res) { Sound.deny(); return; }
    hatching = true;
    PS.checkProgress(state, ev);
    save();
    refreshStats();
    markDirty();
    updatePets();
    flash(el.machine.parentNode, 'shake');
    crankUntil = performance.now() + 700;
    Sound.crank();
    if (res.length === 1) hatchOne(res[0]); else hatchMany(res);
  }

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
    PS.checkProgress(state, ev);
    refreshStats();
    markDirty();
    save();
  }

  function hatchOne(r) {
    const c = PS.CRIT[r.id];
    const body = '<div class="hatch"><div class="stage"><div class="rays"></div><div class="cap">' + SPR.img('capsule0', 4) + '</div></div><div class="reveal-text"></div></div>';
    openModal('hatch', 'Hatching…', body, []);
    const stage = el.modalBody.querySelector('.stage');
    const cap = el.modalBody.querySelector('.cap');
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
      stage.insertAdjacentHTML('beforeend', '<div class="crit-big">' + SPR.img('pet_' + r.id, 6) + '</div>');
      text.innerHTML = '<div class="rarity" style="color:' + RARITY_COL[r.rarity] + '">' + RARITY_NAMES[r.rarity] + '</div>' +
        '<div class="cname">' + c.name + '</div><div class="cbonus">' + PS.critterText(c, r.stars) + '</div>' + resultTag(r);
      el.modalTitle.textContent = r.isNew ? 'New pet!' : 'Hatched!';
      Sound.reveal(r.rarity);
      if (r.rarity >= 3) { Scene.bigFlash(2); Platform.happytime(); }
      setActions([{ label: 'Yay!', cls: 'primary', fn: closeModal }]);
      finishHatch();
    }
    // The capsule colour teases the rarity: it climbs through lower colours before settling.
    later(380, function () { Sound.drop(); cap.classList.add('wobble'); });
    for (let i = 0; i < 6; i++) {
      later(520 + i * 150, function () {
        Sound.wobble();
        cap.innerHTML = SPR.img('capsule' + Math.min(r.rarity, Math.floor((i / 5) * (r.rarity + 1))), 4);
      });
    }
    later(520 + 6 * 150 + (r.rarity >= 3 ? 400 : 120), function () {
      cap.innerHTML = SPR.img('capsuleOpen' + r.rarity, 4);
      later(160, reveal);
    });
    setActions([{ label: 'Skip', fn: reveal }]);
    hatchCleanup = reveal;
  }

  function hatchMany(list) {
    const body = '<div class="hatch"><div class="multi">' + list.map(function (r, i) {
      return '<div class="cell" data-i="' + i + '"><span class="mc">' + SPR.img('capsule0', 2) + '</span></div>';
    }).join('') + '</div><p class="small">Best: <b class="best">…</b></p></div>';
    openModal('hatch', 'Hatching ×' + list.length + '…', body, []);
    const cells = el.modalBody.querySelectorAll('.cell');
    let i = 0, done = false;
    const best = list.reduce(function (a, c) { return c.rarity > a.rarity ? c : a; }, list[0]);
    function open(k) {
      const r = list[k], cell = cells[k];
      cell.className = 'cell ra' + r.rarity;
      cell.innerHTML = SPR.img('pet_' + r.id, 2) + '<span>' + PS.CRIT[r.id].name + '</span>' + resultTag(r);
    }
    const iv = setInterval(function () {
      if (i >= list.length) { finish(); return; }
      open(i);
      if (list[i].rarity >= 2) Sound.reveal(Math.min(2, list[i].rarity - 1)); else Sound.wobble();
      i++;
    }, 230);
    function finish() {
      if (done) return;
      done = true;
      clearInterval(iv);
      for (; i < list.length; i++) open(i);
      el.modalBody.querySelector('.best').textContent = PS.CRIT[best.id].name + ' (' + RARITY_NAMES[best.rarity] + ')';
      el.modalTitle.textContent = 'Hatched ×' + list.length + '!';
      Sound.reveal(best.rarity);
      if (best.rarity >= 3) { Scene.bigFlash(2); Platform.happytime(); }
      setActions([{ label: 'Yay!', cls: 'primary', fn: closeModal }]);
      finishHatch();
    }
    setActions([{ label: 'Skip', fn: finish }]);
    hatchCleanup = finish;
  }

  // ---------------------------------------------------------------------------
  // Relics tab: the forge (push your luck), equipped slots, vault
  // ---------------------------------------------------------------------------
  const RL = CT.RELICS;
  let relicKey = '';
  let forgeAnim = '';
  function relicCard(r, equipped) {
    return '<div class="relic ra' + r.r + (equipped ? ' on' : '') + '" title="' + r.a.map(PS.relicText).join(', ') + '">' + SPR.img(relicSprite(r), 2) +
      '<span class="rn r' + r.r + '">' + r.name + '</span><span class="ra">' + r.a.map(PS.relicText).join('<br>') + '</span>' +
      '<span class="rb"><button type="button" class="' + (equipped ? '' : 'eq') + '" data-rel="' + (equipped ? 'unequip' : 'equip') + ':' + r.uid + '">' + (equipped ? 'Remove' : 'Equip') + '</button>' +
      (equipped ? '' : '<button type="button" data-rel="salvage:' + r.uid + '" title="Salvage for shards">+' + RL.rarities[r.r].salvage + '</button>') + '</span></div>';
  }
  function forgeHTML() {
    const f = state.forge;
    const odds = PS.relicOdds();
    const ladder = '<div class="ladder">' + RL.rarities.map(function (x, i) { return '<span class="r' + i + (f && f.r === i ? ' on' : '') + '">' + x.name + '</span>'; }).join('') + '</div>';
    if (!f) {
      return '<h3>Relic Forge</h3><div class="fdesc">Spend <b>' + RL.cost + '</b> shards to forge a relic, then <b>push your luck</b> to raise its rarity.</div>' +
        '<div class="anvil">' + SPR.img('icon_shardc', 4) + '</div>' + ladder +
        '<div class="fdesc">Forge odds: ' + RL.rarities.map(function (x, i) { return '<b class="r' + i + '">' + (odds[i] * 100).toFixed(odds[i] < 0.01 ? 1 : 0) + '%</b>'; }).join(' · ') + '</div>' +
        '<div class="fbtns"><button class="btn gold" type="button" data-rel="forge"' + (state.shards < RL.cost ? ' disabled' : '') + '>Forge <small>' + RL.cost + ' shards</small></button></div>';
    }
    const top = f.r >= RL.rarities.length - 1;
    const chance = top ? 0 : RL.push[f.r];
    return '<h3>Relic Forge</h3>' +
      '<div class="anvil r' + f.r + (forgeAnim ? ' ' + forgeAnim : '') + '">' + SPR.img(relicSprite(f), 4) + '</div>' + ladder +
      '<div class="rname r' + f.r + '">' + f.name + '</div><div class="affix">' + f.a.map(PS.relicText).join(' · ') + '</div>' +
      (top ? '<div class="fdesc">Mythic! It cannot go any higher.</div>' : '<div class="fdesc">Push: <b>' + Math.round(chance * 100) + '%</b> to become <b class="r' + (f.r + 1) + '">' + RL.rarities[f.r + 1].name + '</b>, otherwise it shatters (refund ' + RL.shatterRefund + ' shards).</div>') +
      '<div class="fbtns">' + (top ? '' : '<button class="btn pink" type="button" data-rel="push">Push ' + Math.round(chance * 100) + '%</button>') +
      '<button class="btn green" type="button" data-rel="keep"' + (state.relics.length >= RL.invCap ? ' disabled' : '') + '>Keep</button></div>' +
      (state.relics.length >= RL.invCap ? '<div class="fdesc">Your vault is full: salvage or fuse relics first.</div>' : '');
  }
  function updateRelics() {
    const key = JSON.stringify([state.forge, state.relics.length, state.relicSeq, state.equipped, Math.floor(state.shards), state.form, state.collapses, forgeAnim]);
    if (key === relicKey) return;
    relicKey = key;
    el.forge.innerHTML = forgeHTML();
    const slots = PS.relicSlots(state);
    setText(el.slotCount, state.equipped.length + '/' + slots);
    const eq = state.equipped.map(function (uid) { return state.relics.find(function (r) { return r.uid === uid; }); }).filter(Boolean);
    let h = eq.map(function (r) { return relicCard(r, true); }).join('');
    for (let i = eq.length; i < slots; i++) h += '<div class="slot-empty">Empty slot</div>';
    if (slots < 6) h += '<div class="slot-empty">' + SPR.img('icon_lock', 1.5) + ' ' + (state.form < 4 ? 'Slot at ' + CT.FORMS[4].name : state.form < 7 ? 'Slot at ' + CT.FORMS[7].name : 'Slot after 3 Collapses') + '</div>';
    el.equipped.innerHTML = h;
    const rb = stats.relics;
    const sum = Object.keys(rb).filter(function (k) { return rb[k] > 0; }).map(function (k) { return PS.relicText({ k: k, v: rb[k] }); });
    setText(el.relicSum, sum.length ? sum.slice(0, 2).join(' · ') + (sum.length > 2 ? ' …' : '') : 'No bonuses yet');
    el.relicSum.title = sum.join(' · ');
    const inv = state.relics.filter(function (r) { return state.equipped.indexOf(r.uid) < 0; }).sort(function (a, b) { return b.r - a.r; });
    setText(el.invCount, state.relics.length + '/' + RL.invCap);
    el.inventory.innerHTML = inv.length ? inv.map(function (r) { return relicCard(r, false); }).join('') : '<div class="empty">Relics you keep land here. Equip them for permanent bonuses, salvage them for shards, or fuse three into a rarer one.</div>';
    const fuse = [];
    for (let r = 0; r < RL.rarities.length - 1; r++) {
      const n = inv.filter(function (x) { return x.r === r; }).length;
      if (n >= RL.fuseNeed) fuse.push('<button class="btn violet" type="button" data-rel="fuse:' + r + '">Fuse 3 ' + RL.rarities[r].name + ' → ' + RL.rarities[r + 1].name + '</button>');
    }
    el.fuseRow.innerHTML = fuse.join('');
  }
  function relicAction(act, arg) {
    Sound.unlock();
    let ok = false;
    if (act === 'forge') {
      ok = !!PS.forgeStart(state, Math.random);
      if (ok) { Sound.forge(); forgeAnim = 'pop'; setTimeout(function () { Sound.reveal(Math.min(4, state.forge ? state.forge.r : 0)); }, 160); }
    } else if (act === 'push') {
      const res = PS.forgePush(state, Math.random);
      ok = !!res;
      if (res && res.ok) {
        forgeAnim = forgeAnim === 'pop' ? 'pop ' : 'pop';   // a changed key re-renders and replays the pop
        Sound.reveal(state.forge.r);
        if (state.forge.r >= 3) { Scene.bigFlash(1.6); Platform.happytime(); }
        toast('<b>Pushed!</b> Now <span class="r' + state.forge.r + '">' + RL.rarities[state.forge.r].name + '</span>', 'pink');
      } else if (res) { forgeAnim = ''; Sound.shatter(); toast('<b>Shattered…</b> +' + res.refund + ' shards back', 'violet'); }
    } else if (act === 'keep') {
      const r = PS.forgeKeep(state);
      ok = !!r;
      if (r) { Sound.buy(); forgeAnim = ''; toast('<b>' + r.name + '</b> ' + (state.equipped.indexOf(r.uid) >= 0 ? 'equipped' : 'stored in your vault'), 'green'); }
    } else if (act === 'equip') {
      ok = PS.equipRelic(state, Number(arg));
      if (!ok) toast('All relic slots are full. Remove one first.');
    } else if (act === 'unequip') ok = PS.unequipRelic(state, Number(arg));
    else if (act === 'salvage') { const g = PS.salvageRelic(state, Number(arg)); ok = g > 0; if (ok) toast('Salvaged for <b>+' + g + ' shards</b>', 'violet'); }
    else if (act === 'fuse') {
      const r = Number(arg);
      const uids = state.relics.filter(function (x) { return x.r === r && state.equipped.indexOf(x.uid) < 0; }).slice(0, RL.fuseNeed).map(function (x) { return x.uid; });
      const made = PS.fuseRelics(state, uids, Math.random);
      ok = !!made;
      if (made) { Sound.reveal(Math.min(4, made.r)); toast('Fused into <b>' + made.name + '</b>!', 'pink'); }
    }
    if (!ok) { Sound.deny(); return; }
    PS.checkProgress(state, ev);
    refreshStats();
    markDirty();
    relicKey = '';
    save();
  }
  [el.forge, el.equipped, el.inventory, el.fuseRow].forEach(function (n) {
    n.addEventListener('click', function (e) { const b = e.target.closest('[data-rel]'); if (!b || b.disabled) return; const p = b.dataset.rel.split(':'); relicAction(p[0], p[1]); });
  });
  el.shards.addEventListener('click', function () { setTab('relics'); });

  // ---------------------------------------------------------------------------
  // Rewards tab: daily login, free capsule, play gifts, quests
  // ---------------------------------------------------------------------------
  const RW = C.rewards;
  let rewardsKey = '';
  let pendingLogin = false;
  let lastClaimables = -1;

  function fmtClock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
  }
  function secsToMidnight() {
    const d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return (m - d) / 1000;
  }

  function rewardHTML(r) {
    const parts = [];
    if (r.tickets) parts.push(SPR.img('ticket', 1) + '<b>' + r.tickets + '</b>');
    if (r.shards) parts.push(SPR.img('icon_shardc', 0.75) + '<b>' + r.shards + '</b>');
    if (r.mins) parts.push(SPR.img('matter', 1.5) + '<b>' + r.mins + 'm</b>');
    if (r.surge) parts.push(SPR.img('comet', 1) + '<b>' + r.surge + 's</b>');
    (r.capsule || []).forEach(function (min) { parts.push(SPR.img('capsule' + min, 1) + '<b class="r' + min + '">' + (min ? RARITY_NAMES[min] + '+' : 'Free') + '</b>'); });
    return '<span class="rw">' + parts.join('') + '</span>';
  }

  function loginRowHTML() {
    const L = state.login;
    const claimedToday = !PS.loginReady(state, todayKey);
    return '<div class="login-row">' + RW.login.map(function (r, d) {
      let cls = 'lcell';
      if (d < L.day) cls += ' got';
      if (d === L.day && !claimedToday) cls += ' today';
      if (r.capsule) cls += ' big';
      return '<div class="' + cls + '"><span class="ld">Day ' + (d + 1) + '</span>' + rewardHTML(PS.loginReward(state, d)) + '</div>';
    }).join('') + '</div>';
  }

  function rewardsHTML() {
    const t = now();
    const L = state.login;
    const loginReady = PS.loginReady(state, todayKey);
    let h = '';
    h += '<section class="rw-sec' + (loginReady ? ' hot' : '') + '"><div class="rw-head"><b>Daily login</b><span>Week ' + (L.week + 1) + ' · Day ' + (L.day + (loginReady ? 1 : 0) || 7) + '/7</span></div>' + loginRowHTML() +
      (loginReady ? '<button class="btn gold" type="button" data-claim="login">Claim Day ' + (L.day + 1) + '</button>'
        : '<div class="small">Next reward in <span class="cd" data-cd="midnight"></span>. Missing a day never resets your calendar.</div>') + '</section>';
    const freeReady = PS.freeCapsuleReady(state, t);
    h += '<section class="rw-sec' + (freeReady ? ' hot' : '') + '"><div class="free-row">' + SPR.img('capsule1', 2) + '<span class="ft">Free capsule<small>A free hatch every 4 hours</small></span>' +
      (freeReady ? '<button class="btn pink sm" type="button" data-claim="free">Hatch free</button>' : '<span class="cd" data-cd="free"></span>') + '</div></section>';
    const chest = PS.chestStatus(state);
    const played = PS.playToday(state);
    const last = RW.playChests[RW.playChests.length - 1].at;
    h += '<section class="rw-sec' + (chest && chest.ready ? ' hot' : '') + '"><div class="rw-head"><b>Play gifts</b><span>' + state.daily.chests + '/' + RW.playChests.length + ' today</span></div>' +
      '<div class="chest-track"><i style="width:' + Math.min(100, played / last * 100).toFixed(1) + '%"></i>' +
      RW.playChests.map(function (c, i) { return '<span class="mk ' + (i < state.daily.chests ? 'got' : chest && i === chest.index && chest.ready ? 'ready' : '') + '" style="left:' + (c.at / last * 100) + '%"></span>'; }).join('') + '</div>' +
      (chest ? '<div class="rw-row"><span class="rt">Gift ' + (chest.index + 1) + ': ' + rewardHTML(chest.reward) + '</span><span class="act">' +
        (chest.ready ? '<button class="btn gold sm" type="button" data-claim="chest">Open</button>' : '<span class="cd" data-cd="chest"></span>') + '</span></div>'
        : '<div class="small">All of today\'s play gifts opened. More tomorrow!</div>') + '</section>';
    h += '<section class="rw-sec"><div class="rw-head"><b>Daily quests</b><span>new in <span class="cd" data-cd="midnight"></span></span></div>';
    for (let i = 0; i < state.daily.quests.length; i++) {
      const p = PS.questProgress(state, i);
      if (!p) continue;
      h += '<div class="rw-row"><span class="rt">' + p.text + ' <small>' + fmt(Math.min(p.cur, p.n)) + '/' + fmt(p.n) + '</small></span><span class="act">' +
        (p.claimed ? '<span class="done">Done ✓</span>' : p.done ? '<button class="btn gold sm" type="button" data-claim="quest:' + i + '">Claim</button>' : rewardHTML(p.def.reward)) + '</span>' +
        '<div class="bar"><i style="width:' + Math.min(100, p.cur / p.n * 100).toFixed(1) + '%"></i></div></div>';
    }
    h += '<div class="rw-sep"></div><div class="rw-row"><span class="rt">Finish all three: ' + rewardHTML(RW.questBonus) + '</span><span class="act">' +
      (state.daily.bonus ? '<span class="done">Done ✓</span>' : PS.questBonusReady(state) ? '<button class="btn gold sm" type="button" data-claim="bonus">Claim</button>' : '') + '</span></div></section>';
    return h;
  }

  function updateCountdowns(root) {
    const t = now();
    const chest = PS.chestStatus(state);
    root.querySelectorAll('[data-cd]').forEach(function (n) {
      const k = n.dataset.cd;
      const v = k === 'midnight' ? secsToMidnight() : k === 'free' ? (state.freeCapAt - t) / 1000 : chest ? chest.left : 0;
      setText(n, fmtClock(v));
    });
  }

  function updateGiftChip() {
    const c = PS.chestStatus(state);
    let text, ready;
    if (c) { ready = c.ready; text = ready ? 'GIFT READY!' : 'Gift in ' + fmtClock(c.left); }
    else { const ms = state.freeCapAt - now(); ready = ms <= 0; text = ready ? 'FREE CAPSULE!' : 'Free capsule ' + fmtClock(ms / 1000); }
    setText(el.giftText, text);
    el.giftChip.classList.toggle('ready', ready);
  }

  function updateRewards() {
    const html = rewardsHTML();
    if (html !== rewardsKey) { rewardsKey = html; el.rewards.innerHTML = html; }
    updateCountdowns(el.rewards);
  }

  function claim(kind, arg) {
    Sound.unlock();
    let reward = null, title = 'Reward!';
    if (kind === 'login') { const r = PS.claimLogin(state, todayKey); if (r) { reward = r.reward; title = 'Day ' + (r.day + 1) + ' reward'; } }
    else if (kind === 'quest') { reward = PS.claimQuest(state, Number(arg)); title = 'Quest reward'; }
    else if (kind === 'bonus') { reward = PS.claimQuestBonus(state); title = 'All quests done'; }
    else if (kind === 'chest') { reward = PS.claimChest(state); title = 'Play gift'; }
    else if (kind === 'free') { reward = PS.claimFreeCapsule(state, now()); title = 'Free capsule'; }
    else if (kind === 'ach') { reward = PS.claimAchievement(state, arg); title = 'Trophy'; }
    if (!reward) { Sound.deny(); return false; }
    const out = PS.grantReward(state, stats, world, reward, Math.random);
    refreshStats();
    markDirty();
    rewardsKey = ''; collectionKey = ''; trophyKey = '';
    save();
    const bits = [];
    if (out.tickets) bits.push('+' + out.tickets + ' tickets');
    if (out.shards) bits.push('+' + out.shards + ' shards');
    if (out.matter) bits.push('+' + fmt(out.matter) + ' Matter');
    if (out.surge) bits.push('Surge +' + out.surge + 's');
    if (kind === 'ach') Sound.achieve(); else Sound.reelWin(out.hatches.length > 0 || kind === 'login');
    Scene.onEvent({ t: 'buy' });
    if (bits.length) toast('<b>' + title + ':</b> ' + bits.join(' · '), 'pink');
    if (out.surge) Scene.mood('star', out.surge);
    if (out.hatches.length) {
      if (modalOpen) { modalOpen = null; el.modal.hidden = true; }
      hatching = true;
      if (out.hatches.length === 1) hatchOne(out.hatches[0]); else hatchMany(out.hatches);
    }
    lastClaimables = -1;
    return true;
  }

  function onClaim(e) {
    const btn = e.target.closest('[data-claim]');
    if (!btn || btn.disabled) return;
    if (e.type === 'click' && e.detail !== 0) return;   // pointer input is handled on pointerdown
    if (e.type === 'pointerdown' && e.button !== 0) return;
    e.preventDefault();
    btn.disabled = true;
    const parts = btn.dataset.claim.split(':');
    claim(parts[0], parts[1]);
  }
  // Claim on pointerdown: the tab re-renders often (countdowns), which could swallow a slow click.
  el.rewards.addEventListener('pointerdown', onClaim);
  el.rewards.addEventListener('click', onClaim);
  el.giftChip.addEventListener('click', function () { setTab('rewards'); });

  function openLogin() {
    const ready = PS.loginReady(state, todayKey);
    const body = '<p>Come back every day for a bigger reward. Day 4 and Day 7 hatch bonus capsules, every finished week makes the calendar richer, and <b>a missed day never resets it</b>.</p>' + loginRowHTML();
    const actions = ready
      ? [{ label: 'Claim Day ' + (state.login.day + 1), cls: 'gold', fn: function (btn) { btn.disabled = true; if (claim('login') && modalOpen === 'login') openLogin(); } }]
      : [{ label: 'See you tomorrow!', cls: 'primary', fn: closeModal }];
    openModal('login', ready ? 'Daily reward!' : 'Claimed!', body, actions);
  }

  // ---------------------------------------------------------------------------
  // Trophies tab
  // ---------------------------------------------------------------------------
  let trophyKey = '';
  let trophySel = null;
  function tInfo(a) {
    const s = state.ach[a.id] || 0;
    const cur = PS.statValue(state, a.stat);
    return '<b>' + a.name + '</b> · ' + a.desc + '<br>' + (s === 2 ? 'Claimed ✓' : s === 1 ? '<b style="color:var(--gold)">Ready! Tap it to claim</b>' : 'Progress: ' + fmt(Math.min(cur, a.n)) + ' / ' + fmt(a.n));
  }
  function updateTrophies() {
    const key = JSON.stringify(state.ach) + trophySel;
    if (key === trophyKey) return;
    trophyKey = key;
    const n = PS.achievementCount(state);
    setText(el.achCount, n + '/' + CT.ACHIEVEMENTS.length);
    setText(el.achBonus, '×' + stats.achMult.toFixed(2) + ' Matter');
    const ready = CT.ACHIEVEMENTS.filter(function (a) { return state.ach[a.id] === 1; }).length;
    el.claimAll.hidden = ready === 0;
    setText(el.claimAll, 'Claim all (' + ready + ') · +' + ready * C.tickets.ach + ' tickets · +' + ready * C.shards.ach + ' shards');
    const cats = {};
    CT.ACHIEVEMENTS.forEach(function (a) { (cats[a.cat] = cats[a.cat] || []).push(a); });
    let h = '<div class="tinfo">' + (trophySel ? tInfo(PS.ACH[trophySel]) : 'Tap a trophy to see it. Each one unlocked gives <b>+' + (C.achStep * 100).toFixed(1) + '% Matter</b> forever; claim it for tickets and a shard.') + '</div>';
    Object.keys(cats).forEach(function (c) {
      const list = cats[c];
      const got = list.filter(function (a) { return state.ach[a.id]; }).length;
      h += '<div class="tcat"><h3><span>' + c + '</span><span class="num">' + got + '/' + list.length + '</span></h3><div class="tgrid">' + list.map(function (a) {
        const s = state.ach[a.id] || 0;
        return '<button type="button" class="tro' + (s === 2 ? ' got' : s === 1 ? ' ready' : '') + (trophySel === a.id ? ' sel' : '') + '" data-ach="' + a.id + '" title="' + a.name + ': ' + a.desc + '">' + SPR.img('icon_trophy', 1.75) + '</button>';
      }).join('') + '</div></div>';
    });
    el.trophies.innerHTML = h;
  }
  el.trophies.addEventListener('click', function (e) {
    const b = e.target.closest('[data-ach]');
    if (!b) return;
    const id = b.dataset.ach;
    if (state.ach[id] === 1) claim('ach', id);
    trophySel = id;
    trophyKey = '';
    updateTrophies();
  });
  el.claimAll.addEventListener('click', function () {
    let n = 0;
    CT.ACHIEVEMENTS.forEach(function (a) { if (state.ach[a.id] === 1) { PS.grantReward(state, stats, world, PS.claimAchievement(state, a.id), Math.random); n++; } });
    if (!n) return;
    refreshStats(); markDirty(); trophyKey = ''; save();
    Sound.achieve();
    Scene.onEvent({ t: 'buy' });
    toast('<b>' + n + ' trophies claimed</b> · +' + n * C.tickets.ach + ' tickets · +' + n * C.shards.ach + ' shards', 'pink');
  });

  // ---------------------------------------------------------------------------
  // Panel updates and badges
  // ---------------------------------------------------------------------------
  let panelClock = 0;
  function updatePanel(force) {
    const t = performance.now();
    if (!force && !dirty.all && t - panelClock < 150) return;
    panelClock = t;
    dirty.all = false;
    if (tab === 'harvest') { updateGens(); setHTML(el.goals, goalsHTML()); }
    else if (tab === 'upgrades') { updateCatalog(); updatePowers(); updateCollapseCard(); }
    else if (tab === 'pets') updatePets();
    else if (tab === 'relics') updateRelics();
    else if (tab === 'rewards') updateRewards();
    else if (tab === 'trophies') updateTrophies();
    updateBadges();
  }

  function setBadge(name, n, text) {
    const b = badges[name];
    const show = n > 0 && tab !== name;
    if (b.hidden === show) b.hidden = !show;
    if (show) setText(b, text || String(n));
  }
  function updateBadges() {
    let gens = 0;
    CT.GENERATORS.forEach(function (g) { if (PS.genVisible(state, g.id) && PS.genCost(g.id, state.gens[g.id] || 0, 1) <= state.matter) gens++; });
    setBadge('harvest', gens, '!');
    let ups = 0;
    for (const u of PS.availableUpgrades(state)) { if (u.cost > state.matter) break; ups++; }
    setBadge('upgrades', ups);
    setBadge('pets', state.tickets >= C.gacha.cost ? 1 : 0, '!');
    setBadge('relics', (state.shards >= RL.cost || state.forge) ? 1 : 0, '!');
    let ach = 0;
    for (const id in state.ach) if (state.ach[id] === 1) ach++;
    setBadge('trophies', ach);
    const n = PS.claimables(state, todayKey, now()) - ach;
    setBadge('rewards', n);
    if (lastClaimables >= 0 && n > lastClaimables && !modalOpen) { toast('<b>Reward ready!</b> Open the Rewards tab', 'pink'); Sound.ticket(); }
    lastClaimables = n;
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  let lastMatterStr = '';
  function updateHud() {
    const m = fmt(state.matter);
    if (m !== lastMatterStr) { lastMatterStr = m; el.matter.textContent = m; }
    const surge = world.surge > 0 ? C.comet.surgeMult : 1;
    const comboMult = 1 + world.combo * stats.comboMax;
    setText(el.perPulse, '+' + fmt(stats.tapValue * comboMult * surge) + ' per pulse');
    setText(el.perSec, '+' + fmt(stats.genPerSec * surge) + ' /sec');
    setHTML(el.multChip, '×<b>' + fmtMult(stats.globalMult) + '</b> income');
    setWidth(el.comboFill, world.combo);
    setText(el.comboVal, '×' + comboMult.toFixed(2));
    el.combo.classList.toggle('full', world.combo >= 0.99);
    setText(el.ticketCount, fmt(state.tickets));
    setText(el.shardCount, fmt(Math.floor(state.shards)));
    el.sdBtn.hidden = !state.stardust;
    setText(el.sdCount, fmt(state.stardust));
    setText(el.sectorNum, String(state.sector + 1));
    setText(el.sectorName, stats.sector.name);
    setHTML(el.mut, 'Today: <b>' + mutation.name + '</b>');
    // Form progression bar.
    const f = CT.FORMS[state.form], nf = CT.FORMS[state.form + 1];
    setText(el.formNum, String(state.form + 1));
    setText(el.formName, f.name);
    setText(el.formNext, nf ? 'next: ' + nf.name + ' at ' + fmt(nf.at) : 'final form!');
    setWidth(el.formFill, formProgress());
    // Next sector and Star Reel.
    const nxt = PS.sectorInfo(state.sector + 1), cur = PS.sectorInfo(state.sector);
    setHTML(el.msText, 'Sector ' + (state.sector + 2) + ' at <b>' + fmt(nxt.at) + '</b>');
    const lo = Math.log10(Math.max(1, cur.at)), hi = Math.log10(nxt.at), v = Math.log10(Math.max(1, state.runTotal));
    setWidth(el.msFill, state.sector === 0 ? state.runTotal / nxt.at : (v - lo) / (hi - lo));
    const need = Math.ceil(stats.reelNeed);
    const charge = world.reel ? need : Math.floor(state.reelCharge);
    setText(el.reelVal, world.reel ? 'SPIN!' : charge + '/' + need);
    setWidth(el.reelFill, charge / need);
    el.reelFill.parentNode.classList.toggle('full', !!world.reel);
    if (world.surge > 0) {
      el.surge.hidden = false;
      setText(el.surge, 'SURGE ×' + C.comet.surgeMult + ' · ' + Math.ceil(world.surge) + 's');
      el.scene.classList.add('surging');
    } else if (!el.surge.hidden) {
      el.surge.hidden = true;
      el.scene.classList.remove('surging');
    }
    if (world.overcharge && !modalOpen) {
      if (el.oc.hidden) { el.oc.hidden = false; Sound.ticket(); }
      setWidth(el.ocTimer, world.overcharge.t / C.overcharge.window);
    } else if (!el.oc.hidden) el.oc.hidden = true;
    updateGiftChip();
    updateHint();
  }

  let hintMode = null;
  function updateHint() {
    let mode = 'idle', text = 'Tap or hold Singu';
    const c = world.comet;
    if (c && !c.caught && Math.abs(c.x) < 1.15 && Math.abs(c.y) < 1) {
      const inRange = Math.hypot(c.x, c.y / 0.82) <= stats.pulseRadius;
      mode = inRange ? 'comet-in' : 'comet';
      text = inRange ? 'Comet in range! Pulse!' : 'A comet! Catch it in your pulse';
    } else if (state.stats.pulses < 4) {
      mode = 'first'; text = 'Tap Singu to feed it';
    } else if (state.stats.pulses > 300 && world.combo > 0.2) {
      mode = 'hide';
    }
    if (mode !== hintMode) {
      hintMode = mode;
      setText(el.hintText, text);
      setClass(el.hint, 'tap-pill' + (mode === 'hide' ? ' hide' : mode === 'idle' ? '' : ' hot'));
    }
  }

  // ---------------------------------------------------------------------------
  // Events: sounds and UI. Visual effects go to the scene.
  // ---------------------------------------------------------------------------
  function handleEvents() {
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      Scene.onEvent(e);
      switch (e.t) {
        case 'pulse': Sound.pulse(e.auto); if (e.lucky > 1) Sound.lucky(); break;
        case 'capture': Sound.capture(e.idx, e.type); break;
        case 'swallow': Sound.swallow(); break;
        case 'blast': Sound.blast(); break;
        case 'payout': if (e.total > 0) { if (!e.auto) Sound.payout(e.chain); flash(el.matter, 'bump'); } break;
        case 'tickets': Sound.ticket(); flash(el.tickets, 'flash'); break;
        case 'shards': flash(el.shards, 'flash'); break;
        case 'level': Sound.level(); Platform.submitScore(state.singuLevel); break;
        case 'comet': Sound.comet(); break;
        case 'comboFull': Sound.lucky(); break;
        case 'surge':
          Sound.surge();
          banner('Comet captured', 'Surge ×' + C.comet.surgeMult, 'All Matter ×' + C.comet.surgeMult + ' for ' + Math.round(e.dur) + ' seconds');
          Platform.happytime();
          break;
        case 'reelStart': startReelAnim(e); break;
        case 'reel': showReelResult(e); break;
        case 'overcharge': Sound.overcharge(e.win); break;
        case 'form': {
          const f = CT.FORMS[e.form];
          Sound.form();
          refreshStats();
          markDirty();
          banner('Singu evolved', f.name + '!', 'Form ' + (e.form + 1) + ' · all Matter ×' + CT.FORM_MULT + (e.form === 4 || e.form === 7 ? ' · new relic slot!' : ''));
          Platform.happytime();
          break;
        }
        case 'ach': {
          const a = PS.ACH[e.id];
          markDirty();
          if (a && !COVER) { Sound.achieve(); toast(SPR.img('icon_trophy', 1) + '<span><b>' + a.name + '</b> · ' + a.desc + '</span>', 'ach'); }
          break;
        }
        case 'sector': {
          const sec = PS.sectorInfo(e.index);
          Sound.sector();
          refreshStats();
          markDirty();
          banner('Sector ' + (e.index + 1) + ' revealed', sec.name, (SECTOR_NEWS[e.index] || 'Fragments worth more') + ' · +' + C.tickets.sector + ' tickets');
          Platform.happytime();
          break;
        }
        case 'discover': {
          const d = C.discoveries.find(function (x) { return x.id === e.id; });
          markDirty();
          if (d) {
            setTimeout(function () { Sound.discover(); toast('<b>' + d.name + '</b> discovered · +' + Math.round(C.atlasStep * 100) + '% · +' + C.tickets.discovery + ' tickets'); }, 250);
            flash(el.atlasBtn, 'flash');
          }
          break;
        }
      }
    }
    ev.length = 0;
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
    if (e.result === 'singu3') { banner('Star Reel', 'SINGU JACKPOT!', '+' + fmt(e.matter) + ' Matter · +' + e.tickets + ' tickets'); Platform.happytime(); }
    clearTimeout(reelHide);
    reelHide = setTimeout(function () { el.reel.hidden = true; }, 2100);
  }

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
    while (el.toasts.children.length > (innerWidth < 700 ? 2 : 3)) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 3200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
  }
  let bannerTimer = 0;
  function banner(kicker, title, sub) {
    el.banner.innerHTML = '<div class="b-kicker">' + kicker + '</div><div class="b-title">' + title + '</div>' + (sub ? '<div class="b-sub">' + sub + '</div>' : '');
    el.banner.classList.remove('show'); void el.banner.offsetWidth;
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, 3000);
  }

  // ---------------------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------------------
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
    holding = false;
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
      '<p>Matter multiplier <b>×' + stats.sdMult.toFixed(2) + '</b> > <b style="color:var(--lav)">×' + (1 + C.collapse.step * after).toFixed(2) + '</b> · plus <b>' + C.shards.collapse * gain + ' relic shards</b></p>' +
      (unlocks.length ? '<p>Unlocks: ' + unlocks.map(function (r) { return '<b style="color:var(--lav)">' + r.name + '</b>: ' + r.desc; }).join('<br>') + '</p>' : '') +
      '<div class="cols"><div><h3 class="h-reset">Resets</h3><ul><li>Matter (' + fmt(state.matter) + ')</li><li>Harvesters &amp; upgrades</li><li>Singu powers' + (anchor ? ' (except Horizon &amp; Density)' : '') + '</li><li>Sector progress</li></ul></div>' +
      '<div><h3 class="h-keep">Stays forever</h3><ul><li>Stardust</li><li>Pets, relics &amp; tickets</li><li>Form, Singu level &amp; trophies</li><li>Atlas &amp; research</li></ul></div></div>' +
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
    Scene.sync();
    Scene.collapseFx();
    Sound.collapse();
    Platform.happytime();
    resetKeys();
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
  el.sdBtn.addEventListener('click', openResearch);

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
      '<p class="small">A different mutation, new daily quests and the next login reward arrive tomorrow.</p>';
    openModal('mutation', "Today's Cosmic Mutation", body, [{ label: 'Nice', cls: 'primary', fn: closeModal }]);
  }
  function openMults() {
    const rows = [
      ['Form · ' + CT.FORMS[state.form].name, stats.formMult], ['Stardust', stats.sdMult], ['Pets', stats.critterMult * stats.petMult],
      ['Trophies', stats.achMult], ['Atlas', stats.atlasMult], ['Singu level ' + state.singuLevel, stats.singuMult],
      ['Upgrades', stats.upgrades.global], ['Relics', 1 + stats.relics.global]
    ];
    const body = '<p>Everything that multiplies your income. Pulses also get <b>Pulse Focus ×' + fmtMult(stats.focusMult) + '</b>, combo and chains.</p><div class="mults">' +
      rows.map(function (r) { return '<span>' + r[0] + '</span><span>×' + fmtMult(r[1]) + '</span>'; }).join('') + '<span><b>Total</b></span><span>×' + fmtMult(stats.globalMult) + '</span></div>';
    openModal('mults', 'Income multipliers', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }
  el.multChip.addEventListener('click', openMults);

  function openLeaderboard() {
    const can = Platform.canLeaderboard();
    const body = '<div class="lb-score">' + SPR.img('singu', 3) + '<div><div class="small">Your score: Singu level</div><div class="big-gain num">' + state.singuLevel + '</div></div></div>' +
      '<p>Singu gains a level every time the Matter it has ever eaten doubles. Your best level is your leaderboard score.</p>' +
      (can ? '<p>Your score is submitted automatically. The leaderboard is shown on the <b>CrazyGames</b> game page.</p>'
        : '<p class="small">The leaderboard works when the game runs on CrazyGames with its leaderboard set up. Your progress is still saved here.</p>') +
      '<p class="small">Lifetime ' + fmt(state.lifetime) + ' Matter · Form ' + (state.form + 1) + ' ' + CT.FORMS[state.form].name + ' · ' + PS.achievementCount(state) + ' trophies · ' + Object.keys(state.critters).length + ' pets</p>';
    if (can) Platform.submitScore(state.singuLevel);
    openModal('leader', 'Leaderboard', body, [{ label: 'Close', cls: 'primary', fn: closeModal }]);
  }
  el.leader.addEventListener('click', openLeaderboard);

  function openSettings() {
    const body =
      '<div class="toggle-row"><span>Sound</span><button class="switch' + (state.settings.muted ? '' : ' on') + '" data-set="sound" type="button" aria-label="Sound"></button></div>' +
      '<div class="toggle-row"><span>Reduced motion</span><button class="switch' + (reduced ? ' on' : '') + '" data-set="motion" type="button" aria-label="Reduced motion"></button></div>' +
      '<p class="small" style="margin-top:12px">Pulse: click, tap or hold Singu, or Space · Tabs: keys 1-6 · Mute: M · Close: Esc<br>Progress saves automatically on this device.</p>' +
      '<p class="small">Capsule and forge odds are always shown. Tickets and shards are earned only by playing and cannot be bought.</p>' +
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
    openModal('reset', 'Erase everything?', '<p>This permanently deletes your universe, Stardust, pets, relics, trophies and tickets on this device. It cannot be undone.</p>', [
      { label: 'Keep my universe', cls: 'primary', fn: closeModal },
      { label: 'Erase everything', cls: 'danger', fn: function () {
        Platform.remove(SAVE_KEY); Platform.remove(BAK_KEY);
        const settings = state.settings;
        state = PS.createState(now());
        state.settings = settings;
        refreshStats();
        world = PS.createWorld(Math.random, state, stats);
        Scene.sync(); Scene.rebuild(true);
        resetKeys();
        save();
        closeModal();
      } }
    ]);
  }
  function resetKeys() { collapseKey = ''; collectionKey = ''; relicKey = ''; trophyKey = ''; catalogKey = ''; rewardsKey = ''; powKey = ''; markDirty(); }
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
      const body = '<p>Your harvesters kept Singu fed for <b>' + playTimeText(a.ms / 1000) + '</b>' + (capped ? ' (the 2 h maximum)' : '') + ' at ' + Math.round(stats.offlineRate * 100) + '% speed.</p>' +
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
  // Input: tap or hold Singu
  // ---------------------------------------------------------------------------
  let holding = false;
  function doPulse() {
    if (modalOpen) return;
    Sound.unlock();
    Platform.gameplayStart();
    PS.pulse(world, state, stats, ev, false);
  }
  el.scene.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    Scene.tap(e.clientX, e.clientY);
    holding = true;
    try { el.scene.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    doPulse();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { el.scene.addEventListener(n, function () { holding = false; }); });
  el.scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') { closeModal(); return; }
    if (modalOpen) return;
    if (e.code === 'Space') { e.preventDefault(); doPulse(); return; }
    if (e.repeat) return;
    const n = Number(e.key);
    if (n >= 1 && n <= TAB_NAMES.length) { setTab(TAB_NAMES[n - 1]); return; }
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });
  document.addEventListener('keyup', function (e) { if (e.code === 'Space' && !modalOpen) e.preventDefault(); });

  el.atlasBtn.addEventListener('click', openAtlas);
  el.settings.addEventListener('click', openSettings);
  el.sound.addEventListener('click', toggleMute);
  el.mut.addEventListener('click', openMutation);

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
  // Layout: large screens scale the whole UI so text stays readable
  // ---------------------------------------------------------------------------
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
      rollMutation(); refreshStats(); markDirty();
      PS.ensureDaily(state, todayKey); rewardsKey = ''; pendingLogin = true;
      toast('<b>New day!</b> ' + mutation.name + ', new quests and a login reward.', 'violet');
    }

    if (holding && !modalOpen && world.cooldown <= 0) doPulse();
    if (!COVER) PS.step(world, state, stats, dt, ev);
    for (let i = 0; i < ev.length; i++) { const t = ev[i].t; if (t === 'level' || t === 'discover' || t === 'form' || t === 'ach') { refreshStats(); break; } }
    handleEvents();
    Scene.draw(dt, tNow / 1000);
    updateHud();
    updatePanel(false);
    if (tab === 'pets') drawMachine(performance.now() < crankUntil ? Math.floor(tNow / 90) % 4 : 0);
    // The daily login calendar pops up for returning players, and for new ones once they have settled in.
    if (!pendingLogin && !COVER && PS.loginReady(state, todayKey) && PS.playToday(state) > 45 && state.milestones.firstBuy) pendingLogin = true;
    if (pendingLogin && !modalOpen && !hatching && PS.loginReady(state, todayKey)) { pendingLogin = false; openLogin(); }

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
    PS.ensureDaily(state, todayKey);
    pendingLogin = !COVER && state.stats.pulses > 0 && PS.loginReady(state, todayKey);
    refreshStats();
    PS.checkProgress(state, null);
    refreshStats();
    world = PS.createWorld(Math.random, state, stats);
    reduced = state.settings.reducedMotion === null ? matchMedia('(prefers-reduced-motion: reduce)').matches : state.settings.reducedMotion;
    document.body.classList.toggle('reduced', reduced);
    Sound.setMuted(state.settings.muted);
    el.sound.classList.toggle('muted', state.settings.muted);
    Scene.init({
      canvas: el.cv, container: el.scene,
      state: function () { return state; }, stats: function () { return stats; }, world: function () { return world; }, reduced: function () { return reduced; }
    });
    staticArt();
    buildGens();
    buildPowers();
    setBuyMode(state.settings.buyMode);
    drawMachine(0);
    fitApp();
    Scene.resize(uiScale);
    Scene.sync();
    window.addEventListener('resize', fitApp);
    const onResize = function () { Scene.resize(uiScale); };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(el.scene);
    else window.addEventListener('resize', onResize);
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
    setTab('harvest');

    lastWall = now();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
    Platform.loadingStop();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { save(); Sound.suspend(); Platform.gameplayStop(); holding = false; }
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
        Scene.sync(); Scene.rebuild(false); resetKeys();
        Sound.setMuted(state.settings.muted);
        toast('<b>Save:</b> loaded your synced universe.', 'violet');
      }
      save();
      Platform.submitScore(state.singuLevel);
    });
    Platform.on('mute', function (m) { Sound.setExternalMute(m); });
    Platform.on('pause', function (p) { Sound.setExternalMute(!!p); });

    // Debug/test handle. Single-player only; nothing here can affect other players.
    window.__ps = {
      get state() { return state; }, get world() { return world; }, get stats() { return stats; },
      PS: PS, save: save,
      refresh: function () { refreshStats(); Scene.sync(); Scene.rebuild(false); resetKeys(); },
      pulse: doPulse,
      freeze: function () { frozen = true; },
      today: function () { return todayKey; },
      setTab: setTab
    };
  }

  // Staged scene for store art: `index.html?cover=1`.
  function setupCover() {
    document.body.classList.add('cover');
    const tag = document.createElement('div');
    tag.className = 'cover-title';
    tag.innerHTML = '<div class="ct1">Pocket</div><div class="ct2">Singularity</div>';
    el.scene.appendChild(tag);
    const sector = Number(QS.get('sector') || 3);
    state.lifetime = 5e12; state.stardust = 6; state.form = 5;
    state.gens = { sweeper: 40, net: 30, drone: 25, miner: 12, hauler: 8, sail: 3 };
    state.runTotal = PS.sectorInfo(sector).at; state.sector = sector;
    CT.PETS.filter(function (p) { return p.rarity >= 2; }).slice(0, 6).forEach(function (p) { state.critters[p.id] = { stars: 3, copies: 0 }; });
    refreshStats();
    Scene.sync();
    Scene.rebuild(false);
    const rng = PS.mulberry32(7);
    world = PS.createWorld(rng, state, stats);
    const types = ['dust', 'dust', 'ice', 'ice', 'crystal', 'shard', 'dust', 'ice'];
    world.frags.length = 0;
    for (let i = 0; i < 40; i++) {
      world.frags.push({ type: types[i % types.length], r: 0.42 + rng() * 0.62, a: rng() * 6.28, size: 1, spin: rng() * 6, wob: rng() * 6, state: PS.ORBIT, alpha: 1, inRange: true, t: 0, delay: 0, dur: 1, r0: 0, a0: 0 });
    }
    world.rings.push({ t: 0.16, max: 0.9, auto: false });
    world.comet = { x: 0.75, y: -0.45, vx: -0.2, vy: 0.08, t: 0, life: 99, caught: false, fall: 0 };
    Scene.mood('happy', 1e9);
  }

  boot();
})();
