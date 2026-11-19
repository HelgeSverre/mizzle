import * as THREE from 'three';
import { clamp, damp, V, frameQuat, anyTangent, offsetOnSphere, stepToward, part, merge, geo, T, vcMesh } from './util.js';

const _a = V(), _b = V();

function hatParts(hat) {
  const g = 0x5fcf5f;
  switch (hat) {
    case 'flower': return [part(geo.cyl(0.012, 0.012, 0.12, 4), g, T(0, 0.7, 0)), part(geo.ico(0.075, 0), 0xff7fb0, T(0, 0.79, 0, 1, 0.6, 1)), part(geo.sph(0.035, 6, 5), 0xffd84a, T(0, 0.82, 0))];
    case 'cap': return [part(geo.dome(0.2, 10, 5), 0xe8584f, T(0, 0.52, 0, 1, 0.8, 1)), part(geo.cyl(0.1, 0.1, 0.02, 8), 0xe8584f, T(0, 0.55, 0.2))];
    case 'helmet': return [part(geo.tor(0.21, 0.035, 6, 14), 0xb9c4d6, T(0, 0.52, 0, 1, 1, 1, Math.PI / 2)), part(geo.cyl(0.01, 0.01, 0.16, 4), 0xb9c4d6, T(0, 0.74, 0)), part(geo.sph(0.035, 6, 5), 0xff5a5a, T(0, 0.83, 0))];
    case 'scarf': return [part(geo.tor(0.24, 0.055, 6, 14), 0xe8584f, T(0, 0.3, 0, 1, 1, 1, Math.PI / 2)), part(geo.box(0.09, 0.22, 0.04), 0xe8584f, T(0.16, 0.2, 0.2, 1, 1, 1, 0, 0, -0.2)), part(geo.cyl(0.012, 0.012, 0.12, 4), g, T(0, 0.7, 0)), part(geo.sph(0.06, 6, 5), 0xffffff, T(0, 0.78, 0))];
    case 'shades': return [part(geo.box(0.34, 0.075, 0.05), 0x1a1a22, T(0, 0.43, 0.235)), part(geo.cyl(0.012, 0.012, 0.12, 4), g, T(0, 0.7, 0)), part(geo.sph(0.07, 6, 5), g, T(0.06, 0.77, 0, 1, 0.3, 0.55))];
    case 'bow': return [part(geo.cone(0.08, 0.14, 5), 0xff5fa0, T(-0.07, 0.69, 0, 1, 1, 1, 0, 0, -1.57)), part(geo.cone(0.08, 0.14, 5), 0xff5fa0, T(0.07, 0.69, 0, 1, 1, 1, 0, 0, 1.57)), part(geo.sph(0.04, 6, 5), 0xff9fc6, T(0, 0.69, 0))];
    case 'tophat': return [part(geo.cyl(0.11, 0.11, 0.17, 10), 0x22222c, T(0, 0.74, 0)), part(geo.cyl(0.18, 0.18, 0.025, 10), 0x22222c, T(0, 0.66, 0))];
    default: return [part(geo.cyl(0.012, 0.012, 0.12, 4), g, T(0, 0.7, 0)), part(geo.sph(0.075, 6, 5), g, T(0.065, 0.77, 0, 1, 0.3, 0.55, 0, 0, 0.5)), part(geo.sph(0.075, 6, 5), g, T(-0.065, 0.77, 0, 1, 0.3, 0.55, 0, 0, -0.5))];
  }
}

const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });

