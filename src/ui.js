import * as THREE from 'three';

const cache = {};
function draw(c, k) {
  c.save(); c.translate(64, 56); c.lineCap = 'round'; c.lineJoin = 'round';
  if (k === 'drop') {
    c.fillStyle = '#35aefc'; c.beginPath(); c.moveTo(0, -32); c.bezierCurveTo(27, 2, 23, 29, 0, 29); c.bezierCurveTo(-23, 29, -27, 2, 0, -32); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-8, 8, 4.5, 9, 0.5, 0, 6.3); c.fill();
  } else if (k === 'bolt') {
    c.fillStyle = '#ffc41f'; c.strokeStyle = '#e99a0a'; c.lineWidth = 4; c.beginPath();
    [[8, -34], [-19, 4], [-3, 4], [-9, 34], [19, -8], [3, -8]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.fill();
  } else if (k === 'snow') {
    c.strokeStyle = '#5cc1f4'; c.lineWidth = 6;
    for (let i = 0; i < 6; i++) { c.save(); c.rotate((i * Math.PI) / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -30); c.moveTo(0, -18); c.lineTo(8, -26); c.moveTo(0, -18); c.lineTo(-8, -26); c.stroke(); c.restore(); }
  } else if (k === 'rainbow') {
    c.lineWidth = 7.5; ['#ff5d6c', '#ffc93c', '#5fd08a', '#4aa3f5'].forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(0, 20, 34 - i * 7.5, Math.PI, 2 * Math.PI); c.stroke(); });
  } else if (k === 'fire') {
    c.fillStyle = '#ff6a1f'; c.beginPath(); c.moveTo(2, -34); c.bezierCurveTo(30, -6, 28, 30, 0, 30); c.bezierCurveTo(-28, 30, -24, 0, -10, -12); c.bezierCurveTo(-8, 0, -2, -4, 2, -34); c.fill();
    c.fillStyle = '#ffd23c'; c.beginPath(); c.moveTo(2, -4); c.bezierCurveTo(16, 8, 13, 26, 0, 26); c.bezierCurveTo(-13, 26, -12, 10, 2, -4); c.fill();
  } else if (k === 'shade') {
    c.strokeStyle = '#8a5a3c'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 30); c.stroke();
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#fff' : '#ff5d6c'; c.beginPath(); c.moveTo(0, -4); c.arc(0, -4, 32, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4); c.closePath(); c.fill(); }
    c.strokeStyle = '#e8485a'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -4, 32, Math.PI, 2 * Math.PI); c.closePath(); c.stroke();
  } else if (k === 'bud') {
    c.fillStyle = '#ff7fb0'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.sin((i * 6.283) / 5) * 17, -Math.cos((i * 6.283) / 5) * 17, 14, 0, 6.3); c.fill(); }
    c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(0, 0, 11, 0, 6.3); c.fill();
  } else if (k === 'heart') {
    c.fillStyle = '#ff5d8a'; c.beginPath(); c.moveTo(0, 28); c.bezierCurveTo(-44, -4, -22, -40, 0, -14); c.bezierCurveTo(22, -40, 44, -4, 0, 28); c.fill();
  }
  c.restore();
}

export function iconCanvas(kind, bubble = true) {
  const key = kind + (bubble ? 'b' : '');
  if (cache[key]) return cache[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  if (bubble) {
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(40,50,90,.28)'; c.lineWidth = 3;
    c.beginPath(); c.arc(64, 56, 52, 0.42 * Math.PI, 0.58 * Math.PI, true); c.lineTo(64, 126); c.closePath(); c.fill(); c.stroke();
  }
  draw(c, kind);
  return (cache[key] = cv);
}

export class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = { hud: $('hud'), hearts: $('hearts'), water: $('waterfill'), bloom: $('bloomnum'), ring: $('bloomring'), hints: $('hints'), inds: $('inds'), labels: $('labels'), title: $('title'), end: $('end'), endstats: $('endstats'), mute: $('mute') };
    this.inds = new Map(); this.labels = []; this.hintEls = {}; this._v = new THREE.Vector3();
    this.heartEls = [];
  }
  setupHearts(total) {
    this.el.hearts.innerHTML = '';
    for (let i = 0; i < total; i++) { const s = document.createElement('i'); this.el.hearts.appendChild(s); this.heartEls.push(s); }
  }
  hearts(n) { this.heartEls.forEach((e, i) => { if (i < n && !e.classList.contains('on')) e.classList.add('on'); }); }
  meters(water, bloom) {
    this.el.water.style.height = Math.round(water * 100) + '%';
    const pct = Math.round(bloom * 100);
    if (pct !== this._pct) { this._pct = pct; this.el.bloom.textContent = pct; this.el.ring.style.strokeDashoffset = String(100 - pct); }
  }
  showHud(on) { this.el.hud.classList.toggle('hide', !on); this.el.hints.classList.toggle('hide', !on); }
  showTitle(on) { this.el.title.classList.toggle('hide', !on); }
  showEnd(on, stats) { this.el.end.classList.toggle('hide', !on); if (stats) this.el.endstats.textContent = stats; }
  hint(id, html, on) {
    let e = this.hintEls[id];
    if (!e) { if (!on) return; e = this.hintEls[id] = document.createElement('div'); e.className = 'hint'; e.innerHTML = html; this.el.hints.appendChild(e); requestAnimationFrame(() => e.classList.add('on')); }
    e.classList.toggle('on', on);
  }
  ind(id, show, kind, x, y, w, h) {
    let e = this.inds.get(id);
    if (!e) {
      if (!show) return;
      e = document.createElement('div'); e.className = 'ind';
      const img = document.createElement('img'); img.src = iconCanvas(kind, false).toDataURL(); e.appendChild(img);
      const ar = document.createElement('b'); e.appendChild(ar);
      e._kind = kind; e._img = img; e._ar = ar;
      this.el.inds.appendChild(e); this.inds.set(id, e);
    }
    e.classList.toggle('on', show);
    if (!show) return;
    if (e._kind !== kind) { e._kind = kind; e._img.src = iconCanvas(kind, false).toDataURL(); }
    const m = 64, k = Math.min((w / 2 - m) / Math.max(1e-3, Math.abs(x)), (h / 2 - m) / Math.max(1e-3, Math.abs(y)));
    e.style.transform = `translate(${w / 2 + x * k}px, ${h / 2 - y * k}px)`;
    e._ar.style.transform = `rotate(${Math.atan2(x, y)}rad) translateY(-34px)`;
  }
  label(text, getPos, dur = 3.5) {
    const e = document.createElement('div'); e.className = 'label'; e.textContent = text;
    this.el.labels.appendChild(e);
    this.labels.push({ e, getPos, t: dur });
  }
  update(dt, camera, w, h) {
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.t -= dt;
      if (l.t <= 0) { l.e.remove(); this.labels.splice(i, 1); continue; }
      this._v.copy(l.getPos()).project(camera);
      l.e.style.transform = `translate(${(this._v.x * 0.5 + 0.5) * w}px, ${(-this._v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      l.e.style.opacity = String(Math.min(1, l.t * 2) * (this._v.z < 1 ? 1 : 0));
    }
  }
}
