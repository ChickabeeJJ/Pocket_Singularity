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
  async function shot(p, name) { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); }

  let p = await page();
  await p.goto(URL);
  await p.waitForTimeout(400);

  await check('starts directly in the universe with the pulse control visible', async () => {
    assert(await p.isVisible('#cv'), 'canvas');
    assert(await p.isVisible('#btn-pulse'), 'pulse button');
    const box = await p.locator('#btn-pulse').boundingBox();
    assert(box.y + box.height <= 510, 'pulse button below the fold');
    await shot(p, '907-first');
  });

  await check('first click pulses and captures within 5 seconds', async () => {
    const t0 = Date.now();
    await p.mouse.click(250, 220);
    await p.waitForFunction(() => __ps.state.stats.captures > 0, null, { timeout: 5000 });
    assert(Date.now() - t0 < 5000);
    assert(await S(p, () => __ps.state.matter > 0), 'matter');
  });

  await check('Space and the button both pulse', async () => {
    await p.waitForTimeout(400);
    const n0 = await S(p, () => __ps.state.stats.pulses);
    await p.keyboard.press('Space');
    await p.waitForTimeout(400);
    await p.click('#btn-pulse');
    await p.waitForTimeout(100);
    const n1 = await S(p, () => __ps.state.stats.pulses);
    assert(n1 - n0 === 2, 'expected 2 pulses, got ' + (n1 - n0));
  });

  await check('buying an upgrade spends Matter, raises level and does not pulse', async () => {
    await p.waitForTimeout(400);
    await S(p, () => { __ps.state.matter = 1000; __ps.state.lifetime += 1000; });
    const before = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime, p: __ps.state.stats.pulses, cost: __ps.PS.upgradeCost('radius', __ps.state.levels.radius) }));
    await p.click('.card >> nth=0');
    const after = await S(p, () => ({ m: __ps.state.matter, life: __ps.state.lifetime, p: __ps.state.stats.pulses, l: __ps.state.levels.radius }));
    assert(after.l === 1, 'level');
    const spent = before.m + (after.life - before.life) - after.m;  // income may land during the click
    assert(Math.abs(spent - before.cost) < 1e-6, 'spent ' + spent + ' cost ' + before.cost);
    assert(after.p === before.p, 'buying must not pulse');
  });

  await check('keyboard 1–5 buys and unaffordable buys are refused', async () => {
    await S(p, () => { __ps.state.matter = 0; });
    await p.keyboard.press('5');
    assert((await S(p, () => __ps.state.levels.focus)) === 0, 'bought without matter');
    await S(p, () => { __ps.state.matter = 500; });
    await p.keyboard.press('5');
    assert((await S(p, () => __ps.state.levels.focus)) === 1, 'key 5 should buy focus');
  });

  await check('max level shows MAX and cannot be bought', async () => {
    await S(p, () => { __ps.state.levels.radius = 12; __ps.state.matter = 1e12; __ps.state.lifetime = 1e12; __ps.refresh(); });
    await p.waitForTimeout(250);
    const txt = await p.textContent('.card >> nth=0');
    assert(/MAX/.test(txt), 'MAX label');
    assert(/12\/12/.test(txt), 'level label');
    const m = await S(p, () => __ps.state.matter);
    await p.click('.card >> nth=0', { force: true });
    assert((await S(p, () => __ps.state.matter)) === m, 'spent matter on a maxed upgrade');
  });

  await check('buy-mode Max buys many levels at once', async () => {
    await S(p, () => { __ps.state.levels.drones = 0; __ps.state.matter = 1e6; __ps.refresh(); });
    await p.click('.buy-mode button[data-mode="0"]');
    await p.click('.card >> nth=2');
    const l = await S(p, () => __ps.state.levels.drones);
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

  await check('first-upgrade goal is remembered after reload', async () => {
    await S(p, () => __ps.save());
    await p.reload();
    await p.waitForTimeout(300);
    assert(/Next sector/.test(await p.textContent('#ms-text')), await p.textContent('#ms-text'));
    assert(await S(p, () => document.getElementById('hint').classList.contains('hide')), 'stale first-run hint visible');
  });

  await check('progress survives a refresh', async () => {
    await S(p, () => __ps.save());
    const before = await S(p, () => JSON.stringify(__ps.state.levels));
    await p.reload();
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
    await p.reload();
    await p.waitForTimeout(300);
    assert((await S(p, () => __ps.state.stardust)) === expected, 'stardust persisted');
  });

  await check('away income: capped at 2 h, paid once, survives refresh without repeating', async () => {
    await S(p, () => { __ps.state.levels.drones = 10; __ps.refresh(); __ps.save(); });
    const rate = await S(p, () => __ps.stats.dronePerSec * __ps.stats.offlineRate);
    await S(p, () => {
      __ps.freeze();
      const raw = JSON.parse(localStorage.getItem('pocket-singularity:save'));
      raw.lastSeen = Date.now() - 5 * 3600e3;
      localStorage.setItem('pocket-singularity:save', JSON.stringify(raw));
    });
    const m0 = await S(p, () => JSON.parse(localStorage.getItem('pocket-singularity:save')).matter);
    await p.reload();
    await p.waitForSelector('#modal:not([hidden])');
    assert(/Welcome back/.test(await p.textContent('#modal-title')), 'welcome modal');
    await shot(p, '907-welcome-back');
    const gained = (await S(p, () => __ps.state.matter)) - m0;
    const cap = rate * 7200;
    assert(gained >= cap * 0.99 && gained <= cap * 1.02 + 50, 'gained ' + gained + ' cap ' + cap);
    await p.click('#modal-actions .btn.primary');
    await S(p, () => __ps.save());
    const m1 = await S(p, () => __ps.state.matter);
    await p.reload();
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
    await p.reload();
    await p.waitForTimeout(300);
    assert(await p.isHidden('#modal'), 'no modal');
    const m1 = await S(p, () => __ps.state.matter);
    assert(m1 - m0 < 1e-6 * m0 + 100, 'gained ' + (m1 - m0));
  });

  await check('corrupted save fails safely and restores the backup', async () => {
    const life = await S(p, () => { __ps.save(); localStorage.setItem('pocket-singularity:backup', localStorage.getItem('pocket-singularity:save')); return __ps.state.lifetime; });
    await S(p, () => { __ps.freeze(); localStorage.setItem('pocket-singularity:save', '{"v":1,"matter":12,,,garbage'); });
    await p.reload();
    await p.waitForTimeout(800);
    const restored = await S(p, () => __ps.state.lifetime);
    assert(Math.abs(restored - life) / life < 0.01, 'backup not restored');
    assert(/backup/i.test(await p.textContent('#toasts')), 'notice toast');
    await S(p, () => { __ps.freeze(); localStorage.setItem('pocket-singularity:save', 'nonsense'); localStorage.setItem('pocket-singularity:backup', 'also nonsense'); });
    await p.reload();
    await p.waitForTimeout(400);
    assert((await S(p, () => __ps.state.lifetime)) >= 0, 'fresh start');
    assert(await p.isVisible('#btn-pulse'));
  });

  await check('mute and reduced motion persist', async () => {
    await p.click('#btn-sound');
    await p.click('#btn-settings');
    await p.click('[data-set="motion"]');
    await p.keyboard.press('Escape');
    await p.reload();
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

  await check('capsules: hatch ×1 spends tickets, reveals a critter, adds it to the collection', async () => {
    await S(p, () => { __ps.state.tickets = 200; });
    await p.click('.tab[data-tab="capsules"]');
    await p.waitForSelector('#tab-capsules:not([hidden])');
    assert(/Common/.test(await p.textContent('#odds')) && /Legendary/.test(await p.textContent('#odds')), 'odds shown');
    const before = await S(p, () => ({ t: __ps.state.tickets, n: __ps.state.gacha.pulls }));
    await p.click('#pull1');
    await p.waitForSelector('#modal:not([hidden]) .hatch');
    await p.waitForSelector('.crit-big', { timeout: 4000 });
    await shot(p, '907-hatch');
    const after = await S(p, () => ({ t: __ps.state.tickets, n: __ps.state.gacha.pulls, owned: Object.keys(__ps.state.critters).length }));
    // Costs 10; a Legendary discovery can hand 2 straight back.
    assert(before.t - after.t <= 10 && before.t - after.t >= 8, 'ticket cost ' + (before.t - after.t));
    assert(after.n === before.n + 1 && after.owned >= 1, JSON.stringify(after));
    await p.click('#modal-actions .btn.primary');
    assert(await p.isHidden('#modal'));
    assert((await p.locator('.crit:not(.locked)').count()) >= 1, 'collection shows the critter');
  });

  await check('capsules: hatch ×10 can be skipped and gives ten results with a Rare+', async () => {
    await S(p, () => { __ps.state.tickets = 200; });
    const n0 = await S(p, () => __ps.state.gacha.pulls);
    await p.click('#pull10');
    await p.waitForSelector('#modal:not([hidden]) .multi');
    await p.click('#modal-actions .btn');   // Skip
    await p.waitForSelector('#modal-actions .btn.primary');
    assert((await p.locator('.multi .cell img').count()) === 10, 'ten reveals');
    assert((await p.locator('.multi .cell.ra1, .multi .cell.ra2, .multi .cell.ra3').count()) >= 1, 'a Rare or better');
    assert((await S(p, () => __ps.state.gacha.pulls)) === n0 + 10);
    await shot(p, '907-hatch10');
    await p.keyboard.press('Escape');
  });

  await check('capsules: daily gift pays once per day and survives reload', async () => {
    await S(p, () => { __ps.state.dailyGift = ''; __ps.setTab('capsules'); });
    await p.waitForSelector('#daily:not([hidden])');
    const t0 = await S(p, () => __ps.state.tickets);
    await p.click('#daily');
    assert((await S(p, () => __ps.state.tickets)) - t0 === 30, 'daily amount');
    assert(await p.isHidden('#daily'), 'button hides after claiming');
    await S(p, () => __ps.save());
    await p.reload(); await p.waitForTimeout(300);
    await S(p, () => __ps.setTab('capsules'));
    assert(await p.isHidden('#daily'), 'still claimed after reload');
    await S(p, () => __ps.setTab('upgrades'));
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

  await check('owned critters orbit Singu', async () => {
    const n = await S(p, () => Object.keys(__ps.state.critters).length);
    assert(n >= 1, 'no critters');
    await shot(p, '907-pets');
  });

  await check('object counts stay bounded during a long busy session', async () => {
    await S(p, () => { const st = __ps.state; st.levels.density = 20; st.levels.radius = 12; __ps.refresh(); });
    for (let i = 0; i < 30; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(120); }
    const n = await S(p, () => ({ f: __ps.world.frags.length, r: __ps.world.rings.length, g: __ps.world.groups.length, cap: __ps.stats.cap, dom: document.getElementsByTagName('*').length }));
    assert(n.f <= n.cap + 30 && n.r < 20 && n.g < 20, JSON.stringify(n));
    assert(n.dom < 400, 'DOM nodes ' + n.dom);
  });
  await p.context().close();

  // Fullscreen 16:9 --------------------------------------------------------------
  p = await page({ viewport: { width: 1920, height: 1080 } });
  await p.goto(URL);
  await p.waitForTimeout(400);
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
  await check('phone portrait: tap pulses, playfield before shop, no horizontal scroll', async () => {
    await p.touchscreen.tap(195, 260);
    await p.waitForFunction(() => __ps.state.stats.pulses === 1, null, { timeout: 2000 });
    const o = await S(p, () => {
      const u = document.getElementById('universe').getBoundingClientRect();
      const s = document.getElementById('shop').getBoundingClientRect();
      const b = document.getElementById('btn-pulse').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, w: innerWidth, h: innerHeight, u: u.top, s: s.top, bb: b.bottom, uh: u.height };
    });
    assert(o.sw <= o.w, 'horizontal overflow');
    assert(o.u < o.s, 'playfield must come before the shop');
    assert(o.bb <= o.h, 'pulse button off-screen');
    assert(o.uh >= 280, 'playfield too small: ' + o.uh);
    await p.waitForTimeout(500);
    await shot(p, '390-portrait');
  });
  await check('phone portrait: pulse button tap and shop tap both work', async () => {
    await p.waitForTimeout(400);
    await p.tap('#btn-pulse');
    await p.waitForTimeout(100);
    assert((await S(p, () => __ps.state.stats.pulses)) === 2);
    await S(p, () => { __ps.state.matter = 100; });
    await p.tap('.card >> nth=0');
    assert((await S(p, () => __ps.state.levels.radius)) === 1);
  });
  await check('phone portrait: capsules tab works by touch', async () => {
    await S(p, () => { __ps.state.tickets = 50; });
    await p.tap('.tab[data-tab="capsules"]');
    await p.waitForSelector('#tab-capsules:not([hidden])');
    await p.tap('#pull1');
    await p.waitForSelector('.crit-big', { timeout: 4000 });
    await shot(p, '390-hatch');
    await p.tap('#modal-actions .btn.primary');
    assert(await p.isHidden('#modal'));
    await shot(p, '390-capsules');
  });
  await p.context().close();

  p = await page({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await p.goto(URL);
  await p.waitForTimeout(400);
  await check('phone landscape: everything reachable', async () => {
    const o = await S(p, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, b: document.getElementById('btn-pulse').getBoundingClientRect().bottom, h: innerHeight }));
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