export class Pip {
  constructor(G, dir, color, name, pitch, hat) {
    this.G = G; this.name = name; this.pitch = pitch;
    this.d = dir.clone(); this.home = dir.clone(); this.target = dir.clone(); this.fwd = anyTangent(dir).clone();
    this.pos = V(); this.t = Math.random() * 10; this.wait = 1; this.mode = 'wander';
    this.happy = 0; this.wet = 0; this.soot = 0; this.blink = 2; this.zz = 0; this.chirpT = 2 + Math.random() * 3; this.spin = 0; this.born = 0;
    const group = new THREE.Group(), inner = new THREE.Group();
    group.add(inner);
    const prof = [[0.001, 0], [0.16, 0.01], [0.25, 0.1], [0.285, 0.26], [0.265, 0.42], [0.2, 0.56], [0.1, 0.64], [0.001, 0.665]].map(([x, y]) => new THREE.Vector2(x, y));
    const parts = [part(new THREE.LatheGeometry(prof, 16), color), part(geo.sph(0.05, 8, 6), 0xff8fa3, T(-0.18, 0.33, 0.2, 1, 1, 0.4)), part(geo.sph(0.05, 8, 6), 0xff8fa3, T(0.18, 0.33, 0.2, 1, 1, 0.4)), ...hatParts(hat)];
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(merge(parts), this.mat);
    body.castShadow = true;
    inner.add(body);
    this.eyes = new THREE.Mesh(merge([
      part(geo.sph(0.04, 8, 6), 0x1a1a22, T(-0.095, 0, 0.24)), part(geo.sph(0.04, 8, 6), 0x1a1a22, T(0.095, 0, 0.24)),
      part(geo.sph(0.014, 5, 4), 0xffffff, T(-0.085, 0.015, 0.275)), part(geo.sph(0.014, 5, 4), 0xffffff, T(0.105, 0.015, 0.275)),
    ]), eyeMat);
    this.eyes.position.y = 0.43;
    this.eyes.visible = hat !== 'shades';
    inner.add(this.eyes);
    const fc = new THREE.Color(color).multiplyScalar(0.72);
    this.feet = [-1, 1].map((s) => { const f = new THREE.Mesh(geo.sph(0.075, 8, 6), new THREE.MeshLambertMaterial({ color: fc })); f.position.set(s * 0.11, 0.04, 0.03); f.scale.set(1, 0.7, 1.3); inner.add(f); return f; });
    this.umb = vcMesh([part(geo.cyl(0.012, 0.012, 0.5, 4), 0x6a8f3c, T(0.2, 0.62, 0)), part(geo.cone(0.46, 0.2, 9), 0x66d066, T(0.2, 0.95, 0))]);
    this.umb.scale.setScalar(0.001);
    inner.add(this.umb);
    group.scale.setScalar(0.001);
    this.group = group; this.inner = inner;
    G.scene.add(group);
    this.pickTarget();
  }
  pickTarget() {
    for (let i = 0; i < 6; i++) {
      offsetOnSphere(this.home, Math.random() * 6.283, 0.03 + Math.random() * 0.075, this.target);
      if (this.G.world.elev(this.target) > 0.04) return;
    }
    this.target.copy(this.home);
  }
  update(dt) {
    const G = this.G, W = G.world;
    this.t += dt; this.born += dt;
    const asleep = this.mode === 'wander' && this.happy <= 0 && G.sun.dot(this.d) < -0.25 && this.wet <= 0;
    let hop = 0, walking = false;
    if (this.happy > 0) {
      this.happy -= dt;
      hop = Math.abs(Math.sin(this.t * 8)) * 0.4;
      this.spin += dt * 7;
    } else {
      this.spin = damp(this.spin, Math.round(this.spin / 6.283) * 6.283, 8, dt);
      const tgt = this.mode === 'stay' ? this.home : this.target;
      if (!asleep && (this.mode === 'stay' || this.wait <= 0)) {
        if (this.d.dot(tgt) < 0.99999) {
          _a.copy(tgt).addScaledVector(this.d, -tgt.dot(this.d));
          if (_a.lengthSq() > 1e-9) this.fwd.lerp(_a.normalize(), Math.min(1, dt * 8));
          stepToward(this.d, tgt, 0.034 * dt);
          walking = true;
        } else if (this.mode === 'wander') { this.wait = 0.8 + Math.random() * 3.5; this.pickTarget(); }
      } else if (this.wait > 0) this.wait -= dt;
      if (walking) hop = Math.abs(Math.sin(this.t * 11)) * 0.08;
      else if (this.mode === 'stay') { const k = this.t % 2.2; if (k < 0.32) hop = Math.sin((k / 0.32) * Math.PI) * 0.2; }
    }
    if (!walking && !asleep) {
      _a.copy(G.cloud.p).addScaledVector(this.d, -G.cloud.p.dot(this.d));
      if (_a.lengthSq() > 1e-4) this.fwd.lerp(_a.normalize(), Math.min(1, dt * 3));
    }
    this.fwd.addScaledVector(this.d, -this.fwd.dot(this.d)).normalize();
    this.pos.copy(this.d).multiplyScalar(W.groundAt(this.d) + hop);
    this.group.position.copy(this.pos);
    frameQuat(this.d, this.fwd, this.group.quaternion);
    const s = 1.6 * clamp(this.born * 2.5) * (1 + Math.max(0, 0.4 - this.born) * 1.2);
    this.group.scale.set(s, s * (1 + hop * 0.5) * (asleep ? 0.92 + Math.sin(this.t * 1.5) * 0.03 : 1), s);
    this.inner.rotation.y = this.spin;
    this.inner.rotation.z = walking ? Math.sin(this.t * 11) * 0.16 : 0;
    this.feet[0].position.y = 0.04 + (walking ? Math.max(0, Math.sin(this.t * 11)) * 0.07 : 0);
    this.feet[1].position.y = 0.04 + (walking ? Math.max(0, -Math.sin(this.t * 11)) * 0.07 : 0);
    // eyes
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 1.5 + Math.random() * 4;
    this.eyes.scale.y = damp(this.eyes.scale.y, asleep ? 0.12 : this.blink < 0 ? 0.1 : this.happy > 0 ? 0.45 : 1, 25, dt);
    // umbrella
    if (this.wet > 0) this.wet -= dt;
    this.umb.scale.setScalar(damp(this.umb.scale.x, this.wet > 0 ? 1 : 0.001, 10, dt));
    // soot
    if (this.soot > 0) {
      this.soot -= dt;
      this.mat.color.setScalar(0.22);
      if (Math.random() < dt * 6) G.fx.puff(_b.copy(this.pos).addScaledVector(this.d, 0.8), 1, 0.2, 0.2, 0.2, 0.4, 0.25, 0.9, 0.5);
      if (this.soot <= 0) this.mat.color.setScalar(1);
    }
    if (asleep) {
      this.zz -= dt;
      if (this.zz <= 0) { this.zz = 1.3; G.fx.zzz(_b.copy(this.pos).addScaledVector(this.d, 0.95), this.d); }
    }
    if (this.mode === 'stay' && this.happy <= 0) {
      this.chirpT -= dt;
      if (this.chirpT <= 0) { this.chirpT = 3.5 + Math.random() * 4; if (G.cloud.p.dot(this.d) > 0.75) G.audio.chirp(this.pitch, false); }
    }
  }
}

