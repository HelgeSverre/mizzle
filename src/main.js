import * as THREE from 'three';
import { R, clamp, lerp, sstep, damp, V, offsetOnSphere, stepToward } from './util.js';
import { createWorld } from './world.js';
import { FX } from './fx.js';
import { Cloud, makeCloudMesh } from './cloud.js';
import { createQuests } from './quests.js';
import { createPost } from './post.js';
import { Sound } from './audio.js';
import { UI, iconCanvas } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);

const G = { scene, camera, renderer, sun: V(1, 0.25, 0).normalize(), state: 'title', time: 0, playT: 0, ts: 1, camK: 0, zoom: 1, q: 1, finale: false, ended: false, baby: null };
window.MIZZLE = G;
const W = (G.world = createWorld(scene, 1337));
const fx = (G.fx = new FX(scene));
W.fx = fx;
const audio = (G.audio = new Sound());
const ui = (G.ui = new UI());
const cloud = (G.cloud = new Cloud(scene));
const quests = (G.quests = createQuests(G));
W.scatter(quests.avoid());
const post = createPost(renderer, scene, camera);
ui.setupHearts(quests.total);

// ---------- lights ----------
const sunLight = new THREE.DirectionalLight(0xfff0d6, 3.1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 20, far: 80 });
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.06;
scene.add(sunLight, sunLight.target);
const moonLight = new THREE.DirectionalLight(0x9aa8ff, 2.3);
scene.add(moonLight, moonLight.target);
scene.add(new THREE.AmbientLight(0xa9b4ee, 1.0));

// ---------- start placement ----------
const p0 = offsetOnSphere(W.sites.turnip, 1.1, 0.3);
const f0 = V().copy(W.sites.turnip).sub(p0);
cloud.place(p0, f0);
const sunA0 = Math.atan2(W.sites.turnip.z, W.sites.turnip.x) + 0.55;
const DAY = 440;

W.onHiss = (pos, d) => { audio.hiss(); fx.puff(_a.copy(pos).addScaledVector(d, 1), 12, 1, 1, 1, 1.4, 0.55, 1.3, 0.6); };
W.onIgnite = () => audio.pop(0.45);

const dropImg = `<img src="${iconCanvas('drop', false).toDataURL()}">`, boltImg = `<img src="${iconCanvas('bolt', false).toDataURL()}">`;
G.onThunderUnlock = () => {
  ui.hint('zap', `<kbd>E</kbd>${boltImg}`, true);
  audio.sparkle(67); cloud.joyT = 1.6; fx.flash = Math.max(fx.flash, 0.25);
  fx.sparks(cloud.pos, 40, 4, 3.4, 1.4, 4, 0.22, 0.9, 0);
};
G.onFinale = () => { G.finale = true; audio.finale(); fx.flash = 1; };
G.onEnd = () => {
  G.ended = true; G.endT = 0;
  const s = Math.floor(G.playT), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
  ui.showEnd(true, `${mm}:${ss}`);
};
G.spawnBaby = (pos) => {
  const m = makeCloudMesh();
  scene.add(m.group);
  G.baby = { m, p: V().copy(pos).normalize(), pos: pos.clone(), t: 0 };
  audio.chirp(1.9, true); audio.pop(1.6);
  fx.hearts(pos, G.baby.p, 10);
};

