#!/usr/bin/env node
/* Browser QA for Pocket Singularity (Playwright + Chromium).
 *   node tests/browser.qa.js [screenshotDir]
 * Serves the game folder itself, runs each check, prints PASS/FAIL, exits non-zero on failure.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try next */ }
  }
  throw new Error('Playwright not found. Install it with: npm i -D playwright');
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '..', process.env.QA_ROOT || '.');
const SHOTS = process.argv[2] || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log('PASS', name); }
  catch (e) { results.push([false, name, e.message]); console.log('FAIL', name, '—', e.message); }
}
function assert(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }

(async () => {
  const srv = await serve();
  const URL = 'http://localhost:' + srv.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];

  async function page(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 907, height: 510 } }, opts || {}));
    // The CrazyGames SDK is not reachable from CI; block it so the test is deterministic.
    await ctx.route('**/sdk.crazygames.com/**', (r) => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
    return p;
  }
  const S = (p, fn, arg) => p.evaluate(fn, arg);
  // A fresh universe first asks for the black hole's name.
  async function named(p) {
    await p.waitForTimeout(120);
    if (await p.isVisible('#name-input')) { await p.click('#modal-actions .btn.gold'); await p.waitForTimeout(60); }
  }
  async function shot(p, name) { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); }

  let p = await page();
  await p.goto(URL);
  await p.waitForTimeout(400);

  await check('a new player names their black hole first', async () => {
    await p.waitForSelector('#name-input');
    await shot(p, '907-name');
    await p.fill('#name-input', 'Mochi<b>!');
    await p.press('#name-input', 'Enter');
    await p.waitForTimeout(100);
    const st = await S(p, () => ({ n: __ps.state.name, ok: __ps.state.named, open: !document.getElementById('modal').hidden }));
    assert(st.n === 'Mochib!' && st.ok && !st.open, JSON.stringify(st));
    assert(/Mochib!/.test(await p.textContent('#powers-head')), 'name used in the UI');
  });

  await check('starts directly in the universe with the tap hint and panel visible', async () => {
    assert(await p.isVisible('#cv'), 'canvas');
    assert(await p.isVisible('#hint'), 'tap hint');
    assert(await p.isVisible('#tab-harvest'), 'harvest tab');
    const box = await p.locator('#tabs').boundingBox();
    assert(box.y >= 0 && box.y + box.height <= 510, 'tabs off-screen');
    await shot(p, '907-first');
  });

  await check('first click pulses and captures within 5 seconds', async () => {
    const t0 = Date.now();
    await p.mouse.click(250, 220);
    await p.waitForFunction(() => __ps.state.stats.captures > 0, null, { timeout: 5000 });
    assert(Date.now() - t0 < 5000);
    assert(await S(p, () => __ps.state.matter > 0), 'matter');
  });

  await check('rewards: daily login claims from the Rewards tab once per day', async () => {
    await p.click('.tab[data-tab="rewards"]');
    await p.waitForSelector('[data-claim="login"]');
    const t0 = await S(p, () => __ps.state.tickets);
    await p.click('[data-claim="login"]');
    await p.waitForTimeout(150);
    const st = await S(p, () => ({ t: __ps.state.tickets, login: __ps.state.login, today: __ps.today() }));
    assert(st.t - t0 >= 5, 'day 1 pays 5 tickets, got ' + (st.t - t0));
    assert(st.login.day === 1 && st.login.last === st.today, JSON.stringify(st.login));
    assert((await p.locator('[data-claim="login"]').count()) === 0, 'claim button gone');
    await p.click('.tab[data-tab="harvest"]');
  });

  await check('Space and a tap both pulse', async () => {
    await p.waitForTimeout(400);
    const n0 = await S(p, () => __ps.state.stats.pulses);
    await p.keyboard.press('Space');
    await p.waitForTimeout(400);
    await p.mouse.click(250, 220);
    await p.waitForTimeout(100);
    const n1 = await S(p, () => __ps.state.stats.pulses);
    assert(n1 - n0 === 2, 'expected 2 pulses, got ' + (n1 - n0));
  });

  await check('buying a harvester spends Matter, adds one and does not pulse', async () => {
    await p.waitForTimeout(400);
    await S(p, () => { __ps.state.matter = 1000; __ps.state.lifetime += 1000; });
    await p.waitForTimeout(200);
    const before = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime, p: __ps.state.stats.pulses, cost: __ps.PS.genCost('sweeper', __ps.state.gens.sweeper || 0, 1) }));
    await p.click('#gens .gen >> nth=0');
    const after = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime, p: __ps.state.stats.pulses, l: __ps.state.gens.sweeper }));
    assert(after.l === 1, 'owned ' + after.l);
    const spent = before.m + (after.life - before.life) - after.m;  // income may land during the click
    assert(Math.abs(spent - before.cost) < 1e-6, 'spent ' + spent + ' cost ' + before.cost);
    assert(after.p === before.p, 'buying must not pulse');
  });

  await check('keys 1–7 switch tabs and unaffordable buys are refused', async () => {
    await p.keyboard.press('3');
    assert(await p.isVisible('#tab-pets'), 'key 3 opens Pets');
    await p.keyboard.press('6');
    assert(await p.isVisible('#tab-skins'), 'key 6 opens Skins');
    await p.keyboard.press('1');
    assert(await p.isVisible('#tab-harvest'), 'key 1 opens Harvest');
    await S(p, () => { __ps.state.matter = 0; });
    const n = await S(p, () => __ps.state.gens.sweeper);
    await p.click('#gens .gen >> nth=0', { force: true });
    assert((await S(p, () => __ps.state.gens.sweeper)) === n, 'bought without matter');
  });

  await check('upgrades: catalog unlocks, buys once and boosts income', async () => {
    await S(p, () => { __ps.state.matter = 1e4; __ps.state.lifetime += 1e4; __ps.setTab('upgrades'); });
    await p.waitForSelector('#catalog .up');
    const id = await p.getAttribute('#catalog .up >> nth=0', 'data-up');
    const r0 = await S(p, () => __ps.stats.genPerSec);
    await p.click('#catalog .up >> nth=0');
    assert(await S(p, (id) => __ps.state.bought[id] === 1, id), 'bought ' + id);
    assert((await S(p, () => __ps.stats.genPerSec)) >= r0, 'income dropped');
    await p.waitForTimeout(200);
    assert((await p.locator('#catalog [data-up="' + id + '"]').count()) === 0, 'bought upgrade still listed');
    await shot(p, '907-upgrades');
  });

  await check('max level shows MAX and cannot be bought', async () => {
    await S(p, () => { __ps.state.levels.radius = 12; __ps.state.matter = 1e12; __ps.state.lifetime = 1e12; __ps.refresh(); __ps.setTab('upgrades'); });
    await p.waitForTimeout(250);
    const txt = await p.textContent('#shop .pow >> nth=0');
    assert(/MAX/.test(txt), 'MAX label');
    assert(/12\/12/.test(txt), 'level label');
    const m = await S(p, () => __ps.state.matter);
    await p.click('#shop .pow >> nth=0', { force: true });
    // Harvesters keep earning during the click, so Matter may only go up.
    assert((await S(p, () => __ps.state.matter)) >= m, 'spent matter on a maxed upgrade');
    assert((await S(p, () => __ps.state.levels.radius)) === 12, 'level went past max');
  });

  await check('buy-mode Max buys many levels at once', async () => {
    await S(p, () => { __ps.state.gens.sweeper = 0; __ps.state.matter = 1e6; __ps.refresh(); __ps.setTab('harvest'); });
    await p.click('.buy-mode button[data-mode="0"]');
    await p.waitForTimeout(200);
    await p.click('#gens .gen >> nth=0');
    const l = await S(p, () => __ps.state.gens.sweeper);
    assert(l > 20, 'bought ' + l);
    await p.click('.buy-mode button[data-mode="1"]');
  });

  await check('a comet appears, is catchable, and triggers a Surge', async () => {
    await S(p, () => { __ps.world.comet = null; __ps.world.cometTimer = 0; });
    await p.waitForFunction(() => {
      const c = __ps.world.comet;
      return c && Math.hypot(c.x, c.y / 0.82) <= __ps.stats.pulseRadius * 0.95;
    }, null, { timeout: 15000 });
    assert(/[Cc]omet/.test(await p.textContent('#hint')), 'comet hint');
    await shot(p, '907-comet');
    await p.waitForTimeout(400);
    await p.keyboard.press('Space');
    await p.waitForFunction(() => __ps.world.surge > 0, null, { timeout: 3000 });
    await p.waitForTimeout(600);
    assert(await p.isVisible('#surge'), 'surge pill');
    assert((await S(p, () => __ps.state.discoveries.comet)) > 0, 'comet discovery');
    await shot(p, '907-surge');
  });

  await check('form bar and goals show what is next after reload', async () => {
    await S(p, () => __ps.save());
    await p.reload(); await named(p);
    await p.waitForTimeout(300);
    const f = await S(p, () => __ps.PS.CT.FORMS[__ps.state.form].name);
    assert((await p.textContent('#form-name')) === f, 'form name');
    assert(/Sector/.test(await p.textContent('#ms-text')), await p.textContent('#ms-text'));
    assert(!/feed it/.test(await p.textContent('#hint')), 'stale first-run hint visible');
    assert((await p.locator('#goals .goal').count()) >= 1, 'next goals');
  });

  await check('progress survives a refresh', async () => {
    await S(p, () => __ps.save());
    const before = await S(p, () => JSON.stringify(__ps.state.levels));
    await p.reload(); await named(p);
    await p.waitForTimeout(300);
    assert((await S(p, () => JSON.stringify(__ps.state.levels))) === before);
  });

  await check('sector reveal changes the universe', async () => {
    for (const i of [1, 2, 3, 4]) {
      await S(p, (i) => { const st = __ps.state; const at = __ps.PS.sectorInfo(i).at; st.runTotal = at; st.lifetime = Math.max(st.lifetime, at); }, i);
      await p.waitForTimeout(i === 1 ? 900 : 250);
      assert((await S(p, () => __ps.state.sector)) === i, 'sector ' + i);
      if (i === 1) await shot(p, '907-sector-reveal');
      await p.waitForTimeout(1700);
      await shot(p, '907-sector-' + (i + 1));
    }
  });

  await check('collapse: confirms, grants Stardust exactly once, keeps the Atlas', async () => {
    await S(p, () => { const st = __ps.state; st.runTotal = st.lifetime = __ps.PS.sectorInfo(3).at * 3; });
    await p.waitForTimeout(300);
    const expected = await S(p, () => __ps.state.stardust + __ps.PS.stardustFor(__ps.state));
    const atlas = await S(p, () => Object.keys(__ps.state.discoveries).length);
    await S(p, () => __ps.setTab('upgrades'));
    await p.waitForSelector('#collapse-card [data-act="collapse"]');
    await p.click('#collapse-card [data-act="collapse"]');
    await p.waitForSelector('#modal:not([hidden])');
    await shot(p, '907-collapse-modal');
    const btn = p.locator('#modal-actions .btn.violet');
    await btn.dblclick({ force: true });
    await p.waitForTimeout(400);
    const st = await S(p, () => ({ sd: __ps.state.stardust, m: __ps.state.matter, sec: __ps.state.sector, a: Object.keys(__ps.state.discoveries).length, c: __ps.state.collapses }));
    assert(st.sd === expected, 'stardust ' + st.sd + ' vs ' + expected);
    assert(st.c === 1, 'collapses ' + st.c);
    assert(st.sec === 0, 'sector reset');
    assert(st.a >= atlas, 'atlas kept');
    await p.reload(); await named(p);
    await p.waitForTimeout(300);
    assert((await S(p, () => __ps.state.stardust)) === expected, 'stardust persisted');
  });

  await check('away income: capped at 2 h, paid once, survives refresh without repeating', async () => {
    await S(p, () => { __ps.state.gens.drone = 10; __ps.refresh(); __ps.save(); });
    const rate = await S(p, () => __ps.stats.dronePerSec * __ps.stats.offlineRate);
    await S(p, () => {
      __ps.freeze();
      const raw = JSON.parse(localStorage.getItem('pocket-singularity:save'));
      raw.lastSeen = Date.now() - 5 * 3600e3;
      localStorage.setItem('pocket-singularity:save', JSON.stringify(raw));
    });
    const m0 = await S(p, () => JSON.parse(localStorage.getItem('pocket-singularity:save')).matter);
    await p.reload(); await named(p);
    await p.waitForSelector('#modal:not([hidden])');
    assert(/Welcome back/.test(await p.textContent('#modal-title')), 'welcome modal');
    await shot(p, '907-welcome-back');
    const gained = (await S(p, () => __ps.state.matter)) - m0;
    const cap = rate * 7200;
    assert(gained >= cap * 0.99 && gained <= cap * 1.02 + 50, 'gained ' + gained + ' cap ' + cap);
    await p.click('#modal-actions .btn.primary');
    await S(p, () => __ps.save());
    const m1 = await S(p, () => __ps.state.matter);
    await p.reload(); await named(p);
    await p.waitForTimeout(400);
    assert(await p.isHidden('#modal'), 'modal should not reappear');
    const m2 = await S(p, () => __ps.state.matter);
    assert(m2 - m1 < cap * 0.05, 'paid twice: ' + (m2 - m1));
  });

  await check('clock moved backwards grants nothing', async () => {
    await S(p, () => {
      __ps.save();
      __ps.freeze();
      const raw = JSON.parse(localStorage.getItem('pocket-singularity:save'));
      raw.lastSeen = Date.now() + 10 * 3600e3;
      localStorage.setItem('pocket-singularity:save', JSON.stringify(raw));
    });
    const m0 = await S(p, () => JSON.parse(localStorage.getItem('pocket-singularity:save')).matter);
    await p.reload(); await named(p);
    await p.waitForTimeout(300);
    assert(await p.isHidden('#modal'), 'no modal');
    const st = await S(p, () => ({ m: __ps.state.matter, rate: __ps.stats.genPerSec }));
    // Only the live income of the second since loading, never hours of away income.
    assert(st.m - m0 < st.rate * 3 + 100, 'gained ' + (st.m - m0));
  });

  await check('corrupted save fails safely and restores the backup', async () => {
    const life = await S(p, () => { __ps.save(); localStorage.setItem('pocket-singularity:backup', localStorage.getItem('pocket-singularity:save')); return __ps.state.lifetime; });
    await S(p, () => { __ps.freeze(); localStorage.setItem('pocket-singularity:save', '{"v":1,"matter":12,,,garbage'); });
    await p.reload(); await named(p);
    await p.waitForTimeout(800);
    const restored = await S(p, () => __ps.state.lifetime);
    assert(Math.abs(restored - life) / life < 0.01, 'backup not restored');
    assert(/backup/i.test(await p.textContent('#toasts')), 'notice toast');
    await S(p, () => { __ps.freeze(); localStorage.setItem('pocket-singularity:save', 'nonsense'); localStorage.setItem('pocket-singularity:backup', 'also nonsense'); });
    await p.reload(); await named(p);
    await p.waitForTimeout(400);
    assert((await S(p, () => __ps.state.lifetime)) >= 0, 'fresh start');
    assert(await p.isVisible('#cv'));
  });

  await check('mute and reduced motion persist', async () => {
    await p.click('#btn-sound');
    await p.click('#btn-settings');
    await p.click('[data-set="motion"]');
    await p.keyboard.press('Escape');
    await p.reload(); await named(p);
    await p.waitForTimeout(300);
    const s = await S(p, () => __ps.state.settings);
    assert(s.muted === true && s.reducedMotion === true, JSON.stringify(s));
    assert(await S(p, () => document.body.classList.contains('reduced')), 'reduced class');
    assert(await S(p, () => document.getElementById('btn-sound').classList.contains('muted')), 'muted icon');
  });

  await check('Escape closes dialogs; Atlas lists every discovery', async () => {
    await p.click('#btn-atlas');
    await p.waitForSelector('#modal:not([hidden])');
    assert((await p.locator('.atlas .ae').count()) === (await S(p, () => __ps.PS.CONFIG.discoveries.length)));
    await shot(p, '907-atlas');
    await p.keyboard.press('Escape');
    assert(await p.isHidden('#modal'));
  });

  await check('pets: hatch ×1 spends tickets, reveals a pet, adds it to the collection', async () => {
    await S(p, () => { __ps.state.tickets = 200; });
    await p.click('.tab[data-tab="pets"]');
    await p.waitForSelector('#tab-pets:not([hidden])');
    const odds = await p.textContent('#odds');
    assert(/Common/.test(odds) && /Legendary/.test(odds) && /Mythic/.test(odds), 'odds shown');
    const before = await S(p, () => ({ t: __ps.state.tickets, n: __ps.state.gacha.pulls }));
    await p.click('#pull1');
    await p.waitForSelector('#modal:not([hidden]) .gacha-box');
    await p.waitForSelector('.won-card', { timeout: 8000 });
    await shot(p, '907-hatch');
    const after = await S(p, () => ({ t: __ps.state.tickets, n: __ps.state.gacha.pulls, owned: Object.keys(__ps.state.critters).length }));
    // Costs 10; discoveries and trophies can hand a few straight back.
    assert(before.t - after.t <= 10 && before.t - after.t >= 2, 'ticket cost ' + (before.t - after.t));
    assert(after.n === before.n + 1 && after.owned >= 1, JSON.stringify(after));
    await p.click('#modal-actions .btn.primary');
    assert(await p.isHidden('#modal'));
    assert((await p.locator('.crit:not(.locked)').count()) >= 1, 'collection shows the pet');
  });

  await check('pets: hatch ×10 can be skipped and gives ten results with a Rare+', async () => {
    await S(p, () => { __ps.state.tickets = 200; });
    const n0 = await S(p, () => __ps.state.gacha.pulls);
    await p.click('#pull10');
    await p.waitForSelector('#modal:not([hidden]) .gacha-box');
    await p.click('#modal-actions .btn');   // Skip
    await p.waitForSelector('#modal-actions .btn.primary');
    assert((await p.locator('.multi .cell img').count()) === 10, 'ten reveals');
    assert((await p.locator('.multi .cell.ra1, .multi .cell.ra2, .multi .cell.ra3, .multi .cell.ra4').count()) >= 1, 'a Rare or better');
    assert((await S(p, () => __ps.state.gacha.pulls)) === n0 + 10);
    await shot(p, '907-hatch10');
    await p.keyboard.press('Escape');
  });

  await check('Star Reel spins after enough pulses and pays out', async () => {
    await S(p, () => { __ps.state.reelCharge = __ps.stats.reelNeed - 1; });
    const m0 = await S(p, () => __ps.state.stats.spins);
    for (let i = 0; i < 6 && (await S(p, () => __ps.state.stats.spins)) === m0; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(420); }
    await p.waitForSelector('#reel:not([hidden])', { timeout: 3000 });
    await p.waitForFunction(() => document.getElementById('reel-result').textContent.length > 3, null, { timeout: 4000 });
    assert(/Matter/.test(await p.textContent('#reel-result')), 'reel prize text');
    await shot(p, '907-reel');
  });

  await check('Overcharge offer resolves once and moves Matter by the stated odds', async () => {
    await S(p, () => { __ps.state.matter = 10000; __ps.world.overcharge = { amount: 1000, t: 3, chain: 12 }; });
    await p.waitForSelector('#overcharge:not([hidden])');
    await shot(p, '907-overcharge');
    const m0 = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime }));
    await p.click('#overcharge');
    const m1 = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime, n: __ps.state.stats.overcharges }));
    assert(Math.abs(m1.m - m0.m - 1000) < 200 || Math.abs(m1.m - m0.m + 500) < 200, 'delta ' + (m1.m - m0.m));
    assert(await p.isHidden('#overcharge'), 'button hides');
    assert((await S(p, () => __ps.world.overcharge)) === null, 'offer consumed');
  });

  await check('rewards: free capsule hatches and then counts down', async () => {
    await S(p, () => { __ps.state.freeCapAt = 0; __ps.setTab('rewards'); });
    await p.waitForSelector('[data-claim="free"]');
    const n0 = await S(p, () => __ps.state.gacha.pulls);
    await p.click('[data-claim="free"]');
    await p.waitForSelector('.won-card', { timeout: 8000 });
    assert((await S(p, () => __ps.state.gacha.pulls)) === n0 + 1, 'hatched');
    await p.click('#modal-actions .btn.primary');
    await S(p, () => __ps.setTab('rewards'));
    await p.waitForSelector('[data-cd="free"]');
    assert(/\d:\d\d/.test(await p.textContent('[data-cd="free"]')), 'countdown shown');
  });

  await check('rewards: play gift and quest claims each pay once', async () => {
    await S(p, () => { __ps.state.stats.playTime = __ps.state.daily.play0 + 130; });
    await p.waitForSelector('[data-claim="chest"]');
    await shot(p, '907-rewards');
    let t0 = await S(p, () => __ps.state.tickets);
    await p.click('[data-claim="chest"]');
    await p.waitForTimeout(100);
    assert((await S(p, () => __ps.state.tickets)) > t0, 'chest paid');
    assert((await S(p, () => __ps.state.daily.chests)) === 1, 'one chest claimed');
    // Complete the first quest by pushing its stat.
    await S(p, () => {
      const q = __ps.PS.questProgress(__ps.state, 0);
      if (q.def.best) __ps.state.daily.chainToday = q.n;
      else if (q.def.stat === 'hatches') __ps.state.gacha.pulls += q.n;
      else __ps.state.stats[q.def.stat] += q.n;
    });
    await p.waitForSelector('[data-claim="quest:0"]');
    t0 = await S(p, () => __ps.state.tickets);
    await p.click('[data-claim="quest:0"]');
    await p.waitForTimeout(100);
    assert((await S(p, () => __ps.state.tickets)) > t0, 'quest paid');
    assert((await p.locator('[data-claim="quest:0"]').count()) === 0, 'quest claim gone');
    await S(p, () => __ps.setTab('harvest'));
  });

  await check('relics: forge, push or keep, equip and salvage', async () => {
    await S(p, () => { __ps.state.shards = 100; __ps.setTab('relics'); });
    await p.click('[data-rel="forge"]');
    assert(await S(p, () => !!__ps.state.forge), 'forging');
    assert((await S(p, () => __ps.state.shards)) === 90, 'forge costs 10');
    await shot(p, '907-forge');
    const pushed = await p.$('[data-rel="push"]');
    if (pushed) { await pushed.click(); await p.waitForTimeout(100); }
    if (await S(p, () => !!__ps.state.forge)) await p.click('[data-rel="keep"]');
    else { await p.click('[data-rel="forge"]'); await p.click('[data-rel="keep"]'); }
    await p.waitForTimeout(150);
    const st = await S(p, () => ({ n: __ps.state.relics.length, eq: __ps.state.equipped.length, f: __ps.state.forge }));
    assert(st.n >= 1 && st.eq >= 1 && !st.f, JSON.stringify(st));
    for (let i = 0; i < 4; i++) { await p.click('[data-rel="forge"]'); await p.click('[data-rel="keep"]'); }
    await p.waitForSelector('#inventory .relic');
    const sh = await S(p, () => __ps.state.shards);
    await p.click('#inventory [data-rel^="salvage"] >> nth=0');
    assert((await S(p, () => __ps.state.shards)) > sh, 'salvage pays shards');
    await shot(p, '907-relics');
  });

  await check('trophies: unlocked ones claim once for tickets and shards', async () => {
    await S(p, () => __ps.setTab('trophies'));
    await p.waitForSelector('.tro.ready');
    const n0 = await S(p, () => ({ t: __ps.state.tickets, s: __ps.state.shards }));
    await p.click('.tro.ready >> nth=0');
    await p.waitForTimeout(150);
    const n1 = await S(p, () => ({ t: __ps.state.tickets, s: __ps.state.shards }));
    assert(n1.t - n0.t >= 1, JSON.stringify([n0, n1]));
    await shot(p, '907-trophies');
    if (await p.isVisible('#claim-all')) {
      await p.click('#claim-all');
      assert((await S(p, () => Object.values(__ps.state.ach).filter((v) => v === 1).length)) === 0, 'claim all');
    }
    await S(p, () => __ps.setTab('harvest'));
  });

  await check('trophies are listed bronze to spectral within each group', async () => {
    await S(p, () => __ps.setTab('trophies'));
    await p.waitForTimeout(200);
    const ok = await S(p, () => {
      const tier = {};
      __ps.PS.CT.ACHIEVEMENTS.forEach((a) => { tier[a.id] = a.tier; });
      return [...document.querySelectorAll('.tgrid')].every((g) => {
        const ts = [...g.querySelectorAll('[data-ach]')].map((n) => tier[n.dataset.ach]);
        return ts.every((t, i) => i === 0 || t >= ts[i - 1]);
      });
    });
    assert(ok, 'tiers out of order');
    await S(p, () => __ps.setTab('harvest'));
  });

  await check('skins: open a crate with keys, reveal a skin from that crate, equip it', async () => {
    await S(p, () => { __ps.state.skins.keys = 10; __ps.setTab('skins'); });
    await p.waitForSelector('[data-crate="stardust"]');
    await p.click('[data-crate="stardust"]');
    await p.waitForSelector('#modal:not([hidden]) .gacha-box');
    await p.click('#modal-actions .btn');   // Skip
    await p.waitForSelector('.gacha-box .won-card');
    await shot(p, '907-crate');
    const st = await S(p, () => ({ keys: __ps.state.skins.keys, own: Object.keys(__ps.state.skins.own) }));
    assert(st.keys === 9 && st.own.length >= 2, JSON.stringify(st));
    const id = st.own.find((x) => x !== 'classic');
    assert(await S(p, (id) => __ps.PS.SKIN[id].crate === 'stardust', id), 'skin from the Stardust Crate');
    await p.keyboard.press('Escape');
    await p.click('[data-skin="' + id + '"]');
    assert((await S(p, () => __ps.state.skins.on)) === id, 'equipped');
    await shot(p, '907-skins');
    await S(p, () => __ps.setTab('harvest'));
  });

  await check('holding on the universe keeps pulsing and builds combo', async () => {
    const n0 = await S(p, () => __ps.state.stats.pulses);
    await p.mouse.move(250, 230);
    await p.mouse.down();
    await p.waitForTimeout(1600);
    await p.mouse.up();
    const st = await S(p, () => ({ n: __ps.state.stats.pulses, c: __ps.world.combo }));
    assert(st.n - n0 >= 3, 'pulses ' + (st.n - n0));
    assert(st.c > 0, 'combo');
  });

  await check('leaderboard button explains the score without the SDK', async () => {
    await p.click('#btn-leader');
    await p.waitForSelector('#modal:not([hidden])');
    assert(/Leaderboard/.test(await p.textContent('#modal-title')), 'title');
    assert(/Singu level/.test(await p.textContent('#modal-body')), 'score explained');
    await p.keyboard.press('Escape');
  });

  await check('rewards: badge and gift chip reflect what is waiting', async () => {
    await S(p, () => { __ps.state.freeCapAt = 0; });
    await p.waitForTimeout(400);
    const badge = '.tab[data-tab="rewards"] .badge';
    assert(await p.isVisible(badge), 'badge visible');
    assert(Number(await p.textContent(badge)) >= 1);
    assert((await p.textContent('#gift-text')).length > 3, 'gift chip text');
    await p.click('#gift-chip');
    assert(await p.isVisible('#tab-rewards'), 'gift chip opens rewards');
    await S(p, () => __ps.setTab('harvest'));
  });

  await check('owned pets orbit Singu', async () => {
    const n = await S(p, () => Object.keys(__ps.state.critters).length);
    assert(n >= 1, 'no critters');
    await shot(p, '907-pets');
  });

  await check('object counts stay bounded during a long busy session', async () => {
    await S(p, () => { const st = __ps.state; st.levels.density = 20; st.levels.radius = 12; __ps.refresh(); });
    const dom0 = await S(p, () => document.getElementsByTagName('*').length);
    for (let i = 0; i < 30; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(120); }
    const n = await S(p, () => ({ f: __ps.world.frags.length, r: __ps.world.rings.length, g: __ps.world.groups.length, cap: __ps.stats.cap, dom: document.getElementsByTagName('*').length }));
    assert(n.f <= n.cap + 30 && n.r < 20 && n.g < 20, JSON.stringify(n));
    assert(n.dom - dom0 < 30, 'DOM grew from ' + dom0 + ' to ' + n.dom);
  });
  await p.context().close();

  // Fullscreen 16:9 --------------------------------------------------------------
  p = await page({ viewport: { width: 1920, height: 1080 } });
  await p.goto(URL);
  await p.waitForTimeout(400);
  await named(p);
  await check('1920×1080 layout has no overflow', async () => {
    await p.mouse.click(600, 500);
    await p.waitForTimeout(500);
    const o = await S(p, () => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));
    assert(o.sw <= o.w && o.sh <= o.h, JSON.stringify(o));
    await shot(p, '1920-fullscreen');
  });
  await check('resizing re-fits the canvas', async () => {
    await p.setViewportSize({ width: 1100, height: 620 });
    await p.waitForTimeout(300);
    const c = await S(p, () => { const r = document.getElementById('cv').getBoundingClientRect(); return { w: r.width, h: r.height }; });
    assert(c.w > 500 && c.h > 300, JSON.stringify(c));
  });
  await p.context().close();

  // Narrow touch ---------------------------------------------------------------
  p = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await p.goto(URL);
  await p.waitForTimeout(400);
  await named(p);
  await check('phone portrait: tap pulses, playfield above panel, tab bar at the bottom, no horizontal scroll', async () => {
    await p.touchscreen.tap(195, 200);
    await p.waitForFunction(() => __ps.state.stats.pulses === 1, null, { timeout: 2000 });
    const o = await S(p, () => {
      const u = document.getElementById('universe').getBoundingClientRect();
      const s = document.getElementById('panel').getBoundingClientRect();
      const b = document.getElementById('tabs').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, w: innerWidth, h: innerHeight, u: u.top, s: s.top, bb: b.bottom, bt: b.top, uh: u.height };
    });
    assert(o.sw <= o.w, 'horizontal overflow');
    assert(o.u < o.s, 'playfield must come before the panel');
    assert(o.bb <= o.h && o.bt > o.h - 90, 'tab bar not at the bottom: ' + JSON.stringify(o));
    assert(o.uh >= 280, 'playfield too small: ' + o.uh);
    await p.waitForTimeout(500);
    await shot(p, '390-portrait');
  });
  await check('phone portrait: second tap and harvester tap both work', async () => {
    await p.waitForTimeout(400);
    await p.touchscreen.tap(195, 220);
    await p.waitForTimeout(100);
    assert((await S(p, () => __ps.state.stats.pulses)) === 2);
    await S(p, () => { __ps.state.matter = 100; });
    await p.waitForTimeout(200);
    await p.tap('#gens .gen >> nth=0');
    assert((await S(p, () => __ps.state.gens.sweeper)) === 1);
  });
  await check('phone portrait: rewards tab works by touch', async () => {
    await p.tap('.tab[data-tab="rewards"]');
    await p.waitForSelector('[data-claim="login"]');
    await p.tap('[data-claim="login"]');
    await p.waitForTimeout(150);
    assert((await S(p, () => __ps.state.login.day)) === 1, 'login claimed by touch');
    await shot(p, '390-rewards');
  });
  await check('phone portrait: pets tab works by touch', async () => {
    await S(p, () => { __ps.state.tickets = 50; });
    await p.tap('.tab[data-tab="pets"]');
    await p.waitForSelector('#tab-pets:not([hidden])');
    await p.tap('#pull1');
    await p.waitForSelector('.won-card', { timeout: 8000 });
    await shot(p, '390-hatch');
    await p.tap('#modal-actions .btn.primary');
    assert(await p.isHidden('#modal'));
    await shot(p, '390-pets');
  });
  await p.context().close();

  p = await page({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await p.goto(URL);
  await p.waitForTimeout(400);
  await named(p);
  await check('phone landscape: everything reachable', async () => {
    const o = await S(p, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, b: document.getElementById('tabs').getBoundingClientRect().bottom, h: innerHeight }));
    assert(o.sw <= o.w && o.b <= o.h, JSON.stringify(o));
    await shot(p, '844-landscape');
  });
  await p.context().close();

  await check('no console or page errors', async () => { assert(errors.length === 0, errors.slice(0, 5).join(' | ')); });

  await browser.close();
  srv.close();
  const failed = results.filter((r) => !r[0]);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
