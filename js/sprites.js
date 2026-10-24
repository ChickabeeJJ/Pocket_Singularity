/* Pocket Singularity — pixel art.
 * Palette, hand-made sprites as character grids, and a small generator for the critters.
 * Every sprite is rendered once to a canvas and reused (for the game canvas and as DOM <img> icons).
 */
(function (root) {
  'use strict';

  // Sweetie 16 (GrafxKid) plus a blush pink, a lavender and a deep night tone.
  const PAL = {
    '0': '#1a1c2c', '1': '#5d275d', '2': '#b13e53', '3': '#ef7d57', '4': '#ffcd75', '5': '#a7f070',
    '6': '#38b764', '7': '#257179', '8': '#29366f', '9': '#3b5dc9', 'a': '#41a6f6', 'b': '#73eff7',
    'c': '#f4f4f4', 'd': '#94b0c2', 'e': '#566c86', 'f': '#333c57', 'p': '#ffa8c5', 'v': '#a884f3',
    'w': '#6b4fb8', 'k': '#0b0b16'
  };

  // Hand-made sprites. '.' is transparent; other characters index PAL.
  const ART = {
    dust: [
      '.ddd.',
      'dccdd',
      'ddddd',
      'edddd',
      '.eee.'
    ],
    dust2: [
      '.ddd.',
      'dcddd',
      'ddddd',
      'eddde',
      '.eee.'
    ],
    ice: [
      '..77..',
      '.7bb7.',
      '7bccb7',
      '7bbba7',
      '.7aa7.',
      '..77..'
    ],
    crystal: [
      '...4...',
      '..4c4..',
      '.44c44.',
      '4444443',
      '.34443.',
      '..343..',
      '...3...'
    ],
    crystal2: [
      '...4...',
      '..444..',
      '.4c444.',
      '4c44443',
      '.34443.',
      '..343..',
      '...3...'
    ],
    shard: [
      '..222..',
      '.23432.',
      '2334332',
      '2344432',
      '2334332',
      '.23332.',
      '..222..'
    ],
    shard2: [
      '..222..',
      '.23332.',
      '2344432',
      '234c432',
      '2344432',
      '.23332.',
      '..222..'
    ],
    cometHead: [
      '.444.',
      '4ccc4',
      '4ccc4',
      '4ccc4',
      '.444.'
    ],
    drone: [
      '.5.',
      '565',
      '6.6'
    ],
    ticket: [
      '.4444444444.',
      '443333c33344',
      '.4333ccc334.',
      '443333c33344',
      '.4444444444.'
    ],
    stardust: [
      '...v...',
      '...v...',
      '..vcv..',
      'vvcccvv',
      '..vcv..',
      '...v...',
      '...v...'
    ],
    matter: [
      '.aaa.',
      'abcaa',
      'aaaa9',
      'aaa99',
      '.999.'
    ],
    star: [
      '...4...',
      '...4...',
      '..444..',
      '4444444',
      '.44444.',
      '.44.44.',
      '.4...4.'
    ],
    singu: [
      '....bbbb....',
      '..bbkkkkbb..',
      '.bkkkkkkkkb.',
      '.bkkkkkkkkb.',
      'bkkcckkcckkb',
      'bkkckkkckkkb',
      'bkpkkkkkkpkb',
      'bkkkkppkkkkb',
      '.bkkkkkkkkb.',
      '.bkkkkkkkkb.',
      '..bbkkkkbb..',
      '....bbbb....'
    ],
    comet: [
      '............',
      '.3..........',
      '..3.........',
      '...33.......',
      '....344.....',
      '.....3444...',
      '......44cc..',
      '.......4ccc.',
      '.......4ccc4',
      '........444.',
      '............',
      '............'
    ],
    // Upgrade icons (12×12).
    up_radius: [
      '....aaaa....',
      '..aa....aa..',
      '.a..bbbb..a.',
      '.a.b....b.a.',
      'a.b..kk..b.a',
      'a.b.kkkk.b.a',
      'a.b.kkkk.b.a',
      'a.b..kk..b.a',
      '.a.b....b.a.',
      '.a..bbbb..a.',
      '..aa....aa..',
      '....aaaa....'
    ],
    up_density: [
      '............',
      '.dd.....b...',
      '.dd...bbb...',
      '......bbb...',
      '...4........',
      '..444...dd..',
      '...4....dd..',
      '.b..........',
      'bbb....33...',
      '.b....3333..',
      '.......33...',
      '............'
    ],
    up_drones: [
      '............',
      '.....55.....',
      '....5665....',
      '.e..5665..e.',
      '.eeee66eeee.',
      '.e..6666..e.',
      '.....66.....',
      '....6..6....',
      '...6....6...',
      '............',
      '..b......b..',
      '............'
    ],
    up_resonance: [
      '............',
      '............',
      '.v.......v..',
      'v.v.....v.v.',
      'v..v...v...v',
      '....v.v.....',
      '.....v......',
      '..p.....p...',
      '.p.p...p.p..',
      'p...p.p...p.',
      '.....p......',
      '............'
    ],
    up_focus: [
      '.....4......',
      '....444.....',
      '...4c444....',
      '..4c44443...',
      '.444444433..',
      '44444444333.',
      '.3444443333.',
      '..34443333..',
      '...343333...',
      '....3333....',
      '.....33.....',
      '............'
    ],
    up_luck: [
      '............',
      '..66....66..',
      '.6556..6556.',
      '.6555665556.',
      '..65555556..',
      '...655556...',
      '..65555556..',
      '.6555665556.',
      '.6556..6556.',
      '..66.66.66..',
      '.....6......',
      '....6.......'
    ],
    // Capsule machine (24×28), drawn for the gacha panel.
    machine: [
      '......00000000000.......',
      '.....0ccccccccccc0......',
      '....0cbbbbbbbbbbbc0.....',
      '....0cb.p..4..a.bc0.....',
      '....0cb..2...v..bc0.....',
      '....0cb.4..a..p.bc0.....',
      '....0cb..v..2...bc0.....',
      '....0cb.a..p..4.bc0.....',
      '....0cbbbbbbbbbbbc0.....',
      '....0ccccccccccccc0.....',
      '...00000000000000000....',
      '...02222222222222220....',
      '...02333333333333320....',
      '...02330000000003320....',
      '...023300ccc4ccc0320....',
      '...02330c44444c03320....',
      '...02330ccc4ccc03320....',
      '...02330000000003320....',
      '...02333333333333320....',
      '...02333330003333320....',
      '...02333330c03333320....',
      '...02333330003333320....',
      '...02222222222222220....',
      '...00000000000000000....',
      '....0f0.........0f0.....',
      '....0f0.........0f0.....',
      '...00000.......00000....'
    ]
  };

  // ---------------------------------------------------------------------------
  // Critter generator: body + ears + extras, then auto outline and shading.
  // ---------------------------------------------------------------------------
  const CRITTER_LOOKS = {
    mouse:   { body: 'round', c: ['d', 'e'], ears: 'round', earC: 'p', snout: 'p' },
    pup:     { body: 'round', c: ['3', '2'], ears: 'droop', muzzle: true, tongue: true },
    bun:     { body: 'round', c: ['v', 'w'], ears: 'long', earC: 'p' },
    snail:   { body: 'low', c: ['5', '6'], extra: 'shell', antenna: true },
    cat:     { body: 'round', c: ['a', '9'], ears: 'pointy', extra: 'startail' },
    penguin: { body: 'tall', c: ['f', '0'], belly: 'c', beak: true, feet: true },
    frog:    { body: 'wide', c: ['5', '6'], ears: 'bulge', extra: 'clover', mouth: 'wide' },
    owl:     { body: 'tall', c: ['3', '2'], ears: 'tufts', belly: '4', bigEyes: true },
    jelly:   { body: 'dome', c: ['p', 'v'], extra: 'tentacles' },
    fox:     { body: 'round', c: ['3', '2'], ears: 'pointy', belly: 'c', extra: 'foxtail', mask: true },
    crab:    { body: 'wide', c: ['2', '1'], extra: 'claws', antenna: true },
    dragon:  { body: 'round', c: ['4', '3'], ears: 'horns', extra: 'wings', belly: 'c', crown: true },
    whale:   { body: 'wide', c: ['9', '8'], belly: 'b', extra: 'spout', crown: true }
  };

  function critterGrid(id) {
    const L = CRITTER_LOOKS[id];
    const N = 18;
    const g = [];
    for (let y = 0; y < N; y++) g.push(new Array(N).fill('.'));
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : '.');
    const base = L.c[0], shade = L.c[1];
    // Body ellipse.
    const shapes = { round: [9, 11, 6.2, 5.6], tall: [9, 10.5, 5.2, 6.4], wide: [9, 11.5, 7.4, 4.8], low: [8, 12.5, 6.4, 3.6], dome: [9, 9.5, 6.4, 5.2] };
    const [cx, cy, rx, ry] = shapes[L.body];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (L.body === 'dome' && y + 0.5 > cy) dy *= 2.6;
      if (dx * dx + dy * dy <= 1) set(x, y, (dx * 0.6 + dy * 0.8 > 0.55) ? shade : base);
    }
    const top = Math.ceil(cy - ry);
    // Ears.
    const ear = L.earC || base;
    if (L.ears === 'round') { for (const ex of [cx - 5, cx + 4]) { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(x === 1 && y === 1)) set(Math.round(ex) + x, top - 2 + y, base); set(Math.round(ex) + 1, top - 1, ear); } }
    if (L.ears === 'pointy') { for (const [ex, d] of [[cx - 5, 1], [cx + 4, -1]]) { const x0 = Math.round(ex); for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) set(x0 + (d > 0 ? j : 2 - j), top - 2 + i, base); set(x0 + 1, top, ear !== base ? ear : 'p'); } }
    if (L.ears === 'long') { for (const ex of [cx - 3, cx + 2]) { const x0 = Math.round(ex); for (let y = top - 6; y < top + 1; y++) { set(x0, y, base); set(x0 + 1, y, base); } for (let y = top - 5; y < top; y++) set(x0 + (ex < cx ? 1 : 0), y, ear); } }
    if (L.ears === 'droop') { for (const ex of [cx - 7, cx + 5]) { const x0 = Math.round(ex); for (let y = top + 1; y < top + 6; y++) { set(x0, y, shade); set(x0 + 1, y, shade); } } }
    if (L.ears === 'bulge') { for (const ex of [cx - 5, cx + 2]) { const x0 = Math.round(ex); for (let y = top - 2; y < top + 1; y++) for (let x = 0; x < 4; x++) if (!((y === top - 2) && (x === 0 || x === 3))) set(x0 + x, y, base); set(x0 + 1, top - 1, 'c'); set(x0 + 2, top - 1, 'k'); } }
    if (L.ears === 'tufts') { set(Math.round(cx - 4), top - 1, shade); set(Math.round(cx - 5), top - 2, shade); set(Math.round(cx + 3), top - 1, shade); set(Math.round(cx + 4), top - 2, shade); }
    if (L.ears === 'horns') { for (const [x0, d] of [[Math.round(cx - 4), -1], [Math.round(cx + 3), 1]]) { set(x0, top - 1, 'c'); set(x0 + d, top - 2, 'c'); set(x0 + d, top - 3, 'd'); } }
    if (L.antenna) { set(Math.round(cx - 3), top - 1, 'e'); set(Math.round(cx - 3), top - 2, 'e'); set(Math.round(cx - 3), top - 3, '4'); set(Math.round(cx + 2), top - 1, 'e'); set(Math.round(cx + 2), top - 2, 'e'); set(Math.round(cx + 2), top - 3, '4'); }
    if (L.crown) { const y = top - (L.ears === 'horns' ? 1 : 1); for (let x = -2; x <= 1; x++) set(Math.round(cx) + x, y, '4'); set(Math.round(cx) - 2, y - 1, '4'); set(Math.round(cx) + 1, y - 1, '4'); set(Math.round(cx) - 1, y - 1, 'p'); }
    // Belly.
    if (L.belly) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - cx) / (rx * 0.55), dy = (y + 0.5 - (cy + ry * 0.35)) / (ry * 0.55);
      if (dx * dx + dy * dy <= 1 && get(x, y) !== '.') set(x, y, L.belly);
    }
    // Extras.
    const ex = L.extra;
    if (ex === 'shell') { const sx = Math.round(cx + 2), sy = Math.round(cy - 3); for (let y = -4; y <= 3; y++) for (let x = -4; x <= 4; x++) { if (x * x + y * y * 1.2 <= 17) set(sx + x, sy + y, (x * x + y * y < 5) ? 'b' : (x + y) % 3 === 0 ? '7' : 'a'); } set(sx, sy, 'c'); }
    if (ex === 'startail') { const x0 = Math.round(cx + rx); const y0 = Math.round(cy); set(x0, y0, base); set(x0 + 1, y0 - 1, base); set(x0 + 2, y0 - 2, '4'); set(x0 + 1, y0 - 2, '4'); set(x0 + 3, y0 - 2, '4'); set(x0 + 2, y0 - 3, '4'); set(x0 + 2, y0 - 1, '4'); }
    if (ex === 'foxtail') { const x0 = Math.round(cx + rx - 1), y0 = Math.round(cy + 1); for (let i = 0; i < 4; i++) { set(x0 + i, y0 - i, base); set(x0 + i, y0 - i + 1, base); } set(x0 + 3, y0 - 3, 'c'); set(x0 + 4, y0 - 4, 'c'); }
    if (ex === 'clover') { const x0 = Math.round(cx + 4), y0 = top - 2; set(x0, y0, '6'); set(x0 + 1, y0, '6'); set(x0, y0 + 1, '6'); set(x0 + 1, y0 + 1, '6'); set(x0 + 2, y0 + 2, '6'); }
    if (ex === 'tentacles') { for (let i = 0; i < 4; i++) { const x0 = Math.round(cx - 4 + i * 2.6); for (let y = Math.round(cy + 1); y < Math.round(cy + 6); y++) set(x0 + ((y + i) % 2), y, y % 2 ? shade : base); } }
    if (ex === 'claws') { for (const [x0, d] of [[Math.round(cx - rx - 1), -1], [Math.round(cx + rx), 1]]) { set(x0, Math.round(cy) - 1, base); set(x0 + d, Math.round(cy) - 2, base); set(x0, Math.round(cy) - 3, base); set(x0 + d, Math.round(cy) - 3, base); set(x0, Math.round(cy) - 2, '.'); } }
    if (ex === 'wings') { for (const [x0, d] of [[Math.round(cx - rx), -1], [Math.round(cx + rx - 1), 1]]) { for (let i = 0; i < 3; i++) { set(x0 + d * i, Math.round(cy) - 2 - i, '3'); set(x0 + d * i, Math.round(cy) - 1 - i, '2'); } } }
    if (ex === 'spout') { const x0 = Math.round(cx); set(x0, top - 1, 'b'); set(x0, top - 2, 'b'); set(x0 - 1, top - 3, 'b'); set(x0 + 1, top - 3, 'b'); set(x0 - 2, top - 4, 'b'); set(x0 + 2, top - 4, 'b'); }
    // Face.
    const ey = Math.round(cy - (L.body === 'tall' ? 2 : 1));
    const e1 = Math.round(cx - 3), e2 = Math.round(cx + 2);
    if (L.mask) { for (let x = e1 - 1; x <= e2 + 1; x++) if (get(x, ey) !== '.') set(x, ey, '2'); }
    for (const exx of [e1, e2]) {
      if (L.bigEyes) { set(exx - 1, ey - 1, 'c'); set(exx, ey - 1, 'c'); set(exx - 1, ey, 'c'); set(exx, ey, 'k'); }
      else { set(exx, ey, 'k'); set(exx, ey + 1, 'k'); set(exx, ey - 0, 'k'); }
      if (!L.bigEyes) set(exx, ey, 'c');
    }
    // Pupils below the highlight so eyes read as shiny.
    if (!L.bigEyes) { set(e1, ey + 1, 'k'); set(e2, ey + 1, 'k'); set(e1, ey + 2, get(e1, ey + 2) === '.' ? '.' : get(e1, ey + 2)); }
    const my = ey + 3;
    if (L.beak) { set(Math.round(cx) - 1, ey + 2, '4'); set(Math.round(cx), ey + 2, '4'); set(Math.round(cx) - 1, ey + 3, '3'); set(Math.round(cx), ey + 3, '3'); }
    else if (L.mouth === 'wide') { for (let x = e1; x <= e2; x++) set(x, my, x === e1 || x === e2 ? shade : 'k'); }
    else { set(Math.round(cx) - 1, my - 1, 'k'); set(Math.round(cx), my - 1, 'k'); if (L.tongue) set(Math.round(cx), my, 'p'); }
    if (L.snout) set(Math.round(cx) - 1, my - 2, L.snout);
    if (L.muzzle) { set(Math.round(cx) - 2, my - 1, 'c'); set(Math.round(cx) + 1, my - 1, 'c'); }
    // Blush.
    if (get(e1 - 1, ey + 2) !== '.') set(e1 - 1, ey + 2, 'p');
    if (get(e2 + 1, ey + 2) !== '.') set(e2 + 1, ey + 2, 'p');
    if (L.feet) { set(Math.round(cx) - 3, Math.round(cy + ry), '3'); set(Math.round(cx) - 2, Math.round(cy + ry), '3'); set(Math.round(cx) + 1, Math.round(cy + ry), '3'); set(Math.round(cx) + 2, Math.round(cy + ry), '3'); }
    // Highlight.
    const hx = Math.round(cx - rx * 0.55), hy = Math.round(cy - ry * 0.6);
    if (get(hx, hy) === base) set(hx, hy, 'c');
    return outline(g.map((r) => r.join('')));
  }

  // Adds a dark outline around every opaque pixel.
  function outline(rows) {
    const h = rows.length, w = rows[0].length;
    const out = rows.map((r) => r.split(''));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (rows[y][x] !== '.') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        return xx >= 0 && yy >= 0 && xx < w && yy < h && rows[yy][xx] !== '.' && rows[yy][xx] !== '0';
      });
      if (n) out[y][x] = '0';
    }
    return out.map((r) => r.join(''));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const cache = {};
  function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function render(rows, tint) {
    const h = rows.length, w = Math.max.apply(null, rows.map((r) => r.length));
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = tint || PAL[ch] || '#ff00ff';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  function get(name) {
    if (cache[name]) return cache[name];
    let rows;
    if (name.indexOf('critter_') === 0) rows = critterGrid(name.slice(8));
    else if (name.indexOf('shadow_') === 0) {
      cache[name] = render(get(name.slice(7)).__rows, '#333c57');
      return cache[name];
    } else rows = ART[name];
    if (!rows) throw new Error('unknown sprite ' + name);
    const c = render(rows);
    c.__rows = rows;
    cache[name] = c;
    return c;
  }

  // Data URL of a sprite scaled up by an integer, for crisp DOM icons.
  const urlCache = {};
  function url(name, scale) {
    const key = name + '@' + (scale || 1);
    if (urlCache[key]) return urlCache[key];
    const src = get(name);
    const s = scale || 1;
    const c = makeCanvas(src.width * s, src.height * s);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    urlCache[key] = c.toDataURL();
    return urlCache[key];
  }

  function img(name, scale, cls) {
    const s = get(name);
    const k = scale || 2;
    return '<img class="px ' + (cls || '') + '" src="' + url(name, 1) + '" width="' + s.width * k + '" height="' + s.height * k + '" alt="">';
  }

  root.PSSprites = { PAL: PAL, ART: ART, LOOKS: CRITTER_LOOKS, critterGrid: critterGrid, get: get, url: url, img: img, outline: outline };
})(typeof globalThis !== 'undefined' ? globalThis : this);
