/* Pocket Singularity — chiptune sound effects synthesized with Web Audio, plus one soft looping soundtrack. */
(function (root) {
  'use strict';

  // Pentatonic scale so long capture chains always sound musical, never harsh.
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];

  const A = {
    ctx: null, master: null, muted: false, external: false, lastPlink: 0,

    unlock: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(function () {}); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.isSilent() ? 0 : 0.5;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        this.noise = this.makeNoise();
      } catch (e) { this.ctx = null; }
      this.syncMusic();
    },

    isSilent: function () { return this.muted || this.external; },
    setMuted: function (m) { this.muted = !!m; this.applyGain(); this.syncMusic(); },
    setExternalMute: function (m) { this.external = !!m; this.applyGain(); this.syncMusic(); },

    // Soundtrack: a quiet background loop, started by the first tap (browsers block autoplay).
    musicOn: true, musicEl: null, musicVol: 0.55, hidden: false,
    setMusic: function (on) { this.musicOn = !!on; this.syncMusic(); },
    syncMusic: function () {
      const want = this.musicOn && !this.isSilent() && !this.hidden && !!this.ctx;
      if (want && !this.musicEl) {
        try {
          this.musicEl = new root.Audio('assets/music/quiet-between-stars.mp3');
          this.musicEl.loop = true;
          this.musicEl.volume = 0;
        } catch (e) { this.musicEl = null; return; }
      }
      const el = this.musicEl;
      if (!el) return;
      clearInterval(this.fadeTimer);
      const self = this;
      if (want) {
        if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(function () {}); }
        // Gentle fade in.
        this.fadeTimer = setInterval(function () {
          el.volume = Math.min(self.musicVol, el.volume + 0.02);
          if (el.volume >= self.musicVol) clearInterval(self.fadeTimer);
        }, 60);
      } else {
        this.fadeTimer = setInterval(function () {
          el.volume = Math.max(0, el.volume - 0.05);
          if (el.volume <= 0) { clearInterval(self.fadeTimer); el.pause(); }
        }, 40);
      }
    },
    applyGain: function () {
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.isSilent() ? 0 : 0.5, t, 0.03);
    },
    suspend: function () { this.hidden = true; this.syncMusic(); if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(function () {}); },
    resume: function () { this.hidden = false; this.syncMusic(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {}); },
    ok: function () { return this.ctx && this.ctx.state === 'running' && !this.isSilent(); },

    makeNoise: function () {
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      // Stepped noise sounds like an 8-bit noise channel rather than hiss.
      let v = 0;
      for (let i = 0; i < len; i++) { if (i % 6 === 0) v = Math.random() * 2 - 1; d[i] = v; }
      return buf;
    },

    tone: function (type, f0, f1, dur, gain, when, filter) {
      const c = this.ctx, t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.008, dur * 0.2));
      g.gain.setValueAtTime(gain, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (filter) {
        const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter;
        o.connect(fl); node = fl;
      }
      node.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    hiss: function (dur, gain, freq, when) {
      const c = this.ctx, t = c.currentTime + (when || 0);
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t); s.stop(t + dur + 0.02);
    },

    arp: function (notes, step, dur, gain, type) {
      notes.forEach((f, i) => this.tone(type || 'square', f, f, dur, gain, i * step, 3200));
    },

    pulse: function (auto) {
      if (!this.ok()) return;
      if (auto) { this.tone('triangle', 110, 55, 0.16, 0.1); return; }
      this.tone('triangle', 160, 45, 0.24, 0.4);
      this.tone('square', 220, 80, 0.08, 0.035, 0, 900);
      this.hiss(0.06, 0.05, 900);
    },

    // idx = position within the current chain; pitch climbs so big chains feel like a run up a scale.
    capture: function (idx, type) {
      if (!this.ok()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastPlink < 0.03) return;
      this.lastPlink = now;
      const f = SCALE[Math.min(SCALE.length - 1, Math.max(0, idx - 1))];
      if (type === 'crystal') { this.tone('square', f * 2, f * 2, 0.12, 0.03, 0, 4000); this.tone('square', f * 3, f * 3, 0.14, 0.02, 0.05, 4000); }
      else if (type === 'shard') this.tone('square', f * 0.5, f * 0.35, 0.09, 0.03, 0, 1800);
      else this.tone('square', f, f, 0.06, type === 'ice' ? 0.032 : 0.026, 0, 3000);
    },

    swallow: function () { if (this.ok()) this.tone('triangle', 330, 200, 0.06, 0.04); },
    blast: function () { if (this.ok()) { this.hiss(0.2, 0.09, 2000); this.tone('square', 140, 50, 0.16, 0.04, 0, 600); } },

    payout: function (chain) {
      if (!this.ok() || chain < 5) return;
      const b = chain >= 12 ? 784 : 659;
      this.arp([b, b * 1.25, b * 1.5].concat(chain >= 12 ? [b * 2] : []), 0.055, 0.1, 0.035);
    },

    lucky: function () { if (this.ok()) this.arp([784, 988, 1175, 1568, 1976], 0.045, 0.09, 0.04); },
    ticket: function () { if (this.ok()) { this.tone('square', 1568, 1568, 0.05, 0.03); this.tone('square', 2093, 2093, 0.08, 0.03, 0.05); } },
    buy: function () { if (this.ok()) this.arp([523.25, 659.25, 783.99], 0.04, 0.07, 0.035); },
    deny: function () { if (this.ok()) this.tone('square', 150, 120, 0.08, 0.03, 0, 800); },
    sector: function () { if (this.ok()) this.arp([392, 523.25, 659.25, 783.99, 1046.5], 0.09, 0.22, 0.035, 'triangle'); },
    level: function () { if (this.ok()) this.arp([659.25, 783.99, 1046.5], 0.05, 0.08, 0.03); },
    discover: function () { if (this.ok()) this.arp([1318.5, 1975.5], 0.07, 0.12, 0.03); },
    comet: function () { if (this.ok()) { this.tone('triangle', 900, 1600, 0.5, 0.04); this.hiss(0.5, 0.025, 3000); } },
    surge: function () { if (this.ok()) { this.arp([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568], 0.05, 0.12, 0.04); this.hiss(0.4, 0.03, 2500); } },

    reelTick: function () { if (this.ok()) this.tone('square', 1200, 1200, 0.02, 0.015, 0, 3000); },
    reelStop: function (hit) { if (this.ok()) { this.tone('square', hit ? 880 : 330, hit ? 880 : 300, 0.07, 0.04, 0, 2000); this.hiss(0.04, 0.04, 1200); } },
    reelWin: function (big) {
      if (!this.ok()) return;
      if (big) { this.arp([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1568, 2093], 0.07, 0.12, 0.04); this.hiss(0.6, 0.03, 4000, 0.3); }
      else this.arp([659.25, 880, 1046.5], 0.06, 0.1, 0.03);
    },

    overcharge: function (win) {
      if (!this.ok()) return;
      if (win) this.arp([523.25, 783.99, 1046.5, 1568, 2093], 0.04, 0.1, 0.04);
      else { this.tone('square', 300, 60, 0.4, 0.05, 0, 1200); this.hiss(0.3, 0.05, 800); }
    },

    crank: function () { if (this.ok()) for (let i = 0; i < 4; i++) { this.tone('square', 220 + i * 30, 200, 0.04, 0.03, i * 0.08, 1500); this.hiss(0.03, 0.03, 1800, i * 0.08); } },
    drop: function () { if (this.ok()) { this.tone('triangle', 400, 120, 0.14, 0.12); this.hiss(0.05, 0.05, 1000, 0.02); } },
    wobble: function () { if (this.ok()) this.tone('square', 600, 650, 0.03, 0.015, 0, 2500); },
    reveal: function (rarity) {
      if (!this.ok()) return;
      const sets = [[659.25, 783.99], [659.25, 783.99, 1046.5], [523.25, 659.25, 783.99, 1046.5, 1318.5], [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093, 2637, 3136]];
      this.arp(sets[rarity], rarity >= 2 ? 0.07 : 0.06, 0.14, 0.04);
      if (rarity >= 2) this.hiss(0.5, 0.025, 4000, 0.2);
    },

    forge: function () { if (this.ok()) { this.tone('square', 180, 90, 0.08, 0.05, 0, 900); this.hiss(0.08, 0.05, 1500); this.tone('square', 180, 90, 0.08, 0.05, 0.12, 900); } },
    shatter: function () { if (this.ok()) { this.hiss(0.35, 0.07, 3000); this.tone('square', 900, 120, 0.3, 0.04, 0, 2000); } },
    achieve: function () { if (this.ok()) this.arp([783.99, 1046.5, 1318.5, 1568], 0.05, 0.1, 0.035); },
    form: function () { if (this.ok()) { this.arp([261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5], 0.08, 0.25, 0.04, 'triangle'); this.hiss(0.8, 0.03, 3000, 0.4); } },

    collapse: function () {
      if (!this.ok()) return;
      this.tone('triangle', 220, 40, 2, 0.3);
      this.hiss(1.4, 0.05, 600);
      this.arp([261.63, 392, 523.25, 783.99], 0.25, 0.6, 0.03, 'triangle');
    }
  };

  root.PSAudio = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
