/* Pocket Singularity — the scene renderer.
 * Draws the universe into a small pixel buffer and scales it up by a whole number.
 * Reads game state through the `G` accessors passed to init(); owns only visual effects.
 */
(function (root) {
  'use strict';

  const PS = root.PS, SPR = root.PSSprites;
  const P = SPR.PAL;
  const C = PS.CONFIG;
  const fmt = PS.fmt;

  // Per-sector look: sky gradient, nebula colours, and the planet "floor" under Singu.
  const THEMES = [
    { sky: ['#07071a', '#141238', '#2b1d52'], neb: ['#3b5dc9', '#6b4fb8', '#b13e53'], planet: '#e09a6a', planetDark: '#6a3050', rim: '#ffcd75' },
    { sky: ['#06091a', '#111a3a', '#24305e'], neb: ['#41a6f6', '#3b5dc9', '#5d275d'], planet: '#8c96ab', planetDark: '#3a3f58', rim: '#c9e4ff' },
    { sky: ['#05101e', '#0c2638', '#1a4a62'], neb: ['#73eff7', '#257179', '#3b5dc9'], planet: '#cfefff', planetDark: '#4a7a9a', rim: '#ffffff' },
    { sky: ['#0e0720', '#25103c', '#45185a'], neb: ['#a884f3', '#b13e53', '#ff8fb1'], planet: '#8a4ab0', planetDark: '#3a1a5a', rim: '#ff9fd8' },
    { sky: ['#130a18', '#33142c', '#5a2430'], neb: ['#ef7d57', '#ffcd75', '#b13e53'], planet: '#ffb35a', planetDark: '#8a3a2a', rim: '#fff0b0' }
  ];
  const TYPE_KEYS = { dust: ['d', 'c'], ice: ['b', 'a'], crystal: ['4', 'c'], shard: ['3', '2'] };
  const SINGU_SCALE = 1.3;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y, v) { return v * 16 > BAYER[((y & 3) << 2) | (x & 3)]; }

  let G = null;           // accessors from game.js
  let cv, ctx, container;
  const buf = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const b = buf ? buf.getContext('2d') : null;
  let W = 0, H = 0, DPR = 1, PXS = 2, BW = 1, BH = 1, KK = 2, CX = 0, CY = 0, S = 100;
  let bg = null, bgPrev = null, vignette = null, bgSector = -1;
  const fx = { shake: 0, gulp: 0, flash: 0, collapse: 0, bgFade: 1, lucky: 0, ocWin: 0, ocLose: 0, squash: 0 };
  const stars = [];
  const particles = [], floats = [], blasts = [], streams = [];
  let tapPoint = null;
  let pets = [], sats = [];
  let shooting = null, shootTimer = 4;
  const rocks = [];
  const MAX_PARTICLES = 380, MAX_FLOATS = 30;
  const mood = { kind: '', t: 0, munch: 0 };

  function init(opts) {
    G = opts;
    cv = opts.canvas; container = opts.container;
    ctx = cv.getContext('2d', { alpha: false });
  }

  function resize(uiScale) {
    DPR = Math.min(3, root.devicePixelRatio || 1) * (uiScale || 1);
    W = Math.max(1, container.clientWidth);
    H = Math.max(1, container.clientHeight);
    PXS = Math.max(2, Math.min(8, Math.floor(Math.min(W, H) / 220)));
    BW = Math.ceil(W / PXS); BH = Math.ceil(H / PXS);
    KK = Math.max(1, Math.round(PXS * DPR));
    cv.width = BW * KK; cv.height = BH * KK;
    cv.style.width = BW * PXS + 'px'; cv.style.height = BH * PXS + 'px';
    cv.style.left = Math.floor((W - BW * PXS) / 2) + 'px';
    cv.style.top = Math.floor((H - BH * PXS) / 2) + 'px';
    buf.width = BW; buf.height = BH;
    CX = Math.floor(BW / 2);
    CY = Math.floor(BH * 0.47);
    S = Math.min(BW / 2 / 1.06, BH / 2 / (1.06 * 0.82));
    for (const k in patterns) delete patterns[k];
    buildStars();
    rebuild(false);
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------
  function buildStars() {
    stars.length = 0;
    const rng = PS.mulberry32(77);
    for (let i = 0; i < Math.round(BW * BH / 60); i++) {
      const layer = i % 3;
      stars.push({ x: rng() * BW, y: rng() * BH * 0.8, layer: layer, p: rng() * 6.28, s: 0.6 + rng() * 2, big: rng() > 0.93 });
    }
    rocks.length = 0;
    for (let i = 0; i < 3; i++) rocks.push({ x: rng() * BW, y: BH * (0.12 + rng() * 0.5), v: 1.5 + rng() * 3, s: 1 + Math.floor(rng() * 2), spin: rng() * 6 });
  }

  function rebuild(animate) {
    if (!BW || !G) return;
    const st = G.state();
    const sec = PS.sectorInfo(st.sector);
    const th = THEMES[(sec.palette + sec.tier) % THEMES.length];
    if (animate && bg) { bgPrev = bg; fx.bgFade = 0; } else { bgPrev = null; fx.bgFade = 1; }
    bgSector = st.sector;
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const g = c.getContext('2d');
    // Sky.
    const sky = g.createLinearGradient(0, 0, 0, BH);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.55, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, BW, BH);
    // Soft nebula clouds.
    const rng = PS.mulberry32(500 + sec.index * 131);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = rng() * BW, y = rng() * BH * 0.75, r = (0.18 + rng() * 0.35) * Math.max(BW, BH);
      const col = th.neb[i % th.neb.length];
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, hexA(col, 0.22 + rng() * 0.12));
      rg.addColorStop(0.5, hexA(col, 0.08));
      rg.addColorStop(1, hexA(col, 0));
      g.fillStyle = rg; g.fillRect(0, 0, BW, BH);
    }
    // A distant spiral galaxy.
    const gx = BW * (0.15 + rng() * 0.2), gy = BH * (0.15 + rng() * 0.2), gr = Math.min(BW, BH) * 0.09;
    for (let a = 0; a < 14; a += 0.06) {
      for (const arm of [0, Math.PI]) {
        const r = a * gr / 14;
        const x = gx + Math.cos(a + arm) * r, y = gy + Math.sin(a + arm) * r * 0.45;
        g.fillStyle = hexA(a < 3 ? '#fff6dc' : th.neb[0], 0.5 - a / 32);
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    g.globalCompositeOperation = 'source-over';
    // Static dim stars.
    for (let i = 0; i < BW * BH / 90; i++) {
      g.fillStyle = hexA('#dfe8ff', 0.15 + rng() * 0.35);
      g.fillRect(Math.floor(rng() * BW), Math.floor(rng() * BH * 0.85), 1, 1);
    }
    // Planet horizon: a huge curved world under Singu, lit from the top-left, with an atmosphere rim.
    const pr = BW * 1.1, px = BW * 0.5, py = BH + pr * 0.82;
    const pg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.95, pr * 0.1, px, py, pr);
    pg.addColorStop(0, th.planet); pg.addColorStop(0.7, mixHex(th.planet, th.planetDark, 0.55)); pg.addColorStop(1, th.planetDark);
    g.fillStyle = pg;
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    // Surface detail: craters and dunes.
    g.save(); g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.clip();
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.3, d = pr * (0.86 + rng() * 0.13);
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d, r = 1 + rng() * Math.max(2, BW * 0.02);
      g.fillStyle = hexA(th.planetDark, 0.35); g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hexA('#ffffff', 0.12); g.fillRect(Math.round(x - r), Math.round(y - r * 0.6), Math.max(1, Math.round(r)), 1);
    }
    g.restore();
    // Atmosphere rim.
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = hexA(th.rim, [0.6, 0.25, 0.1][i]);
      g.lineWidth = 1;
      g.beginPath(); g.arc(px, py, pr + i, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    bg = c;
    // Vignette.
    vignette = document.createElement('canvas');
    vignette.width = BW; vignette.height = BH;
    const vg = vignette.getContext('2d');
    const vr = vg.createRadialGradient(BW / 2, BH * 0.45, Math.min(BW, BH) * 0.35, BW / 2, BH * 0.45, Math.max(BW, BH) * 0.75);
    vr.addColorStop(0, 'rgba(5,4,14,0)'); vr.addColorStop(1, 'rgba(5,4,14,0.55)');
    vg.fillStyle = vr; vg.fillRect(0, 0, BW, BH);
  }

  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, a).toFixed(3) + ')'; }
  function mixHex(a, c, t) { return SPR.mix(a, c, t); }

  const patterns = {};
  function pattern(key, level) {
    const id = key + level;
    if (patterns[id]) return patterns[id];
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const g = c.getContext('2d');
    g.fillStyle = P[key] || key;
    for (let i = 0; i < 16; i++) if (BAYER[i] < level) g.fillRect(i & 3, i >> 2, 1, 1);
    patterns[id] = b.createPattern(c, 'repeat');
    return patterns[id];
  }

  // ---------------------------------------------------------------------------
  // Scene population
  // ---------------------------------------------------------------------------
  function sync() {
    const st = G.state();
    // Pets: the best six you own orbit Singu.
    const owned = C.critters.filter(function (c) { return st.critters[c.id]; })
      .sort(function (a, c) { return c.rarity - a.rarity || st.critters[c.id].stars - st.critters[a.id].stars; })
      .slice(0, 6);
    pets = owned.map(function (c, i) { return { id: c.id, phase: i / Math.max(1, owned.length) * Math.PI * 2, bob: i * 1.7 }; });
    // Harvesters: up to three satellites per kind you own, on orbits that widen with tier.
    sats = [];
    PS.CT.GENERATORS.forEach(function (g, i) {
      const n = st.gens[g.id] || 0;
      if (!n) return;
      const k = Math.min(3, 1 + Math.floor(Math.log10(n + 1)));
      for (let j = 0; j < k; j++) sats.push({ i: i, a: (j / k) * Math.PI * 2 + i * 0.7, r: 0.42 + (i % 5) * 0.12 + Math.floor(i / 5) * 0.03, sp: 0.18 + (i % 3) * 0.05, emit: Math.random() * 2 });
    });
  }

  function sx(x) { return Math.round(CX + x * S); }
  function sy(y) { return Math.round(CY + y * S); }

  function addParticle(x, y, vx, vy, life, key) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, key: key });
  }
  function burst(x, y, n, keys) {
    if (G.reduced()) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28, sp = 15 + Math.random() * 45;
      addParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, 0.4 + Math.random() * 0.5, keys[k % keys.length]);
    }
  }
  function addFloat(text, x, y, color, size, life, shadow) {
    if (floats.length >= MAX_FLOATS) floats.shift();
    floats.push({ text: text, x: x, y: y, color: color, size: size, life: life || 1.1, max: life || 1.1, shadow: shadow || P['0'], vx: (Math.random() - 0.5) * 12 });
  }
  function singuMood(kind, secs) { if (kind === 'happy' || !mood.t || mood.kind !== 'happy') { mood.kind = kind; mood.t = secs; } }

  function coreR() { return PS.coreRadius(G.state()) * S * SINGU_SCALE; }

  // Visual reactions to rule events. Sounds and UI live in game.js.
  function onEvent(e) {
    const r = coreR();
    switch (e.t) {
      case 'pulse':
        if (!e.auto) { fx.squash = 1; fx.flash = Math.max(fx.flash, 0.6); }
        if (e.lucky > 1) {
          fx.lucky = 1;
          addFloat('LUCKY ×' + (+e.lucky.toFixed(1)) + '!', CX * PXS, Math.max(40, (CY - r * 3.2) * PXS), P['5'], 26, 1.4, P['6']);
          burst(CX, CY, 24, ['5', '6', '4']);
          singuMood('happy', 1.5);
        }
        break;
      case 'tap': {
        if (e.auto) break;
        const tp = tapPoint || { x: CX + (Math.random() - 0.5) * 30, y: CY - r * 1.5 };
        addFloat('+' + fmt(e.value), tp.x * PXS, tp.y * PXS - 10, P.c, 15, 0.9);
        break;
      }
      case 'capture': {
        fx.gulp = Math.min(1, fx.gulp + 0.3);
        mood.munch = 0.35;
        const keys = TYPE_KEYS[e.type];
        for (let k = 0; k < (G.reduced() ? 2 : e.type === 'crystal' ? 8 : 4); k++) {
          const a = Math.random() * 6.28, sp = 20 + Math.random() * 40;
          addParticle(CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.8, Math.cos(a) * sp, Math.sin(a) * sp, 0.35 + Math.random() * 0.3, keys[k % 2]);
        }
        break;
      }
      case 'swallow': fx.gulp = Math.min(1, fx.gulp + 0.12); mood.munch = 0.2; break;
      case 'blast':
        blasts.push({ x: sx(e.x), y: sy(e.y), r: e.r * S, t: 0 });
        burst(sx(e.x), sy(e.y), 14, ['3', '2', '4']);
        break;
      case 'payout': {
        if (e.total <= 0) break;
        const big = e.chain >= 12 ? 1.5 : e.chain >= 5 ? 1.25 : 1;
        const color = e.lucky > 1 ? P['5'] : e.chain >= 12 ? P['4'] : e.chain >= 5 ? P.p : P.c;
        const fy = Math.max(46, (CY - r * 2.4) * PXS - 10);
        addFloat('+' + fmt(e.total), CX * PXS, fy, color, Math.round(18 * big), 1.2);
        if (e.chain >= 2) addFloat('CHAIN ×' + e.chain, CX * PXS, fy + 20 * big, e.chain >= 12 ? P['4'] : P.b, Math.round(13 * big), 1.2);
        if (e.chain >= 8 && !G.reduced() && !e.auto) fx.shake = Math.min(1, 0.3 + e.chain * 0.03);
        if (e.chain >= 8) singuMood('happy', 1.2);
        // Matter streams toward the counter in the top-left.
        for (let k = 0; k < Math.min(10, 2 + e.chain); k++) streams.push({ x: CX + (Math.random() - 0.5) * r * 2, y: CY + (Math.random() - 0.5) * r, t: -k * 0.04, key: k % 2 ? '4' : 'c' });
        break;
      }
      case 'comboFull':
        addFloat('FULL COMBO!', CX * PXS, (CY + r * 2.2) * PXS, P['3'], 20, 1.4, P['2']);
        burst(CX, CY, 30, ['3', '4', '2']);
        break;
      case 'tickets':
        addFloat('+' + e.n + ' TICKET' + (e.n > 1 ? 'S' : ''), CX * PXS + 70, (CY - r * 1.5) * PXS, P['4'], 13, 1.4, P['2']);
        break;
      case 'shards':
        addFloat('+' + fmt(e.n) + ' SHARD' + (e.n >= 2 ? 'S' : ''), CX * PXS - 70, (CY - r * 1.2) * PXS, P.v, 13, 1.4, P['1']);
        break;
      case 'level':
        addFloat(String(G.name ? G.name() : 'Singu').toUpperCase() + ' LV ' + e.level + '!', CX * PXS, (CY + r * 2.6) * PXS, P.p, 15, 1.6, P['1']);
        burst(CX, CY, 16, ['p', 'c', 'v']);
        singuMood('happy', 1.2);
        break;
      case 'form':
        fx.flash = 2.2; fx.shake = G.reduced() ? 0 : 1;
        burst(CX, CY, 60, ['c', '4', 'v', 'b']);
        singuMood('star', 3);
        break;
      case 'surge': fx.flash = 1.5; burst(CX, CY, 40, ['4', 'c', '3']); singuMood('star', e.dur); break;
      case 'reel': if (e.result === 'singu3') { fx.flash = 2; singuMood('happy', 4); } else if (e.result !== 'none' && e.result !== 'pair') singuMood('happy', 1.5);
        burst(CX, CY - 6, /3$|triple/.test(e.result) ? 40 : 14, ['4', 'c', 'p']); break;
      case 'overcharge':
        if (e.win) { fx.ocWin = 1; burst(CX, CY, 50, ['4', '5', 'c', 'p']); addFloat('OVERCHARGED! +' + fmt(e.amount), CX * PXS, (CY - 20) * PXS, P['5'], 22, 1.6, P['6']); singuMood('happy', 2); }
        else { fx.ocLose = 1; burst(CX, CY, 20, ['e', 'f', 'd']); addFloat('Fizzled... -' + fmt(e.amount), CX * PXS, (CY - 20) * PXS, P.p, 18, 1.6, P['1']); singuMood('dizzy', 1.6); }
        break;
      case 'sector': rebuild(true); break;
      case 'buy': burst(CX, CY, 10, ['5', 'c']); break;
    }
  }

  function tap(clientX, clientY) {
    const rc = cv.getBoundingClientRect();
    tapPoint = { x: (clientX - rc.left) * BW / rc.width, y: (clientY - rc.top) * BH / rc.height, t: 0 };
  }

  function bigFlash(amount) { fx.flash = Math.max(fx.flash, amount); }
  function collapseFx() { fx.collapse = 1.6; rebuild(true); }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function ellipse(cx, cy, rx, ry, key, dotted, phase) {
    if (rx < 1) return;
    const steps = Math.max(24, Math.ceil(Math.PI * 2 * rx));
    b.fillStyle = P[key] || key;
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
  function overlay(hex, a) {
    if (a <= 0.005) return;
    b.globalAlpha = Math.min(1, a);
    b.fillStyle = hex;
    b.fillRect(0, 0, BW, BH);
    b.globalAlpha = 1;
  }
  function sprite(name, x, y, size) {
    const s = SPR.get(name);
    if (size) b.drawImage(s, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    else b.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  }

  function draw(dt, t) {
    const st = G.state(), stats = G.stats(), world = G.world(), reduced = G.reduced();
    if (st.sector !== bgSector) rebuild(true);
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.imageSmoothingEnabled = false;
    let ox = 0, oy = 0;
    if (fx.shake > 0) {
      const a = Math.ceil(fx.shake * 2);
      ox = Math.round((Math.random() - 0.5) * a * 2); oy = Math.round((Math.random() - 0.5) * a * 2);
      fx.shake = Math.max(0, fx.shake - dt * 4);
    }
    if (bg) {
      b.drawImage(bg, 0, 0);
      if (bgPrev && fx.bgFade < 1) {
        b.globalAlpha = 1 - fx.bgFade; b.drawImage(bgPrev, 0, 0); b.globalAlpha = 1;
        fx.bgFade = Math.min(1, fx.bgFade + dt / 1.2);
        if (fx.bgFade >= 1) bgPrev = null;
      }
    }
    // Parallax stars drifting slowly left, three depths.
    for (const s of stars) {
      const speed = [0.6, 1.4, 2.6][s.layer] * (reduced ? 0.3 : 1);
      s.x -= speed * dt;
      if (s.x < 0) s.x += BW;
      const v = Math.sin(t * s.s + s.p);
      if (s.layer === 0 && v < 0) continue;
      b.fillStyle = s.layer === 2 ? (v > 0.6 ? P.c : P.d) : s.layer === 1 ? P.d : P.e;
      b.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      if (s.big && v > 0.85) { b.fillStyle = P.e; b.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); b.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3); }
    }
    // Shooting star now and then.
    shootTimer -= dt;
    if (shootTimer <= 0 && !reduced) { shooting = { x: Math.random() * BW, y: Math.random() * BH * 0.3, t: 0 }; shootTimer = 5 + Math.random() * 8; }
    if (shooting) {
      shooting.t += dt;
      const k = shooting.t / 0.6;
      if (k >= 1) shooting = null;
      else for (let i = 0; i < 10; i++) { b.fillStyle = i < 2 ? P.c : P.d; b.fillRect(Math.round(shooting.x + k * 60 - i), Math.round(shooting.y + k * 25 - i * 0.4), 1, 1); }
    }
    // Drifting asteroids.
    for (const rk of rocks) {
      rk.x += rk.v * dt * (reduced ? 0.3 : 1);
      if (rk.x > BW + 6) rk.x = -6;
      b.fillStyle = P.e; b.fillRect(Math.round(rk.x), Math.round(rk.y), rk.s + 1, rk.s);
      b.fillStyle = P.d; b.fillRect(Math.round(rk.x), Math.round(rk.y), 1, 1);
    }

    b.save();
    b.translate(ox, oy);
    const r = coreR();
    const surge = world.surge > 0;

    // Pulse range: a soft solid ring; it glows gold while a comet is inside it.
    const R = stats.pulseRadius * S;
    const cometIn = world.comet && !world.comet.caught && Math.hypot(world.comet.x, world.comet.y / 0.82) <= stats.pulseRadius;
    if (cometIn) {
      const glow = 0.55 + 0.35 * Math.sin(t * 10);
      b.globalAlpha = glow * 0.35; ellipse(CX, CY, R + 1, (R + 1) * 0.82, '3', 0);
      b.globalAlpha = glow; ellipse(CX, CY, R, R * 0.82, '4', 0);
      b.globalAlpha = 1;
    } else {
      b.globalAlpha = surge ? 0.6 : world.cooldown <= 0 ? 0.32 : 0.16;
      ellipse(CX, CY, R, R * 0.82, surge ? '3' : 'd', 0);
      b.globalAlpha = 1;
    }

    if (tapPoint && !reduced) {
      tapPoint.t += dt;
      const p = tapPoint.t / 0.25;
      if (p >= 1) tapPoint = null;
      else ellipse(tapPoint.x, tapPoint.y, 2 + p * 6, 2 + p * 6, 'b', 2);
    }

    for (const ring of world.rings) {
      const rr = Math.min(ring.max, ring.t * C.ringSpeed) * S;
      const life = ring.max / C.ringSpeed + 0.45;
      const a = 1 - ring.t / life;
      if (a <= 0) continue;
      const key = ring.auto ? 'v' : surge ? '4' : 'b';
      if (a > 0.25) ellipse(CX, CY, rr, rr * 0.82, key, a > 0.6 ? 0 : 2);
      if (!ring.auto && a > 0.4) ellipse(CX, CY, rr * 0.86, rr * 0.86 * 0.82, a > 0.7 ? 'a' : '9', 3);
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const bl = blasts[i];
      bl.t += dt;
      const p = bl.t / 0.35;
      if (p >= 1) { blasts.splice(i, 1); continue; }
      ellipse(bl.x, bl.y, bl.r * p + 1, (bl.r * p + 1) * 0.82, p < 0.5 ? '3' : '2', p < 0.5 ? 0 : 2);
    }

    drawSats(dt, t, r, true);
    drawPets(t, r, true);
    drawDisk(t, r, true, st, surge);
    for (const f of world.frags) drawFragment(f, t);
    drawCombo(dt, t, r, world, reduced);
    drawSingu(t, r, surge, dt);
    drawDisk(t, r, false, st, surge);
    drawSats(dt, t, r, false);
    drawPets(t, r, false);
    drawComet(t, world);

    // Particles.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3;
      if (p.life / p.max < 0.3 && (Math.floor(t * 20) + i) % 2) continue;
      b.fillStyle = P[p.key] || p.key;
      b.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    // Matter streams arcing to the top-left counter.
    for (let i = streams.length - 1; i >= 0; i--) {
      const s = streams[i];
      s.t += dt;
      if (s.t < 0) continue;
      const k = Math.min(1, s.t / 0.7);
      if (k >= 1) { streams.splice(i, 1); continue; }
      const e = k * k;
      const x = s.x + (12 - s.x) * e, y = s.y + (10 - s.y) * e - Math.sin(k * Math.PI) * 20;
      b.fillStyle = P[s.key]; b.fillRect(Math.round(x), Math.round(y), 2, 2);
    }

    // Screen-wide flashes are smooth translucent washes (no dither dots).
    if (fx.lucky > 0) { overlay('#a7f070', fx.lucky * 0.22); fx.lucky = Math.max(0, fx.lucky - dt * 5); }
    if (fx.ocWin > 0) { overlay('#ffcd75', fx.ocWin * 0.3); fx.ocWin = Math.max(0, fx.ocWin - dt * 2); }
    if (fx.ocLose > 0) { overlay('#0b0b16', fx.ocLose * 0.45); fx.ocLose = Math.max(0, fx.ocLose - dt * 1.5); }
    if (fx.flash > 1) overlay('#fff6dc', Math.min(0.35, (fx.flash - 1) * 0.25));
    if (fx.collapse > 0) {
      overlay('#07070f', Math.min(0.95, fx.collapse * 0.7));
      const rr = (1.6 - fx.collapse) * Math.max(BW, BH);
      ellipse(CX, CY, rr, rr * 0.82, 'v', 0);
      fx.collapse -= dt;
    }
    b.restore();
    if (vignette) b.drawImage(vignette, 0, 0);
    fx.gulp = Math.max(0, fx.gulp - dt * 5);
    fx.flash = Math.max(0, fx.flash - dt * 3);
    fx.squash = Math.max(0, fx.squash - dt * 6);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW * KK, BH * KK);

    // Floating text, crisp at full resolution.
    const k = KK / PXS;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      const p = 1 - f.life / f.max;
      const rise = Math.round((reduced ? 8 : 26) * Math.min(1, p * 1.6));
      const pop = p < 0.12 ? 1.25 - p * 2 : 1;
      if (p > 0.8 && Math.floor(t * 16) % 2) continue;
      const x = f.x + f.vx * p;
      ctx.font = '700 ' + Math.round(f.size * pop) + 'px Cozy, monospace';
      ctx.fillStyle = f.shadow;
      ctx.fillText(f.text, x + 2, f.y - rise + 2);
      ctx.fillText(f.text, x - 1, f.y - rise - 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, f.y - rise);
    }
  }

  function drawFragment(f, t) {
    const p = PS.fragPos(f);
    const x = sx(p.x), y = sy(p.y);
    if (f.alpha < 1 && (Math.floor(t * 20) % 2 || f.alpha < 0.4)) return;
    const falling = f.state === PS.FALL && f.delay <= 0;
    if (falling) {
      const keys = TYPE_KEYS[f.type];
      if (!f.trail) f.trail = [];
      f.trail.unshift([x, y]);
      if (f.trail.length > 5) f.trail.length = 5;
      for (let i = 1; i < f.trail.length; i++) { b.fillStyle = P[keys[i % 2]]; b.fillRect(f.trail[i][0], f.trail[i][1], 1, 1); }
      if (Math.min(1, f.t / f.dur) > 0.65) { b.fillStyle = P[keys[0]]; b.fillRect(x - 1, y - 1, 2, 2); return; }
    }
    let name = f.type;
    if (f.type === 'dust' && Math.floor(t * 3 + f.wob) % 2) name = 'dust2';
    if (f.type === 'crystal' && Math.floor(t * 4 + f.wob) % 4 === 0) name = 'crystal2';
    if (f.type === 'shard' && Math.floor(t * 8 + f.wob) % 2) name = 'shard2';
    sprite(name, x, y + (f.type === 'crystal' ? Math.round(Math.sin(t * 3 + f.wob)) : 0));
  }

  function drawDisk(t, r, back, st, surge) {
    const stage = PS.coreStage(st);
    const rings = 2 + Math.min(3, stage);
    const bands = surge ? ['4', 'c', '4', '3'] : ['4', '3', '2', '3'];
    for (let i = 0; i < rings; i++) {
      const rx = r * (1.55 + i * 0.32), ry = Math.max(2, rx * 0.3);
      const steps = Math.ceil(Math.PI * 2 * rx * 1.2);
      const spin = t * (0.9 - i * 0.12);
      const outer = i === rings - 1 && stage >= 2;
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const sn = Math.sin(a);
        if (back ? sn >= 0 : sn < 0) continue;
        if (i > 0 && (s + i) % (i + 1) === 0) continue;
        const band = Math.floor(((a + spin) / (Math.PI * 2)) * 10 + i) % bands.length;
        b.fillStyle = P[outer ? (s % 2 ? 'v' : 'w') : bands[(band + 4) % bands.length]];
        b.fillRect(Math.round(CX + Math.cos(a) * rx), Math.round(CY + sn * ry), 1, 1);
      }
    }
    if (!back && stage >= 3) {
      const len = Math.round(r * (0.8 + stage * 0.25));
      for (let j = 2; j < len; j++) {
        if (!dith(CX, j + Math.floor(t * 20), 1 - j / len)) continue;
        b.fillStyle = P[j % 3 ? 'v' : 'c'];
        b.fillRect(CX, CY - Math.round(r) - j, 1, 1);
        b.fillRect(CX, CY + Math.round(r) + j, 1, 1);
      }
    }
  }

  // Combo aura: flames licking up around Singu, stronger as the combo fills.
  function drawCombo(dt, t, r, world, reduced) {
    const c = world.combo || 0;
    if (c < 0.15) return;
    const n = Math.round(c * (reduced ? 4 : 12));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      addParticle(CX + Math.cos(a) * r * 1.05, CY + Math.sin(a) * r * 0.9, Math.cos(a) * 6, -20 - Math.random() * 30 * c, 0.3 + Math.random() * 0.3, c > 0.9 ? (i % 3 ? '4' : 'c') : (i % 2 ? '3' : '2'));
    }
    if (c >= 0.99) ellipse(CX, CY, r + 3 + Math.sin(t * 20), r + 3 + Math.sin(t * 20), Math.floor(t * 10) % 2 ? '4' : '3', 2);
  }

  function drawSingu(t, r0, surge, dt) {
    mood.t = Math.max(0, mood.t - dt);
    if (!mood.t) mood.kind = '';
    mood.munch = Math.max(0, mood.munch - dt);
    // Squash and stretch on each tap.
    const sq = fx.squash;
    const R = Math.max(5, Math.round(r0 * (1 + fx.gulp * 0.1)));
    const rx = Math.round(R * (1 + sq * 0.12)), ry = Math.round(R * (1 - sq * 0.12));
    const cx = CX, cy = CY;
    const haloKey = surge ? '3' : mood.kind === 'happy' ? '1' : '9';
    for (let dy = -ry - 4; dy <= ry + 4; dy++) for (let dx = -rx - 4; dx <= rx + 4; dx++) {
      const d = Math.hypot(dx / rx, dy / ry) * R;
      if (d > R + 0.5 && d < R + 4.5 && dith(cx + dx, cy + dy, (R + 4.5 - d) / 4 * (0.5 + Math.min(1, fx.flash) * 0.35))) { b.fillStyle = P[haloKey]; b.fillRect(cx + dx, cy + dy, 1, 1); }
    }
    const rimKey = surge || mood.kind === 'star' ? '4' : mood.kind === 'happy' ? 'p' : mood.kind === 'dizzy' ? 'e' : 'b';
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      b.fillStyle = P.k; b.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
    const spin = t * (1.1 + Math.min(1, fx.gulp) * 2);
    for (let arm = 0; arm < 3; arm++) {
      for (let rr = R * 0.95; rr > R * 0.18; rr -= 0.5) {
        const fr = rr / R;
        const a = arm * 2.094 + spin + fr * 3.2;
        const x = Math.round(cx + Math.cos(a) * rr * rx / R), y = Math.round(cy + Math.sin(a) * rr * ry / R);
        if (!dith(x, y, fr * 0.9)) continue;
        b.fillStyle = P[fr > 0.7 ? 'w' : fr > 0.45 ? '1' : 'f'];
        b.fillRect(x, y, 1, 1);
      }
    }
    if (mood.munch > 0) { const rr = R * (0.3 + mood.munch * 1.8); if (rr < R) ellipse(cx, cy, rr * rx / R, rr * ry / R, 'v', 2); }
    ellipse(cx, cy, rx, ry, rimKey, 0);
    b.fillStyle = P.c;
    for (let i = 0; i < 7; i++) { const a = t * 1.6 + i * 0.08; b.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
  }

  // Harvesters orbit Singu and send little streams of matter into it.
  function drawSats(dt, t, r, back) {
    if (!sats.length) return;
    const reduced = G.reduced();
    for (const s of sats) {
      if (back) { s.a += dt * s.sp * (reduced ? 0.4 : 1); s.emit -= dt; }
      const sn = Math.sin(s.a);
      if (back ? sn >= 0 : sn < 0) continue;
      const x = CX + Math.cos(s.a) * S * s.r * 1.05, y = CY + sn * S * s.r * 0.42;
      sprite('gen' + s.i, x, y, 10);
      if (!back && s.emit <= 0 && !reduced) {
        s.emit = 1.5 + Math.random() * 2;
        addParticle(x, y, (CX - x) * 1.8, (CY - y) * 1.8, 0.5, '5');
      }
    }
  }

  function drawPets(t, r, back) {
    if (!pets.length) return;
    const rx = Math.max(r * 3.2, 28), ry = rx * 0.38;
    for (const pet of pets) {
      const a = pet.phase + t * 0.2;
      const sn = Math.sin(a);
      if (back ? sn >= 0 : sn < 0) continue;
      const hop = Math.abs(Math.sin(t * 3 + pet.bob)) * 3;
      sprite('pet_' + pet.id, CX + Math.cos(a) * rx, CY + sn * ry - Math.round(hop) - 2);
    }
  }

  function drawComet(t, world) {
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

  root.PSScene = { init: init, resize: resize, rebuild: rebuild, sync: sync, draw: draw, onEvent: onEvent, tap: tap, bigFlash: bigFlash, collapseFx: collapseFx, mood: singuMood };
})(typeof globalThis !== 'undefined' ? globalThis : this);
