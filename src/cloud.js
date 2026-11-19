import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R, clamp, damp, V, frameQuat, anyTangent, geo, T } from './util.js';

const _a = V(), _b = V();
const WHITE = new THREE.Color(0xffffff), SLATE = new THREE.Color(0x7c89ab), ZAP = new THREE.Color(0xffe27a);

export function makeCloudMesh() {
  const group = new THREE.Group(), inner = new THREE.Group();
  group.add(inner);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8f9ec4, emissiveIntensity: 0.4 });
  const puffs = [[0, 0, 0, 1], [0.85, -0.12, 0, 0.68], [-0.85, -0.1, 0.05, 0.72], [0.4, 0.36, -0.1, 0.66], [-0.42, 0.32, 0, 0.6], [0, -0.14, 0.42, 0.72], [0.1, -0.05, -0.5, 0.7], [1.3, -0.25, 0.1, 0.4], [-1.32, -0.24, 0, 0.42]];
  const body = new THREE.Mesh(mergeGeometries(puffs.map(([x, y, z, r]) => { const s = geo.sph(r, 18, 14); s.applyMatrix4(T(x, y * 0.9, z, 1, 0.82, 1)); return s; })), mat);
  body.castShadow = true;
  inner.add(body);
  const dark = new THREE.MeshBasicMaterial({ color: 0x23233a });
  const eyeG = geo.sph(0.105, 12, 10);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(eyeG, dark);
    e.position.set(s * 0.3, 0.4, 0.87); e.scale.set(1, 1.25, 0.5); e.rotation.x = -0.45;
    const gl = new THREE.Mesh(geo.sph(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    gl.position.set(0.03, 0.04, 0.09); e.add(gl);
    inner.add(e);
    return e;
  });
  const cheekM = new THREE.MeshBasicMaterial({ color: 0xff9db4, transparent: true, opacity: 0.85 });
  [-1, 1].forEach((s) => { const c = new THREE.Mesh(geo.sph(0.12, 10, 8), cheekM); c.position.set(s * 0.56, 0.22, 0.83); c.scale.set(1, 0.7, 0.3); c.rotation.x = -0.4; inner.add(c); });
  const mouth = new THREE.Mesh(geo.sph(0.07, 10, 8), dark);
  mouth.position.set(0, 0.2, 0.97); mouth.scale.set(1.3, 0.55, 0.4);
  inner.add(mouth);
  return { group, inner, body, mat, eyes, mouth };
}

export class Cloud {
  constructor(scene) {
    this.p = V(0, 1, 0); this.f = V(0, 0, 1); this.vel = V(); this.pos = V();
    this.water = 0.55; this.alt = R + 3; this.charge = 0; this.level = 0; this.size = 0.8;
    this.t = 0; this.blink = 2; this.joyT = 0; this.raining = false; this.cough = 0;
    this.mesh = makeCloudMesh();
    scene.add(this.mesh.group);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x1a2040, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadowG = new THREE.Group(); this.shadowG.add(this.shadow);
    scene.add(this.shadowG);
  }
  place(p, f) {
    this.p.copy(p).normalize();
    if (f) this.f.copy(f); else anyTangent(this.p, this.f);
    this.f.addScaledVector(this.p, -this.f.dot(this.p)).normalize();
    this.vel.set(0, 0, 0);
  }
  rainAng() { return 0.15 + this.level * 0.007; }
  update(dt, ix, iy, world) {
    this.t += dt;
    const { p, f, vel } = this;
    _a.crossVectors(f, p); // screen-right
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const sp = 0.46 * (this.charge > 0 ? 0.35 : 1);
    _b.set(0, 0, 0).addScaledVector(f, iy * sp).addScaledVector(_a, ix * sp);
    vel.x = damp(vel.x, _b.x, 4, dt); vel.y = damp(vel.y, _b.y, 4, dt); vel.z = damp(vel.z, _b.z, 4, dt);
    p.addScaledVector(vel, dt).normalize();
    f.addScaledVector(p, -f.dot(p)).normalize();
    vel.addScaledVector(p, -vel.dot(p));
    const ground = world.groundAt(p);
    this.ground = ground;
    this.alt = damp(this.alt, ground + 2.3, 3, dt);
    this.size = 0.56 + this.water * 0.36 + this.level * 0.035;
    this.pos.copy(p).multiplyScalar(this.alt + Math.sin(this.t * 1.7) * 0.09);
    const g = this.mesh.group;
    g.position.copy(this.pos);
    if (this.charge > 0) g.position.add(_b.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.1 * Math.min(1, this.charge)));
    _b.copy(f).negate();
    frameQuat(p, _b, g.quaternion);
    const wob = Math.sin(this.t * 2.1) * 0.05, sq = this.joyT > 0 ? Math.sin(this.joyT * 14) * 0.12 : 0;
    g.scale.set(this.size * (1 + wob - sq), this.size * (1 - wob + sq), this.size * (1 + wob));
    // lean into motion
    const vx = vel.dot(_a.crossVectors(f, p)), vy = vel.dot(f);
    this.mesh.inner.rotation.z = damp(this.mesh.inner.rotation.z, vx * 0.9, 5, dt);
    this.mesh.inner.rotation.x = damp(this.mesh.inner.rotation.x, vy * 0.7, 5, dt);
    // colour: heavier = darker
    const m = this.mesh.mat;
    m.color.copy(WHITE).lerp(SLATE, Math.pow(this.water, 1.6) * 0.7);
    if (this.charge > 0) m.color.lerp(ZAP, Math.min(1, this.charge) * 0.6 * (0.6 + 0.4 * Math.sin(this.t * 40)));
    m.emissiveIntensity = 0.4 + Math.min(1, this.charge) * 0.8;
    // face
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 1.5 + Math.random() * 3.5;
    let ey = this.blink < 0 ? 0.12 : 1.25;
    if (this.raining) ey = 0.3;
    if (this.joyT > 0) { this.joyT -= dt; ey = 0.35; }
    if (this.cough > 0) { this.cough -= dt; ey = 0.2; }
    for (const e of this.mesh.eyes) e.scale.y = damp(e.scale.y, ey, 22, dt);
    const mo = this.mesh.mouth;
    const mw = this.raining || this.charge > 0 ? 0.9 : this.joyT > 0 ? 2.0 : 1.3, mh = this.raining || this.charge > 0 ? 1.3 : this.joyT > 0 ? 0.9 : 0.5;
    mo.scale.x = damp(mo.scale.x, mw, 12, dt); mo.scale.y = damp(mo.scale.y, mh, 12, dt);
    // blob shadow
    this.shadowG.position.copy(p).multiplyScalar(ground + 0.12);
    frameQuat(p, f, this.shadowG.quaternion);
    this.shadowG.scale.setScalar(this.size * 1.3);
  }
}