// ---------- input ----------
const keys = {};
const used = { move: 0, rain: 0, zap: 0 };
function start() {
  if (G.state !== 'title') return;
  audio.init();
  G.state = 'play';
  ui.showTitle(false); ui.showHud(true);
  ui.hint('move', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', true);
  ui.hint('rain', `<kbd class="wide">space</kbd>${dropImg}`, true);
}
G.start = start;
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  if (G.state === 'title') { start(); return; }
  if (G.ended && G.endT > 1.5) { ui.showEnd(false); G.ended = false; }
  if (e.code === 'KeyM') toggleMute();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('pointerdown', () => start());
document.getElementById('title').addEventListener('pointerdown', () => start());
function toggleMute() { audio.setMute(!audio.muted); ui.el.mute.classList.toggle('off', audio.muted); }
ui.el.mute.addEventListener('click', toggleMute);

// ---------- gameplay ----------
const _a = V(), _b = V(), _c = V(), _to = V(), _from = V();
let rainAmt = 0, snowing = false;

function strike() {
  const tgt = quests.zapTarget(cloud.p);
  let d = cloud.p, h = 0, tree = null;
  if (tgt) { d = tgt.d; h = tgt.h; } else { tree = W.nearestTree(cloud.p, 0.1); if (tree) { d = tree.d; h = 1.3 * tree.g; } }
  _to.copy(d).multiplyScalar(W.groundAt(d) + h);
  _from.copy(cloud.pos).addScaledVector(cloud.p, -0.4);
  fx.strike(_from, _to, camera.position);
  audio.thunder();
  cloud.water = Math.max(0, cloud.water - 0.22);
  if (tgt) tgt.hit(); else { if (tree) W.ignite(tree); quests.soot(d); }
  used.zap++;
}
G.strike = strike;

function updatePlay(dt) {
  G.playT += G.ended || quests.bud.stage === 'done' ? 0 : dt;
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (ix || iy) used.move += dt;
  cloud.update(dt, ix, iy, W);
  const ground = cloud.ground;
  const zapKey = keys.KeyE || keys.KeyF || keys.ShiftLeft || keys.ShiftRight;
  const wantRain = !!keys.Space && cloud.water > 0.005 && cloud.charge === 0;
  const overWater = !W.isLand(cloud.p) || quests.pondAt(cloud.p);
  snowing = W.isCold(cloud.p);
  if (wantRain) { cloud.water = Math.max(0, cloud.water - dt / 15); used.rain += dt; }
  else if (overWater && cloud.water < 1 && !keys.Space) {
    cloud.water = Math.min(1, cloud.water + dt * 0.36);
    fx.vapor(cloud, ground); audio.slurp(dt);
  }
  cloud.raining = wantRain;
  rainAmt = damp(rainAmt, wantRain ? 1 : 0, 9, dt);
  fx.rainUpdate(cloud, ground, rainAmt, snowing, dt);
  if (rainAmt > 0.5) {
    const ang = cloud.rainAng();
    W.addWater(cloud.p, ang, dt);
    quests.rain(cloud.p, ang, dt, snowing);
  }
  const sunlit = G.sun.dot(cloud.p) > -0.05;
  fx.rainbowUpdate(cloud, ground, camera.position, sunlit, dt, wantRain && !snowing);
  quests.hover(cloud.p, dt);
  // thunder
  if (quests.thunder) {
    if (zapKey) cloud.charge += dt * 1.6;
    else if (cloud.charge > 0) {
      if (cloud.charge > 0.6) {
        if (cloud.water >= 0.2) strike();
        else { audio.cough(); cloud.cough = 0.5; fx.puff(cloud.pos, 6, 0.8, 0.8, 0.85, 1, 0.4, 0.6, 0.6); }
      }
      cloud.charge = 0;
    }
    if (cloud.charge > 0 && Math.random() < dt * 30) fx.sparks(_a.copy(cloud.pos).add(_b.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * cloud.size)), 1, 4, 3.6, 1.6, 0.6, 0.16, 0.25, 0);
  }
  // baby cloud
  if (G.baby) {
    const b = G.baby;
    b.t += dt;
    _a.crossVectors(cloud.f, cloud.p);
    _b.copy(cloud.p).addScaledVector(_a, -0.2).addScaledVector(cloud.f, -0.1).normalize();
    stepToward(b.p, _b, 0.6 * dt * Math.acos(clamp(b.p.dot(_b), -1, 1)) + 0.002);
    _c.copy(b.p).multiplyScalar(cloud.alt - 0.5 + Math.sin(b.t * 2.3) * 0.12);
    b.pos.lerp(_c, 1 - Math.exp(-3 * dt));
    b.m.group.position.copy(b.pos);
    b.m.group.quaternion.copy(cloud.mesh.group.quaternion);
    b.m.group.scale.setScalar(0.34 * (1 + Math.sin(b.t * 3) * 0.05));
    for (const e of b.m.eyes) e.scale.y = wantRain ? 0.3 : 1.25;
    if (wantRain) {
      W.addWater(b.p, 0.09, dt);
      if (Math.random() < dt * 40) fx.soft.spawn(_a.copy(b.pos).add(_b.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5)), _b.copy(b.p).multiplyScalar(-6), 0.45, 0.08, 0.06, 0.8, 0.93, 1, 0.9);
    }
  }
  // ambient life: fireflies at night, drifting petals by day
  if (W.flora.length && Math.random() < dt * 28) {
    const f = W.flora[(Math.random() * W.flora.length) | 0];
    if (f.g > 0.5 && f.x * cloud.p.x + f.y * cloud.p.y + f.z * cloud.p.z > 0.55) {
      _a.set(f.x, f.y, f.z);
      const lit = G.sun.dot(_a);
      const r = W.radiusAt(_a) + 0.3 + Math.random() * 0.8;
      _b.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5);
      if (lit < -0.1) fx.glow.spawn(_c.copy(_a).multiplyScalar(r), _b, 2.5 + Math.random() * 2, 0.16, 0.05, 1.6, 2.2, 0.5, 0.9);
      else if (lit > 0.2 && Math.random() < 0.35) fx.soft.spawn(_c.copy(_a).multiplyScalar(r), _b.addScaledVector(_a, 0.25), 3, 0.09, 0.07, 1, 0.8, 0.9, 0.85);
    }
  }
  // audio + ui
  audio.setRain(rainAmt * (snowing ? 0.25 : 1));
  audio.setCharge(clamp(cloud.charge));
  audio.setWind(cloud.vel.length() / 0.46);
  audio.night = sstep(0.1, -0.3, G.sun.dot(cloud.p));
  audio.progress = damp(audio.progress, clamp((quests.joy / quests.total) * 0.8 + W.bloom * 0.25 + (G.finale ? 0.3 : 0)), 0.5, dt);
  ui.meters(cloud.water, W.bloom);
  if (used.move > 2.5) ui.hint('move', '', false);
  if (used.rain > 2.5) ui.hint('rain', '', false);
  if (used.zap > 0) ui.hint('zap', '', false);
  updateIndicators();
}

