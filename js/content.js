/* Pocket Singularity — content tables: harvesters, the upgrade catalog, forms, achievements,
 * relics and pets. Pure data plus a few generators that expand compact tables into long lists.
 * Loaded before core.js in the browser; required by core.js in Node.
 */
(function (root) {
  'use strict';

  function roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Harvesters: buildings that produce Matter every second. Classic idle curve.
  // ---------------------------------------------------------------------------
  const GENERATORS = [
    { id: 'sweeper', name: 'Stardust Sweeper', cost: 15,     rate: 0.1,    desc: 'Brushes loose dust into Singu' },
    { id: 'net',     name: 'Comet Net',        cost: 100,    rate: 1,      desc: 'Snags passing ice' },
    { id: 'drone',   name: 'Orbital Drone',    cost: 1.1e3,  rate: 8,      desc: 'Tireless little collectors' },
    { id: 'miner',   name: 'Moon Miner',       cost: 1.2e4,  rate: 47,     desc: 'Digs moons into crumbs' },
    { id: 'hauler',  name: 'Asteroid Hauler',  cost: 1.3e5,  rate: 260,    desc: 'Tows whole rocks home' },
    { id: 'sail',    name: 'Solar Sail',       cost: 1.4e6,  rate: 1.4e3,  desc: 'Rides starlight, scoops it too' },
    { id: 'ion',     name: 'Ion Harvester',    cost: 2e7,    rate: 7.8e3,  desc: 'Strips charged clouds' },
    { id: 'siphon',  name: 'Nebula Siphon',    cost: 3.3e8,  rate: 4.4e4,  desc: 'Drinks whole nebulae' },
    { id: 'pump',    name: 'Quasar Pump',      cost: 5.1e9,  rate: 2.6e5,  desc: 'Pumps a quasar dry' },
    { id: 'forge',   name: 'Pulsar Forge',     cost: 7.5e10, rate: 1.6e6,  desc: 'Hammers pulsars into matter' },
    { id: 'gate',    name: 'Wormhole Gate',    cost: 1e12,   rate: 1e7,    desc: 'Imports matter from elsewhere' },
    { id: 'dyson',   name: 'Dyson Swarm',      cost: 1.4e13, rate: 6.5e7,  desc: 'Wraps stars, keeps the crumbs' },
    { id: 'engine',  name: 'Galaxy Engine',    cost: 1.7e14, rate: 4.3e8,  desc: 'Spins galaxies like turbines' },
    { id: 'loom',    name: 'Cosmic Loom',      cost: 2.1e15, rate: 2.9e9,  desc: 'Weaves cosmic strings into mass' },
    { id: 'bang',    name: 'Big Bang Reactor', cost: 2.6e16, rate: 2.1e10, desc: 'A tiny universe, on tap' }
  ];
  // Higher tiers get progressively pricier so the ladder stretches over a long first run.
  GENERATORS.forEach(function (g, i) { g.cost *= Math.pow(2, i); });
  const GEN_GROWTH = 1.15;
  const GEN_MILESTONES = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

  // ---------------------------------------------------------------------------
  // Forms: Singu evolves as lifetime Matter grows. Each form multiplies everything.
  // ---------------------------------------------------------------------------
  const FORMS = [
    { name: 'Speck',            at: 0 },
    { name: 'Pebble Eater',     at: 1e3 },
    { name: 'Moon Muncher',     at: 1e5 },
    { name: 'Planet Gobbler',   at: 1e7 },
    { name: 'Star Swallower',   at: 1e9 },
    { name: 'Nebula Devourer',  at: 1e12 },
    { name: 'Galaxy Gulper',    at: 1e15 },
    { name: 'Cluster Crusher',  at: 1e18 },
    { name: 'Void Monarch',     at: 1e22 },
    { name: 'Reality Render',   at: 1e26 },
    { name: 'Universe Eater',   at: 1e31 },
    { name: 'Omniverse Maw',    at: 1e37 }
  ];
  const FORM_MULT = 1.15;

  // ---------------------------------------------------------------------------
  // One-time upgrades: a long catalog generated from a few rules.
  // Effects: { gen: id, x } multiplies one harvester; { tap: x, tapCps: f } boosts pulses;
  // { global: x }; { ice|crystal: x }; { blast|comet|luck|tickets|combo|reel: add }; { petSyn }; { achSyn }.
  // ---------------------------------------------------------------------------
  const GEN_UP_AT = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400];
  const GEN_UP_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e16];
  const UP_NAMES = ['Tuned', 'Polished', 'Overclocked', 'Gilded', 'Quantum', 'Stellar', 'Hyper', 'Eternal', 'Mythic', 'Godly'];

  function buildUpgrades() {
    const list = [];
    GENERATORS.forEach(function (g, gi) {
      GEN_UP_AT.forEach(function (need, t) {
        list.push({ id: 'g_' + g.id + '_' + t, name: UP_NAMES[t] + ' ' + g.name + 's', desc: g.name + ' output ×2', cost: g.cost * GEN_UP_COST[t], need: { stat: 'gen:' + g.id, n: need }, fx: { gen: g.id, x: 2 }, icon: 'gen' + gi, tier: t });
      });
    });
    const gloveNeed = [10, 50, 150, 400, 1000, 2000, 4000, 7000, 12000, 20000, 30000, 45000, 65000, 90000, 125000];
    gloveNeed.forEach(function (n, t) {
      list.push({ id: 'glove_' + t, name: 'Gravity Gloves ' + roman(t + 1), desc: 'Pulse value ×2 and +1% of /sec per pulse', cost: 100 * Math.pow(7, t), need: { stat: 'pulses', n: n }, fx: { tap: 2, tapCps: 0.01 }, icon: 'glove', tier: t });
    });
    for (let t = 0; t < 30; t++) {
      list.push({ id: 'cat_' + t, name: 'Cosmic Catalyst ' + roman(t + 1), desc: 'All Matter ×1.25', cost: 2e4 * Math.pow(70, t), need: { stat: 'lifetime', n: 2e4 * Math.pow(60, t) }, fx: { global: 1.25 }, icon: 'catalyst', tier: t });
    }
    const lines = [
      { key: 'ice',     name: 'Ice Polish',    desc: 'Ice fragments ×2',            fx: { ice: 2 },        n: 5,  base: 300,  icon: 'ice' },
      { key: 'crystal', name: 'Crystal Cut',   desc: 'Star crystals ×2',            fx: { crystal: 2 },    n: 5,  base: 2e3,  icon: 'crystal' },
      { key: 'blast',   name: 'Shard Fuse',    desc: 'Shard blasts 20% bigger',     fx: { blast: 0.2 },    n: 5,  base: 5e3,  icon: 'shard' },
      { key: 'comet',   name: 'Comet Bait',    desc: 'Comets 15% more often',       fx: { comet: 0.15 },   n: 5,  base: 8e3,  icon: 'comet' },
      { key: 'luck',    name: 'Lucky Clover',  desc: '+1% Lucky Pulse chance',      fx: { luck: 0.01 },    n: 5,  base: 1.5e4, icon: 'clover' },
      { key: 'tickets', name: 'Ticket Press',  desc: 'Chains drop tickets 20% more', fx: { tickets: 0.2 },  n: 5,  base: 1e4,  icon: 'ticket' },
      { key: 'combo',   name: 'Combo Coil',    desc: 'Max combo +10%',              fx: { combo: 0.1 },    n: 10, base: 500,  icon: 'combo' },
      { key: 'reel',    name: 'Reel Grease',   desc: 'Star Reel fills 8% faster',   fx: { reel: 0.08 },    n: 5,  base: 4e3,  icon: 'reel' },
      { key: 'pet',     name: 'Pet Treats',    desc: '+1% all Matter per pet owned', fx: { petSyn: 0.01 }, n: 10, base: 2.5e4, icon: 'treat' },
      { key: 'ach',     name: 'Trophy Polish', desc: 'Achievement bonus +25%',      fx: { achSyn: 0.25 },  n: 10, base: 5e4,  icon: 'trophy' }
    ];
    lines.forEach(function (l) {
      for (let t = 0; t < l.n; t++) {
        list.push({ id: l.key + '_' + t, name: l.name + ' ' + roman(t + 1), desc: l.desc, cost: l.base * Math.pow(60, t), need: { stat: 'lifetime', n: l.base * Math.pow(40, t) * 0.5 }, fx: l.fx, icon: l.icon, tier: t });
      }
    });
    return list;
  }

  // ---------------------------------------------------------------------------
  // Achievements: unlock automatically (+1.5% Matter each), then claim for tickets and a shard.
  // ---------------------------------------------------------------------------
  function fmtShort(n) {
    const s = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];
    if (n < 1000) return String(n);
    const t = Math.floor(Math.log10(n) / 3);
    return t < s.length ? Math.round(n / Math.pow(1000, t)) + s[t] : n.toExponential(0);
  }
  function buildAchievements() {
    const list = [];
    const add = function (id, name, desc, stat, n, cat) { list.push({ id: id, name: name, desc: desc, stat: stat, n: n, cat: cat }); };
    const matterNames = ['Nibble', 'Snack', 'Meal', 'Feast', 'Banquet', 'Gorge', 'Glutton', 'Bottomless', 'Black Belly', 'Hungry Void', 'World Eater', 'Star Glutton', 'Galactic Appetite', 'Cluster Muncher', 'Supercluster Snack', 'Filament Feast', 'Horizon Hunger', 'Planck Pantry', 'Infinite Buffet', 'The Last Crumb'];
    const matterAt = [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e12, 1e14, 1e16, 1e18, 1e20, 1e23, 1e26, 1e30, 1e34, 1e40, 1e46];
    matterAt.forEach(function (n, i) { add('m_' + i, matterNames[i], 'Eat ' + fmtShort(n) + ' Matter in total', 'lifetime', n, 'Matter'); });
    const genTiers = [1, 25, 50, 100, 200];
    const genWords = ['First', 'Crew of', 'Fleet of', 'Armada of', 'Legion of'];
    GENERATORS.forEach(function (g) {
      genTiers.forEach(function (n, i) { add('g_' + g.id + '_' + n, genWords[i] + ' ' + g.name + (n > 1 ? 's' : ''), 'Own ' + n + ' ' + g.name + (n > 1 ? 's' : ''), 'gen:' + g.id, n, 'Harvesters'); });
    });
    [[100, 'Tapper'], [1000, 'Pulse Pro'], [10000, 'Pulse Machine'], [50000, 'Gravity Drummer'], [200000, 'Event Horizon Hands']].forEach(function (x, i) { add('p_' + i, x[1], 'Pulse ' + fmtShort(x[0]) + ' times', 'pulses', x[0], 'Pulses'); });
    [[5, 'Chain Starter'], [12, 'Cascade'], [25, 'Avalanche'], [40, 'Gravity Storm']].forEach(function (x, i) { add('c_' + i, x[1], 'Catch ' + x[0] + ' fragments in one pulse', 'bestChain', x[0], 'Pulses'); });
    [[1, 'In the Zone'], [10, 'On Fire'], [100, 'Unstoppable']].forEach(function (x, i) { add('cb_' + i, x[1], 'Reach a full combo ' + x[0] + ' time' + (x[0] > 1 ? 's' : ''), 'comboMaxed', x[0], 'Pulses'); });
    [10, 25, 50, 100, 150, 200, 250].forEach(function (n, i) { add('u_' + i, ['Tinkerer', 'Engineer', 'Inventor', 'Architect', 'Visionary', 'Mad Scientist', 'Completionist'][i], 'Buy ' + n + ' upgrades', 'upgrades', n, 'Upgrades'); });
    [3, 10, 20, 30, 40, 48].forEach(function (n, i) { add('pet_' + i, ['Pet Sitter', 'Petting Zoo', 'Menagerie', 'Space Ark', 'Cosmic Kennel', 'Gotta Hatch Them All'][i], 'Own ' + n + ' different pets', 'pets', n, 'Pets'); });
    [10, 50, 200, 1000].forEach(function (n, i) { add('h_' + i, ['Capsule Curious', 'Capsule Fan', 'Capsule Addict', 'Capsule Legend'][i], 'Hatch ' + n + ' capsules', 'hatches', n, 'Pets'); });
    [1, 10, 50, 200].forEach(function (n, i) { add('r_' + i, ['Relic Hunter', 'Forge Regular', 'Forgemaster', 'Relic Tycoon'][i], 'Forge ' + n + ' relic' + (n > 1 ? 's' : ''), 'relicsMade', n, 'Relics'); });
    add('r_myth', 'Touched by Myth', 'Own a Mythic relic', 'mythicRelic', 1, 'Relics');
    [1, 10, 50, 150].forEach(function (n, i) { add('cr_' + i, ['Unboxer', 'Crate Cracker', 'Key Master', 'Vault Raider'][i], 'Open ' + n + ' skin crate' + (n > 1 ? 's' : ''), 'crates', n, 'Skins'); });
    [3, 8, 13, 18].forEach(function (n, i) { add('sk_' + i, ['New Look', 'Fashionista', 'Trendsetter', 'Every Shade of Void'][i], 'Own ' + n + ' skins', 'skins', n, 'Skins'); });
    add('r_push', 'Push It', 'Push a relic up 3 times in a row', 'bestPush', 3, 'Relics');
    for (let i = 1; i < FORMS.length; i++) add('f_' + i, FORMS[i].name, 'Evolve Singu into a ' + FORMS[i].name, 'form', i, 'Forms');
    [2, 3, 4, 5, 7, 10, 15].forEach(function (n, i) { add('s_' + i, 'Explorer ' + roman(i + 1), 'Reach sector ' + n, 'maxSector', n, 'Space'); });
    [1, 5, 25].forEach(function (n, i) { add('col_' + i, ['First Fold', 'Origami Universe', 'Big Crunch Regular'][i], 'Collapse ' + n + ' time' + (n > 1 ? 's' : ''), 'collapses', n, 'Space'); });
    [1, 25, 100].forEach(function (n, i) { add('com_' + i, ['Comet Catcher', 'Comet Chaser', 'Comet Collector'][i], 'Catch ' + n + ' comet' + (n > 1 ? 's' : ''), 'comets', n, 'Space'); });
    [10, 100, 1000].forEach(function (n, i) { add('l_' + i, ['Four-Leaf', 'Lucky Streak', 'Fortune\'s Pet'][i], 'Land ' + n + ' Lucky Pulses', 'lucky', n, 'Luck'); });
    [10, 100].forEach(function (n, i) { add('sp_' + i, ['Spinner', 'Reel Regular'][i], 'Spin the Star Reel ' + n + ' times', 'spins', n, 'Luck'); });
    add('jack', 'JACKPOT!', 'Line up three Singus on the Star Reel', 'jackpots', 1, 'Luck');
    [10, 25, 50].forEach(function (n, i) { add('lv_' + i, 'Growing Up ' + roman(i + 1), 'Reach Singu level ' + n, 'singuLevel', n, 'Space'); });
    // Trophy tier by difficulty within its series: 0 bronze, 1 silver, 2 gold, 3 spectral.
    const series = {};
    list.forEach(function (a) { (series[a.stat] = series[a.stat] || []).push(a); });
    Object.keys(series).forEach(function (k) {
      const xs = series[k].sort(function (a, b) { return a.n - b.n; });
      xs.forEach(function (a, i) {
        if (xs.length === 1) a.tier = 2;
        else if (xs.length <= 3) a.tier = i;
        else { const f = i / (xs.length - 1); a.tier = f < 0.3 ? 0 : f < 0.6 ? 1 : f < 0.9 ? 2 : 3; }
      });
    });
    ['r_myth', 'jack'].forEach(function (id) { list.forEach(function (a) { if (a.id === id) a.tier = 3; }); });
    return list;
  }

  // ---------------------------------------------------------------------------
  // Relics: forged from shards, with rarity and random stats. Odds always shown.
  // ---------------------------------------------------------------------------
  const RELICS = {
    cost: 10,
    rarities: [
      { name: 'Common',    w: 55,  affixes: 1, scale: 1,   salvage: 2 },
      { name: 'Rare',      w: 28,  affixes: 2, scale: 1.6, salvage: 4 },
      { name: 'Epic',      w: 12.5, affixes: 2, scale: 2.6, salvage: 8 },
      { name: 'Legendary', w: 4,   affixes: 3, scale: 4.2, salvage: 16 },
      { name: 'Mythic',    w: 0.5, affixes: 4, scale: 7,   salvage: 40 }
    ],
    push: [0.55, 0.4, 0.25, 0.12],   // chance to climb one rarity when you Push; a failed push shatters the relic
    shatterRefund: 3,
    fuseNeed: 3,
    invCap: 40,
    stats: [
      { k: 'global',  name: 'All Matter',      min: 0.05, max: 0.10, noun: 'Orb' },
      { k: 'pulse',   name: 'Pulse value',     min: 0.10, max: 0.20, noun: 'Gauntlet' },
      { k: 'gen',     name: 'Harvesters',      min: 0.08, max: 0.15, noun: 'Cog' },
      { k: 'combo',   name: 'Max combo',       min: 0.08, max: 0.15, noun: 'Metronome' },
      { k: 'luck',    name: 'Lucky chance',    min: 0.01, max: 0.02, noun: 'Clover', abs: true },
      { k: 'luckPow', name: 'Lucky power',     min: 0.2,  max: 0.4,  noun: 'Die', abs: true },
      { k: 'tickets', name: 'Ticket drops',    min: 0.10, max: 0.20, noun: 'Stub' },
      { k: 'shards',  name: 'Shard find',      min: 0.08, max: 0.15, noun: 'Prism' },
      { k: 'comet',   name: 'Comet rate',      min: 0.08, max: 0.15, noun: 'Compass' },
      { k: 'offline', name: 'Away income',     min: 0.03, max: 0.06, noun: 'Hourglass' },
      { k: 'crystal', name: 'Crystal value',   min: 0.20, max: 0.40, noun: 'Gem' }
    ],
    prefixes: ['Dusty', 'Polished', 'Radiant', 'Ancient', 'Mythic']
  };

  // ---------------------------------------------------------------------------
  // Pets (hatched from capsules). 25 species in 48 colourways across 5 rarities.
  // ---------------------------------------------------------------------------
  const PETS = [
    // id, name, rarity, species, colour, bonus
    ['mouse_mote', 'Mote Mouse', 0, 'mouse', '#9fb4cc', { matter: 0.08 }],
    ['pup_pebble', 'Pebble Pup', 0, 'pup', '#e9a06b', { gen: 0.10 }],
    ['bun_dusty', 'Dusty Bun', 0, 'bun', '#c9b3ff', { chain: 0.05 }],
    ['snail_glow', 'Glow Snail', 0, 'snail', '#a7f070', { offline: 0.05 }],
    ['chick_puff', 'Puff Chick', 0, 'chick', '#ffd96b', { pulse: 0.15 }],
    ['duck_ripple', 'Ripple Duck', 0, 'duck', '#eef2f7', { reel: 0.08 }],
    ['slime_goo', 'Goo Slime', 0, 'slime', '#73eff7', { combo: 0.08 }],
    ['bee_buzz', 'Buzz Bee', 0, 'bee', '#ffcd4d', { gen: 0.10 }],
    ['frog_pond', 'Pond Frog', 0, 'frog', '#6dcf5f', { luck: 0.01 }],
    ['turtle_moss', 'Moss Turtle', 0, 'turtle', '#5fae6e', { offline: 0.06 }],
    ['hamster_nib', 'Nibble Hamster', 0, 'hamster', '#e8b07a', { pulse: 0.15 }],
    ['bat_dusk', 'Dusk Bat', 0, 'bat', '#7a68a6', { comet: 0.08 }],
    ['bear_cub', 'Cocoa Cub', 0, 'bear', '#a87650', { matter: 0.08 }],
    ['crab_pebble', 'Pebble Crab', 0, 'crab', '#ee7a5e', { blast: 0.10 }],
    ['penguin_snow', 'Snow Penguin', 0, 'penguin', '#5b6f8c', { ice: 0.20 }],
    ['axo_bubble', 'Bubble Axolotl', 0, 'axolotl', '#ffa8c5', { shards: 0.08 }],
    ['cat_comet', 'Comet Cat', 1, 'cat', '#4fa8f6', { comet: 0.15 }],
    ['penguin_ice', 'Ice Penguin', 1, 'penguin', '#2f3d7a', { ice: 0.40 }],
    ['frog_lucky', 'Lucky Frog', 1, 'frog', '#38b764', { luck: 0.02 }],
    ['owl_orbit', 'Orbit Owl', 1, 'owl', '#ef8a57', { reel: 0.15 }],
    ['fox_frost', 'Frost Fox', 1, 'fox', '#bfe6ff', { combo: 0.15 }],
    ['bun_moon', 'Moon Bun', 1, 'bun', '#e3e8ff', { matter: 0.18 }],
    ['pup_rocket', 'Rocket Pup', 1, 'pup', '#c8485e', { pulse: 0.35 }],
    ['mouse_lunar', 'Lunar Mouse', 1, 'mouse', '#cbd6ff', { gen: 0.20 }],
    ['jelly_drift', 'Drift Jelly', 1, 'jelly', '#7ff0f0', { shards: 0.15 }],
    ['bee_comet', 'Comet Bee', 1, 'bee', '#ffa64d', { gen: 0.20 }],
    ['bat_lunar', 'Lunar Bat', 1, 'bat', '#a2b4c8', { offline: 0.10 }],
    ['duck_star', 'Star Duck', 1, 'duck', '#ffd36b', { luck: 0.02 }],
    ['slime_ember', 'Ember Slime', 1, 'slime', '#f08a5d', { blast: 0.20 }],
    ['hamster_cosmo', 'Cosmo Hamster', 1, 'hamster', '#b294f6', { pulse: 0.35 }],
    ['jelly_nebula', 'Nebula Jelly', 2, 'jelly', '#ff9fc8', { matter: 0.30 }],
    ['fox_quasar', 'Quasar Fox', 2, 'fox', '#f2814f', { luckPow: 0.5 }],
    ['crab_shard', 'Shard Crab', 2, 'crab', '#c43d5c', { blast: 0.30 }],
    ['octo_void', 'Void Octopus', 2, 'octopus', '#7a3a8a', { gen: 0.40 }],
    ['owl_nova', 'Nova Owl', 2, 'owl', '#ffd166', { combo: 0.30 }],
    ['turtle_galaxy', 'Galaxy Turtle', 2, 'turtle', '#4769d6', { offline: 0.15 }],
    ['cat_ember', 'Ember Cat', 2, 'cat', '#f07a4d', { pulse: 0.60 }],
    ['axo_prism', 'Prism Axolotl', 2, 'axolotl', '#b08cff', { shards: 0.25 }],
    ['bear_polar', 'Polar Bear', 2, 'bear', '#f2f6fb', { gen: 0.40 }],
    ['snail_crystal', 'Crystal Snail', 2, 'snail', '#7af0ea', { tickets: 1 }],
    ['dragon_sun', 'Sun Dragon', 3, 'dragon', '#ffc94d', { mult: 0.5 }],
    ['whale_cosmo', 'Cosmo Whale', 3, 'whale', '#4769d6', { gen: 1, tickets: 1 }],
    ['unicorn_star', 'Star Unicorn', 3, 'unicorn', '#f6f2ff', { luck: 0.03, luckPow: 0.5 }],
    ['octo_kraken', 'Star Kraken', 3, 'octopus', '#d04a64', { combo: 0.5 }],
    ['panda_zen', 'Zen Panda', 3, 'panda', '#f4f4f4', { mult: 0.4 }],
    ['dragon_frost', 'Frost Dragon', 3, 'dragon', '#7fe8f5', { mult: 0.4 }],
    ['whale_prism', 'Prism Leviathan', 4, 'whale', '#b38cff', { mult: 1 }],
    ['unicorn_void', 'Void Unicorn', 4, 'unicorn', '#3a3f7a', { mult: 1 }]
  ].map(function (p) { return { id: p[0], name: p[1], rarity: p[2], species: p[3], color: p[4], bonus: p[5] }; });

  // ---------------------------------------------------------------------------
  // Skins for the black hole, from crates opened with Cosmic Keys (earned only by playing).
  // Each crate has its own skins and its own rarity table; odds and pity are always shown.
  // A skin has colours for the halo, rim, swirl arms (outer → inner) and accretion disk,
  // an optional particle effect, and a buff that applies while it is equipped.
  // ---------------------------------------------------------------------------
  const CRATES = [
    { id: 'stardust', name: 'Stardust Crate', cost: 1, color: '#c98a4a', desc: 'Cosy everyday looks',
      weights: [64, 27, 7.5, 1.5, 0], pity: { rarity: 3, within: 30 } },
    { id: 'nebula', name: 'Nebula Crate', cost: 4, color: '#8a5ad6', desc: 'Colourful cosmic weather',
      weights: [0, 60, 30.5, 8, 1.5], pity: { rarity: 4, within: 45 } },
    { id: 'horizon', name: 'Event Horizon Crate', cost: 10, color: '#1f2a4a', desc: 'Only the rarest singularities',
      weights: [0, 0, 67, 27.5, 5.5], pity: { rarity: 4, within: 20 } }
  ];
  const SKINS = [
    // id, name, crate, rarity, { halo, rim, arms[3], disk[4], fx }, buff
    ['classic', 'Classic', null, 0, { halo: '#3b5dc9', rim: '#41a6f6', arms: ['#a884f3', '#5d275d', '#29366f'], disk: ['#ffcd75', '#ef7d57', '#b13e53', '#ef7d57'], core: ['#07070f', '#07070f'] }, {}],
    // Stardust Crate
    ['dusty', 'Dusty', 'stardust', 0, { halo: '#566c86', rim: '#c2c3c7', arms: ['#94b0c2', '#566c86', '#333c57'], disk: ['#e4d4b0', '#c2a37a', '#8a6a4a', '#c2a37a'], core: ['#2c2c3a', '#07070f'], inner: 'pulse' }, { pulse: 0.05 }],
    ['mint', 'Mint Swirl', 'stardust', 0, { halo: '#257179', rim: '#a7f070', arms: ['#73eff7', '#38b764', '#257179'], disk: ['#d6ffb8', '#a7f070', '#38b764', '#a7f070'], core: ['#16503f', '#04100c'], arms4: true, inner: 'rings' }, { gen: 0.05 }],
    ['peach', 'Peach Fizz', 'stardust', 0, { halo: '#b13e53', rim: '#ffa8c5', arms: ['#ffcd75', '#ef7d57', '#b13e53'], disk: ['#fff0c8', '#ffcd75', '#ef7d57', '#ffcd75'], core: ['#4a1a28', '#0b0408'], inner: 'pulse' }, { combo: 0.05 }],
    ['frostbite', 'Frostbite', 'stardust', 1, { halo: '#41a6f6', rim: '#dff6ff', arms: ['#ffffff', '#73eff7', '#41a6f6'], disk: ['#ffffff', '#c9e4ff', '#73eff7', '#c9e4ff'], fx: 'snow', core: ['#bfe8ff', '#0a1530'], inner: 'stars', rimW: 2 }, { gen: 0.12 }],
    ['ember', 'Ember', 'stardust', 1, { halo: '#b13e53', rim: '#ff9a3d', arms: ['#ffcd75', '#ef7d57', '#b13e53'], disk: ['#fff3b0', '#ffcd75', '#ff7a3d', '#d04040'], fx: 'flame', core: ['#ff7a3d', '#2a0808'], inner: 'lava' }, { pulse: 0.12 }],
    ['candy', 'Candy Nebula', 'stardust', 2, { halo: '#ff6fd0', rim: '#ffb3f0', arms: ['#73eff7', '#ff8fd8', '#a884f3'], disk: ['#ffffff', '#ffb3f0', '#73eff7', '#ffb3f0'], fx: 'hearts', core: ['#ff8fd8', '#2a0f3a'], inner: 'rings', arms4: true }, { global: 0.12 }],
    ['golden', 'Golden Hour', 'stardust', 3, { halo: '#ffc23d', rim: '#fff0b0', arms: ['#fff0b0', '#ffc23d', '#b0702a'], disk: ['#ffffff', '#fff0b0', '#ffc23d', '#fff0b0'], fx: 'sparkle', core: ['#ffe9a0', '#3a2808'], inner: 'stars', spin: 1.4, rimW: 2 }, { global: 0.2, combo: 0.1 }],
    // Nebula Crate
    ['bubblegum', 'Bubblegum', 'nebula', 1, { halo: '#ff6fd0', rim: '#ffa8c5', arms: ['#ffd4e3', '#ff8fb1', '#b13e53'], disk: ['#ffffff', '#ffd4e3', '#ff8fb1', '#ffd4e3'], fx: 'bubbles', core: ['#ffb3d0', '#3a0f25'], inner: 'rings' }, { combo: 0.15 }],
    ['aurora', 'Aurora', 'nebula', 1, { halo: '#38b764', rim: '#73eff7', arms: ['#a7f070', '#73eff7', '#3b5dc9'], disk: ['#d6ffb8', '#a7f070', '#73eff7', '#a884f3'], core: ['#38b764', '#05101e'], inner: 'lava', arms4: true }, { comet: 0.15 }],
    ['supernova', 'Supernova', 'nebula', 2, { halo: '#ff7a3d', rim: '#ffffff', arms: ['#ffffff', '#fff0b0', '#ff7a3d'], disk: ['#ffffff', '#fff3b0', '#ffcd75', '#ff7a3d'], fx: 'flame', core: ['#ffffff', '#ff7a3d'], inner: 'pulse', spin: 2, rimW: 2 }, { pulse: 0.25, crystal: 0.2 }],
    ['deepsea', 'Deep Sea', 'nebula', 2, { halo: '#29366f', rim: '#41a6f6', arms: ['#73eff7', '#3b5dc9', '#29366f'], disk: ['#73eff7', '#41a6f6', '#3b5dc9', '#41a6f6'], fx: 'bubbles', core: ['#2a5aa8', '#030818'], inner: 'rings' }, { gen: 0.25, offline: 0.1 }],
    ['prism', 'Prism', 'nebula', 3, { halo: '#a884f3', rim: '#ffffff', arms: ['#ff8fd8', '#73eff7', '#ffcd75'], disk: ['#ff6b6b', '#ffcd75', '#a7f070', '#73eff7'], fx: 'rainbow', core: 'rainbow', arms4: true, spin: 1.3 }, { global: 0.35 }],
    ['starforge', 'Starforge', 'nebula', 4, { halo: '#b48cff', rim: '#ffd36b', arms: ['#fff0b0', '#ffc23d', '#8a5ad6'], disk: ['#ffffff', '#ffd36b', '#b48cff', '#ffd36b'], fx: 'stars', core: ['#4a2a88', '#07070f'], inner: 'stars', arms4: true, rimW: 2 }, { global: 0.6, luck: 0.02 }],
    // Event Horizon Crate
    ['voidwalker', 'Void Walker', 'horizon', 2, { halo: '#3a1a5a', rim: '#a884f3', arms: ['#5d275d', '#3a1a5a', '#1a0f2a'], disk: ['#a884f3', '#5d275d', '#3a1a5a', '#5d275d'], fx: 'void', core: ['#000000', '#5d275d'], inner: 'vortex', spin: 2.4 }, { gen: 0.35 }],
    ['solarflare', 'Solar Flare', 'horizon', 2, { halo: '#ff7a3d', rim: '#fff3b0', arms: ['#ffcd75', '#ff7a3d', '#b13e53'], disk: ['#ffffff', '#ffcd75', '#ff7a3d', '#b13e53'], fx: 'flame', core: ['#fff3b0', '#b13e53'], inner: 'lava', spin: 1.6, rimW: 2 }, { pulse: 0.35, combo: 0.1 }],
    ['quasar', 'Quasar', 'horizon', 3, { halo: '#73eff7', rim: '#ffffff', arms: ['#ffffff', '#73eff7', '#3b5dc9'], disk: ['#ffffff', '#c9f7ff', '#73eff7', '#41a6f6'], fx: 'sparkle', core: ['#ffffff', '#1a3a6a'], inner: 'rings', spin: 1.5, rimW: 2 }, { global: 0.45, shards: 0.15 }],
    ['glitch', 'Glitch', 'horizon', 3, { halo: '#38b764', rim: '#ff6fd0', arms: ['#a7f070', '#ff6fd0', '#29366f'], disk: ['#a7f070', '#ff6fd0', '#73eff7', '#ff6fd0'], fx: 'glitch', core: ['#0a2a14', '#2a0a2a'], inner: 'glitch' }, { global: 0.45, luck: 0.03 }],
    ['prime', 'Singularity Prime', 'horizon', 4, { halo: '#ffffff', rim: '#ffffff', arms: ['#ffffff', '#c9d4e6', '#566c86'], disk: ['#ffffff', '#ff8fd8', '#73eff7', '#ffd36b'], fx: 'rainbow', core: 'rainbow', inner: 'stars', arms4: true, spin: 1.8, rimW: 2 }, { global: 1, combo: 0.25 }]
  ].map(function (x) { return { id: x[0], name: x[1], crate: x[2], rarity: x[3], look: x[4], buff: x[5] }; });

  // Old pet ids from version 2 saves.
  const PET_MIGRATE = { mouse: 'mouse_mote', pup: 'pup_pebble', bun: 'bun_dusty', snail: 'snail_glow', cat: 'cat_comet', penguin: 'penguin_ice', frog: 'frog_lucky', owl: 'owl_orbit', jelly: 'jelly_nebula', fox: 'fox_quasar', crab: 'crab_shard', dragon: 'dragon_sun', whale: 'whale_cosmo' };

  const BONUS_TEXT = {
    matter: '+{v}% Matter', gen: '+{v}% harvester income', pulse: '+{v}% pulse value', combo: '+{v}% max combo',
    chain: '+{v}% chain bonus', offline: '+{v}% away income', comet: 'Comets {v}% more often', ice: 'Ice worth +{v}%',
    luck: '+{v}% Lucky chance', luckPow: 'Lucky Pulses +{x}× stronger', reel: 'Star Reel {v}% faster', blast: 'Shard blasts {v}% bigger',
    mult: 'All Matter ×{m}', tickets: '+{n} ticket per comet & reel', shards: '+{v}% relic shards'
  };

  const API = {
    roman: roman, GENERATORS: GENERATORS, GEN_GROWTH: GEN_GROWTH, GEN_MILESTONES: GEN_MILESTONES,
    FORMS: FORMS, FORM_MULT: FORM_MULT, CRATES: CRATES, SKINS: SKINS, UPGRADES: buildUpgrades(), ACHIEVEMENTS: buildAchievements(),
    RELICS: RELICS, PETS: PETS, PET_MIGRATE: PET_MIGRATE, BONUS_TEXT: BONUS_TEXT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PS_CONTENT = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
