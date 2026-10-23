/* Pocket Singularity — synthesized sound. No audio files; everything is Web Audio. */
(function (root) {
  'use strict';

  // Pentatonic scale so long capture chains always sound musical, never harsh.
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];

  const A = {
    ctx: null, master: null, muted: false, external: false, lastPlink: 0, plinksThisFrame: 0,

    unlock: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(function () {}); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.isSilent() ? 0 : 0.55;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        this.noise = this.makeNoise();
      } catch (e) { this.ctx = null; }
    },

    isSilent: function () { return this.muted || this.external; },
    setMuted: function (m) { this.muted = !!m; this.applyGain(); },
    setExternalMute: function (m) { this.external = !!m; this.applyGain(); },
    applyGain: function () {
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.isSilent() ? 0 : 0.55, t, 0.03);
    },
    suspend: function () { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(function () {}); },
    resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {}); },

    ok: function () { return this.ctx && this.ctx.state === 'running' && !this.isSilent(); },

    makeNoise: function () {
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },

    tone: function (type, f0, f1, dur, gain, when, filter) {
      const c = this.ctx, t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2));
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

    pulse: function (auto) {
      if (!this.ok()) return;
      if (auto) { this.tone('sine', 90, 50, 0.22, 0.08); return; }
      this.tone('sine', 120, 42, 0.3, 0.32);
      this.tone('triangle', 240, 90, 0.12, 0.05, 0, 900);
      this.hiss(0.08, 0.05, 700);
    },

    // idx = position within the current chain; pitch climbs so big chains feel like a run up a scale.
    capture: function (idx, type) {
      if (!this.ok()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastPlink < 0.028) return;  // avoid stacking dozens of plinks in one frame
      this.lastPlink = now;
      const f = SCALE[Math.min(SCALE.length - 1, Math.max(0, idx - 1))];
      if (type === 'crystal') {
        this.tone('sine', f * 2, f * 2, 0.5, 0.06);
        this.tone('sine', f * 3, f * 3, 0.35, 0.025, 0.02);
      } else if (type === 'shard') {
        this.tone('square', f * 0.5, f * 0.25, 0.12, 0.022, 0, 1600);
      } else {
        this.tone('triangle', f, f, 0.1, type === 'ice' ? 0.05 : 0.04, 0, 3800);
      }
    },

    swallow: function () { if (this.ok()) this.tone('sine', 300, 180, 0.08, 0.02); },

    blast: function () {
      if (!this.ok()) return;
      this.hiss(0.22, 0.08, 1800);
      this.tone('sawtooth', 160, 60, 0.2, 0.04, 0, 700);
    },

    payout: function (chain) {
      if (!this.ok() || chain < 5) return;
      const base = chain >= 12 ? 784 : 659;
      this.tone('sine', base, base, 0.28, 0.05, 0.02);
      this.tone('sine', base * 1.5, base * 1.5, 0.34, 0.04, 0.08);
      if (chain >= 12) this.tone('sine', base * 2, base * 2, 0.42, 0.035, 0.14);
    },

    buy: function () {
      if (!this.ok()) return;
      [523.25, 659.25, 783.99].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.05, i * 0.045, 4000));
    },

    deny: function () { if (this.ok()) this.tone('sine', 180, 150, 0.09, 0.04); },

    chord: function (notes, dur, gain) {
      notes.forEach((f, i) => {
        this.tone('sine', f, f, dur, gain, i * 0.09);
        this.tone('triangle', f / 2, f / 2, dur * 0.9, gain * 0.4, i * 0.09, 1200);
      });
    },

    sector: function () { if (this.ok()) this.chord([392, 523.25, 659.25, 783.99], 1.4, 0.045); },
    discover: function () { if (this.ok()) { this.tone('sine', 1318.5, 1318.5, 0.3, 0.04); this.tone('sine', 1975.5, 1975.5, 0.4, 0.03, 0.08); } },
    comet: function () { if (this.ok()) { this.tone('sine', 900, 1500, 0.6, 0.025); this.hiss(0.6, 0.02, 3000); } },

    surge: function () {
      if (!this.ok()) return;
      this.chord([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.9, 0.045);
      this.hiss(0.5, 0.04, 2500);
    },

    collapse: function () {
      if (!this.ok()) return;
      this.tone('sine', 220, 40, 2.2, 0.25);
      this.tone('sine', 110, 30, 2.4, 0.2);
      this.hiss(1.6, 0.05, 500);
      this.chord([261.63, 392, 523.25], 2.4, 0.035);
    }
  };

  root.PSAudio = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
