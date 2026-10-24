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
  assert.ok(at('collapse available') > 360, 'first collapse is not immediate');
  assert.ok(at('first capsule pull') <= 90, 'first capsule within 90 s');
});

test('first capsule is always Rare and costs the listed price', () => {
  const s = PS.createState(0);
  s.tickets = PS.CONFIG.gacha.cost;
  const r = PS.pull(s, 1, PS.mulberry32(1));
  assert.equal(r.length, 1);
  assert.equal(r[0].rarity, 1);
  assert.equal(s.tickets, 0);
  assert.equal(PS.pull(s, 1, PS.mulberry32(1)), null, 'cannot pull without tickets');
});

test('gacha pity guarantees Epic within 25 and Legendary within 70', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = PS.createState(0);
    const rng = PS.mulberry32(seed);
    let sinceEpic = 0, sinceLegend = 0;
    for (let i = 0; i < 400; i++) {
      s.tickets = 100;
      const [r] = PS.pull(s, 1, rng);
      sinceEpic = r.rarity >= 2 ? 0 : sinceEpic + 1;
      sinceLegend = r.rarity === 3 ? 0 : sinceLegend + 1;
      assert.ok(sinceEpic < PS.CONFIG.gacha.pityEpic, 'epic pity broken at seed ' + seed);
      assert.ok(sinceLegend < PS.CONFIG.gacha.pityLegend, 'legend pity broken at seed ' + seed);
    }
  }
});

test('ten-pull always contains a Rare or better and duplicates star up', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = PS.createState(0);
    s.gacha.pulls = 5;
    s.tickets = PS.CONFIG.gacha.cost10;
    const res = PS.pull(s, 10, PS.mulberry32(seed));
    assert.equal(res.length, 10);
    assert.ok(res.some((r) => r.rarity >= 1), 'seed ' + seed);
  }
  const s = PS.createState(0);
  for (let i = 0; i < 2000; i++) { s.tickets = 10; PS.pull(s, 1, PS.mulberry32(i + 7)); }
  for (const id of Object.keys(s.critters)) {
    const c = s.critters[id];
    assert.ok(c.stars >= 1 && c.stars <= 5);
  }
  assert.ok(Object.values(s.critters).some((c) => c.stars === 5), 'commons should max out over 2000 pulls');
});