export function makeHouse(cap) {
  const g = new THREE.Group();
  const parts = [
    part(geo.cyl(0.36, 0.44, 0.62, 10), 0xfff1d6, T(0, 0.31, 0)),
    part(geo.dome(0.74, 14, 7), cap, T(0, 0.52, 0, 1, 0.82, 1)),
    part(geo.cyl(0.75, 0.75, 0.04, 14), 0xfff7e8, T(0, 0.52, 0)),
    part(geo.box(0.2, 0.32, 0.06), 0x8a5a3c, T(0, 0.16, 0.42)),
    part(geo.cyl(0.07, 0.07, 0.34, 6), 0xfff1d6, T(0.36, 0.98, -0.12)),
  ];
  for (let i = 0; i < 7; i++) {
    const th = 0.35 + (i % 3) * 0.38, ph = i * 2.4;
    parts.push(part(geo.sph(0.1, 7, 5), 0xffffff, T(Math.sin(th) * Math.cos(ph) * 0.72, 0.52 + Math.cos(th) * 0.72 * 0.82, Math.sin(th) * Math.sin(ph) * 0.72, 1, 0.5, 1)));
  }
  g.add(vcMesh(parts, true));
  const win = new THREE.Mesh(geo.sph(0.085, 8, 6), new THREE.MeshBasicMaterial({ color: 0x35405a }));
  win.position.set(0.24, 0.4, 0.33); win.scale.z = 0.5;
  g.add(win);
  g.userData.win = win;
  return g;
}
