'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PS = require('../js/core.js');
const { run } = require('../tools/sim.js');

test('upgrade costs rise predictably with no surprise walls', () => {
  for (const u of PS.CONFIG.upgrades) {
    for (let l = 0; l < u.max - 1; l++) {
      const ratio = PS.upgradeCost(u.id, l + 1) / PS.upgradeCost(u.id, l);
      assert.ok(ratio < 2.5, `${u.id} level ${l} jumps ×${ratio}`);
    }
  }
});

test('buy spends exactly the quoted cost and respects max level', () => {
  const s = PS.createState(0);
  s.matter = 1e9;
  const q = PS.bulkQuote(s, 'radius', 10);
  const before = s.matter;
  assert.equal(PS.buy(s, 'radius', 10), 10);
  assert.equal(before - s.matter, q.cost);
  assert.equal(PS.buy(s, 'radius', 0), 2);  // max is 12
  assert.equal(s.levels.radius, 12);
  assert.equal(PS.buy(s, 'radius', 1), 0);
  assert.ok(PS.bulkQuote(s, 'radius', 1).maxed);
});

test('buy refuses when unaffordable and never goes negative', () => {
  const s = PS.createState(0);
  s.matter = 5;
  assert.equal(PS.buy(s, 'focus', 1), 0);
  assert.equal(s.matter, 5);
  s.matter = PS.upgradeCost('focus', 0) + 3;
  assert.equal(PS.buy(s, 'focus', 0), 1);
  assert.equal(s.matter, 3);
});

test('sanitize survives garbage and clamps hostile values', () => {
  for (const junk of [null, 42, 'x', [], { matter: 'lots' }, { matter: -5, levels: { radius: 999, focus: -3 } }, { matter: Infinity, lifetime: NaN }]) {
    const { state } = PS.sanitize(junk, 1000);
    assert.ok(Number.isFinite(state.matter) && state.matter >= 0);
    for (const u of PS.CONFIG.upgrades) assert.ok(state.levels[u.id] >= 0 && state.levels[u.id] <= u.max);
  }
  assert.equal(PS.parseSave('{not json', 0).broken, true);
  assert.equal(PS.parseSave('', 0), null);
  const good = PS.createState(5);
  good.matter = 10; good.lifetime = 50; good.runTotal = 50; good.levels.drones = 4;
  const back = PS.parseSave(PS.serialize(good), 0);
  assert.equal(back.ok, true);
  assert.equal(back.state.levels.drones, 4);
  assert.equal(back.state.matter, 10);
});

test('sanitize derives the sector from progress and caps matter by lifetime', () => {
  const { state } = PS.sanitize({ v: 1, matter: 1e12, runTotal: 10, lifetime: 10, sector: 4 }, 0);
  assert.equal(state.sector, 0);
  assert.equal(state.matter, 10);
});

test('collapse grants the correct Stardust exactly once and keeps permanent progress', () => {
  const s = PS.createState(0);
  s.runTotal = s.lifetime = s.matter = PS.sectorInfo(3).at * 2;
  PS.checkProgress(s, null);
  assert.ok(PS.canCollapse(s));
  const expected = PS.stardustFor(s);
  s.discoveries.f_dust = 1;
  const gain = PS.doCollapse(s);
  assert.equal(gain, expected);
  assert.equal(s.stardust, expected);
  assert.equal(s.matter, 0);
  assert.equal(s.sector, 0);
  assert.equal(s.levels.focus, 0);
  assert.ok(s.discoveries.f_dust);
  assert.equal(PS.doCollapse(s), 0, 'second collapse with nothing earned must give nothing');
  assert.equal(s.stardust, expected);
});

test('collapse is unavailable before the required sector', () => {
  const s = PS.createState(0);
  s.runTotal = s.lifetime = PS.sectorInfo(3).at - 1;
  PS.checkProgress(s, null);
  assert.equal(PS.canCollapse(s), false);
  assert.equal(PS.doCollapse(s), 0);
});