function updateIndicators() {
  const w = innerWidth, h = innerHeight;
  const horizon = R / camera.position.length();
  _c.copy(camera.position).normalize();
  _b.crossVectors(cloud.f, cloud.p);
  const seen = new Set();
  for (const t of quests.targets()) {
    seen.add(t.id);
    _a.copy(t.d).multiplyScalar(W.groundAt(t.d) + 1.8).project(camera);
    const on = t.d.dot(_c) > horizon - 0.06 && Math.abs(_a.x) < 0.9 && Math.abs(_a.y) < 0.86;
    if (on) { ui.ind(t.id, false); continue; }
    _a.copy(t.d).addScaledVector(cloud.p, -t.d.dot(cloud.p));
    let x = _a.dot(_b), y = _a.dot(cloud.f);
    const l = Math.hypot(x, y);
    if (l < 1e-4) { x = 0; y = 1; } else { x /= l; y /= l; }
    ui.ind(t.id, true, t.icon, x, y, w, h);
  }
  for (const id of ui.inds.keys()) if (!seen.has(id)) ui.ind(id, false);
}

// ---------- camera ----------
const cp = cloud.p.clone(), cf = cloud.f.clone();
const playPos = V(), playTgt = V(), playUp = V(), titlePos = V(), titleTgt = V(), tgt = V(), up = V();
const Y = V(0, 1, 0);
function updateCamera(dt) {
  const k = 1 - Math.exp(-5 * dt);
  cp.lerp(cloud.p, k).normalize();
  cf.lerp(cloud.f, k); cf.addScaledVector(cp, -cf.dot(cp)).normalize();
  G.zoom = damp(G.zoom, G.finale && quests.bud.stage === 'bloom' ? 1.5 : 1, 1.2, dt);
  const z = G.zoom;
  playPos.copy(cp).multiplyScalar(R + 17 * z).addScaledVector(cf, -9.5 * z);
  playTgt.copy(cp).multiplyScalar(R).addScaledVector(cf, 0.7);
  playUp.copy(cf).addScaledVector(cp, 0.4).normalize();
  _a.copy(p0).applyAxisAngle(Y, G.time * 0.06 - 0.6);
  _a.y = _a.y * 0.4 + 0.3; _a.normalize();
  titlePos.copy(_a).multiplyScalar(47);
  titleTgt.set(0, 5.5, 0);
  G.camK = clamp(G.camK + (G.state === 'play' ? dt / 3.2 : -dt));
  const e = G.camK * G.camK * (3 - 2 * G.camK);
  camera.position.lerpVectors(titlePos, playPos, e);
  tgt.lerpVectors(titleTgt, playTgt, e);
  up.lerpVectors(Y, playUp, e).normalize();
  if (fx.shake > 0) camera.position.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(fx.shake * 0.5));
  camera.up.copy(up);
  camera.lookAt(tgt);
  W.sky.position.copy(camera.position);
  _a.copy(cloud.p).multiplyScalar(cloud.ground || R).project(camera);
  const u = post.fin.uniforms;
  u.uFocus.value = lerp(0.42, clamp(_a.y * 0.5 + 0.5, 0.25, 0.7), e);
  u.uBlur.value = lerp(0.55, 1, e);
}

