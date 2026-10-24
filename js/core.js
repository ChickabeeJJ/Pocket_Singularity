/* Pocket Singularity — core rules.
 * Pure game logic: balance data, economy, saves, gacha, and the fragment world simulation.
 * No DOM access here, so the same file runs in the browser and in Node (tools/sim.js, tests/).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Balance data. Every tuning value lives here.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    saveVersion: 2,
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

    // Caps of 100+ are effectively "endless"; costs outgrow effects long before them.
    upgrades: [
      { id: 'radius',    name: 'Event Horizon', desc: 'Pulse reaches further',        base: 20,  growth: 1.55, max: 12 },
      { id: 'density',   name: 'Matter Density', desc: 'More fragments drift in',     base: 22,  growth: 1.48, max: 25 },
      { id: 'drones',    name: 'Orbital Drones', desc: 'Collect Matter on their own; ×2 every 25 levels', base: 45, growth: 1.16, max: 1000 },
      { id: 'resonance', name: 'Resonance',      desc: 'Bigger chain bonus',          base: 60,  growth: 1.62, max: 25 },
      { id: 'focus',     name: 'Pulse Focus',    desc: 'Everything is worth more',    base: 120, growth: 1.9,  max: 200 },
      { id: 'luck',      name: 'Lucky Charm',    desc: 'More Lucky Pulses; the Star Reel fills faster', base: 150, growth: 1.75, max: 20 }
    ],

    // Five hand-made sectors; later ones are generated from these (see sectorInfo).
    sectors: [
      { name: 'Dust Cloud',     at: 0,     value: 1,    mix: { dust: 88, ice: 11, crystal: 1.2, shard: 0 } },
      { name: 'Shattered Belt', at: 1.5e3, value: 1.5,  mix: { dust: 60, ice: 22, crystal: 2.5, shard: 14 } },
      { name: 'Frozen Moon',    at: 6e4,   value: 2.25, mix: { dust: 36, ice: 50, crystal: 4, shard: 10 } },
      { name: 'Nebula Engine',  at: 4e6,   value: 3.4,  mix: { dust: 36, ice: 22, crystal: 6, shard: 34 } },
      { name: 'Star Nursery',   at: 3e8, value: 5,    mix: { dust: 30, ice: 26, crystal: 24, shard: 20 } }
    ],
    sectorGrowth: 20,       // threshold multiplier for each generated sector after the fifth
    sectorValueGrowth: 1.5,

    collapse: { minSector: 3, base: 1.5e5, step: 0.25 },  // Stardust = floor(cbrt(run / base)); +25% each

    research: [
      { id: 'echo',   at: 3,  name: 'Echo Pulse',     desc: 'Singu pulses by itself every 5 s' },
      { id: 'lure',   at: 10, name: 'Comet Lure',     desc: 'Comets appear 40% more often; Surges last longer' },
      { id: 'memory', at: 25, name: 'Deep Memory',    desc: 'Away income 50% > 80%; each run starts with 3 drones' },
      { id: 'anchor', at: 60, name: 'Horizon Anchor', desc: 'Event Horizon and Density levels survive Collapse' }
    ],

    comet: { first: 45, min: 70, max: 140, speed: 0.24, surge: 20, surgeMult: 3 },
    echoInterval: 5,
    atlasStep: 0.03,

    // Singu grows a level each time lifetime Matter doubles past `base`.
    singu: { base: 25, growth: 2, perLevel: 0.03 },

    // Lucky Pulses: a random pulse multiplies its whole chain.
    lucky: { chance: 0.05, perLevel: 0.01, power: 3 },

    // Star Reel: every capture charges it; when full it spins three cosmic symbols. Never costs anything.
    reel: {
      need: 30,               // pulses that catch something
      spin: 1.7,
      symbols: [
        { id: 'dust', w: 30 }, { id: 'ice', w: 24 }, { id: 'shard', w: 18 },
        { id: 'crystal', w: 14 }, { id: 'comet', w: 9 }, { id: 'singu', w: 5 }
      ],
      // Seconds of current income paid per result, plus tickets.
      prizes: {
        singu3:   { secs: 120, tickets: 20, surge: true, name: 'SINGU JACKPOT' },
        comet3:   { secs: 40,  tickets: 10, surge: true, name: 'Comet Triple' },
        crystal3: { secs: 60,  tickets: 8,  name: 'Crystal Triple' },
        triple:   { secs: 30,  tickets: 4,  name: 'Triple' },
        pairRare: { secs: 12,  tickets: 2,  name: 'Lucky Pair' },
        pair:     { secs: 8,   tickets: 1,  name: 'Pair' },
        none:     { secs: 3,   tickets: 0,  name: 'Stardust Sparkle' }
      }
    },

    // Overcharge: an optional push-your-luck after a big chain. Odds are shown in the UI.
    overcharge: { minChain: 10, window: 3.5, cooldown: 25, winChance: 0.5, win: 1, lose: 0.5 },

    tickets: {
      chainMin: 4, chainBase: 0.18, chainPer: 0.015, chainMax: 0.35, chainCooldown: 12,
      comet: 5, sector: 10, level: 3, discovery: 2
    },

    gacha: {
      cost: 10, cost10: 90,
      rarities: [
        { name: 'Common',    w: 62, refund: 1 },
        { name: 'Rare',      w: 27, refund: 2 },
        { name: 'Epic',      w: 9,  refund: 4 },
        { name: 'Legendary', w: 2,  refund: 8 }
      ],
      pityEpic: 25,          // an Epic or better at least every 25 pulls
      pityLegend: 70,        // a Legendary at least every 70 pulls
      softLegend: 50,        // after 50 dry pulls Legendary odds climb each pull
      starNeed: [0, 1, 2, 3, 4],   // extra copies needed to go from N to N+1 stars
      maxStars: 5,
      starScale: 0.5         // bonus × (1 + 0.5 × (stars − 1))  → ★5 = ×3
    },

    critters: [
      { id: 'mouse',   name: 'Mote Mouse',   rarity: 0, bonus: { matter: 0.08 },  text: '+{matter}% Matter' },
      { id: 'pup',     name: 'Pebble Pup',   rarity: 0, bonus: { drones: 0.12 },  text: '+{drones}% drone income' },
      { id: 'bun',     name: 'Dusty Bun',    rarity: 0, bonus: { chain: 0.05 },   text: '+{chain}% chain bonus' },
      { id: 'snail',   name: 'Glow Snail',   rarity: 0, bonus: { offline: 0.05 }, text: '+{offline}% away income' },
      { id: 'cat',     name: 'Comet Cat',    rarity: 1, bonus: { comet: 0.15 },   text: 'Comets {comet}% more often' },
      { id: 'penguin', name: 'Ice Penguin',  rarity: 1, bonus: { ice: 0.3 },      text: 'Ice worth +{ice}%' },
      { id: 'frog',    name: 'Lucky Frog',   rarity: 1, bonus: { luck: 0.02 },    text: '+{luck}% Lucky Pulse chance' },
      { id: 'owl',     name: 'Orbit Owl',    rarity: 1, bonus: { reel: 0.15 },    text: 'Star Reel fills {reel}% faster' },
      { id: 'jelly',   name: 'Nebula Jelly', rarity: 2, bonus: { matter: 0.3 },   text: '+{matter}% Matter' },
      { id: 'fox',     name: 'Quasar Fox',   rarity: 2, bonus: { luckPow: 0.5 },  text: 'Lucky Pulses +{luckPow}× stronger' },
      { id: 'crab',    name: 'Shard Crab',   rarity: 2, bonus: { blast: 0.2 },    text: 'Shard blasts {blast}% bigger' },
      { id: 'dragon',  name: 'Sun Dragon',   rarity: 3, bonus: { mult: 0.5 },     text: 'All Matter ×{mult}' },
      { id: 'whale',   name: 'Cosmo Whale',  rarity: 3, bonus: { drones: 1, tickets: 1 }, text: 'Drones +{drones}%, +{tickets} ticket per comet & reel' }
    ],

    // Reasons to come back. Rewards: tickets, mins (minutes of current income), surge (seconds),
    // capsule (list of minimum rarities for free hatches: 0 any, 1 Rare+, 2 Epic+).
    rewards: {
      login: [
        { tickets: 20 },
        { tickets: 20, mins: 10 },
        { tickets: 30, surge: 30 },
        { tickets: 20, capsule: [1] },
        { tickets: 40, mins: 20 },
        { tickets: 50, surge: 60 },
        { tickets: 60, capsule: [2] }
      ],
      loginWeekBonus: 0.25, loginWeekCap: 4,   // each completed week adds +25% tickets, up to +100%
      questsPerDay: 3,
      quests: [
        { id: 'pulses',      stat: 'pulses',      n: 150, text: 'Pulse {n} times',               reward: { tickets: 10 } },
        { id: 'captures',    stat: 'captures',    n: 400, text: 'Swallow {n} fragments',         reward: { tickets: 10 } },
        { id: 'spins',       stat: 'spins',       n: 4,   text: 'Spin the Star Reel {n} times',  reward: { tickets: 12 } },
        { id: 'lucky',       stat: 'lucky',       n: 8,   text: 'Land {n} Lucky Pulses',         reward: { tickets: 12 } },
        { id: 'comets',      stat: 'comets',      n: 2,   text: 'Catch {n} comets',              reward: { tickets: 15 } },
        { id: 'hatches',     stat: 'hatches',     n: 3,   text: 'Hatch {n} capsules',            reward: { tickets: 15 } },
        { id: 'buys',        stat: 'buys',        n: 20,  text: 'Buy {n} upgrade levels',        reward: { tickets: 10 } },
        { id: 'chain',       stat: 'chainToday',  n: 12,  text: 'Make a chain of {n}',           reward: { tickets: 12 }, best: true },
        { id: 'play',        stat: 'playTime',    n: 600, text: 'Play for 10 minutes',           reward: { tickets: 10, mins: 5 } },
        { id: 'overcharges', stat: 'overcharges', n: 2,   text: 'Overcharge {n} times',          reward: { tickets: 10 } }
      ],
      questBonus: { tickets: 25, capsule: [1] },
      playChests: [
        { at: 120,  reward: { tickets: 5 } },
        { at: 300,  reward: { tickets: 8 } },
        { at: 600,  reward: { tickets: 10, mins: 5 } },
        { at: 1200, reward: { tickets: 15, surge: 30 } },
        { at: 1800, reward: { tickets: 20, capsule: [1] } }
      ],
      freeCapsuleMs: 4 * 60 * 60 * 1000,
      goalTickets: [5, 10, 15, 25, 40, 60, 80],
      goals: [
        { id: 'pulses',      name: 'Pulse Master',    stat: 'pulses',      tiers: [50, 250, 1000, 5000, 20000, 100000], text: 'Pulse {n} times' },
        { id: 'captures',    name: 'Big Eater',       stat: 'captures',    tiers: [200, 1000, 5000, 25000, 100000, 500000], text: 'Swallow {n} fragments' },
        { id: 'bestChain',   name: 'Chain Artist',    stat: 'bestChain',   tiers: [6, 12, 20, 30, 45], text: 'Make a chain of {n}' },
        { id: 'hatches',     name: 'Collector',       stat: 'hatches',     tiers: [5, 20, 50, 100, 250, 500], text: 'Hatch {n} capsules' },
        { id: 'maxSector',   name: 'Explorer',        stat: 'maxSector',   tiers: [2, 3, 4, 5, 7, 10], text: 'Reach sector {n}' },
        { id: 'singuLevel',  name: 'Growing Up',      stat: 'singuLevel',  tiers: [5, 10, 20, 30, 40, 50, 60], text: 'Singu level {n}' },
        { id: 'lucky',       name: 'Lucky Star',      stat: 'lucky',       tiers: [10, 50, 200, 1000, 5000], text: 'Land {n} Lucky Pulses' },
        { id: 'spins',       name: 'Reel Regular',    stat: 'spins',       tiers: [5, 25, 100, 400, 1000], text: 'Spin the reel {n} times' },
        { id: 'comets',      name: 'Comet Chaser',    stat: 'comets',      tiers: [1, 5, 20, 50, 150], text: 'Catch {n} comets' },
        { id: 'collapses',   name: 'Universe Folder', stat: 'collapses',   tiers: [1, 3, 10, 25], text: 'Collapse {n} times' },
        { id: 'discoveries', name: 'Atlas Keeper',    stat: 'discoveries', tiers: [5, 10, 15, 18], text: 'Make {n} discoveries' }
      ]
    },

    mutations: [
      { id: 'frost',    name: 'Frost Tide',     desc: 'Ice fragments are worth 2×',           ice: 2 },
      { id: 'wide',     name: 'Wide Field',     desc: 'Pulses reach 15% further',             radius: 1.15 },
      { id: 'bloom',    name: 'Crystal Bloom',  desc: 'Star crystals are 3× more common',     crystalW: 3 },
      { id: 'swarm',    name: 'Drone Swarm',    desc: 'Drones collect 50% more',              drones: 1.5 },
      { id: 'season',   name: 'Comet Season',   desc: 'Comets arrive twice as often',         comets: 2 },
      { id: 'resonant', name: 'Resonant Day',   desc: 'Chain bonus is 50% stronger',          chain: 1.5 },
      { id: 'volatile', name: 'Volatile Skies', desc: 'More unstable shards, bigger blasts',  shardW: 2.5, blast: 1.35 },
      { id: 'dense',    name: 'Dense Void',     desc: 'Fragments drift in 25% faster',        spawn: 1.25 },
      { id: 'lucky',    name: 'Lucky Stars',    desc: 'Lucky Pulses twice as likely',         luck: 2 }
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
      { id: 'jackpot',   name: 'Singu Jackpot',     desc: 'Line up three Singus on the Star Reel.' },
      { id: 'legend',    name: 'Living Legend',     desc: 'Hatch a Legendary critter.' },
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
  const CRIT = {};
  CONFIG.critters.forEach(function (c) { CRIT[c.id] = c; });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function num(v, fallback) { return (typeof v === 'number' && isFinite(v)) ? v : fallback; }
  function nonNeg(v) { return Math.max(0, num(v, 0)); }
  function int(v, lo, hi) { return clamp(Math.floor(num(v, lo)), lo, hi); }

  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];
  function fmt(n) {
    if (!isFinite(n)) return 'INF';
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

  function weighted(rng, list) {
    let total = 0;
    for (const x of list) total += x.w;
    let roll = rng() * total;
    for (const x of list) { roll -= x.w; if (roll <= 0) return x; }
    return list[list.length - 1];
  }

  // ---------------------------------------------------------------------------
  // State & saves
  // ---------------------------------------------------------------------------
  function freshLevels() {
    const l = {};
    CONFIG.upgrades.forEach(function (u) { l[u.id] = 0; });
    return l;
  }

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
      tickets: 0,
      singuLevel: 0,
      reelCharge: 0,
      critters: {},            // id -> { stars, copies }
      gacha: { pulls: 0, sinceEpic: 0, sinceLegend: 0 },
      login: { day: 0, week: 0, last: '' },   // next calendar day to claim, weeks completed, last claim day
      daily: { key: '', quests: [], base: {}, chainToday: 0, bonus: false, play0: 0, chests: 0 },
      freeCapAt: 0,            // when the next free capsule is ready (ms)
      goals: {},               // goal id -> tiers claimed
      discoveries: {},
      stats: { pulses: 0, captures: 0, bestChain: 0, comets: 0, playTime: 0, runTime: 0, lucky: 0, spins: 0, jackpots: 0, overcharges: 0, buys: 0 },
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
    const ok = (raw.v === 1 || raw.v === CONFIG.saveVersion) &&
      ['matter', 'runTotal', 'lifetime'].every(function (k) { return typeof raw[k] === 'number' && isFinite(raw[k]) && raw[k] >= 0; });
    s.matter = nonNeg(raw.matter);
    s.runTotal = nonNeg(raw.runTotal);
    s.lifetime = Math.max(nonNeg(raw.lifetime), s.runTotal);
    s.matter = Math.min(s.matter, s.lifetime);  // cannot hold more than was ever earned
    const lv = raw.levels && typeof raw.levels === 'object' ? raw.levels : {};
    CONFIG.upgrades.forEach(function (u) { s.levels[u.id] = int(lv[u.id], 0, u.max); });
    s.stardust = Math.floor(nonNeg(raw.stardust));
    s.collapses = Math.floor(nonNeg(raw.collapses));
    s.tickets = Math.floor(Math.min(nonNeg(raw.tickets), 1e7));
    // The sector and Singu level are derived from progress, never trusted from the file.
    s.sector = sectorFor(s.runTotal);
    s.maxSector = Math.max(int(raw.maxSector, 0, 99), s.sector);
    s.singuLevel = Math.min(int(raw.singuLevel, 0, 999), singuLevelFor(s.lifetime));
    s.reelCharge = clamp(nonNeg(raw.reelCharge), 0, CONFIG.reel.need);
    if (raw.critters && typeof raw.critters === 'object') {
      Object.keys(raw.critters).forEach(function (id) {
        const c = raw.critters[id];
        if (!CRIT[id] || !c || typeof c !== 'object') return;
        const stars = int(c.stars, 1, CONFIG.gacha.maxStars);
        s.critters[id] = { stars: stars, copies: int(c.copies, 0, CONFIG.gacha.starNeed[Math.min(stars, CONFIG.gacha.maxStars - 1)] || 0) };
      });
    }
    const g = raw.gacha && typeof raw.gacha === 'object' ? raw.gacha : {};
    s.gacha.pulls = Math.floor(nonNeg(g.pulls));
    s.gacha.sinceEpic = int(g.sinceEpic, 0, CONFIG.gacha.pityEpic);
    s.gacha.sinceLegend = int(g.sinceLegend, 0, CONFIG.gacha.pityLegend);
    const dayRe = /^\d{4}-\d{2}-\d{2}$/;
    const lg = raw.login && typeof raw.login === 'object' ? raw.login : {};
    s.login.day = int(lg.day, 0, CONFIG.rewards.login.length - 1);
    s.login.week = int(lg.week, 0, 9999);
    s.login.last = typeof lg.last === 'string' && dayRe.test(lg.last) ? lg.last : '';
    const dl = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
    if (typeof dl.key === 'string' && dayRe.test(dl.key) && Array.isArray(dl.quests)) {
      const qids = {};
      CONFIG.rewards.quests.forEach(function (q) { qids[q.id] = true; });
      s.daily.key = dl.key;
      s.daily.quests = dl.quests.filter(function (q) { return q && qids[q.id]; }).slice(0, CONFIG.rewards.questsPerDay)
        .map(function (q) { return { id: q.id, claimed: q.claimed === true }; });
      const base = dl.base && typeof dl.base === 'object' ? dl.base : {};
      Object.keys(base).forEach(function (k) { if (/^[A-Za-z]{1,20}$/.test(k)) s.daily.base[k] = nonNeg(base[k]); });
      s.daily.chainToday = Math.floor(nonNeg(dl.chainToday));
      s.daily.bonus = dl.bonus === true;
      s.daily.play0 = nonNeg(dl.play0);
      s.daily.chests = int(dl.chests, 0, CONFIG.rewards.playChests.length);
      if (s.daily.quests.length < CONFIG.rewards.questsPerDay) s.daily.key = '';   // malformed: re-roll today
    }
    s.freeCapAt = nonNeg(raw.freeCapAt);
    if (now && s.freeCapAt > now + CONFIG.rewards.freeCapsuleMs) s.freeCapAt = now + CONFIG.rewards.freeCapsuleMs;  // clock moved back
    const gl = raw.goals && typeof raw.goals === 'object' ? raw.goals : {};
    CONFIG.rewards.goals.forEach(function (g) { if (gl[g.id]) s.goals[g.id] = int(gl[g.id], 0, g.tiers.length); });
    const known = {};
    CONFIG.discoveries.forEach(function (d) { known[d.id] = true; });
    if (raw.discoveries && typeof raw.discoveries === 'object') {
      Object.keys(raw.discoveries).forEach(function (k) {
        if (known[k]) s.discoveries[k] = nonNeg(raw.discoveries[k]) || 1;
      });
    }
    const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    Object.keys(s.stats).forEach(function (k) { s.stats[k] = nonNeg(st[k]); });
    s.daily.play0 = Math.min(s.daily.play0, s.stats.playTime);
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

  // Steps through the list with a stride coprime to its length, so two days in a row never match.
  function mutationFor(key) {
    const list = CONFIG.mutations;
    const n = list.length;
    const parts = key.split('-').map(Number);
    const day = Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 864e5);
    let stride = 5;
    while (gcd(stride, n) !== 1) stride++;
    return list[(((day * stride) % n) + n) % n];
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function researchFlags(state) {
    const out = {};
    CONFIG.research.forEach(function (r) { out[r.id] = state.stardust >= r.at; });
    return out;
  }

  function discoveryCount(state) { return Object.keys(state.discoveries).length; }

  function singuLevelFor(lifetime) {
    const c = CONFIG.singu;
    if (lifetime < c.base) return 0;
    return 1 + Math.floor(Math.log(lifetime / c.base) / Math.log(c.growth) + 1e-9);
  }
  function singuNext(level) { return CONFIG.singu.base * Math.pow(CONFIG.singu.growth, level); }

  // ---------------------------------------------------------------------------
  // Critters (gacha collection)
  // ---------------------------------------------------------------------------
  function critterValue(c, stars) { return 1 + CONFIG.gacha.starScale * (stars - 1); }

  function critterBonus(state) {
    const b = { matter: 0, drones: 0, chain: 0, offline: 0, comet: 0, ice: 0, luck: 0, luckPow: 0, reel: 0, blast: 0, mult: 1, tickets: 0 };
    Object.keys(state.critters).forEach(function (id) {
      const c = CRIT[id], own = state.critters[id];
      if (!c || !own) return;
      const k = critterValue(c, own.stars);
      Object.keys(c.bonus).forEach(function (key) {
        if (key === 'mult') b.mult *= 1 + c.bonus.mult * k;
        else if (key === 'tickets') b.tickets += Math.round(c.bonus.tickets * k);
        else b[key] += c.bonus[key] * k;
      });
    });
    return b;
  }

  // Human-readable bonus for a critter at a star level.
  function critterText(c, stars) {
    const k = critterValue(c, stars || 1);
    return c.text.replace(/\{(\w+)\}/g, function (_, key) {
      const v = c.bonus[key] * k;
      if (key === 'mult') return (1 + v).toFixed(2);
      if (key === 'tickets') return String(Math.round(v));
      if (key === 'luckPow') return v.toFixed(1);
      return String(Math.round(v * 100));
    });
  }

  function rarityRoll(state, rng) {
    const g = state.gacha, G = CONFIG.gacha;
    if (g.pulls === 0) return 1;                                  // the very first pull is always Rare
    if (g.sinceLegend + 1 >= G.pityLegend) return 3;
    const w = G.rarities.map(function (r) { return r.w; });
    if (g.sinceLegend + 1 > G.softLegend) w[3] += (g.sinceLegend + 1 - G.softLegend) * 1.5;
    let r = weighted(rng, w.map(function (x, i) { return { w: x, i: i }; })).i;
    if (r < 2 && g.sinceEpic + 1 >= G.pityEpic) r = 2;
    return r;
  }

  function addCritter(state, id) {
    const G = CONFIG.gacha;
    const own = state.critters[id];
    if (!own) { state.critters[id] = { stars: 1, copies: 0 }; return { isNew: true, stars: 1, starUp: false, refund: 0 }; }
    if (own.stars >= G.maxStars) {
      const refund = G.rarities[CRIT[id].rarity].refund;
      state.tickets += refund;
      return { isNew: false, stars: own.stars, starUp: false, refund: refund };
    }
    own.copies++;
    let starUp = false;
    while (own.stars < G.maxStars && own.copies >= G.starNeed[own.stars]) {
      own.copies -= G.starNeed[own.stars];
      own.stars++;
      starUp = true;
    }
    return { isNew: false, stars: own.stars, starUp: starUp, refund: 0 };
  }

  function pullOnce(state, rng, forceMin) {
    const g = state.gacha;
    let rarity = rarityRoll(state, rng);
    if (forceMin && rarity < forceMin) rarity = forceMin;
    g.pulls++;
    g.sinceEpic = rarity >= 2 ? 0 : g.sinceEpic + 1;
    g.sinceLegend = rarity === 3 ? 0 : g.sinceLegend + 1;
    const pool = CONFIG.critters.filter(function (c) { return c.rarity === rarity; });
    const c = pool[Math.floor(rng() * pool.length) % pool.length];
    const res = addCritter(state, c.id);
    if (rarity === 3) discover(state, 'legend', null);
    return Object.assign({ id: c.id, rarity: rarity }, res);
  }

  // Spends tickets and returns the results, or null if the player cannot afford it.
  function pull(state, count, rng) {
    rng = rng || Math.random;
    const G = CONFIG.gacha;
    const cost = count >= 10 ? G.cost10 : G.cost;
    const n = count >= 10 ? 10 : 1;
    if (state.tickets < cost) return null;
    state.tickets -= cost;
    const out = [];
    for (let i = 0; i < n; i++) {
      // A ten-pull always contains at least one Rare or better.
      const needRare = n === 10 && i === n - 1 && out.every(function (r) { return r.rarity === 0; });
      out.push(pullOnce(state, rng, needRare ? 1 : 0));
    }
    return out;
  }

  // Exact odds shown to the player for the next single pull.
  function gachaOdds(state) {
    const G = CONFIG.gacha, g = state.gacha;
    if (g.pulls === 0) return [0, 1, 0, 0];
    if (g.sinceLegend + 1 >= G.pityLegend) return [0, 0, 0, 1];
    const w = G.rarities.map(function (r) { return r.w; });
    if (g.sinceLegend + 1 > G.softLegend) w[3] += (g.sinceLegend + 1 - G.softLegend) * 1.5;
    const t = w.reduce(function (a, b) { return a + b; }, 0);
    let p = w.map(function (x) { return x / t; });
    if (g.sinceEpic + 1 >= G.pityEpic) p = [0, 0, p[2] + p[0] + p[1], p[3]];
    return p;
  }


  // ---------------------------------------------------------------------------
  // Retention: daily login calendar, daily quests, play-time gifts, free capsule, goals
  // ---------------------------------------------------------------------------
  const RW = CONFIG.rewards;

  function statValue(state, stat) {
    switch (stat) {
      case 'hatches': return state.gacha.pulls;
      case 'maxSector': return state.maxSector + 1;
      case 'singuLevel': return state.singuLevel;
      case 'collapses': return state.collapses;
      case 'discoveries': return discoveryCount(state);
      case 'chainToday': return state.daily.chainToday;
      default: return state.stats[stat] || 0;
    }
  }

  // Starts a new day's quests and gifts if the calendar day changed. Returns true on rollover.
  function ensureDaily(state, key) {
    if (state.daily.key === key) return false;
    const rng = mulberry32(hashString('quests:' + key));
    const pool = RW.quests.slice();
    const picks = [];
    while (picks.length < RW.questsPerDay && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    const base = {};
    picks.forEach(function (q) { if (!q.best) base[q.stat] = statValue(state, q.stat); });
    state.daily = { key: key, quests: picks.map(function (q) { return { id: q.id, claimed: false }; }), base: base, chainToday: 0, bonus: false, play0: state.stats.playTime, chests: 0 };
    return true;
  }

  function questDef(id) { return RW.quests.find(function (q) { return q.id === id; }); }
  function questProgress(state, i) {
    const dq = state.daily.quests[i];
    const q = dq && questDef(dq.id);
    if (!q) return null;
    const cur = q.best ? state.daily.chainToday : statValue(state, q.stat) - (state.daily.base[q.stat] || 0);
    return { def: q, cur: Math.max(0, cur), n: q.n, done: cur >= q.n, claimed: dq.claimed, text: q.text.replace('{n}', q.n) };
  }
  function claimQuest(state, i) {
    const p = questProgress(state, i);
    if (!p || !p.done || p.claimed) return null;
    state.daily.quests[i].claimed = true;
    return p.def.reward;
  }
  function questBonusReady(state) {
    return !state.daily.bonus && state.daily.quests.length > 0 && state.daily.quests.every(function (q) { return q.claimed; });
  }
  function claimQuestBonus(state) {
    if (!questBonusReady(state)) return null;
    state.daily.bonus = true;
    return RW.questBonus;
  }

  function loginReady(state, key) { return state.login.last !== key; }
  function loginReward(state, day) {
    const r = Object.assign({}, RW.login[day]);
    if (r.tickets) r.tickets = Math.round(r.tickets * (1 + RW.loginWeekBonus * Math.min(RW.loginWeekCap, state.login.week)));
    return r;
  }
  // Claims today's calendar reward. Missing days never resets the calendar; it just waits.
  function claimLogin(state, key) {
    if (!loginReady(state, key)) return null;
    const day = state.login.day;
    const reward = loginReward(state, day);
    state.login.last = key;
    state.login.day = day + 1;
    if (state.login.day >= RW.login.length) { state.login.day = 0; state.login.week++; }
    return { day: day, reward: reward };
  }

  function playToday(state) { return Math.max(0, state.stats.playTime - state.daily.play0); }
  function chestStatus(state) {
    const i = state.daily.chests;
    if (i >= RW.playChests.length) return null;
    const c = RW.playChests[i];
    const t = playToday(state);
    return { index: i, at: c.at, reward: c.reward, left: Math.max(0, c.at - t), ready: t >= c.at };
  }
  function claimChest(state) {
    const c = chestStatus(state);
    if (!c || !c.ready) return null;
    state.daily.chests++;
    return c.reward;
  }

  function freeCapsuleReady(state, now) { return now >= state.freeCapAt; }
  function claimFreeCapsule(state, now) {
    if (!freeCapsuleReady(state, now)) return null;
    state.freeCapAt = now + RW.freeCapsuleMs;
    return { capsule: [0] };
  }

  function goalStatus(state, g) {
    const claimed = state.goals[g.id] || 0;
    const cur = statValue(state, g.stat);
    if (claimed >= g.tiers.length) return { claimed: claimed, cur: cur, maxed: true, ready: false };
    const target = g.tiers[claimed];
    return { claimed: claimed, cur: cur, target: target, ready: cur >= target, maxed: false, tickets: RW.goalTickets[Math.min(claimed, RW.goalTickets.length - 1)], text: g.text.replace('{n}', target) };
  }
  function claimGoal(state, id) {
    const g = RW.goals.find(function (x) { return x.id === id; });
    if (!g) return null;
    const st = goalStatus(state, g);
    if (!st.ready) return null;
    state.goals[id] = st.claimed + 1;
    return { tickets: st.tickets };
  }

  // How many rewards are waiting to be claimed right now (for badges).
  function claimables(state, key, now) {
    let n = 0;
    if (loginReady(state, key)) n++;
    for (let i = 0; i < state.daily.quests.length; i++) { const p = questProgress(state, i); if (p && p.done && !p.claimed) n++; }
    if (questBonusReady(state)) n++;
    const c = chestStatus(state);
    if (c && c.ready) n++;
    if (freeCapsuleReady(state, now)) n++;
    RW.goals.forEach(function (g) { if (goalStatus(state, g).ready) n++; });
    return n;
  }

  // Applies a reward. Free capsules hatch immediately (they count toward pity like any hatch).
  function grantReward(state, stats, world, reward, rng) {
    rng = rng || Math.random;
    const out = { tickets: 0, matter: 0, surge: 0, hatches: [] };
    if (!reward) return out;
    if (reward.tickets) { state.tickets += reward.tickets; out.tickets = reward.tickets; }
    if (reward.mins) out.matter = earn(state, stats.refIncome * 60 * reward.mins);
    if (reward.surge && world) { world.surge = Math.max(0, world.surge) + reward.surge; out.surge = reward.surge; }
    (reward.capsule || []).forEach(function (min) { out.hatches.push(pullOnce(state, rng, min)); });
    checkProgress(state, null);
    return out;
  }

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
    state.stats.buys += q.n;
    return q.n;
  }

  function derive(state, mut) {
    mut = mut || {};
    const L = state.levels;
    const sec = sectorInfo(state.sector);
    const cb = critterBonus(state);
    const sdMult = 1 + CONFIG.collapse.step * state.stardust;
    const atlasMult = 1 + CONFIG.atlasStep * discoveryCount(state);
    const singuMult = 1 + CONFIG.singu.perLevel * state.singuLevel;
    const critterMult = (1 + cb.matter) * cb.mult;
    const focusMult = Math.pow(1.32, L.focus);
    const valueMult = focusMult * sec.value * sdMult * atlasMult * singuMult * critterMult;
    const droneMilestone = Math.pow(2, Math.floor(L.drones / 25));
    const mix = Object.assign({}, sec.mix);
    if (mut.crystalW) mix.crystal *= mut.crystalW;
    // Volatile days also sprinkle a few shards into the first sector, so the bonus is never empty.
    if (mut.shardW) mix.shard = Math.max(mix.shard, 2) * mut.shardW;
    const research = researchFlags(state);
    const out = {
      sector: sec,
      valueMult: valueMult,
      focusMult: focusMult,
      sdMult: sdMult,
      atlasMult: atlasMult,
      singuMult: singuMult,
      critterMult: critterMult,
      critters: cb,
      pulseRadius: Math.min(1.1, (0.46 + 0.045 * L.radius) * (mut.radius || 1)),
      spawnRate: 1.35 * Math.pow(1.12, L.density) * (mut.spawn || 1),
      cap: 14 + 2 * L.density,
      chainStep: (0.08 + 0.045 * L.resonance) * (mut.chain || 1) * (1 + cb.chain),
      dronePerSec: L.drones * 0.5 * droneMilestone * valueMult * (mut.drones || 1) * (1 + cb.drones),
      typeValue: { dust: 1, ice: CONFIG.fragments.ice.value * (mut.ice || 1) * (1 + cb.ice), crystal: CONFIG.fragments.crystal.value, shard: CONFIG.fragments.shard.value },
      blast: CONFIG.fragments.shard.blast * (mut.blast || 1) * (1 + cb.blast),
      mix: mix,
      cometRate: (mut.comets || 1) * (research.lure ? 1.4 : 1) * (1 + cb.comet),
      surgeDur: CONFIG.comet.surge * (research.lure ? 1.5 : 1),
      echo: research.echo,
      offlineRate: Math.min(1, (research.memory ? 0.8 : CONFIG.offlineRate) + cb.offline),
      luckChance: Math.min(0.6, (CONFIG.lucky.chance + CONFIG.lucky.perLevel * L.luck + cb.luck) * (mut.luck || 1)),
      luckPower: CONFIG.lucky.power + cb.luckPow,
      reelNeed: CONFIG.reel.need / (1 + 0.06 * L.luck + cb.reel),
      bonusTickets: cb.tickets,
      research: research
    };
    // Rough "active income" used to size Star Reel prizes so they stay meaningful at any scale.
    out.refIncome = out.dronePerSec + out.spawnRate * valueMult * 1.2 * chainMult(out, 6);
    return out;
  }

  function chainMult(stats, n) { return 1 + stats.chainStep * Math.max(0, n - 1); }

  function earn(state, amount) {
    if (!(amount > 0) || !isFinite(amount)) return 0;
    state.matter += amount;
    state.runTotal += amount;
    state.lifetime += amount;
    return amount;
  }

  function giveTickets(state, n, why, ev) {
    if (!(n > 0)) return;
    state.tickets += n;
    if (ev) ev.push({ t: 'tickets', n: n, why: why });
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
  // Progress checks: sectors, Singu levels and discoveries
  // ---------------------------------------------------------------------------
  function discover(state, id, ev) {
    if (state.discoveries[id]) return false;
    state.discoveries[id] = Math.max(1, Math.round(state.stats.playTime));
    state.tickets += CONFIG.tickets.discovery;
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
      giveTickets(state, CONFIG.tickets.sector, 'sector', null);
      if (ev) ev.push({ t: 'sector', index: state.sector });
    }
    const lvl = singuLevelFor(state.lifetime);
    while (state.singuLevel < lvl) {
      state.singuLevel++;
      giveTickets(state, CONFIG.tickets.level, 'level', null);
      if (ev) ev.push({ t: 'level', level: state.singuLevel });
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
      reel: null,              // active Star Reel spin
      overcharge: null,        // pending push-your-luck offer
      overchargeCd: 0,
      ticketCd: 0,
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

  function newGroup(w, auto, lucky) {
    const g = { count: 0, base: 0, landed: 0, credited: 0, auto: !!auto, lucky: lucky || 1, hadCrystal: false, done: false, blastCount: 0 };
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
    // Lucky Pulse is rolled up front so the whole chain can celebrate it.
    let lucky = 1;
    if (!auto && w.rng() < stats.luckChance) lucky = stats.luckPower;
    const g = newGroup(w, auto, lucky);
    for (const f of w.frags) {
      if (f.state !== ORBIT || f.alpha < 0.35) continue;
      const d = fragDist(f);
      if (d <= R) catchFrag(w, f, g, d / CONFIG.ringSpeed);
    }
    if (g.count > 0 && !auto) chargeReel(w, state, stats, 1, ev);
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
    if (g.count === 0) { g.done = true; g.lucky = 1; lucky = 1; }
    if (lucky > 1) state.stats.lucky++;
    if (ev) ev.push({ t: 'pulse', auto: !!auto, count: g.count, comet: cometCaught, radius: R, lucky: lucky });
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
    const mult = chainMult(stats, g.count) * g.lucky;
    const total = g.base * stats.valueMult * surgeMult * mult;
    const bonus = Math.max(0, total - g.credited);
    earn(state, bonus);
    if (!g.auto && g.count > state.stats.bestChain) state.stats.bestChain = g.count;
    if (!g.auto && g.count > state.daily.chainToday) state.daily.chainToday = g.count;
    if (g.count >= 5) discover(state, 'chain5', ev);
    if (g.count >= 12) discover(state, 'chain12', ev);
    if (g.count >= 25) discover(state, 'chain25', ev);
    if (g.blastCount >= 3) discover(state, 'reaction', ev);
    // Big chains sometimes drop a capsule ticket.
    const T = CONFIG.tickets;
    if (!g.auto && g.count >= T.chainMin && w.ticketCd <= 0) {
      const p = Math.min(T.chainMax, T.chainBase + T.chainPer * (g.count - T.chainMin)) * (g.lucky > 1 ? 2 : 1);
      if (w.rng() < p) { giveTickets(state, 1, 'chain', ev); w.ticketCd = T.chainCooldown; }
    }
    // Offer an Overcharge on big manual chains, now and then.
    const O = CONFIG.overcharge;
    if (!g.auto && g.count >= O.minChain && total > 0 && w.overchargeCd <= 0 && !w.overcharge) {
      w.overcharge = { amount: total, t: O.window, chain: g.count };
      w.overchargeCd = O.cooldown;
    }
    if (ev) ev.push({ t: 'payout', total: total, bonus: bonus, chain: g.count, mult: mult, auto: g.auto, lucky: g.lucky });
  }

  // Resolve the pending Overcharge. Returns { win, amount } or null if none is pending.
  function overcharge(w, state, ev) {
    const o = w.overcharge;
    if (!o) return null;
    w.overcharge = null;
    const O = CONFIG.overcharge;
    state.stats.overcharges++;
    const win = w.rng() < O.winChance;
    let amount;
    if (win) amount = earn(state, o.amount * O.win);
    else { amount = Math.min(state.matter, o.amount * O.lose); state.matter -= amount; }
    const res = { win: win, amount: amount, chain: o.chain };
    if (ev) ev.push(Object.assign({ t: 'overcharge' }, res));
    return res;
  }

  // ---------------------------------------------------------------------------
  // Star Reel
  // ---------------------------------------------------------------------------
  function chargeReel(w, state, stats, n, ev) {
    if (w.reel) return;  // charge waits while a spin is on screen
    state.reelCharge += n;
    if (state.reelCharge >= stats.reelNeed) {
      state.reelCharge = 0;
      startReel(w, state, ev);
    }
  }

  function reelResult(symbols) {
    const [a, b, c] = symbols;
    if (a === b && b === c) {
      if (a === 'singu') return 'singu3';
      if (a === 'comet') return 'comet3';
      if (a === 'crystal') return 'crystal3';
      return 'triple';
    }
    const pairSym = a === b ? a : b === c ? b : a === c ? a : null;
    if (pairSym) return pairSym === 'singu' || pairSym === 'comet' || pairSym === 'crystal' ? 'pairRare' : 'pair';
    return 'none';
  }

  function startReel(w, state, ev) {
    const syms = [0, 1, 2].map(function () { return weighted(w.rng, CONFIG.reel.symbols).id; });
    w.reel = { symbols: syms, t: 0, result: reelResult(syms), paid: false };
    state.stats.spins++;
    if (ev) ev.push({ t: 'reelStart', symbols: syms, result: w.reel.result });
  }

  function payReel(w, state, stats, ev) {
    const r = w.reel;
    r.paid = true;
    const P = CONFIG.reel.prizes[r.result];
    const matter = earn(state, stats.refIncome * P.secs * (w.surge > 0 ? CONFIG.comet.surgeMult : 1));
    const tickets = P.tickets > 0 ? P.tickets + stats.bonusTickets : 0;
    giveTickets(state, tickets, 'reel', null);
    if (P.surge) w.surge = Math.max(w.surge, 0) + stats.surgeDur;
    if (r.result === 'singu3') { state.stats.jackpots++; discover(state, 'jackpot', ev); }
    if (ev) ev.push({ t: 'reel', result: r.result, name: P.name, matter: matter, tickets: tickets, surge: !!P.surge, symbols: r.symbols });
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

    if (w.ticketCd > 0) w.ticketCd -= dt;
    if (w.overchargeCd > 0) w.overchargeCd -= dt;
    if (w.overcharge) { w.overcharge.t -= dt; if (w.overcharge.t <= 0) { w.overcharge = null; if (ev) ev.push({ t: 'overchargeExpired' }); } }

    if (w.reel) {
      w.reel.t += dt;
      if (!w.reel.paid && w.reel.t >= CONFIG.reel.spin) payReel(w, state, stats, ev);
      if (w.reel.t >= CONFIG.reel.spin + 2.2) w.reel = null;
    }

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
          giveTickets(state, CONFIG.tickets.comet + stats.bonusTickets, 'comet', ev);
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
    CONFIG: CONFIG, UPG: UPG, CRIT: CRIT,
    fmt: fmt, clamp: clamp, mulberry32: mulberry32, hashString: hashString,
    createState: createState, sanitize: sanitize, serialize: serialize, parseSave: parseSave,
    sectorInfo: sectorInfo, sectorFor: sectorFor, dayKey: dayKey, mutationFor: mutationFor,
    researchFlags: researchFlags, discoveryCount: discoveryCount, singuLevelFor: singuLevelFor, singuNext: singuNext,
    critterBonus: critterBonus, critterText: critterText, pull: pull, gachaOdds: gachaOdds,
    statValue: statValue, ensureDaily: ensureDaily, questProgress: questProgress, claimQuest: claimQuest, questBonusReady: questBonusReady, claimQuestBonus: claimQuestBonus,
    loginReady: loginReady, loginReward: loginReward, claimLogin: claimLogin, playToday: playToday, chestStatus: chestStatus, claimChest: claimChest,
    freeCapsuleReady: freeCapsuleReady, claimFreeCapsule: claimFreeCapsule, goalStatus: goalStatus, claimGoal: claimGoal, claimables: claimables, grantReward: grantReward,
    upgradeCost: upgradeCost, bulkQuote: bulkQuote, buy: buy, derive: derive, chainMult: chainMult, earn: earn,
    stardustFor: stardustFor, canCollapse: canCollapse, doCollapse: doCollapse, awayGain: awayGain,
    checkProgress: checkProgress, discover: discover, mark: mark,
    createWorld: createWorld, pulse: pulse, canPulse: canPulse, step: step, overcharge: overcharge, reelResult: reelResult,
    fragPos: fragPos, coreRadius: coreRadius, coreStage: coreStage,
    ORBIT: ORBIT, FALL: FALL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PS = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