test('displayed odds sum to 1 and reflect pity', () => {
  const s = PS.createState(0);
  assert.deepEqual(PS.gachaOdds(s), [0, 1, 0, 0]);
  s.gacha.pulls = 3;
  const o = PS.gachaOdds(s);
  assert.ok(Math.abs(o.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  s.gacha.sinceLegend = PS.CONFIG.gacha.pityLegend - 1;
  assert.deepEqual(PS.gachaOdds(s), [0, 0, 0, 1]);
});

test('critter bonuses scale with stars and feed derived stats', () => {
  const s = PS.createState(0);
  const base = PS.derive(s, {}).valueMult;
  s.critters.mouse = { stars: 1, copies: 0 };
  const one = PS.derive(s, {}).valueMult;
  s.critters.mouse.stars = 5;
  const five = PS.derive(s, {}).valueMult;
  assert.ok(Math.abs(one / base - 1.08) < 1e-9);
  assert.ok(Math.abs(five / base - 1.24) < 1e-9);
  assert.match(PS.critterText(PS.CRIT.mouse, 5), /24/);
});

test('star reel results map correctly', () => {
  assert.equal(PS.reelResult(['singu', 'singu', 'singu']), 'singu3');
  assert.equal(PS.reelResult(['comet', 'comet', 'comet']), 'comet3');
  assert.equal(PS.reelResult(['dust', 'dust', 'dust']), 'triple');
  assert.equal(PS.reelResult(['dust', 'crystal', 'crystal']), 'pairRare');
  assert.equal(PS.reelResult(['dust', 'ice', 'dust']), 'pair');
  assert.equal(PS.reelResult(['dust', 'ice', 'shard']), 'none');
});

test('star reel spins after enough catching pulses and always pays something', () => {
  const s = PS.createState(0);
  const st = PS.derive(s, {});
  const w = PS.createWorld(PS.mulberry32(5), s, st);
  w.cometTimer = 1e9;
  const ev = [];
  let spun = null;
  for (let i = 0; i < 4000 && !spun; i++) {
    if (i % 12 === 0) PS.pulse(w, s, st, ev, false);
    PS.step(w, s, st, 1 / 30, ev);
    spun = ev.find((e) => e.t === 'reel');
  }
  assert.ok(spun, 'reel never paid');
  assert.ok(spun.matter > 0);
});

test('overcharge resolves exactly once', () => {
  const s = PS.createState(0);
  const w = PS.createWorld(PS.mulberry32(2), s, PS.derive(s, {}));
  s.matter = 1000;
  w.overcharge = { amount: 400, t: 3, chain: 12 };
  const r = PS.overcharge(w, s, []);
  assert.ok(r);
  assert.equal(s.matter, r.win ? 1400 : 800);
  assert.equal(PS.overcharge(w, s, []), null);
});

test('daily login: once per day, advances the calendar, never resets on a missed day', () => {
  const s = PS.createState(0);
  const r1 = PS.claimLogin(s, '2026-10-24');
  assert.equal(r1.day, 0);
  assert.equal(PS.claimLogin(s, '2026-10-24'), null, 'second claim same day');
  // Skip several days: the calendar continues from day 2, it does not reset.
  const r2 = PS.claimLogin(s, '2026-10-29');
  assert.equal(r2.day, 1);
  for (let d = 2; d < 7; d++) PS.claimLogin(s, '2026-11-0' + d);
  assert.equal(s.login.day, 0);
  assert.equal(s.login.week, 1);
  assert.ok(PS.loginReward(s, 0).tickets > PS.CONFIG.rewards.login[0].tickets, 'week 2 pays more');
});

test('daily quests roll deterministically, track progress from the day start and claim once', () => {
  const s = PS.createState(0);
  s.stats.pulses = 1000;
  PS.ensureDaily(s, '2026-10-24');
  const ids = s.daily.quests.map((q) => q.id);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  const t = PS.createState(0);
  PS.ensureDaily(t, '2026-10-24');
  assert.deepEqual(t.daily.quests.map((q) => q.id), ids, 'same quests for the same day');
  assert.equal(PS.ensureDaily(s, '2026-10-24'), false);
  for (let i = 0; i < 3; i++) {
    const p = PS.questProgress(s, i);
    assert.equal(p.cur, 0, 'progress starts at zero for ' + p.def.id);
    if (p.def.best) s.daily.chainToday = p.n;
    else if (p.def.stat === 'hatches') s.gacha.pulls += p.n;
    else s.stats[p.def.stat] += p.n;
    assert.ok(PS.questProgress(s, i).done);
    assert.ok(PS.claimQuest(s, i));
    assert.equal(PS.claimQuest(s, i), null);
  }
  assert.ok(PS.claimQuestBonus(s));
  assert.equal(PS.claimQuestBonus(s), null);
  assert.equal(PS.ensureDaily(s, '2026-10-25'), true, 'new day rolls');
  assert.equal(s.daily.bonus, false);
});

test('play-time gifts unlock in order with play time today', () => {
  const s = PS.createState(0);
  PS.ensureDaily(s, '2026-10-24');
  assert.equal(PS.claimChest(s), null);
  s.stats.playTime += PS.CONFIG.rewards.playChests[0].at;
  assert.ok(PS.claimChest(s));
  assert.equal(PS.claimChest(s), null, 'next chest needs more time');
  s.stats.playTime += 99999;
  let n = 1;
  while (PS.claimChest(s)) n++;
  assert.equal(n, PS.CONFIG.rewards.playChests.length);
  assert.equal(PS.chestStatus(s), null);
});

test('free capsule every 4 hours, and a clock moved back cannot skip the wait', () => {
  const s = PS.createState(0);
  const now = 1e12;
  assert.ok(PS.claimFreeCapsule(s, now));
  assert.equal(PS.claimFreeCapsule(s, now + 1000), null);
  assert.ok(PS.claimFreeCapsule(s, now + PS.CONFIG.rewards.freeCapsuleMs));
  const raw = JSON.parse(PS.serialize(s));
  raw.freeCapAt = now + 1e12;
  const back = PS.sanitize(raw, now).state;
  assert.ok(back.freeCapAt <= now + PS.CONFIG.rewards.freeCapsuleMs);
});

test('goals pay each tier once, in order', () => {
  const s = PS.createState(0);
  assert.equal(PS.claimGoal(s, 'pulses'), null);
  s.stats.pulses = 300;
  assert.ok(PS.claimGoal(s, 'pulses'));
  assert.ok(PS.claimGoal(s, 'pulses'));
  assert.equal(PS.claimGoal(s, 'pulses'), null, 'third tier needs 1000');
  assert.equal(s.goals.pulses, 2);
});

test('grantReward applies tickets, matter, surge and free hatches', () => {
  const s = PS.createState(0);
  const st = PS.derive(s, {});
  const w = PS.createWorld(PS.mulberry32(1), s, st);
  const out = PS.grantReward(s, st, w, { tickets: 7, mins: 1, surge: 10, capsule: [2] }, PS.mulberry32(3));
  assert.equal(out.tickets, 7);
  assert.ok(s.tickets >= 7, 'Singu level-ups from the Matter can add more');
  assert.ok(out.matter > 0 && s.matter > 0);
  assert.ok(w.surge >= 10);
  assert.equal(out.hatches.length, 1);
  assert.ok(out.hatches[0].rarity >= 2, 'Epic+ capsule');
  assert.equal(s.gacha.pulls, 1);
});

test('claimable count drives the badges', () => {
  const s = PS.createState(0);
  PS.ensureDaily(s, '2026-10-24');
  const n = PS.claimables(s, '2026-10-24', 1e12);
  assert.ok(n >= 2, 'login + free capsule on a fresh save');
  PS.claimLogin(s, '2026-10-24');
  PS.claimFreeCapsule(s, 1e12);
  assert.equal(PS.claimables(s, '2026-10-24', 1e12), 0);
});

test('Singu level follows lifetime Matter and cannot be forged in a save', () => {
  assert.equal(PS.singuLevelFor(0), 0);
  assert.ok(PS.singuLevelFor(1e6) > PS.singuLevelFor(1e3));
  const { state } = PS.sanitize({ v: 2, matter: 0, runTotal: 0, lifetime: 30, singuLevel: 500, tickets: -4, critters: { mouse: { stars: 99 }, fake: { stars: 1 } } }, 0);
  assert.equal(state.singuLevel, PS.singuLevelFor(30));
  assert.equal(state.tickets, 0);
  assert.equal(state.critters.mouse.stars, 5);
  assert.equal(state.critters.fake, undefined);
});

test('version 1 saves still load', () => {
  const v1 = { v: 1, matter: 50, runTotal: 80, lifetime: 80, levels: { radius: 2, drones: 3 }, stardust: 1 };
  const r = PS.sanitize(v1, 0);
  assert.equal(r.ok, true);
  assert.equal(r.state.levels.radius, 2);
  assert.equal(r.state.levels.luck, 0);
  assert.equal(r.state.tickets, 0);
});