// ---------- resize / quality ----------
function resize() {
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2) * G.q;
  post.setSize(w, h, pr);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 50 : 36;
  camera.updateProjectionMatrix();
  fx.setScale((h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
addEventListener('resize', resize);
resize();

let last = performance.now(), ema = 16, slowT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  ema = lerp(ema, raw * 1000, 0.05);
  if (G.time > 4 && ema > 26 && G.q > 0.5) { slowT += raw; if (slowT > 2) { slowT = 0; G.q = Math.max(0.5, G.q - 0.17); resize(); } } else slowT = 0;
  step(Math.min(0.05, raw) * G.ts);
  post.composer.render();
}
function step(dt) {
  G.time += dt;
  const a = sunA0 + G.time * ((Math.PI * 2) / DAY);
  G.sun.set(Math.cos(a), 0.25, Math.sin(a)).normalize();
  W.uSun.value.copy(G.sun);
  sunLight.position.copy(G.sun).multiplyScalar(50);
  moonLight.position.copy(G.sun).multiplyScalar(-50);
  if (G.state === 'play') updatePlay(dt);
  else cloud.update(dt, 0, 0, W);
  if (G.ended) G.endT += dt;
  quests.update(dt);
  W.update(dt, G.time);
  fx.update(dt);
  updateCamera(dt);
  ui.update(dt, camera, innerWidth, innerHeight);
  const u = post.fin.uniforms;
  u.uFlash.value = fx.flash * 0.5;
  u.uTime.value = G.time;
}
G.step = step;

// debug helpers (console): MIZZLE.dbg.tp('windmill'), MIZZLE.dbg.skip()
G.dbg = {
  tp(kind) { const d = kind === 'bud' ? quests.bud.p : quests.list.find((q) => q.kind === kind).propD; cloud.place(d); cp.copy(cloud.p); cf.copy(cloud.f); },
  skip() { quests.skip(); },
  sim(sec, hold = {}) { Object.assign(keys, hold); for (let i = 0; i < sec * 30; i++) step(1 / 30); for (const k in hold) keys[k] = false; },
  info() { return { state: G.state, joy: quests.joy, bloom: +W.bloom.toFixed(3), water: +cloud.water.toFixed(2), thunder: quests.thunder, bud: quests.bud.stage, stages: quests.list.map((q) => `${q.kind}:${q.stage}${q.active ? '*' : ''}`).join(' '), world: W.stats(), q: G.q, ema: +ema.toFixed(1) }; },
};

requestAnimationFrame(frame);
