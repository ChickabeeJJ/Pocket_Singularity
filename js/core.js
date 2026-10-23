/* Pocket Singularity — core rules.
 * Pure game logic: balance data, economy, saves, and the fragment world simulation.
 * No DOM access here, so the same file runs in the browser and in Node (tools/sim.js, tests/).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Balance data. Every tuning value lives here.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    saveVersion: 1,
    pulseCooldown: 0.36,      // seconds between pulses
    pulseBuffer: 0.16,        // a click this close to the end of cooldown is queued, not dropped
    ringSpeed: 2.6,           // field units per second
    coreRadius: 0.115,        // base core radius (field units, field edge = 1)
    swallowRadius: 0.2,       // drifting fragments inside this are eaten on their own
    drift: 0.014,             // inward drift speed of orbiting fragments
    offlineCapMs: 2 * 60 * 60 * 1000,
    offlineRate: 0.5,
    awayThresholdMs: 5000,    // longer real gaps than this are treated as "away"
    startFragments: 16,

    fragments: {
      dust:    { value: 1.0,  label: 'Dust' },
      ice:     { value: 1.35, label: 'Ice' },
      crystal: { value: 2.5,  label: 'Star crystal' },
      shard:   { value: 1.8,  label: 'Unstable shard', blast: 0.3 }
    },

    upgrades: [
      { id: 'radius',    name: 'Wider Event Horizon', desc: 'Pulse reaches further',       base: 20,  growth: 1.55, max: 12 },
      { id: 'density',   name: 'Matter Density',      desc: 'More fragments drift in',     base: 22,  growth: 1.48, max: 20 },
      { id: 'drones',    name: 'Orbital Drones',      desc: 'Collect Matter on their own', base: 45,  growth: 1.16, max: 100 },
      { id: 'resonance', name: 'Resonance',           desc: 'Bigger chain bonus',          base: 60,  growth: 1.62, max: 15 },
      { id: 'focus',     name: 'Pulse Focus',         desc: 'Everything is worth more',    base: 120, growth: 1.9,  max: 40 }
    ],

    // Five hand-made sectors; later ones are generated from these (see sectorInfo).
    sectors: [
      { name: 'Dust Cloud',     at: 0,     value: 1,    mix: { dust: 88, ice: 11, crystal: 1.2, shard: 0 } },
      { name: 'Shattered Belt', at: 1.5e3, value: 1.5,  mix: { dust: 60, ice: 22, crystal: 2.5, shard: 14 } },
      { name: 'Frozen Moon',    at: 4e4,   value: 2.25, mix: { dust: 36, ice: 50, crystal: 4, shard: 10 } },
      { name: 'Nebula Engine',  at: 1e6,   value: 3.4,  mix: { dust: 36, ice: 22, crystal: 6, shard: 34 } },
      { name: 'Star Nursery',   at: 2.5e7, value: 5,    mix: { dust: 30, ice: 26, crystal: 24, shard: 20 } }
    ],
    sectorGrowth: 12,       // threshold multiplier for each generated sector after the fifth
    sectorValueGrowth: 1.5,

    collapse: { minSector: 3, base: 3.6e4, step: 0.25 },  // Stardust = floor(cbrt(run / base)); +25% each

    research: [
      { id: 'echo',   at: 3,  name: 'Echo Pulse',        desc: 'The core pulses by itself every 5 s' },
      { id: 'lure',   at: 10, name: 'Comet Lure',        desc: 'Comets appear 40% more often; Surges last longer' },
      { id: 'memory', at: 25, name: 'Deep Memory',       desc: 'Away income 50% → 80%; each run starts with 3 drones' },
      { id: 'anchor', at: 60, name: 'Horizon Anchor',    desc: 'Event Horizon and Density levels survive Collapse' }
    ],

    comet: { first: 45, min: 70, max: 140, speed: 0.24, surge: 20, surgeMult: 3 },
    echoInterval: 5,
    atlasStep: 0.03,

    mutations: [
      { id: 'frost',    name: 'Frost Tide',     desc: 'Ice fragments are worth 2×',           ice: 2 },
      { id: 'wide',     name: 'Wide Field',     desc: 'Pulses reach 15% further',             radius: 1.15 },
      { id: 'bloom',    name: 'Crystal Bloom',  desc: 'Star crystals are 3× more common',     crystalW: 3 },
      { id: 'swarm',    name: 'Drone Swarm',    desc: 'Drones collect 50% more',              drones: 1.5 },
      { id: 'season',   name: 'Comet Season',   desc: 'Comets arrive twice as often',         comets: 2 },
      { id: 'resonant', name: 'Resonant Day',   desc: 'Chain bonus is 50% stronger',          chain: 1.5 },
      { id: 'volatile', name: 'Volatile Skies', desc: 'More unstable shards, bigger blasts',  shardW: 2.5, blast: 1.35 },
      { id: 'dense',    name: 'Dense Void',     desc: 'Fragments drift in 25% faster',        spawn: 1.25 }
    ],

    discoveries: [
      { id: 'f_dust',    name: 'Stellar Dust',      desc: 'The common grain of every universe.' },
      { id: 'f_ice',     name: 'Ice Fragment',      desc: 'Frozen water from a comet that never was.' },
      { id: 'f_crystal', name: 'Star Crystal',      desc: 'Compressed starlight. Rare and bright.' },
      { id: 'f_shard',   name: 'Unstable Shard',    desc: 'Bursts when swallowed, dragging neighbours in.' },
      { id: 'comet',     name: 'Wandering Comet',   desc: 'Catch one in a pulse to trigger a Surge.' },
      { id: 'chain5',    name: 'Resonant Chain',    desc: 'Capture 5 fragments with one pulse.' },
      { id: 'chain12',   name: 'Cascade',           desc: 'Capture 12 fragments with one pulse.' },
      { id: 'chain25',   name: 'Avalanche',         desc: 'Capture 25 fragments with one pulse.' },
      { id: 'reaction',  name: 'Chain Reaction',    desc: 'One shard blast pulls in 3 more fragments.' },
      { id: 'golden',    name: 'Golden Hour',       desc: 'Swallow a Star Crystal during a Surge.' },
      { id: 's1',        name: 'Shattered Belt',    desc: 'Reach the second sector.' },
      { id: 's2',        name: 'Frozen Moon',       desc: 'Reach the third sector.' },
      { id: 's3',        name: 'Nebula Engine',     desc: 'Reach the fourth sector.' },
      { id: 's4',        name: 'Star Nursery',      desc: 'Reach the fifth sector.' },
      { id: 'drones25',  name: 'Drone Constellation', desc: 'Command 25 Orbital Drones.' },
      { id: 'collapse',  name: 'First Collapse',    desc: 'Fold a universe into Stardust.' }
    ]
  };

  const UPG = {};
  CONFIG.upgrades.forEach(function (u, i) { u.index = i; UPG[u.id] = u; });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function num(v, fallback) { return (typeof v === 'number' && isFinite(v)) ? v : fallback; }
  function nonNeg(v) { return Math.max(0, num(v, 0)); }
  function int(v, lo, hi) { return clamp(Math.floor(num(v, lo)), lo, hi); }

  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 100) return n < 10 && n % 1 > 0.05 ? n.toFixed(1) : String(Math.floor(n));
    if (n < 1000) return String(Math.floor(n));
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIX.length) return n.toExponential(2).replace('+', '');
    const scaled = n / Math.pow(1000, tier);
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    // Truncate rather than round so 999.96K never displays as 1000.0K.
    const p = Math.pow(10, digits);
    return (Math.floor(scaled * p) / p).toFixed(digits) + SUFFIX[tier];
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function toRoman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

  // ---------------------------------------------------------------------------
  // State & saves
  // ---------------------------------------------------------------------------
  function freshLevels() { return { radius: 0, density: 0, drones: 0, resonance: 0, focus: 0 }; }

  function createState(now) {
    return {
      v: CONFIG.saveVersion,
      matter: 0,
      runTotal: 0,
      lifetime: 0,
      levels: freshLevels(),
      sector: 0,
      maxSector: 0,
      stardust: 0,
      collapses: 0,
      discoveries: {},
      stats: { pulses: 0, captures: 0, bestChain: 0, comets: 0, playTime: 0, runTime: 0 },
      milestones: {},          // seconds of play when key moments first happened (local playtest telemetry)
      settings: { muted: false, reducedMotion: null, buyMode: 1 },
      lastSeen: now || 0,
      created: now || 0
    };
  }

  // Accepts anything (including garbage) and returns a valid state plus whether it was intact.
  function sanitize(raw, now) {
    const s = createState(now);
    if (!raw || typeof raw !== 'object') return { state: s, ok: false };
    const ok = raw.v === CONFIG.saveVersion &&
      ['matter', 'runTotal', 'lifetime'].every(function (k) { return typeof raw[k] === 'number' && isFinite(raw[k]) && raw[k] >= 0; });
    s.matter = nonNeg(raw.matter);
    s.runTotal = nonNeg(raw.runTotal);
    s.lifetime = Math.max(nonNeg(raw.lifetime), s.runTotal);
    s.matter = Math.min(s.matter, s.lifetime);  // cannot hold more than was ever earned
    const lv = raw.levels && typeof raw.levels === 'object' ? raw.levels : {};
    CONFIG.upgrades.forEach(function (u) { s.levels[u.id] = int(lv[u.id], 0, u.max); });
    s.stardust = Math.floor(nonNeg(raw.stardust));
    s.collapses = Math.floor(nonNeg(raw.collapses));
    // The sector is derived from run progress, never trusted from the file.
    s.sector = sectorFor(s.runTotal);
    s.maxSector = Math.max(int(raw.maxSector, 0, 99), s.sector);
    const known = {};
    CONFIG.discoveries.forEach(function (d) { known[d.id] = true; });
    if (raw.discoveries && typeof raw.discoveries === 'object') {
      Object.keys(raw.discoveries).forEach(function (k) {
        if (known[k]) s.discoveries[k] = nonNeg(raw.discoveries[k]) || 1;
      });
    }
    const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    Object.keys(s.stats).forEach(function (k) { s.stats[k] = nonNeg(st[k]); });
    const ms = raw.milestones && typeof raw.milestones === 'object' ? raw.milestones : {};
    Object.keys(ms).forEach(function (k) { if (/^[A-Za-z0-9_]{1,24}$/.test(k)) s.milestones[k] = nonNeg(ms[k]); });
    const set = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    s.settings.muted = set.muted === true;
    s.settings.reducedMotion = typeof set.reducedMotion === 'boolean' ? set.reducedMotion : null;
    s.settings.buyMode = [1, 10, 0].indexOf(set.buyMode) >= 0 ? set.buyMode : 1;
    s.lastSeen = nonNeg(raw.lastSeen) || (now || 0);
    s.created = nonNeg(raw.created) || (now || 0);
    return { state: s, ok: ok };
  }

  function serialize(state) { return JSON.stringify(state); }

  function parseSave(text, now) {
    if (typeof text !== 'string' || !text) return null;
    try { return sanitize(JSON.parse(text), now); } catch (e) { return { state: createState(now), ok: false, broken: true }; }
  }

  // ---------------------------------------------------------------------------
  // Sectors, mutations, research
  // ---------------------------------------------------------------------------
  function sectorInfo(i) {
    const base = CONFIG.sectors;
    if (i < base.length) return Object.assign({ index: i, palette: i, tier: 0 }, base[i]);
    const tier = Math.floor(i / base.length);
    const src = base[i % base.length];
    const last = base[base.length - 1];
    const extra = i - (base.length - 1);
    return {
      index: i,
      palette: i % base.length,
      tier: tier,
      name: src.name + ' ' + toRoman(tier + 1),
      at: last.at * Math.pow(CONFIG.sectorGrowth, extra),
      value: last.value * Math.pow(CONFIG.sectorValueGrowth, extra),
      mix: base[Math.max(1, i % base.length)].mix
    };
  }

  function sectorFor(runTotal) {
    let i = 0;
    while (i < 98 && runTotal >= sectorInfo(i + 1).at) i++;
    return i;
  }

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function mutationFor(key) {
    const list = CONFIG.mutations;
    const i = hashString('ps:' + key) % list.length;
    // Never repeat yesterday's mutation.
    const parts = key.split('-').map(Number);
    const prev = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    const j = hashString('ps:' + dayKey(prev)) % list.length;
    return list[i === j ? (i + 1) % list.length : i];
  }

  function researchFlags(state) {
    const out = {};
    CONFIG.research.forEach(function (r) { out[r.id] = state.stardust >= r.at; });
    return out;
  }

  function discoveryCount(state) { return Object.keys(state.discoveries).length; }

  // ---------------------------------------------------------------------------
  // Economy
  // ---------------------------------------------------------------------------
  function upgradeCost(id, level) {
    const u = UPG[id];
    return Math.ceil(u.base * Math.pow(u.growth, level));
  }

  // Cost and count for buying up to `want` levels (0 = as many as affordable).
  function bulkQuote(state, id, want) {
    const u = UPG[id];
    let lvl = state.levels[id], cost = 0, n = 0;
    const limit = want === 0 ? u.max : Math.min(u.max, lvl + want);
    while (lvl < limit) {
      const c = upgradeCost(id, lvl);
      if (want === 0 && cost + c > state.matter) break;
      cost += c; lvl++; n++;
    }
    if (n === 0 && lvl < u.max) { cost = upgradeCost(id, lvl); n = 1; }  // show the next level's price
    return { n: n, cost: cost, maxed: state.levels[id] >= u.max };
  }

  function buy(state, id, want) {
    const u = UPG[id];
    if (!u) return 0;
    const q = bulkQuote(state, id, want);
    if (q.maxed || q.cost > state.matter || q.n === 0) return 0;
    state.matter -= q.cost;
    state.levels[id] += q.n;
    return q.n;
  }

  function derive(state, mut) {
    mut = mut || {};
    const L = state.levels;
    const sec = sectorInfo(state.sector);
    const sdMult = 1 + CONFIG.collapse.step * state.stardust;
    const atlasMult = 1 + CONFIG.atlasStep * discoveryCount(state);
    const focusMult = Math.pow(1.32, L.focus);
    const valueMult = focusMult * sec.value * sdMult * atlasMult;
    const droneMilestone = Math.pow(2, Math.floor(L.drones / 25));
    const mix = Object.assign({}, sec.mix);
    if (mut.crystalW) mix.crystal *= mut.crystalW;
    // Volatile days also sprinkle a few shards into the first sector, so the bonus is never empty.
    if (mut.shardW) mix.shard = Math.max(mix.shard, 2) * mut.shardW;
    const research = researchFlags(state);
    return {
      sector: sec,
      valueMult: valueMult,
      focusMult: focusMult,
      sdMult: sdMult,
      atlasMult: atlasMult,
      pulseRadius: Math.min(1.1, (0.46 + 0.045 * L.radius) * (mut.radius || 1)),
      spawnRate: 1.35 * Math.pow(1.12, L.density) * (mut.spawn || 1),
      cap: 14 + 2 * L.density,
      chainStep: (0.08 + 0.045 * L.resonance) * (mut.chain || 1),
      dronePerSec: L.drones * 0.5 * droneMilestone * valueMult * (mut.drones || 1),
      typeValue: { dust: 1, ice: CONFIG.fragments.ice.value * (mut.ice || 1), crystal: CONFIG.fragments.crystal.value, shard: CONFIG.fragments.shard.value },
      blast: CONFIG.fragments.shard.blast * (mut.blast || 1),
      mix: mix,
      cometRate: (mut.comets || 1) * (research.lure ? 1.4 : 1),
      surgeDur: CONFIG.comet.surge * (research.lure ? 1.5 : 1),
      echo: research.echo,
      offlineRate: research.memory ? 0.8 : CONFIG.offlineRate,
      research: research
    };
  }

  function chainMult(stats, n) { return 1 + stats.chainStep * Math.max(0, n - 1); }

  function earn(state, amount) {
    if (!(amount > 0) || !isFinite(amount)) return 0;
    state.matter += amount;
    state.runTotal += amount;
    state.lifetime += amount;
    return amount;
  }

  // ---------------------------------------------------------------------------
  // Collapse (prestige)
  // ---------------------------------------------------------------------------
  function stardustFor(state) {
    return Math.floor(Math.cbrt(state.runTotal / CONFIG.collapse.base) + 1e-9);
  }
  function canCollapse(state) {
    return state.sector >= CONFIG.collapse.minSector && stardustFor(state) >= 1;
  }
  function doCollapse(state) {
    if (!canCollapse(state)) return 0;
    const gain = stardustFor(state);
    const anchor = researchFlags(state).anchor;
    const keep = { radius: state.levels.radius, density: state.levels.density };
    state.stardust += gain;
    state.collapses += 1;
    state.matter = 0;
    state.runTotal = 0;
    state.sector = 0;
    state.levels = freshLevels();
    const r = researchFlags(state);
    if (anchor) { state.levels.radius = keep.radius; state.levels.density = keep.density; }
    if (r.memory) state.levels.drones = 3;
    state.stats.runTime = 0;
    return gain;
  }

  // Matter granted for time away. Elapsed is clamped; clock changes yield zero.
  function awayGain(state, stats, elapsedMs) {
    const ms = clamp(num(elapsedMs, 0), 0, CONFIG.offlineCapMs);
    return { ms: ms, gain: stats.dronePerSec * (ms / 1000) * stats.offlineRate };
  }

  // ---------------------------------------------------------------------------
  // Progress checks: sectors and discoveries
  // ---------------------------------------------------------------------------
  function discover(state, id, ev) {
    if (state.discoveries[id]) return false;
    state.discoveries[id] = Math.max(1, Math.round(state.stats.playTime));
    if (ev) ev.push({ t: 'discover', id: id });
    return true;
  }

  function checkProgress(state, ev) {
    const target = sectorFor(state.runTotal);
    while (state.sector < target) {
      state.sector++;
      if (state.sector > state.maxSector) state.maxSector = state.sector;
      if (state.sector <= 4) discover(state, 's' + state.sector, ev);
      mark(state, 'sector' + state.sector);
      if (ev) ev.push({ t: 'sector', index: state.sector });
    }
    if (state.levels.drones >= 25) discover(state, 'drones25', ev);
    if (state.collapses > 0) discover(state, 'collapse', ev);
  }

  function mark(state, key) {
    if (state.milestones[key] === undefined) state.milestones[key] = Math.round(state.stats.playTime);
  }

  // ---------------------------------------------------------------------------
  // World simulation
  // ---------------------------------------------------------------------------
  const ORBIT = 0, FALL = 1;

  function createWorld(rng, state, stats) {
    const w = {
      rng: rng || Math.random,
      frags: [],
      rings: [],
      groups: [],
      comet: null,
      cometTimer: CONFIG.comet.first,
      surge: 0,
      cooldown: 0,
      queued: false,
      spawnAcc: 0,
      echoTimer: CONFIG.echoInterval,
      time: 0
    };
    if (state && stats) {
      for (let i = 0; i < CONFIG.startFragments; i++) {
        // Seed the field so the very first pulse always catches something.
        const f = spawnFragment(w, stats, i < 6 ? 0.25 + w.rng() * 0.17 : null);
        f.alpha = 1;
      }
    }
    return w;
  }

  function pickType(rng, mix) {
    let total = 0;
    for (const k in mix) total += mix[k];
    let roll = rng() * total;
    for (const k in mix) { roll -= mix[k]; if (roll <= 0) return k; }
    return 'dust';
  }

  function spawnFragment(w, stats, r) {
    const rng = w.rng;
    const type = pickType(rng, stats.mix);
    const radius = r != null ? r : 0.32 + Math.pow(rng(), 0.7) * 0.72;
    const f = {
      type: type,
      r: radius,
      a: rng() * Math.PI * 2,
      dir: 1,
      size: 0.85 + rng() * 0.4,
      spin: rng() * Math.PI * 2,
      wob: rng() * Math.PI * 2,
      state: ORBIT,
      alpha: 0,
      t: 0, delay: 0, dur: 0, r0: 0, a0: 0,
      group: null,
      inRange: false
    };
    w.frags.push(f);
    return f;
  }

  function fragPos(f) { return { x: Math.cos(f.a) * f.r, y: Math.sin(f.a) * f.r * 0.82 }; }
  function dist(x, y) { return Math.sqrt(x * x + y * y); }
  // Distances are measured in the flattened orbital plane so the visible range ellipse matches the rules.
  function fragDist(f) { const p = fragPos(f); return dist(p.x, p.y / 0.82); }

  function newGroup(w, auto) {
    const g = { count: 0, base: 0, landed: 0, credited: 0, auto: !!auto, hadCrystal: false, done: false, blastCount: 0 };
    w.groups.push(g);
    return g;
  }

  function catchFrag(w, f, g, delay) {
    f.state = FALL;
    f.group = g;
    f.t = 0;
    f.delay = delay;
    f.dur = 0.22 + f.r * 0.32;
    f.r0 = f.r;
    f.a0 = f.a;
    g.count++;
  }

  function canPulse(w) { return w.cooldown <= 0; }

  // Returns true if a pulse fired (or was queued).
  function pulse(w, state, stats, ev, auto) {
    if (w.cooldown > 0) {
      if (!auto && w.cooldown <= CONFIG.pulseBuffer) w.queued = true;
      return false;
    }
    firePulse(w, state, stats, ev, auto);
    return true;
  }

  function firePulse(w, state, stats, ev, auto) {
    if (!auto) w.cooldown = CONFIG.pulseCooldown;
    const R = stats.pulseRadius * (auto ? 0.85 : 1);
    w.rings.push({ t: 0, max: R, auto: !!auto });
    const g = newGroup(w, auto);
    for (const f of w.frags) {
      if (f.state !== ORBIT || f.alpha < 0.35) continue;
      const d = fragDist(f);
      if (d <= R) catchFrag(w, f, g, d / CONFIG.ringSpeed);
    }
    let cometCaught = false;
    if (w.comet && !w.comet.caught) {
      const d = dist(w.comet.x, w.comet.y / 0.82);
      if (d <= R) {
        w.comet.caught = true;
        w.comet.fall = 0;
        cometCaught = true;
      }
    }
    if (!auto) {
      state.stats.pulses++;
      mark(state, 'firstPulse');
    }
    if (ev) ev.push({ t: 'pulse', auto: !!auto, count: g.count, comet: cometCaught, radius: R });
    if (g.count === 0) g.done = true;
    return g;
  }

  function landFrag(w, state, stats, f, ev) {
    const g = f.group;
    const surgeMult = w.surge > 0 ? CONFIG.comet.surgeMult : 1;
    const base = stats.typeValue[f.type];
    const value = base * stats.valueMult * surgeMult;
    earn(state, value);
    g.base += base;
    g.landed++;
    g.credited += value;
    state.stats.captures++;
    discover(state, 'f_' + f.type, ev);
    if (f.type === 'crystal') {
      g.hadCrystal = true;
      if (w.surge > 0) discover(state, 'golden', ev);
    }
    if (ev) ev.push({ t: 'capture', type: f.type, value: value, idx: g.landed, auto: g.auto });
    if (f.type === 'shard') shardBlast(w, stats, f, g, ev);
  }

  function shardBlast(w, stats, f, g, ev) {
    // The shard bursts at its last orbital position, catching neighbours into the same chain.
    const ox = Math.cos(f.a0) * f.r0, oy = Math.sin(f.a0) * f.r0 * 0.82;
    let n = 0;
    for (const o of w.frags) {
      if (o.state !== ORBIT || o.alpha < 0.35) continue;
      const p = fragPos(o);
      const d = dist(p.x - ox, (p.y - oy) / 0.82);
      if (d <= stats.blast) { catchFrag(w, o, g, d / CONFIG.ringSpeed); n++; }
    }
    g.blastCount += n;
    if (ev) ev.push({ t: 'blast', x: ox, y: oy, r: stats.blast, n: n });
    return n;
  }

  function finishGroup(w, state, stats, g, ev) {
    g.done = true;
    const surgeMult = w.surge > 0 ? CONFIG.comet.surgeMult : 1;
    const mult = chainMult(stats, g.count);
    const total = g.base * stats.valueMult * surgeMult * mult;
    const bonus = Math.max(0, total - g.credited);
    earn(state, bonus);
    if (!g.auto && g.count > state.stats.bestChain) state.stats.bestChain = g.count;
    if (g.count >= 5) discover(state, 'chain5', ev);
    if (g.count >= 12) discover(state, 'chain12', ev);
    if (g.count >= 25) discover(state, 'chain25', ev);
    if (g.blastCount >= 3) discover(state, 'reaction', ev);
    if (ev) ev.push({ t: 'payout', total: total, bonus: bonus, chain: g.count, mult: mult, auto: g.auto });
  }

  function spawnComet(w) {
    const rng = w.rng;
    const ang = rng() * Math.PI * 2;
    const miss = 0.12 + rng() * 0.3;                 // closest approach to the core
    const side = rng() < 0.5 ? -1 : 1;
    const dx = Math.cos(ang), dy = Math.sin(ang);    // travel direction
    const px = -dy * miss * side, py = dx * miss * side; // closest-approach point
    const start = 1.45;
    w.comet = {
      x: px - dx * start, y: (py - dy * start) * 0.82,
      vx: dx * CONFIG.comet.speed, vy: dy * CONFIG.comet.speed * 0.82,
      t: 0, life: (start * 2) / CONFIG.comet.speed, caught: false, fall: 0
    };
  }

  function step(w, state, stats, dt, ev) {
    w.time += dt;
    state.stats.playTime += dt;
    state.stats.runTime += dt;

    if (w.cooldown > 0) {
      w.cooldown -= dt;
      if (w.cooldown <= 0 && w.queued) { w.queued = false; w.cooldown = 0; firePulse(w, state, stats, ev, false); }
    }

    if (w.surge > 0) w.surge = Math.max(0, w.surge - dt);
    const surgeMult = w.surge > 0 ? CONFIG.comet.surgeMult : 1;

    // Passive income.
    if (stats.dronePerSec > 0) earn(state, stats.dronePerSec * dt * surgeMult);

    // Spawning.
    let orbiting = 0;
    for (const f of w.frags) if (f.state === ORBIT) orbiting++;
    w.spawnAcc += stats.spawnRate * dt;
    while (w.spawnAcc >= 1) {
      w.spawnAcc -= 1;
      if (orbiting < stats.cap) { spawnFragment(w, stats, null); orbiting++; }
    }
    if (w.spawnAcc > 1) w.spawnAcc = 1;

    // Fragments.
    const coreR = coreRadius(state);
    for (let i = w.frags.length - 1; i >= 0; i--) {
      const f = w.frags[i];
      if (f.state === ORBIT) {
        if (f.alpha < 1) f.alpha = Math.min(1, f.alpha + dt * 1.6);
        f.a += 0.2 * Math.pow(Math.max(f.r, 0.2), -1.5) * dt;
        f.r -= CONFIG.drift * dt * (0.6 + f.size * 0.4);
        f.spin += dt * (f.type === 'shard' ? 2.4 : 0.8);
        f.inRange = fragDist(f) <= stats.pulseRadius;
        if (f.r <= CONFIG.swallowRadius) {
          // Drifted all the way in: the core eats it on its own (no chain bonus).
          const value = stats.typeValue[f.type] * stats.valueMult * surgeMult;
          earn(state, value);
          discover(state, 'f_' + f.type, ev);
          if (ev) ev.push({ t: 'swallow', type: f.type, value: value });
          w.frags.splice(i, 1);
        }
      } else {
        if (f.delay > 0) { f.delay -= dt; continue; }
        f.t += dt;
        const p = Math.min(1, f.t / f.dur);
        const e = p * p;
        f.r = f.r0 + (coreR * 0.6 - f.r0) * e;
        f.a = f.a0 + e * 2.2;
        f.spin += dt * 8;
        if (p >= 1) {
          landFrag(w, state, stats, f, ev);
          w.frags.splice(i, 1);
        }
      }
    }

    // Chain groups resolve once every caught fragment has landed.
    for (let i = w.groups.length - 1; i >= 0; i--) {
      const g = w.groups[i];
      if (!g.done && g.landed >= g.count) finishGroup(w, state, stats, g, ev);
      if (g.done) w.groups.splice(i, 1);
    }

    // Rings (visual + timing reference).
    for (let i = w.rings.length - 1; i >= 0; i--) {
      const r = w.rings[i];
      r.t += dt;
      if (r.t > r.max / CONFIG.ringSpeed + 0.45) w.rings.splice(i, 1);
    }

    // Comets.
    if (w.comet) {
      const c = w.comet;
      c.t += dt;
      if (c.caught) {
        c.fall += dt;
        const k = Math.min(1, dt * 6);
        c.x += (0 - c.x) * k; c.y += (0 - c.y) * k;
        if (c.fall > 0.45) {
          w.comet = null;
          w.surge = Math.max(w.surge, 0) + stats.surgeDur;
          state.stats.comets++;
          discover(state, 'comet', ev);
          if (ev) ev.push({ t: 'surge', dur: w.surge });
        }
      } else {
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.t >= c.life) w.comet = null;
      }
    } else {
      w.cometTimer -= dt * stats.cometRate;
      if (w.cometTimer <= 0) {
        spawnComet(w);
        w.cometTimer = CONFIG.comet.min + w.rng() * (CONFIG.comet.max - CONFIG.comet.min);
        if (ev) ev.push({ t: 'comet' });
      }
    }

    // Echo Pulse research: the core pulses by itself.
    if (stats.echo) {
      w.echoTimer -= dt;
      if (w.echoTimer <= 0) { w.echoTimer = CONFIG.echoInterval; firePulse(w, state, stats, ev, true); }
    }

    checkProgress(state, ev);
  }

  // Core visibly grows with all-time progress.
  function coreRadius(state) {
    const g = Math.log10(1 + state.lifetime) / 12;
    return CONFIG.coreRadius * (1 + Math.min(0.75, g * 0.75) + Math.min(0.25, state.stardust * 0.01));
  }

  function coreStage(state) {
    const l = state.lifetime;
    return l < 1e3 ? 0 : l < 1e5 ? 1 : l < 1e7 ? 2 : l < 1e10 ? 3 : 4;
  }

  const API = {
    CONFIG: CONFIG, UPG: UPG,
    fmt: fmt, clamp: clamp, mulberry32: mulberry32, hashString: hashString,
    createState: createState, sanitize: sanitize, serialize: serialize, parseSave: parseSave,
    sectorInfo: sectorInfo, sectorFor: sectorFor, dayKey: dayKey, mutationFor: mutationFor,
    researchFlags: researchFlags, discoveryCount: discoveryCount,
    upgradeCost: upgradeCost, bulkQuote: bulkQuote, buy: buy, derive: derive, chainMult: chainMult, earn: earn,
    stardustFor: stardustFor, canCollapse: canCollapse, doCollapse: doCollapse, awayGain: awayGain,
    checkProgress: checkProgress, discover: discover, mark: mark,
    createWorld: createWorld, pulse: pulse, canPulse: canPulse, step: step,
    fragPos: fragPos, coreRadius: coreRadius, coreStage: coreStage,
    ORBIT: ORBIT, FALL: FALL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PS = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
