#!/usr/bin/env node
/* Pacing simulator: plays the real core rules with a scripted player and prints when
 * milestones happen. Used to tune CONFIG against the bible's experience targets.
 *
 *   node tools/sim.js [minutes] [policy] [seed]
 *   policy: spam | smart | idle      (default smart)
 */
'use strict';
const PS = require('../js/core.js');

function run(opts) {
  const minutes = opts.minutes || 40;
  const policy = opts.policy || 'smart';
  const rng = PS.mulberry32(opts.seed || 1);
  const state = opts.state || PS.createState(0);
  const mut = opts.mutation || {};
  let stats = PS.derive(state, mut);
  let world = PS.createWorld(rng, state, stats);
  const dt = 1 / 30;
  const log = [];
  const seen = {};
  let lastPulse = -99, lastShop = 0, lastCollapseCheck = 0;
  let t = 0;
  const firstBuy = {};
  function note(key, extra) {
    if (seen[key]) return;
    seen[key] = true;
    log.push({ t: t, key: key, extra: extra });
  }
  const end = minutes * 60;
  const ev = [];
  while (t < end) {
    ev.length = 0;
    PS.step(world, state, stats, dt, ev);
    t += dt;
    for (const e of ev) if (e.t === 'sector') { note('sector ' + e.index + ' ' + PS.sectorInfo(e.index).name, PS.fmt(state.runTotal)); stats = PS.derive(state, mut); }
    // Pulse policy
    let inRange = 0;
    for (const f of world.frags) if (f.state === PS.ORBIT && f.inRange && f.alpha > 0.35) inRange++;
    const cometIn = world.comet && !world.comet.caught && Math.hypot(world.comet.x, world.comet.y / 0.82) < stats.pulseRadius;
    if (policy === 'spam') {
      if (t - lastPulse > 0.45 && inRange > 0) { PS.pulse(world, state, stats, ev, false); lastPulse = t; }
    } else if (policy === 'smart') {
      if (t - lastPulse > 0.4 && (cometIn || inRange >= 6 || (inRange > 0 && t - lastPulse > 2.5))) { PS.pulse(world, state, stats, ev, false); lastPulse = t; }
    } else if (policy === 'idle') {
      if (t - lastPulse > 6 && inRange > 0) { PS.pulse(world, state, stats, ev, false); lastPulse = t; }
    }
    // Shop policy: every 2 s, buy the cheapest affordable upgrade repeatedly.
    if (t - lastShop > 2) {
      lastShop = t;
      for (let guard = 0; guard < 50; guard++) {
        let best = null, bestCost = Infinity;
        for (const u of PS.CONFIG.upgrades) {
          if (state.levels[u.id] >= u.max) continue;
          const c = PS.upgradeCost(u.id, state.levels[u.id]);
          if (c < bestCost) { bestCost = c; best = u; }
        }
        if (!best || bestCost > state.matter) break;
        PS.buy(state, best.id, 1);
        if (!firstBuy[best.id]) { firstBuy[best.id] = true; note('first ' + best.id, PS.fmt(bestCost)); }
        if (!seen['first upgrade']) note('first upgrade');
        stats = PS.derive(state, mut);
      }
    }
    if (PS.canCollapse(state)) note('collapse available', PS.stardustFor(state) + ' SD');
    if (opts.collapseAt && t - lastCollapseCheck > 5) {
      lastCollapseCheck = t;
      if (PS.canCollapse(state) && PS.stardustFor(state) >= opts.collapseAt) {
        const g = PS.doCollapse(state);
        note('COLLAPSE #' + state.collapses + ' +' + g + ' SD');
        delete seen['collapse available'];
        for (const k of Object.keys(seen)) if (k.startsWith('sector') || k.startsWith('first ')) delete seen[k];
        for (const k of Object.keys(firstBuy)) delete firstBuy[k];
        stats = PS.derive(state, mut);
        world = PS.createWorld(rng, state, stats);
      }
    }
    for (const e of ev) if (e.t === 'discover') note('discover ' + e.id);
  }
  return { state, log, stats };
}

function mmss(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }

if (require.main === module) {
  const minutes = Number(process.argv[2]) || 40;
  const policy = process.argv[3] || 'smart';
  const seed = Number(process.argv[4]) || 1;
  const collapseAt = Number(process.argv[5]) || 0;
  const r = run({ minutes, policy, seed, collapseAt });
  for (const l of r.log) if (!l.key.startsWith('discover') || process.env.VERBOSE) console.log(mmss(l.t).padStart(6), l.key, l.extra || '');
  const s = r.state;
  console.log('---');
  console.log('levels', JSON.stringify(s.levels), 'matter', PS.fmt(s.matter), 'run', PS.fmt(s.runTotal), 'SD avail', PS.stardustFor(s), 'SD', s.stardust);
  console.log('drone/s', PS.fmt(r.stats.dronePerSec), 'discoveries', PS.discoveryCount(s) + '/' + PS.CONFIG.discoveries.length, 'bestChain', s.stats.bestChain);
}

module.exports = { run };
