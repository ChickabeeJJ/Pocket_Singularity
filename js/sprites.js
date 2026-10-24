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
      '.bkkk1kkkkb.',
      '.bk1kkkkwkb.',
      'bkkkkwkkkkkb',
      '43bkkkk1kb34',
      '443333333344',
      '.b44444444b.',
      '.bkkkkkkkkb.',
      '..bbkkkkbb..',
      '....bbbb....',
      '............'
    ],
    capsule: [
      '..000..',
      '.0ppp0.',
      '0ppcpp0',
      '0ppppp0',
      '0000000',
      '0ccccc0',
      '.0ccc0.',
      '..000..'
    ],
    gift: [
      '..0...0..',
      '.020.020.',
      '..02020..',
      '000000000',
      '022242220',
      '000040000',
      '.0334330.',
      '.0334330.',
      '.0334330.',
      '.0000000.'
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
    // Star Reel comet: head in the middle so it sits centred in a reel slot.
    reelComet: [
      '............',
      '.3..........',
      '..33........',
      '...344......',
      '....4444....',
      '...44ccc4...',
      '...4ccccc4..',
      '...4ccccc4..',
      '...4ccccc4..',
      '....4ccc4...',
      '.....444....',
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
  // Colour helpers (hue-shifted shading: highlights warm up, shadows cool down)
  // ---------------------------------------------------------------------------
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgbHex(r) { return '#' + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function tones(base) {
    return {
      base: base,
      light: mix(base, '#fff6dc', 0.38),
      spec: mix(base, '#ffffff', 0.75),
      dark: mix(base, '#3a2a6e', 0.38),
      deep: mix(base, '#1a1030', 0.62),
      belly: mix(base, '#fffdf6', 0.62)
    };
  }

  // ---------------------------------------------------------------------------
  // Painter: a tiny pixel canvas with shaded shapes and a selective outline.
  // ---------------------------------------------------------------------------
  function Painter(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  Painter.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; };
  Painter.prototype.get = function (x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.p[y * this.w + x] : null; };
  Painter.prototype.rect = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); };
  // Fills an ellipse; `c` is a colour or a function (nx, ny, x, y) -> colour, with nx/ny in -1..1.
  Painter.prototype.ell = function (cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'function' ? c(nx, ny, x, y) : c);
    }
  };
  // Ellipse lit from the top-left: highlight, base, shadow, plus a specular glint.
  Painter.prototype.ball = function (cx, cy, rx, ry, T, opts) {
    opts = opts || {};
    this.ell(cx, cy, rx, ry, function (nx, ny) {
      const l = -(nx * 0.55 + ny * 0.85);
      if (opts.flatBottom && ny > 0.55) return T.dark;
      return l > 0.5 ? T.light : l < -0.45 ? T.dark : T.base;
    });
    if (!opts.noSpec) { this.set(cx - rx * 0.45, cy - ry * 0.55, T.spec); this.set(cx - rx * 0.45 + 1, cy - ry * 0.55, T.light); }
  };
  Painter.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  Painter.prototype.tri = function (ax, ay, bx, by, cx, cy, c) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };
  // Selective outline: each edge pixel takes a dark version of the colour it borders.
  Painter.prototype.outline = function (ink) {
    const out = this.p.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      let n = null;
      for (const d of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const c = this.get(x + d[0], y + d[1]); if (c) { n = c; break; } }
      if (n) out[y * this.w + x] = mix(n, ink || '#140c26', 0.68);
    }
    this.p = out;
  };
  Painter.prototype.canvas = function () {
    const c = makeCanvas(this.w, this.h);
    const g = c.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const v = this.p[y * this.w + x]; if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); } }
    return c;
  };

  const INK = '#1a1c2c', PINK = '#ff8fb1', BEAK = '#ffa34d', GOLD = '#ffcd4d', WHITE = '#fffdf6';

  // ---------------------------------------------------------------------------
  // Pets: 25 species painted from parts, recoloured per pet.
  // ---------------------------------------------------------------------------
  function eyes(P, cx, ey, gap, big) {
    for (const s of [-1, 1]) {
      const x = cx + s * gap - (big ? 1 : 0) - (s < 0 ? 1 : 0);
      if (big) { P.ell(x + 1, ey + 0.5, 2.2, 2.4, WHITE); P.rect(x, ey - 1, 2, 3, INK); P.set(x, ey - 1, WHITE); }
      else { P.rect(x, ey - 1, 2, 3, INK); P.set(x, ey - 1, WHITE); }
    }
  }
  function cheeks(P, cx, y, gap) { P.set(cx - gap - 2, y, PINK); P.set(cx - gap - 1, y, PINK); P.set(cx + gap + 1, y, PINK); P.set(cx + gap + 2, y, PINK); }
  function smile(P, cx, y) { P.set(cx - 1, y, INK); P.set(cx, y + 1, INK); P.set(cx + 1, y, INK); }
  function feet(P, cx, y, T, gap) { P.ell(cx - (gap || 3), y, 2, 1.3, T.dark); P.ell(cx + (gap || 3), y, 2, 1.3, T.dark); }

  const SPECIES = {
    mouse: function (P, T, R) { P.ball(6, 7, 3.4, 3.4, T); P.ell(6, 7, 1.7, 1.7, PINK); P.ball(18, 7, 3.4, 3.4, T); P.ell(18, 7, 1.7, 1.7, PINK); R.body(); P.line(19, 19, 22, 16, PINK); P.set(12, R.ey + 2, PINK); R.face(); },
    pup: function (P, T, R) { R.body(); P.ell(5.5, 11, 2, 4, T.dark); P.ell(18.5, 11, 2, 4, T.dark); P.ell(15, 12, 2.6, 2.3, T.dark); P.ell(12, R.ey + 3, 2.6, 1.8, T.belly); P.set(12, R.ey + 2, INK); R.face({ tongue: true }); },
    bun: function (P, T, R) { P.ell(9, 5, 2, 5.5, T.base); P.ell(9, 5, 0.9, 4, PINK); P.ell(15, 5, 2, 5.5, T.base); P.ell(15, 5, 0.9, 4, PINK); R.body(); P.set(12, R.ey + 2, PINK); R.face(); },
    snail: function (P, T, R) {
      R.body({ cy: 17, rx: 9, ry: 4.5 });
      const S = tones(mix(T.base, '#ffb36b', 0.55));
      P.ball(15, 11, 6, 6, S);
      for (let a = 0; a < 12; a += 0.35) { const r = 0.4 * a; P.set(15 + Math.cos(a) * r, 11 + Math.sin(a) * r, S.deep); }
      P.line(6, 14, 5, 9, T.dark); P.line(9, 14, 9, 9, T.dark); P.set(5, 8, INK); P.set(9, 8, INK); P.set(5, 7, WHITE); P.set(9, 7, WHITE);
      smile(P, 7, 16); P.set(5, 16, PINK); P.set(10, 16, PINK);
    },
    chick: function (P, T, R) { R.body({ cy: 15, rx: 7, ry: 6.5 }); P.ell(4.5, 15, 1.6, 2.6, T.dark); P.ell(19.5, 15, 1.6, 2.6, T.dark); P.line(12, 8, 11, 6, T.dark); P.line(12, 8, 13, 6, T.dark); P.tri(11, R.ey + 2, 13, R.ey + 2, 12, R.ey + 4, BEAK); R.face({ mouth: false }); feet(P, 12, 21.5, { dark: BEAK }); },
    duck: function (P, T, R) { R.body(); P.line(11, 6, 12, 4, T.dark); P.ell(12, R.ey + 3, 3.2, 1.4, BEAK); P.set(12, R.ey + 3, mix(BEAK, INK, 0.4)); R.face({ mouth: false }); feet(P, 12, 21.5, { dark: BEAK }); },
    slime: function (P, T, R) {
      P.ell(12, 15, 9, 7.5, function (nx, ny) { if (ny > 0.55) return T.dark; const l = -(nx * 0.5 + ny * 0.85); return l > 0.45 ? T.light : l < -0.4 ? T.dark : T.base; });
      P.rect(3, 19, 19, 3, null);
      P.rect(4, 19, 17, 2, T.dark); P.set(6, 21, T.dark); P.set(17, 21, T.dark);
      P.ell(8, 11, 1.6, 1.2, T.spec); P.set(10, 10, T.spec);
      R.ey = 15; R.face();
    },
    bee: function (P, T, R) { P.ell(5, 8, 3, 2.4, '#dff6ff'); P.ell(19, 8, 3, 2.4, '#dff6ff'); R.body(); for (const y of [16, 19]) for (let x = 5; x < 20; x++) if (P.get(x, y) && P.get(x, y) !== INK) P.set(x, y, T.deep); P.line(10, 7, 8, 3, INK); P.line(14, 7, 16, 3, INK); P.set(8, 3, T.base); P.set(16, 3, T.base); R.face(); },
    frog: function (P, T, R) { R.body({ rx: 9, ry: 6.5, cy: 15 }); P.ball(7.5, 8.5, 3, 3, T); P.ball(16.5, 8.5, 3, 3, T); P.ell(12, 17.5, 5, 2.5, T.belly); R.ey = 9; R.gap = 4.5; R.face({ big: true, mouth: false }); for (let x = 8; x <= 16; x++) P.set(x, 13, x === 8 || x === 16 ? T.dark : INK); },
    turtle: function (P, T, R) {
      const S = tones(mix(T.base, '#7a5a2e', 0.45));
      P.ball(12, 15, 10, 6.8, S);
      for (const [x, y] of [[8, 13], [12, 11], [16, 13], [10, 16], [14, 16]]) P.ell(x, y, 1.6, 1.2, S.light);
      R.body({ cx: 12, cy: 9, rx: 5.5, ry: 5 });
      feet(P, 12, 21.5, T, 6); R.ey = 9; R.gap = 2.5; R.face();
    },
    hamster: function (P, T, R) { P.ball(6, 8, 2.4, 2.4, T); P.ball(18, 8, 2.4, 2.4, T); R.body(); P.ell(7, 15, 3, 2.4, T.belly); P.ell(17, 15, 3, 2.4, T.belly); P.ell(12, 18, 4, 3, T.belly); P.set(12, R.ey + 2, PINK); R.face(); },
    bat: function (P, T, R) {
      const W = tones(mix(T.base, '#2b1f4a', 0.35));
      P.tri(1, 7, 8, 11, 6, 17, W.base); P.tri(23, 7, 16, 11, 18, 17, W.base);
      P.tri(7, 9, 9, 3, 11, 9, T.base); P.tri(13, 9, 15, 3, 17, 9, T.base);
      R.body(); R.face(); P.set(11, R.ey + 4, WHITE); P.set(13, R.ey + 4, WHITE);
    },
    bear: function (P, T, R) { P.ball(6.5, 7.5, 2.8, 2.8, T); P.ell(6.5, 7.5, 1.3, 1.3, T.dark); P.ball(17.5, 7.5, 2.8, 2.8, T); P.ell(17.5, 7.5, 1.3, 1.3, T.dark); R.body(); P.ell(12, R.ey + 3, 2.8, 2, T.belly); P.rect(11, R.ey + 2, 2, 1, INK); R.face({ mouth: false }); },
    panda: function (P, T, R) {
      const K = '#2b2a3a';
      P.ball(6.5, 7.5, 2.8, 2.8, tones(K)); P.ball(17.5, 7.5, 2.8, 2.8, tones(K));
      R.body(); P.ell(8.5, R.ey + 0.5, 2.3, 2.6, K); P.ell(15.5, R.ey + 0.5, 2.3, 2.6, K);
      P.rect(11, R.ey + 2, 2, 1, INK); R.face({ mouth: false, eyeWhite: true }); feet(P, 12, 21.5, tones(K));
    },
    crab: function (P, T, R) {
      P.ball(3.5, 9, 2.8, 2.8, T); P.ball(20.5, 9, 2.8, 2.8, T); P.set(3, 7, null); P.set(20, 7, null);
      for (const s of [-1, 1]) { P.line(12 + s * 7, 18, 12 + s * 10, 21, T.dark); P.line(12 + s * 6, 19, 12 + s * 8, 22, T.dark); }
      R.body({ rx: 8.5, ry: 6, cy: 15 }); P.line(10, 9, 9, 6, T.dark); P.line(14, 9, 15, 6, T.dark);
      R.ey = 13; R.face();
    },
    penguin: function (P, T, R) { R.body({ rx: 7, ry: 8, cy: 13 }); P.ell(12, 15, 4.6, 5.6, WHITE); P.ell(4.5, 14, 1.6, 3.5, T.dark); P.ell(19.5, 14, 1.6, 3.5, T.dark); P.tri(11, R.ey + 2, 13, R.ey + 2, 12, R.ey + 4, BEAK); R.face({ mouth: false }); feet(P, 12, 21.5, { dark: BEAK }); },
    axolotl: function (P, T, R) {
      const G = mix(T.base, '#d0305a', 0.45);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.line(12 + s * 6, 9 + i * 2, 12 + s * 10, 6 + i * 3, G);
      R.body(); P.ell(12, 18, 4, 2.5, T.belly); R.face(); P.line(10, R.ey + 3, 14, R.ey + 3, INK);
    },
    cat: function (P, T, R) { P.tri(5, 10, 7, 3, 11, 8, T.base); P.tri(13, 8, 17, 3, 19, 10, T.base); P.tri(7, 8, 7.5, 5, 9.5, 7.5, PINK); P.tri(14.5, 7.5, 16.5, 5, 17, 8, PINK); P.line(19, 19, 22, 13, T.dark); P.set(22, 12, T.dark); R.body(); P.set(12, R.ey + 2, PINK); R.face(); P.set(4, R.ey + 2, T.dark); P.set(20, R.ey + 2, T.dark); },
    owl: function (P, T, R) { P.tri(5, 9, 6, 3, 9, 7, T.dark); P.tri(15, 7, 18, 3, 19, 9, T.dark); R.body({ rx: 7.5, ry: 8, cy: 13 }); P.ell(12, 17, 4, 3.5, T.belly); for (const x of [10, 12, 14]) P.set(x, 17, T.dark); P.tri(11, R.ey + 2, 13, R.ey + 2, 12, R.ey + 4, BEAK); R.face({ big: true, mouth: false }); },
    fox: function (P, T, R) {
      P.ell(20, 16, 3.5, 4.5, function (nx, ny) { return ny < -0.4 ? WHITE : T.base; });
      P.tri(4, 11, 6, 2, 11, 8, T.base); P.tri(13, 8, 18, 2, 20, 11, T.base); P.tri(6.5, 8, 7, 5, 9, 7.5, T.deep); P.tri(15, 7.5, 17, 5, 17.5, 8, T.deep);
      R.body(); P.ell(12, R.ey + 3, 5, 2.6, WHITE); P.set(12, R.ey + 2, INK); R.face({ mouth: false });
    },
    jelly: function (P, T, R) {
      for (let i = 0; i < 5; i++) { const x = 6 + i * 3; for (let y = 15; y < 23; y++) P.set(x + ((y + i) % 3 === 0 ? 1 : 0), y, i % 2 ? T.light : T.dark); }
      P.ell(12, 12, 9, 7, function (nx, ny) { if (ny > 0.3) return T.dark; const l = -(nx * 0.5 + ny * 0.85); return l > 0.45 ? T.light : T.base; });
      P.rect(2, 15, 21, 4, null); P.rect(3, 14, 19, 1, T.dark);
      for (let i = 0; i < 5; i++) { const x = 6 + i * 3; for (let y = 15; y < 23; y++) P.set(x + ((y + i) % 3 === 0 ? 1 : 0), y, i % 2 ? T.light : T.dark); }
      P.ell(8, 8, 1.5, 1.1, T.spec); R.ey = 10; R.face();
    },
    octopus: function (P, T, R) {
      for (let i = 0; i < 6; i++) { const x0 = 5 + i * 2.8; P.line(x0, 15, x0 + (i < 3 ? -2 : 2), 21, i % 2 ? T.base : T.dark); P.line(x0 + 1, 15, x0 + (i < 3 ? -1 : 3), 21, T.base); }
      R.body({ ry: 7.5, cy: 11 }); for (const [x, y] of [[8, 6], [15, 5], [17, 9]]) P.set(x, y, T.light); R.ey = 11; R.face();
    },
    dragon: function (P, T, R) {
      const W = tones(mix(T.base, '#8a3a5a', 0.35));
      P.tri(1, 6, 7, 10, 5, 15, W.base); P.tri(23, 6, 17, 10, 19, 15, W.base);
      P.line(19, 19, 22, 19, T.dark); P.tri(21, 17, 23, 19, 21, 21, T.dark);
      P.tri(8, 7, 7, 2, 10, 6, '#fff3c4'); P.tri(14, 6, 17, 2, 16, 7, '#fff3c4');
      R.body(); for (const y of [16, 18, 20]) P.line(10, y, 14, y, T.belly); R.face();
    },
    whale: function (P, T, R) {
      for (const [x, y] of [[11, 2], [13, 2], [10, 1], [14, 1], [12, 3], [12, 4]]) P.set(x, y, '#9ff6ff');
      P.tri(18, 13, 23, 9, 23, 17, T.dark);
      R.body({ rx: 9.5, ry: 6.5, cy: 13, cx: 11 }); P.ell(11, 17, 7, 2.2, T.belly); R.ey = 12; R.gap = 3.5; R.cx = 10; R.face();
    },
    unicorn: function (P, T, R) {
      const manes = ['#ff8fb1', '#a884f3', '#73eff7', '#ffcd75'];
      P.tri(6, 10, 7, 4, 10, 8, T.base); P.tri(14, 8, 17, 4, 18, 10, T.base);
      R.body();
      for (let i = 0; i < 4; i++) P.ell(5 + i * 1.2, 9 + i * 2.6, 2, 1.8, manes[i]);
      P.tri(11, 6, 13, 6, 12, 0, GOLD); P.set(12, 3, '#fff3c4'); P.set(11, 5, '#e0a82e');
      P.set(12, R.ey + 2, PINK); R.face();
    }
  };

  function petCanvas(pet) {
    const P = new Painter(24, 24);
    const T = tones(pet.color);
    const R = { cx: 12, cy: 14, rx: 8, ry: 7, ey: 13, gap: 3 };
    R.body = function (o) {
      o = o || {};
      R.cx = o.cx || R.cx; R.cy = o.cy || R.cy; R.rx = o.rx || R.rx; R.ry = o.ry || R.ry;
      P.ball(R.cx, R.cy, R.rx, R.ry, T);
      R.ey = Math.round(R.cy - R.ry * 0.15);
    };
    R.face = function (o) {
      o = o || {};
      eyes(P, R.cx, R.ey, R.gap, o.big);
      cheeks(P, R.cx, R.ey + 2, R.gap + (o.big ? 1 : 0));
      if (o.mouth !== false) smile(P, R.cx, R.ey + 3);
      if (o.tongue) P.set(R.cx, R.ey + 5, PINK);
    };
    SPECIES[pet.species](P, T, R);
    if (pet.species !== 'slime' && pet.species !== 'jelly' && pet.species !== 'octopus' && pet.species !== 'snail' && !P.get(12, 21)) feet(P, R.cx, Math.min(22, R.cy + R.ry), T);
    // Rarity flourishes.
    if (pet.rarity >= 3) {
      const top = (function () { for (let y = 0; y < 24; y++) if (P.get(12, y)) return y; return 4; })();
      const y = Math.max(1, top - 2);
      P.rect(9, y, 7, 2, GOLD); P.set(9, y - 1, GOLD); P.set(12, y - 1, GOLD); P.set(15, y - 1, GOLD); P.set(12, y, '#ff6b8a');
    }
    if (pet.rarity >= 4) { for (const [x, y] of [[2, 3], [21, 4], [3, 19], [21, 20]]) { P.set(x, y, '#ffffff'); P.set(x + 1, y, '#9ff6ff'); P.set(x, y + 1, '#ff9fd8'); } }
    P.outline();
    return P.canvas();
  }

  // ---------------------------------------------------------------------------
  // Capsules and the capsule machine
  // ---------------------------------------------------------------------------
  const RARITY_HEX = ['#9aa8bb', '#3f9bff', '#b17cff', '#ffc23d', '#ff6fd0'];
  function capsuleCanvas(rarity, open) {
    const P = new Painter(18, 20);
    const top = tones(RARITY_HEX[rarity]);
    const bot = tones('#f3efe6');
    const lift = open ? 4 : 0;
    P.ell(9, 11, 7.5, 7.5, function (nx, ny, x, y) {
      const l = -(nx * 0.55 + ny * 0.85);
      if (ny < 0) {
        if (rarity === 4) { const band = Math.floor((x + y) / 2) % 4; return ['#ff6fd0', '#b17cff', '#73eff7', '#ffd36b'][band]; }
        return l > 0.45 ? top.light : l < -0.35 ? top.dark : top.base;
      }
      return l > 0.3 ? bot.light : l < -0.4 ? bot.dark : bot.base;
    });
    if (lift) {
      const copy = P.p.slice();
      for (let y = 0; y < 11; y++) for (let x = 0; x < 18; x++) P.p[y * 18 + x] = null;
      for (let y = 0; y < 11; y++) for (let x = 0; x < 18; x++) { const c = copy[y * 18 + x]; if (c && y - lift >= 0) P.p[(y - lift) * 18 + x] = c; }
    }
    for (let x = 2; x < 17; x++) { if (P.get(x, 11)) P.set(x, 11, '#2b2a3a'); }
    P.set(5, 7 - lift, '#ffffff'); P.set(6, 6 - lift, '#ffffff'); P.set(5, 6 - lift, top.spec);
    if (rarity >= 3) { const y = 7 - lift; P.set(11, y, '#fff6c4'); P.set(10, y + 1, '#fff6c4'); P.set(12, y + 1, '#fff6c4'); P.set(11, y + 1, '#ffffff'); P.set(11, y + 2, '#fff6c4'); }
    P.outline();
    return P.canvas();
  }

  // Drawn with the canvas API for smooth glass and chrome; `frame` turns the crank and jiggles the capsules.
  function machineCanvas(frame) {
    const W = 56, H = 72;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const px = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const disc = function (cx, cy, r, col) { g.fillStyle = col; for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); } };
    // Shadow.
    px(8, 69, 40, 2, 'rgba(10,8,20,0.45)');
    // Legs/base.
    px(9, 63, 38, 6, '#3a2a55'); px(9, 63, 38, 1, '#5a4680'); px(11, 68, 6, 2, '#241838'); px(39, 68, 6, 2, '#241838');
    // Cabinet.
    const cab = tones('#ef4f6b');
    px(7, 38, 42, 26, cab.dark); px(8, 38, 40, 25, cab.base); px(8, 38, 40, 3, cab.light); px(8, 38, 2, 25, cab.light); px(46, 38, 2, 25, cab.dark);
    // Front panel with a star decal.
    px(12, 43, 32, 17, mix('#ef4f6b', '#fff3e0', 0.2)); px(12, 43, 32, 1, cab.spec); px(12, 59, 32, 1, cab.dark);
    const star = [[0, -3], [-1, -1], [1, -1], [-3, -1], [3, -1], [-2, 1], [2, 1], [0, 0], [-1, 0], [1, 0], [-2, 2], [2, 2], [-3, 3], [3, 3]];
    star.forEach(function (d) { px(18 + d[0], 49 + d[1], 1, 1, '#ffd36b'); });
    // Crank (rotates through 4 frames).
    disc(31, 50, 6, '#c9d2e3'); disc(31, 50, 5, '#e9eef7'); disc(30, 49, 2, '#ffffff'); disc(31, 50, 2, '#9aa6bd');
    const a = (frame || 0) * Math.PI / 2;
    for (let i = 0; i <= 7; i++) px(Math.round(31 + Math.cos(a) * i), Math.round(50 + Math.sin(a) * i), 2, 2, '#7b86a0');
    disc(Math.round(31 + Math.cos(a) * 8), Math.round(50 + Math.sin(a) * 8), 2, '#ffd36b');
    // Coin slot.
    px(40, 46, 4, 9, '#2b2340'); px(41, 47, 2, 7, '#0e0b18'); px(40, 46, 4, 1, '#6a5a90');
    // Chute.
    px(20, 60, 16, 3, '#1a1426'); px(21, 60, 14, 1, '#3a3050');
    // Neck (chrome).
    px(12, 33, 32, 5, '#b9c3d6'); px(12, 33, 32, 1, '#f2f6ff'); px(12, 37, 32, 1, '#7d879e');
    // Glass dome with capsules inside.
    const cx = 28, cy = 19, r = 17;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    px(0, 0, W, H, '#cfe9ff');
    px(0, 0, W, H, 'rgba(160,210,255,0.35)');
    // A pile of two-tone capsule balls; they hop a pixel while the crank turns.
    const caps = [[17, 31, 0], [25, 32, 1], [33, 31, 2], [40, 28, 0], [14, 25, 3], [21, 25, 1], [29, 25, 4], [37, 22, 1], [24, 18, 2], [32, 17, 0]];
    caps.forEach(function (p, i) {
      const T = tones(RARITY_HEX[p[2]]);
      const y = p[1] - (frame && (frame + i) % 2 ? 1 : 0);
      const r = 4;
      for (let dy = -r; dy <= r; dy++) {
        const hw = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
        for (let dx = -hw; dx <= hw; dx++) {
          const l = -(dx * 0.55 + dy * 0.85) / r;
          const col = dy < 0 ? (l > 0.4 ? T.light : l < -0.3 ? T.dark : T.base) : (l > 0.2 ? '#fffdf6' : l < -0.4 ? '#cfc8bd' : '#efe9de');
          px(p[0] + dx, y + dy, 1, 1, col);
        }
      }
      px(p[0] - r, y, r * 2 + 1, 1, '#2b2a3a');
      px(p[0] - 2, y - 2, 1, 1, '#ffffff');
    });
    // Glass reflections.
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 9; i++) g.fillRect(cx - 13 + i, cy - 9 - Math.round(Math.sqrt(Math.max(0, 81 - (i - 9) * (i - 9))) * 0.5), 1, 2);
    g.fillRect(cx + 9, cy + 6, 2, 3);
    g.restore();
    // Dome rim.
    g.strokeStyle = '#7d879e'; g.lineWidth = 1;
    for (let t = 0; t < Math.PI * 2; t += 0.02) px(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1, t > Math.PI ? '#e9f3ff' : '#8aa0c0');
    // Cap and topper.
    px(22, 0, 12, 4, '#b9c3d6'); px(22, 0, 12, 1, '#f2f6ff');
    return c;
  }

  // ---------------------------------------------------------------------------
  // Icons: harvesters, relics, upgrades, currencies
  // ---------------------------------------------------------------------------
  const GEN_ICON = [
    function (P) { P.line(3, 13, 11, 4, '#9a6a3a'); P.line(4, 13, 12, 4, '#c08a50'); P.tri(9, 3, 15, 1, 14, 7, '#ffd36b'); P.tri(10, 4, 14, 3, 13, 6, '#e8a83a'); P.set(4, 4, '#ffffff'); P.set(3, 5, '#cfe9ff'); },
    function (P) { P.line(2, 14, 7, 9, '#9a6a3a'); P.ell(10.5, 6, 5, 5, function (nx, ny, x, y) { return (Math.abs(nx * nx + ny * ny - 0.8) < 0.25) ? '#c9d2e3' : ((x + y) % 2 ? '#7ad7ff' : null); }); P.ball(11, 6, 1.6, 1.6, tones('#dff6ff')); },
    function (P) { P.rect(1, 6, 4, 4, '#3f9bff'); P.rect(11, 6, 4, 4, '#3f9bff'); P.line(1, 8, 4, 8, '#9fd8ff'); P.line(11, 8, 14, 8, '#9fd8ff'); P.ball(8, 8, 3, 3, tones('#c9d2e3')); P.set(8, 4, '#ff6b8a'); P.line(8, 5, 8, 3, '#7b86a0'); },
    function (P) { P.ball(7, 8, 6, 6, tones('#c9cfd8')); P.ell(5, 9, 1.4, 1.2, '#9aa3b2'); P.ell(9, 6, 1, 1, '#9aa3b2'); P.line(11, 14, 15, 10, '#9a6a3a'); P.tri(12, 9, 15, 6, 16, 11, '#7b86a0'); },
    function (P) { P.ball(9, 9, 5.5, 4.5, tones('#a07a5a')); P.ell(7, 8, 1.2, 1, '#7a5a40'); P.tri(2, 7, 4, 9, 2, 11, '#ff9f43'); P.set(1, 9, '#ffd36b'); P.line(13, 4, 15, 2, '#c9d2e3'); },
    function (P) { P.line(4, 15, 4, 2, '#9a6a3a'); P.tri(5, 2, 15, 8, 5, 13, function (x, y) { return (x + y) % 4 === 0 ? '#ffe9a0' : '#ffd36b'; }); P.set(14, 8, '#ffffff'); },
    function (P) { P.ball(8, 8, 5, 5, tones('#73eff7')); P.line(9, 2, 7, 7, '#ffffff'); P.line(7, 7, 10, 8, '#ffffff'); P.line(10, 8, 8, 14, '#ffffff'); },
    function (P) { P.ell(8, 5, 6.5, 4, '#a884f3'); P.ell(5, 4, 3, 2, '#c9b3ff'); P.tri(5, 8, 11, 8, 8, 14, '#c9d2e3'); P.rect(7, 13, 3, 2, '#7b86a0'); },
    function (P) { P.line(0, 8, 15, 8, '#9ff6ff'); P.line(8, 0, 8, 15, '#9ff6ff'); P.ball(8, 8, 3.5, 3.5, tones('#ffffff')); P.ell(8, 8, 1.4, 1.4, '#73eff7'); },
    function (P) { P.rect(2, 10, 12, 3, '#5a5f78'); P.rect(4, 13, 8, 2, '#3a3f58'); P.rect(1, 9, 14, 1, '#9aa3b2'); for (const [x, y] of [[8, 2], [7, 4], [9, 4], [5, 5], [11, 5], [8, 6]]) P.set(x, y, '#ffd36b'); P.set(8, 4, '#ffffff'); },
    function (P) { P.ell(8, 8, 7, 7, function (nx, ny) { const d = nx * nx + ny * ny; return d > 0.6 ? '#7a5cff' : d > 0.3 ? '#3a1f7a' : '#0b0b16'; }); for (let a = 0; a < 6; a += 0.4) P.set(8 + Math.cos(a) * a * 0.9, 8 + Math.sin(a) * a * 0.9, '#c9b3ff'); },
    function (P) { P.ball(8, 8, 3.5, 3.5, tones('#ffd36b')); for (let a = 0; a < 6.28; a += 0.785) P.rect(Math.round(8 + Math.cos(a) * 6) - 1, Math.round(8 + Math.sin(a) * 6) - 1, 2, 2, '#3f9bff'); },
    function (P) { for (let a = 0; a < 9; a += 0.15) { const r = a * 0.75; P.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.7, a < 3 ? '#ffffff' : '#c9b3ff'); P.set(8 - Math.cos(a) * r, 8 - Math.sin(a) * r * 0.7, a < 3 ? '#ffffff' : '#ff9fd8'); } },
    function (P) { P.rect(1, 1, 14, 1, '#9a6a3a'); P.rect(1, 14, 14, 1, '#9a6a3a'); for (let x = 1; x < 15; x++) { P.set(x, 5 + Math.round(Math.sin(x * 0.9) * 2), '#ff8fb1'); P.set(x, 8 + Math.round(Math.sin(x * 0.9 + 2) * 2), '#73eff7'); P.set(x, 11 + Math.round(Math.sin(x * 0.9 + 4) * 2), '#ffd36b'); } },
    function (P) { P.rect(2, 11, 12, 4, '#5a5f78'); P.rect(2, 11, 12, 1, '#9aa3b2'); for (let a = 0; a < 6.28; a += 0.52) P.line(8, 6, 8 + Math.cos(a) * 6, 6 + Math.sin(a) * 5, a % 1.04 < 0.5 ? '#ffd36b' : '#ff6b8a'); P.ball(8, 6, 2, 2, tones('#ffffff')); }
  ];
  function genCanvas(i) { const P = new Painter(16, 16); GEN_ICON[i](P); P.outline(); return P.canvas(); }

  const RELIC_HEX = ['#a9b6c6', '#4fa8f6', '#b48cff', '#ffcd4d', '#ff7fd8'];
  const RELIC_ICON = {
    Orb: function (P, T) { P.rect(5, 13, 6, 2, '#7a5a40'); P.ball(8, 8, 5, 5, T); P.set(6, 5, '#ffffff'); },
    Gauntlet: function (P, T) { P.rect(4, 9, 8, 5, T.dark); P.rect(4, 4, 2, 6, T.base); P.rect(6, 3, 2, 7, T.base); P.rect(8, 3, 2, 7, T.base); P.rect(10, 4, 2, 6, T.base); P.rect(12, 7, 2, 3, T.base); P.rect(4, 12, 8, 1, T.light); },
    Cog: function (P, T) { for (let a = 0; a < 6.28; a += 0.785) P.rect(Math.round(8 + Math.cos(a) * 6) - 1, Math.round(8 + Math.sin(a) * 6) - 1, 3, 3, T.base); P.ball(8, 8, 5, 5, T); P.ell(8, 8, 1.6, 1.6, null); P.ell(8, 8, 1.5, 1.5, '#1a1c2c'); },
    Metronome: function (P, T) { P.tri(3, 14, 13, 14, 8, 2, T.base); P.tri(5, 14, 11, 14, 8, 5, T.light); P.line(8, 12, 11, 4, '#1a1c2c'); P.ell(10, 6, 1.2, 1.2, GOLD); },
    Clover: function (P, T) { for (const [x, y] of [[5, 5], [11, 5], [5, 10], [11, 10]]) P.ball(x, y, 3, 3, T); P.line(8, 9, 10, 15, T.dark); },
    Die: function (P, T) { P.rect(3, 3, 10, 10, T.base); P.rect(3, 3, 10, 2, T.light); P.rect(11, 3, 2, 10, T.dark); for (const [x, y] of [[5, 6], [8, 8], [10, 10]]) P.set(x, y, '#1a1c2c'); },
    Stub: function (P, T) { P.rect(2, 5, 12, 7, T.base); P.rect(2, 5, 12, 1, T.light); P.set(2, 8, null); P.set(13, 8, null); for (let y = 6; y < 12; y += 2) P.set(9, y, T.dark); P.ell(5.5, 8.5, 1.3, 1.3, '#ffffff'); },
    Prism: function (P, T) { P.tri(8, 2, 14, 13, 2, 13, function (x, y) { return x < 8 - (y - 2) * 0.2 ? T.light : T.base; }); P.line(14, 9, 15, 9, '#ff8fb1'); P.line(14, 10, 15, 10, '#ffd36b'); P.line(14, 11, 15, 11, '#73eff7'); },
    Compass: function (P, T) { P.ball(8, 8, 6, 6, T); P.ell(8, 8, 4.4, 4.4, '#f4f4f4'); P.tri(7, 8, 9, 8, 8, 3, '#ef4f6b'); P.tri(7, 8, 9, 8, 8, 13, '#3a3f58'); },
    Hourglass: function (P, T) { P.rect(3, 2, 10, 1, '#9a6a3a'); P.rect(3, 13, 10, 1, '#9a6a3a'); P.tri(4, 3, 12, 3, 8, 8, '#dff6ff'); P.tri(4, 13, 12, 13, 8, 8, '#dff6ff'); P.tri(6, 13, 10, 13, 8, 10, T.base); P.set(8, 9, T.base); },
    Gem: function (P, T) { P.tri(2, 6, 14, 6, 8, 14, T.base); P.rect(4, 3, 8, 3, T.light); P.tri(2, 6, 4, 3, 4, 6, T.light); P.tri(12, 3, 14, 6, 12, 6, T.dark); P.set(5, 4, '#ffffff'); }
  };
  function relicCanvas(noun, rarity) {
    const P = new Painter(16, 16);
    (RELIC_ICON[noun] || RELIC_ICON.Orb)(P, tones(RELIC_HEX[rarity]));
    P.outline();
    return P.canvas();
  }

  const MISC_ICON = {
    glove: function (P) { const T = tones('#ffd36b'); P.rect(4, 8, 8, 6, T.base); P.rect(4, 3, 2, 6, T.base); P.rect(6, 2, 2, 7, T.light); P.rect(8, 2, 2, 7, T.base); P.rect(10, 3, 2, 6, T.base); P.rect(12, 7, 2, 3, T.base); P.rect(4, 13, 8, 2, '#ef4f6b'); },
    catalyst: function (P) { P.rect(6, 2, 4, 4, '#dff6ff'); P.ell(8, 10, 5, 4.5, '#dff6ff'); P.ell(8, 11, 4, 3, '#a884f3'); P.set(6, 10, '#ffffff'); P.set(9, 9, '#ffd6ff'); P.rect(5, 1, 6, 1, '#9a6a3a'); },
    combo: function (P) { P.tri(3, 14, 13, 14, 8, 1, '#ef4f6b'); P.tri(5, 14, 11, 14, 8, 5, '#ffa34d'); P.tri(7, 14, 10, 14, 8, 9, '#ffe9a0'); },
    reel: function (P) { P.rect(1, 3, 14, 10, '#5d275d'); for (const x of [2, 7, 12]) P.rect(x, 5, 3, 6, '#f4f4f4'); P.set(3, 7, '#ef4f6b'); P.set(8, 7, '#ef4f6b'); P.set(13, 7, '#ef4f6b'); P.rect(1, 3, 14, 1, '#ff8fb1'); },
    treat: function (P) { P.ell(4, 6, 2.5, 2.5, '#f3e2c0'); P.ell(4, 10, 2.5, 2.5, '#f3e2c0'); P.ell(12, 6, 2.5, 2.5, '#f3e2c0'); P.ell(12, 10, 2.5, 2.5, '#f3e2c0'); P.rect(4, 6, 8, 4, '#f3e2c0'); P.rect(4, 6, 8, 1, '#fffaf0'); },
    trophy: function (P) { const T = tones('#ffcd4d'); P.rect(4, 2, 8, 6, T.base); P.ell(8, 7, 4, 3, T.base); P.rect(4, 2, 2, 6, T.light); P.set(2, 3, T.dark); P.set(2, 4, T.dark); P.set(3, 5, T.dark); P.set(13, 3, T.dark); P.set(13, 4, T.dark); P.set(12, 5, T.dark); P.rect(7, 10, 2, 3, T.dark); P.rect(5, 13, 6, 2, '#9a6a3a'); },
    shardc: function (P) { P.tri(8, 1, 13, 7, 8, 15, '#b17cff'); P.tri(8, 1, 3, 7, 8, 15, '#d6b8ff'); P.line(8, 2, 8, 14, '#ffffff'); },
    gift2: function (P) { P.rect(2, 6, 12, 9, '#ef4f6b'); P.rect(1, 4, 14, 3, '#ff6b8a'); P.rect(7, 4, 2, 11, '#ffd36b'); P.tri(4, 1, 8, 4, 4, 4, '#ffd36b'); P.tri(12, 1, 8, 4, 12, 4, '#ffd36b'); },
    lock: function (P) { P.ell(8, 5, 3.5, 3.5, '#9aa3b2'); P.ell(8, 5, 2, 2, null); P.rect(3, 7, 10, 7, '#ffcd4d'); P.rect(3, 7, 10, 1, '#fff0b0'); P.rect(7, 9, 2, 3, '#7a5a20'); },
    leader: function (P) { P.rect(2, 8, 4, 7, '#c9d2e3'); P.rect(6, 4, 4, 11, '#ffcd4d'); P.rect(10, 10, 4, 5, '#e8a06b'); P.set(8, 2, '#ffffff'); }
  };
  function miscCanvas(k) { const P = new Painter(16, 16); MISC_ICON[k](P); P.outline(); return P.canvas(); }

  // ---------------------------------------------------------------------------
  // Rendering & cache
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

  let PETS = {};
  function setPets(list) { PETS = {}; list.forEach(function (p) { PETS[p.id] = p; }); }

  // Names: 'pet_<id>', 'capsule<r>', 'capsuleOpen<r>', 'machine<f>', 'gen<i>', 'relic_<Noun>_<r>', 'icon_<key>', or an ART key.
  function get(name) {
    if (cache[name]) return cache[name];
    let c;
    let m;
    if (name.indexOf('pet_') === 0 || name.indexOf('critter_') === 0) c = petCanvas(PETS[name.replace(/^(pet_|critter_)/, '')]);
    else if ((m = /^capsule(Open)?(\d)$/.exec(name))) c = capsuleCanvas(Number(m[2]), !!m[1]);
    else if ((m = /^machine(\d)$/.exec(name))) c = machineCanvas(Number(m[1]));
    else if ((m = /^gen(\d+)$/.exec(name))) c = genCanvas(Number(m[1]));
    else if ((m = /^relic_(\w+)_(\d)$/.exec(name))) c = relicCanvas(m[1], Number(m[2]));
    else if ((m = /^icon_(\w+)$/.exec(name))) c = miscCanvas(m[1]);
    else {
      const rows = ART[name];
      if (!rows) throw new Error('unknown sprite ' + name);
      c = render(rows);
    }
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
    return '<img class="px ' + (cls || '') + '" src="' + url(name, 1) + '" width="' + Math.round(s.width * k) + '" height="' + Math.round(s.height * k) + '" alt="">';
  }

  root.PSSprites = { PAL: PAL, ART: ART, get: get, url: url, img: img, setPets: setPets, tones: tones, mix: mix, RARITY_HEX: RARITY_HEX, RELIC_HEX: RELIC_HEX, GEN_COUNT: GEN_ICON.length };
})(typeof globalThis !== 'undefined' ? globalThis : this);
