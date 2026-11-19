// Generative score + synthesized effects. No samples.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [
  { root: 48, tones: [0, 4, 7, 11, 14] }, // Cmaj9
  { root: 45, tones: [0, 3, 7, 10, 14] }, // Am9
  { root: 53, tones: [0, 4, 7, 11, 14] }, // Fmaj9
  { root: 55, tones: [0, 4, 7, 9, 14] }, // G6/9
];
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
const euclid = (k, n, rot = 0) => Array.from({ length: n }, (_, i) => ((((i + rot) % n) * k) % n) < k);

export class Sound {
  constructor() { this.c = null; this.muted = false; this.progress = 0; this.night = 0; this.step = 0; this.mel = 4; this.slurpT = 0; this.pat = euclid(3, 16); this.swell = 0; }

  init() {
    if (this.c) return;
    const C = (this.c = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = 0.85;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(C.destination);
    // reverb
    const len = C.sampleRate * 2.8, ir = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = C.createConvolver(); this.rev.buffer = ir;
    const rg = C.createGain(); rg.gain.value = 0.5; this.rev.connect(rg); rg.connect(this.master);
    // noise source
    const nb = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nb = nb;
    // rain bed
    const rs = C.createBufferSource(); rs.buffer = nb; rs.loop = true;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    this.rainG = C.createGain(); this.rainG.gain.value = 0;
    rs.connect(bp); bp.connect(hp); hp.connect(this.rainG); this.rainG.connect(this.master); rs.start();
    // wind bed
    const ws = C.createBufferSource(); ws.buffer = nb; ws.loop = true; ws.playbackRate.value = 0.5;
    this.windF = C.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = 1.2;
    this.windG = C.createGain(); this.windG.gain.value = 0;
    ws.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master); ws.start();
    // charge whine
    this.chO = C.createOscillator(); this.chO.type = 'sawtooth'; this.chO.frequency.value = 60;
    const cf = C.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 900;
    this.chG = C.createGain(); this.chG.gain.value = 0;
    this.chO.connect(cf); cf.connect(this.chG); this.chG.connect(this.master); this.chO.start();
    this.s16 = 60 / 78 / 4;
    this.next = C.currentTime + 0.15;
    setInterval(() => this.sched(), 50);
  }
  get t() { return this.c.currentTime; }
  setMute(m) { this.muted = m; if (this.c) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.t, 0.05); }

  out(node, rev = 0) { node.connect(this.master); if (rev > 0) { const g = this.c.createGain(); g.gain.value = rev; node.connect(g); g.connect(this.rev); } }
  osc(type, f, t, dur) { const o = this.c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
  env(t, a, peak, d) { const g = this.c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; }
  noise(t, dur, rate = 1) { const s = this.c.createBufferSource(); s.buffer = this.nb; s.loop = true; s.playbackRate.value = rate; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }

  pluck(n, t, vol = 0.2, dec = 1.1, rev = 0.5) {
    const f = midi(n), g = this.env(t, 0.004, vol, dec);
    const o = this.osc('sine', f, t, dec); o.connect(g);
    const g2 = this.env(t, 0.002, vol * 0.45, dec * 0.18); const o2 = this.osc('sine', f * 5.42, t, dec * 0.2); o2.connect(g2);
    const g3 = this.env(t, 0.003, vol * 0.3, dec * 0.5); const o3 = this.osc('triangle', f * 2, t, dec * 0.5); o3.connect(g3);
    this.out(g, rev); this.out(g2, rev); this.out(g3, rev);
  }
  bell(n, t, vol = 0.1) {
    const f = midi(n);
    for (const [m, v, d] of [[1, 1, 2.4], [2.76, 0.4, 1.4], [5.4, 0.22, 0.7]]) { const g = this.env(t, 0.003, vol * v, d); this.osc('sine', f * m, t, d).connect(g); this.out(g, 0.8); }
  }
  pad(notes, t, dur, vol) {
    const C = this.c, f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(900 + this.progress * 900, t + dur * 0.5); f.frequency.linearRampToValueAtTime(350, t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const n of notes) for (const det of [-6, 6]) { const o = this.osc('sawtooth', midi(n), t, dur); o.detune.value = det; o.connect(f); }
    f.connect(g); this.out(g, 0.7);
  }
  bass(n, t, dur, vol) { const g = this.env(t, 0.02, vol, dur); const o = this.osc('sine', midi(n), t, dur); o.connect(g); const o2 = this.osc('triangle', midi(n + 12), t, dur); const g2 = this.env(t, 0.02, vol * 0.25, dur * 0.6); o2.connect(g2); this.out(g); this.out(g2); }
  hat(t, vol, dec = 0.04) { const s = this.noise(t, dec); const f = this.c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = this.env(t, 0.001, vol, dec); s.connect(f); f.connect(g); this.out(g, 0.15); }
  block(t, vol, f = 880) { const g = this.env(t, 0.001, vol, 0.07); const o = this.osc('sine', f, t, 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.06); o.connect(g); this.out(g, 0.4); }

  sched() {
    if (!this.c || this.c.state !== 'running') return;
    if (this.next < this.t) this.next = this.t + 0.05;
    while (this.next < this.t + 0.3) {
      this.playStep(this.step, this.next);
      this.next += this.s16 * (this.step % 2 === 0 ? 1.12 : 0.88);
      this.step++;
    }
  }
  playStep(step, t) {
    const s = step % 16, bar = Math.floor(step / 16), P = this.progress, night = this.night;
    const ch = CHORDS[bar % 4];
    if (s === 0) {
      this.pad([ch.root + ch.tones[0] + 12, ch.root + ch.tones[2] + 12, ch.root + ch.tones[3] + 12, ch.root + ch.tones[4] + 12], t, this.s16 * 18, 0.022 + P * 0.016 + this.swell * 0.03);
      const k = 3 + Math.round(P * 6) - (night > 0.5 ? 1 : 0);
      this.pat = euclid(Math.max(2, k), 16, (bar * 3) % 16);
      this.swell = Math.max(0, this.swell - 0.25);
    }
    if (P > 0.1 && (s === 0 || (s === 10 && P > 0.3))) this.bass(ch.root - 12, t, this.s16 * (s === 0 ? 9 : 5), 0.2);
    if (this.pat[s] && Math.random() < 0.9) {
      // random walk through the pentatonic, biased to chord tones on strong steps
      this.mel = Math.max(0, Math.min(PENTA.length - 1, this.mel + Math.floor(Math.random() * 5) - 2));
      let n = PENTA[this.mel];
      if (s % 4 === 0) { const ct = ch.tones.map((x) => ch.root + x + 12); n = ct.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)); while (n < 60) n += 12; }
      if (night > 0.5) n -= 12;
      this.pluck(n, t, 0.13 + Math.random() * 0.07, 1.0 + Math.random() * 0.6);
      if (P > 0.45 && Math.random() < 0.3) this.pluck(n + 7, t + this.s16 * 0.5, 0.05, 0.8);
    }
    if (P > 0.3) { if (s % 2 === 1) this.hat(t, 0.018 + (s % 4 === 3 ? 0.014 : 0)); if (P > 0.5 && (s === 4 || s === 12)) this.block(t, 0.05, 700); if (P > 0.7 && (s === 7 || s === 14)) this.block(t, 0.035, 1050); }
    if (P > 0.6 && bar % 2 === 1 && (s === 2 || s === 5 || s === 8)) this.bell(ch.root + ch.tones[[4, 3, 2][[2, 5, 8].indexOf(s)]] + 36, t, 0.035);
    if (night > 0.5 && s % 4 === 2 && Math.random() < 0.5) this.cricket(t);
  }
  cricket(t) { for (let i = 0; i < 3; i++) { const g = this.env(t + i * 0.055, 0.004, 0.012, 0.035); this.osc('sine', 4300 + Math.random() * 300, t + i * 0.055, 0.05).connect(g); this.out(g, 0.3); } }

  // continuous controls
  setRain(x) { if (this.c) this.rainG.gain.setTargetAtTime(x * 0.16, this.t, 0.12); }
  setCharge(x) { if (!this.c) return; this.chG.gain.setTargetAtTime(x > 0 ? 0.03 + x * 0.05 : 0, this.t, 0.05); this.chO.frequency.setTargetAtTime(70 + x * 420, this.t, 0.08); }
  setWind(v) { if (!this.c) return; this.windG.gain.setTargetAtTime(0.02 + v * 0.1, this.t, 0.2); this.windF.frequency.setTargetAtTime(300 + v * 500, this.t, 0.2); }

  // one-shots
  thunder() {
    if (!this.c) return; const t = this.t, C = this.c;
    const s = this.noise(t, 3); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.2);
    const g = this.env(t, 0.005, 0.9, 2.6); s.connect(f); f.connect(g); this.out(g, 0.9);
    const o = this.osc('sine', 80, t, 1.6); o.frequency.exponentialRampToValueAtTime(30, t + 1.4); const g2 = this.env(t, 0.01, 0.7, 1.5); o.connect(g2); this.out(g2);
    const c = this.noise(t, 0.1); const hf = C.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 2500; const g3 = this.env(t, 0.001, 0.5, 0.09); c.connect(hf); hf.connect(g3); this.out(g3, 0.6);
  }
  pop(p = 1) { if (!this.c) return; const t = this.t; const o = this.osc('sine', 380 * p, t, 0.12); o.frequency.exponentialRampToValueAtTime(900 * p, t + 0.07); const g = this.env(t, 0.003, 0.25, 0.1); o.connect(g); this.out(g, 0.4); }
  chirp(pitch = 1, happy = true) {
    if (!this.c) return; const t = this.t, n = happy ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.09, f = 620 * pitch * (happy ? 1 + i * 0.22 : 1 - i * 0.12);
      const o = this.osc('triangle', f, tt, 0.1); o.frequency.exponentialRampToValueAtTime(f * (happy ? 1.5 : 0.8), tt + 0.07);
      const bp = this.c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
      const g = this.env(tt, 0.006, 0.2, 0.08); o.connect(bp); bp.connect(g); this.out(g, 0.35);
    }
  }
  sparkle(base = 72) { if (!this.c) return; const t = this.t; [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.pluck(base + n, t + i * 0.065, 0.16, 1.4, 0.8)); this.bell(base + 24, t + 0.5, 0.08); this.swell = 1; }
  hiss() { if (!this.c) return; const t = this.t; const s = this.noise(t, 0.6); const f = this.c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500; const g = this.env(t, 0.01, 0.22, 0.55); s.connect(f); f.connect(g); this.out(g, 0.3); }
  slurp(dt) {
    if (!this.c) return; this.slurpT -= dt; if (this.slurpT > 0) return; this.slurpT = 0.09 + Math.random() * 0.08;
    const t = this.t, f = 260 + Math.random() * 300; const o = this.osc('sine', f, t, 0.1); o.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.08); const g = this.env(t, 0.005, 0.06, 0.08); o.connect(g); this.out(g, 0.3);
  }
  boom() {
    if (!this.c) return; const t = this.t; const s = this.noise(t, 0.8); const f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(150, t + 0.5);
    const g = this.env(t, 0.003, 0.45, 0.7); s.connect(f); f.connect(g); this.out(g, 0.8);
    for (let i = 0; i < 9; i++) this.hat(t + 0.25 + Math.random() * 0.8, 0.05, 0.02);
  }
  launch() {
    if (!this.c) return; const t = this.t; const s = this.noise(t, 4.2); const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(150, t); f.frequency.exponentialRampToValueAtTime(2600, t + 3.8);
    const g = this.c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 1); g.gain.linearRampToValueAtTime(0.0001, t + 4.1); s.connect(f); f.connect(g); this.out(g, 0.5);
  }
  roar() {
    if (!this.c) return; const t = this.t; const o = this.osc('sawtooth', 62, t, 2.6); o.frequency.linearRampToValueAtTime(88, t + 0.9); o.frequency.linearRampToValueAtTime(48, t + 2.5);
    const lfo = this.osc('sine', 9, t, 2.6); const lg = this.c.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
    const f = this.c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(700, t + 1); f.frequency.linearRampToValueAtTime(180, t + 2.5);
    const g = this.c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + 2.6); o.connect(f); f.connect(g); this.out(g, 0.7);
  }
  cough() { if (!this.c) return; const t = this.t; const s = this.noise(t, 0.2, 0.6); const f = this.c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; const g = this.env(t, 0.005, 0.25, 0.15); s.connect(f); f.connect(g); this.out(g, 0.2); }
  finale() {
    if (!this.c) return; const t = this.t;
    this.pad([36, 48, 55, 60, 64, 67, 74, 79], t, 14, 0.05);
    for (let i = 0; i < 28; i++) this.pluck(PENTA[Math.floor(Math.random() * PENTA.length)] + 12, t + 1 + i * 0.32 + Math.random() * 0.1, 0.1, 1.6, 0.9);
    this.swell = 3;
  }
}
