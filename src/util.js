import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const R = 10;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomUnit(rnd, out = V()) {
  const y = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

const _Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _z = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3();

// orientation with local +Y along p, spun by yaw
export function surfQuat(p, yaw = 0, out = new THREE.Quaternion()) {
  out.setFromUnitVectors(_Y, p);
  _q.setFromAxisAngle(_Y, yaw);
  return out.multiply(_q);
}

// orientation with local +Y along p and local +Z along fwd (projected to the tangent plane)
export function frameQuat(p, fwd, out = new THREE.Quaternion()) {
  _z.copy(fwd).addScaledVector(p, -fwd.dot(p));
  if (_z.lengthSq() < 1e-8) anyTangent(p, _z); else _z.normalize();
  _x.crossVectors(p, _z);
  _m.makeBasis(_x, p, _z);
  return out.setFromRotationMatrix(_m);
}

export function anyTangent(p, out = V()) {
  if (Math.abs(p.y) > 0.9) out.set(1, 0, 0); else out.set(0, 1, 0);
  return out.cross(p).normalize();
}

// point at angular distance `dist` from p along compass `bearing`
export function offsetOnSphere(p, bearing, dist, out = V()) {
  anyTangent(p, _t);
  _b.crossVectors(p, _t);
  _t.multiplyScalar(Math.cos(bearing)).addScaledVector(_b, Math.sin(bearing));
  return out.copy(p).multiplyScalar(Math.cos(dist)).addScaledVector(_t, Math.sin(dist)).normalize();
}

// rotate unit p toward unit target by at most `step` radians; returns the remaining angle
export function stepToward(p, target, step) {
  const ang = Math.acos(clamp(p.dot(target), -1, 1));
  if (ang < 1e-5) return 0;
  const t = Math.min(1, step / ang), s = Math.sin(ang);
  const a = Math.sin((1 - t) * ang) / s, b = Math.sin(t * ang) / s;
  p.multiplyScalar(a).addScaledVector(target, b).normalize();
  return ang * (1 - t);
}

// ---------- tiny modelling kit ----------
export const VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const VCS = new THREE.MeshLambertMaterial({ vertexColors: true });
const _c = new THREE.Color();

export function T(x = 0, y = 0, z = 0, sx = 1, sy, sz, rx = 0, ry = 0, rz = 0) {
  if (sy === undefined) sy = sx;
  if (sz === undefined) sz = sx;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

export function part(g0, color, m) {
  const g = g0.index ? g0.toNonIndexed() : g0.clone();
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (m) g.applyMatrix4(m);
  _c.set(color);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export const merge = (parts) => mergeGeometries(parts, false);

export function vcMesh(parts, smooth = false, mat) {
  const m = new THREE.Mesh(merge(parts), mat || (smooth ? VCS : VC));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const geo = {
  sph: (r = 1, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h),
  dome: (r = 1, w = 12, h = 6, a = Math.PI / 2) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, a),
  ico: (r = 1, d = 1) => new THREE.IcosahedronGeometry(r, d),
  cyl: (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  tor: (r, t, a = 8, b = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, a, b, arc),
};

export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