test('away income is capped at two hours, reduced, and zero for negative time', () => {
  const s = PS.createState(0);
  s.levels.drones = 10;
  const st = PS.derive(s, {});
  const two = PS.awayGain(s, st, 2 * 3600e3).gain;
  assert.equal(PS.awayGain(s, st, 50 * 3600e3).gain, two);
  assert.ok(Math.abs(two - st.dronePerSec * 7200 * PS.CONFIG.offlineRate) < 1e-6);
  assert.equal(PS.awayGain(s, st, -5000).gain, 0);
  assert.equal(PS.awayGain(s, st, NaN).gain, 0);
});

test('daily mutation is deterministic and never repeats two days running', () => {
  const a = PS.mutationFor('2026-10-23');
  assert.equal(a.id, PS.mutationFor('2026-10-23').id);
  let prev = null;
  for (let d = 1; d <= 120; d++) {
    const date = new Date(2026, 0, d);
    const m = PS.mutationFor(PS.dayKey(date));
    if (prev) assert.notEqual(m.id, prev, PS.dayKey(date));
    prev = m.id;
  }
});

test('sectors are ordered and generated sectors keep growing', () => {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const s = PS.sectorInfo(i);
    assert.ok(s.at > last, `sector ${i}`);
    assert.ok(s.name && s.value > 0);
    last = s.at;
  }
});

test('first pulse on a fresh world always catches something', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = PS.createState(0);
    const st = PS.derive(s, {});
    const w = PS.createWorld(PS.mulberry32(seed), s, st);
    const ev = [];
    PS.pulse(w, s, st, ev, false);
    assert.ok(ev[0].count >= 1, `seed ${seed} caught nothing`);
  }
});

test('pulse cooldown blocks spam but buffers a late click', () => {
  const s = PS.createState(0);
  const st = PS.derive(s, {});
  const w = PS.createWorld(PS.mulberry32(3), s, st);
  const ev = [];
  assert.equal(PS.pulse(w, s, st, ev, false), true);
  assert.equal(PS.pulse(w, s, st, ev, false), false);
  assert.equal(w.queued, false, 'early click is not queued');
  PS.step(w, s, st, PS.CONFIG.pulseCooldown - 0.1, ev);
  PS.pulse(w, s, st, ev, false);
  assert.equal(w.queued, true, 'late click is queued');
  PS.step(w, s, st, 0.2, ev);
  assert.equal(s.stats.pulses, 2);
});

test('chain payout equals base × value × chain multiplier', () => {
  const s = PS.createState(0);
  const st = PS.derive(s, {});
  const w = PS.createWorld(PS.mulberry32(9), s, st);
  w.frags.length = 0;
  w.cometTimer = 1e9;
  for (let i = 0; i < 6; i++) w.frags.push({ type: 'dust', r: 0.3, a: i, size: 1, spin: 0, wob: 0, state: PS.ORBIT, alpha: 1, t: 0, delay: 0, dur: 0, r0: 0, a0: 0, group: null });
  st.spawnRate = 0;
  const ev = [];
  PS.pulse(w, s, st, ev, false);
  for (let i = 0; i < 60; i++) PS.step(w, s, st, 1 / 30, ev);
  const pay = ev.find((e) => e.t === 'payout');
  assert.ok(pay);
  assert.equal(pay.chain, 6);
  const expected = 6 * st.valueMult * PS.chainMult(st, 6);
  assert.ok(Math.abs(pay.total - expected) < 1e-9);
  assert.ok(Math.abs(s.matter - expected) < 1e-9);
});

test('long simulated sessions stay finite and bounded', () => {
  const r = run({ minutes: 30, policy: 'spam', seed: 4 });
  const s = r.state;
  assert.ok(Number.isFinite(s.matter) && Number.isFinite(s.lifetime));
  assert.ok(s.sector >= 3, 'a 30 minute session should reach the fourth sector');
});

test('pacing hits the bible targets for an active player', () => {
  const r = run({ minutes: 13, policy: 'smart', seed: 1 });
  const at = (k) => (r.log.find((l) => l.key === k) || {}).t;
  assert.ok(at('first upgrade') <= 60, 'first upgrade within a minute');
  assert.ok(at('first drones') >= 60 && at('first drones') <= 180, 'first automation in 1–3 min');
  const s1 = (r.log.find((l) => l.key.startsWith('sector 1')) || {}).t;
  assert.ok(s1 >= 180 && s1 <= 360, 'first sector in 3–6 min, got ' + s1);
  assert.ok(at('collapse available') > 480, 'first collapse is not immediate');
});
