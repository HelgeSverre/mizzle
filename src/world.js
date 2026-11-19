import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R, clamp, lerp, sstep, V, surfQuat, offsetOnSphere, randomUnit, part, merge, geo, T, rng } from './util.js';
import { makeNoise } from './noise.js';

const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Color();

// a set of InstancedMeshes sharing one transform per instance, with a "grow" factor
class Inst {
  constructor(scene, geos, mats, max, shadow) {
    this.meshes = geos.map((g, i) => {
      const m = new THREE.InstancedMesh(g, mats[i], max);
      m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = false;
      scene.add(m);
      return m;
    });
    this.n = 0; this.P = []; this.Q = []; this.S = [];
  }
  add(pos, quat, scale, colors) {
    const i = this.n++;
    this.P.push(pos); this.Q.push(quat); this.S.push(scale);
    this.meshes.forEach((m, k) => { m.count = this.n; if (colors && colors[k]) m.setColorAt(i, colors[k]); });
    this.set(i, 0);
    return i;
  }
  set(i, g) {
    _s.setScalar(Math.max(1e-4, this.S[i] * g));
    _m.compose(this.P[i], this.Q[i], _s);
    for (const m of this.meshes) { m.setMatrixAt(i, _m); m.instanceMatrix.needsUpdate = true; }
  }
  color(i, k, c) {
    const m = this.meshes[k];
    m.setColorAt(i, c);
    m.instanceColor.needsUpdate = true;
  }
}

export function createWorld(scene, seed) {
  const N = makeNoise(seed), rnd = rng(seed * 7 + 1);
  const W = { uTime: { value: 0 }, uSun: { value: V(1, 0, 0) }, fires: [], trees: [], flora: [], fx: null, onHiss: null, onIgnite: null, bloom: 0 };

  const elev = (x, y, z) => {
    let e = N.fbm(x * 1.3 + 3.1, y * 1.3 + 7.7, z * 1.3 - 2.4, 5) * 2.9 - 0.06;
    e += sstep(0.74, 0.95, y) * 0.7;
    return e;
  };
  const rOfE = (e) => (e > 0 ? R + 0.04 + Math.pow(e, 1.3) * 1.45 : R + Math.max(e, -0.6) * 0.9);
  W.elev = (p) => elev(p.x, p.y, p.z);
  W.radiusAt = (p) => rOfE(elev(p.x, p.y, p.z));
  W.groundAt = (p) => Math.max(R, W.radiusAt(p));
  W.isLand = (p) => elev(p.x, p.y, p.z) > 0;
  const coldness = (x, y, z) => sstep(0.66, 0.8, y + N.n3(x * 3, y * 3, z * 3) * 0.06);
  W.isCold = (p) => coldness(p.x, p.y, p.z) > 0.5;

  // ---------- terrain ----------
  const g0 = new THREE.IcosahedronGeometry(1, 40);
  g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  const tg = mergeVertices(g0, 1e-4);
  const pos = tg.attributes.position, n = pos.count;
  const dirs = new Float32Array(n * 3), life = new Float32Array(n), land = new Uint8Array(n);
  const aCol = new Float32Array(n * 3), dCol = new Float32Array(n * 3);
  const C = (h) => new THREE.Color(h);
  const pal = {
    sand: C(0xf3e3ae), deep: C(0x1a6a8c), shallow: C(0x9fe0d8), m1: C(0xa6e06c), m2: C(0x5cc470), forest: C(0x379a6c),
    rock: C(0xa9a2b6), snow: C(0xf5f9ff), snow2: C(0xd9e8ff), d1: C(0xbda58a), d2: C(0xa39180), dcold: C(0xa3a6b8), drock: C(0x8d878f),
  };
  const ca = new THREE.Color(), cd = new THREE.Color();
  let landCount = 0;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const il = 1 / Math.hypot(x, y, z), dx = x * il, dy = y * il, dz = z * il;
    dirs[i * 3] = dx; dirs[i * 3 + 1] = dy; dirs[i * 3 + 2] = dz;
    const e = elev(dx, dy, dz), r = rOfE(e);
    pos.setXYZ(i, dx * r, dy * r, dz * r);
    const n1 = N.n3(dx * 6, dy * 6, dz * 6) * 0.5 + 0.5;
    if (e <= 0) {
      ca.copy(pal.sand).lerp(pal.shallow, sstep(0, -0.12, e)).lerp(pal.deep, sstep(-0.08, -0.5, e));
      cd.copy(ca);
      life[i] = 1;
    } else {
      land[i] = 1; landCount++;
      const cold = coldness(dx, dy, dz);
      ca.copy(pal.m1).lerp(pal.m2, n1);
      ca.lerp(pal.forest, sstep(0.3, 0.7, e) * 0.8);
      ca.lerp(pal.rock, sstep(0.8, 1.05, e));
      ca.lerp(pal.snow, sstep(1.05, 1.25, e));
      ca.lerp(n1 > 0.5 ? pal.snow : pal.snow2, cold);
      cd.copy(pal.d1).lerp(pal.d2, n1).lerp(pal.drock, sstep(0.6, 1.0, e)).lerp(pal.dcold, cold);
      const beach = 1 - sstep(0.02, 0.09, e);
      ca.lerp(pal.sand, beach * (1 - cold));
      cd.lerp(pal.sand, beach * 0.6);
    }
    aCol[i * 3] = ca.r; aCol[i * 3 + 1] = ca.g; aCol[i * 3 + 2] = ca.b;
    dCol[i * 3] = cd.r; dCol[i * 3 + 1] = cd.g; dCol[i * 3 + 2] = cd.b;
  }
  tg.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3));
  tg.setAttribute('dCol', new THREE.BufferAttribute(dCol, 3));
  const lifeAttr = new THREE.BufferAttribute(life, 1);
  lifeAttr.setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('life', lifeAttr);
  tg.computeVertexNormals();
  const tmat = new THREE.MeshLambertMaterial({ flatShading: true });
  tmat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = W.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aCol; attribute vec3 dCol; attribute float life; varying vec3 vA; varying vec3 vD; varying float vLife; varying float vRad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aCol; vD = dCol; vLife = life; vRad = length(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vA; varying vec3 vD; varying float vLife; varying float vRad;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float lf = smoothstep(0.05, 0.9, vLife);
        vec3 tc = mix(vD, vA, lf);
        tc += vec3(0.30, 0.34, 0.05) * lf * (1.0 - lf) * 1.6;
        float rr = vRad - 10.0;
        float fm = smoothstep(0.75, 1.0, sin(rr * 60.0 + uTime * 1.6)) * smoothstep(-0.28, -0.02, rr) * (1.0 - smoothstep(0.0, 0.04, rr));
        tc = mix(tc, vec3(1.0), fm * 0.55);
        vec4 diffuseColor = vec4(tc, opacity);`);
  };
  const terrain = new THREE.Mesh(tg, tmat);
  terrain.castShadow = true; terrain.receiveShadow = true;
  scene.add(terrain);
  W.terrain = terrain;

  // ---------- ocean ----------
  const omat = new THREE.MeshPhongMaterial({ color: 0x48c2e0, transparent: true, opacity: 0.72, shininess: 260, specular: 0x555555 });
  omat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = W.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * (sin(position.x * 1.7 + uTime * 1.1) + sin(position.y * 2.3 + uTime * 0.9) + sin(position.z * 1.9 - uTime * 1.3)) * 0.014;');
  };
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), omat);
  ocean.receiveShadow = true; ocean.renderOrder = -1;
  scene.add(ocean);

  // ---------- sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: { uSun: W.uSun, uTime: W.uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uSun; uniform float uTime; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vDir);
        float s = dot(d, uSun);
        float day = smoothstep(-0.45, 0.5, s);
        float neb = vn(d * 2.5) * 0.6 + vn(d * 5.5 + 3.0) * 0.4;
        vec3 night = mix(vec3(0.012, 0.016, 0.06), vec3(0.09, 0.035, 0.16), smoothstep(0.35, 0.8, neb));
        night += vec3(0.0, 0.05, 0.07) * smoothstep(0.55, 0.9, vn(d * 3.3 + 9.0));
        vec3 dayc = mix(vec3(0.30, 0.60, 0.95), vec3(1.0, 0.80, 0.56), smoothstep(0.25, 1.0, s));
        vec3 col = mix(night, dayc, day);
        col += vec3(0.95, 0.35, 0.4) * exp(-(s * 2.6 + 0.2) * (s * 2.6 + 0.2)) * 0.32;
        col += vec3(1.0, 0.85, 0.55) * (smoothstep(0.9988, 0.9993, s) * 6.0 + pow(max(s, 0.0), 90.0) * 0.9);
        vec3 g = d * 110.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5; float h = hash(id);
        float star = step(0.986, h) * smoothstep(0.25, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * 2.5 + h * 200.0));
        col += star * (1.0 - day) * vec3(1.6, 1.6, 2.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  W.sky = sky;

  // ---------- atmosphere ----------
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSun: W.uSun },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `
      uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float f = clamp(-dot(v, vN) / 0.55, 0.0, 1.0);
        f = pow(f, 3.2);
        float day = smoothstep(-0.35, 0.45, dot(vN, uSun));
        vec3 col = mix(vec3(0.10, 0.12, 0.42), vec3(0.45, 0.78, 1.0), day);
        col += vec3(1.0, 0.45, 0.3) * exp(-16.0 * dot(vN, uSun) * dot(vN, uSun)) * 0.5;
        gl_FragColor = vec4(col * f * 0.5, 1.0);
      }`,
  }));
  scene.add(atmo);

  // ---------- aurora over the cold pole ----------
  const aur = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, 2.6, 96, 10, true), new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: W.uTime, uSun: W.uSun },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vP;
      void main(){ vUv = uv; vec3 p = position; float a = atan(p.z, p.x);
        p.xz *= 1.0 + 0.08 * sin(a * 5.0 + uTime * 0.4) + 0.05 * sin(a * 11.0 - uTime * 0.7);
        vP = p; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying vec3 vP;
      void main(){ float a = vUv.x * 6.2831;
        float c = 0.5 + 0.5 * sin(a * 9.0 + uTime * 0.6 + sin(a * 3.0 - uTime * 0.3) * 2.0);
        c *= 0.5 + 0.5 * sin(a * 23.0 - uTime * 1.1);
        float v = smoothstep(0.0, 0.25, vUv.y) * pow(max(1.0 - vUv.y, 0.0), 1.5);
        vec3 col = mix(vec3(0.15, 1.0, 0.55), vec3(0.75, 0.3, 1.0), vUv.y * 1.3);
        float night = 0.45 + 0.55 * smoothstep(0.2, -0.3, dot(normalize(vP), uSun));
        gl_FragColor = vec4(col * c * v * 1.5 * night, 1.0); }`,
  }));
  aur.position.set(0, R + 3.4, 0);
  scene.add(aur);

  // ---------- site selection ----------
  const flatLand = (d, lo, hi) => {
    const e = W.elev(d);
    if (e < lo || e > hi) return false;
    const r0 = rOfE(e);
    for (let k = 0; k < 6; k++) {
      offsetOnSphere(d, k * Math.PI / 3, 0.12, _t);
      const e2 = W.elev(_t);
      if (e2 < 0.03 || Math.abs(rOfE(e2) - r0) > 0.4) return false;
    }
    return true;
  };
  const nearSea = (d) => {
    for (let k = 0; k < 8; k++) { offsetOnSphere(d, k * Math.PI / 4, 0.24, _t); if (W.elev(_t) < -0.05) return true; }
    return false;
  };
  const cands = [];
  for (let i = 0; i < 9000; i++) {
    const d = randomUnit(rnd);
    if (d.y > 0.8 ? flatLand(d, 0.07, 1.5) : flatLand(d, 0.07, 0.55)) cands.push(d.clone());
  }
  const chosen = [];
  const pick = (pred, minSep = 0.52) => {
    for (let pass = 0; pass < 3; pass++) {
      const sep = Math.cos(minSep * (pass === 2 ? 0.5 : 1));
      const pool = cands.filter((d) => (pass > 0 || pred(d)) && chosen.every((c) => c.dot(d) < sep) && (pass === 0 || d.y < 0.7));
      if (pool.length) { const d = pool[Math.floor(rnd() * pool.length)]; chosen.push(d); return d; }
    }
    const d = cands[Math.floor(rnd() * cands.length)]; chosen.push(d); return d;
  };
  const S = {};
  const ang = (a, b) => Math.acos(clamp(a.dot(b), -1, 1));
  S.turnip = pick((d) => Math.abs(d.y) < 0.45 && nearSea(d));
  S.pond = pick((d) => { const a = ang(d, S.turnip); return a > 0.5 && a < 0.85 && d.y < 0.6; });
  S.windmill = pick((d) => { const a = ang(d, S.turnip); return a > 0.55 && a < 1.3 && d.y < 0.6; });
  S.snowman = pick((d) => d.y > 0.86);
  S.shade = pick((d) => nearSea(d) && W.elev(d) < 0.3 && Math.abs(d.y) < 0.6);
  S.bud = pick((d) => W.elev(d) > 0.2 && d.y < 0.6 && ang(d, S.turnip) > 0.9);
  S.camp = pick((d) => d.y < 0.6);
  S.moss = pick((d) => d.y < 0.5 && d.y > -0.5);
  S.rocket = pick((d) => d.y < 0.6);
  S.wedding = pick((d) => d.y < 0.6);
  W.sites = S;

  // ---------- flora + trees ----------
  const lamW = new THREE.MeshLambertMaterial({ flatShading: true });
  const lamVC = new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true });
  const plain = (g) => { const o = g.index ? g.toNonIndexed() : g.clone(); o.deleteAttribute('uv'); return o; };
  const xf = (g, m) => { const o = plain(g); o.applyMatrix4(m); return o; };
  const tuft = merge([
    xf(geo.cone(0.05, 0.34, 4), T(0, 0.17, 0)), xf(geo.cone(0.045, 0.26, 4), T(0.07, 0.12, 0.02, 1, 1, 1, 0, 0, -0.35)),
    xf(geo.cone(0.045, 0.24, 4), T(-0.06, 0.11, -0.03, 1, 1, 1, 0.2, 0, 0.4)), xf(geo.cone(0.04, 0.2, 4), T(0.0, 0.1, 0.07, 1, 1, 1, 0.45, 0, 0)),
  ]);
  const stem = xf(geo.cone(0.022, 0.3, 4), T(0, 0.15, 0));
  const head = merge([
    xf(geo.ico(0.075, 0), T(0, 0.32, 0, 1, 0.6, 1)), xf(geo.ico(0.05, 0), T(0.08, 0.3, 0, 1, 0.5, 1)), xf(geo.ico(0.05, 0), T(-0.08, 0.3, 0, 1, 0.5, 1)),
    xf(geo.ico(0.05, 0), T(0, 0.3, 0.08, 1, 0.5, 1)), xf(geo.ico(0.05, 0), T(0, 0.3, -0.08, 1, 0.5, 1)),
  ]);
  const shroom = merge([part(geo.cyl(0.035, 0.05, 0.16, 5), 0xfff1d6, T(0, 0.08, 0)), part(geo.dome(0.12, 7, 3), 0xe8584f, T(0, 0.14, 0, 1, 0.8, 1))]);
  const bush = merge([xf(geo.ico(0.16, 0), T(0, 0.1, 0)), xf(geo.ico(0.12, 0), T(0.14, 0.08, 0.04)), xf(geo.ico(0.11, 0), T(-0.12, 0.07, -0.05))]);
  const crystal = merge([xf(geo.cone(0.07, 0.36, 4), T(0, 0.18, 0)), xf(geo.cone(0.05, 0.22, 4), T(0.08, 0.1, 0.03, 1, 1, 1, 0, 0, -0.5))]);
  const MAXF = 4200;
  const F = {
    grass: new Inst(scene, [tuft], [lamW], MAXF, false),
    flower: new Inst(scene, [stem, head], [new THREE.MeshLambertMaterial({ color: 0x4fae5c, flatShading: true }), lamW], MAXF, false),
    shroom: new Inst(scene, [shroom], [lamVC], 900, false),
    bush: new Inst(scene, [bush], [lamW], 1400, true),
    crystal: new Inst(scene, [crystal], [new THREE.MeshLambertMaterial({ flatShading: true, emissive: 0x3377aa, emissiveIntensity: 0.5 })], 500, false),
  };
  const trunkG = xf(geo.cyl(0.07, 0.12, 0.8, 5), T(0, 0.4, 0));
  const roundG = merge([xf(geo.ico(0.55, 1), T(0, 1.1, 0)), xf(geo.ico(0.38, 1), T(0.34, 1.38, 0.1)), xf(geo.ico(0.34, 1), T(-0.3, 0.92, -0.12))]);
  const pineG = merge([xf(geo.cone(0.52, 0.75, 6), T(0, 0.85, 0)), xf(geo.cone(0.4, 0.65, 6), T(0, 1.28, 0)), xf(geo.cone(0.27, 0.55, 6), T(0, 1.66, 0))]);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x8a5a3c, flatShading: true });
  const TI = [new Inst(scene, [trunkG, roundG], [trunkM, lamW], 420, true), new Inst(scene, [trunkG, pineG], [trunkM, lamW], 320, true)];
  const grassCols = [0x8fdc62, 0x6fce5f, 0xa9e56b, 0x58c070], flowerCols = [0xff8fb5, 0xffd24a, 0xffffff, 0xc49bff, 0xff9a4a, 0x7fd6ff, 0xff6b6b];
  const roundCols = [0x5cc46a, 0x49b36b, 0x7fd06a, 0x3fae7c, 0x66c85a], blossomCols = [0xffa8c8, 0xffc2d6, 0xffd98a], pineCols = [0x2f8f6f, 0x3a9a80, 0x2a8466];
  const CHAR = new THREE.Color(0x2a2522), FIRE = new THREE.Color(0xff6a1a);

  W.addTree = (d, grown = false, typeHint) => {
    const e = W.elev(d), cold = W.isCold(d);
    const type = typeHint !== undefined ? typeHint : (cold || e > 0.55 ? 1 : 0);
    const cols = type === 1 ? pineCols : (rnd() < 0.14 ? blossomCols : roundCols);
    const col = new THREE.Color(cols[Math.floor(rnd() * cols.length)]);
    if (cold) col.lerp(new THREE.Color(0xd8efee), 0.45);
    const p = d.clone().multiplyScalar(W.radiusAt(d) - 0.03);
    const inst = TI[type];
    if (inst.n >= inst.meshes[0].instanceMatrix.count) return null;
    const idx = inst.add(p, surfQuat(d, rnd() * 6.28), 0.75 + rnd() * 0.6, [null, col]);
    const t = { d: d.clone(), pos: p, inst, idx, col, m: grown ? 1.5 : 0, g: 0, gv: 0, fire: 0, wet: 0, burnt: false, spread: 0 };
    W.trees.push(t);
    return t;
  };

  W.scatter = (avoid) => {
    const ok = (d) => avoid.every((a) => a.d.dot(d) < Math.cos(a.r));
    const d = V();
    for (let i = 0, made = 0; i < 9000 && made < 330; i++) {
      randomUnit(rnd, d);
      const e = W.elev(d);
      if (e < 0.09 || e > 0.85 || !ok(d)) continue;
      if (N.n3(d.x * 2.4 + 5, d.y * 2.4, d.z * 2.4) < -0.12) continue;
      if (W.trees.some((t) => t.d.dot(d) > 0.9984)) continue;
      if (W.addTree(d)) made++;
    }
    const NF = 11000;
    for (let i = 0; i < NF; i++) {
      const y = 1 - (2 * (i + 0.5)) / NF, r = Math.sqrt(1 - y * y), phi = i * 2.399963;
      d.set(Math.cos(phi) * r + (rnd() - 0.5) * 0.03, y + (rnd() - 0.5) * 0.03, Math.sin(phi) * r + (rnd() - 0.5) * 0.03).normalize();
      const e = W.elev(d);
      if (e < 0.035 || e > 0.9 || !ok(d)) continue;
      const cold = W.isCold(d), k = rnd();
      let inst, colors = null, sc = 1.0 + rnd() * 0.8;
      if (cold) { if (k > 0.3) continue; inst = F.crystal; colors = [_c.set(0xbfe9ff).clone()]; }
      else if (e < 0.08) { if (k > 0.35) continue; inst = F.grass; colors = [_c.set(0xc9d77a).clone()]; }
      else if (k < 0.5) { inst = F.grass; colors = [_c.set(grassCols[Math.floor(rnd() * 4)]).clone()]; }
      else if (k < 0.84) { inst = F.flower; colors = [null, _c.set(flowerCols[Math.floor(rnd() * flowerCols.length)]).clone()]; sc *= 1.15; }
      else if (k < 0.93) { inst = F.bush; colors = [_c.set(roundCols[Math.floor(rnd() * 5)]).clone()]; }
      else { inst = F.shroom; }
      if (inst.n >= inst.meshes[0].instanceMatrix.count) continue;
      const p = d.clone().multiplyScalar(W.radiusAt(d) - 0.02);
      const idx = inst.add(p, surfQuat(d, rnd() * 6.28), sc, colors);
      W.flora.push({ x: d.x, y: d.y, z: d.z, inst, idx, m: 0, g: 0, gv: 0, thr: rnd() * 0.5 });
    }
  };

  // ---------- water / life ----------
  let lifeDirty = false;
  W.addWater = (p, angR, amt) => {
    const cosA = Math.cos(angR), cosI = Math.cos(angR * 0.45), px = p.x, py = p.y, pz = p.z;
    for (let i = 0; i < n; i++) {
      if (!land[i] || life[i] >= 1.2) continue;
      const d = dirs[i * 3] * px + dirs[i * 3 + 1] * py + dirs[i * 3 + 2] * pz;
      if (d > cosA) { life[i] = Math.min(1.2, life[i] + amt * 0.95 * sstep(cosA, cosI, d)); lifeDirty = true; }
    }
    for (const f of W.flora) {
      const d = f.x * px + f.y * py + f.z * pz;
      if (d > cosA) f.m = Math.min(2, f.m + amt * sstep(cosA, cosI, d));
    }
    for (const t of W.trees) {
      const d = t.d.dot(p);
      if (d > cosA) {
        t.m = Math.min(2, t.m + amt * sstep(cosA, cosI, d));
        if (t.burnt && t.m > 0.5) { t.burnt = false; t.inst.color(t.idx, 1, t.col); }
        if (t.fire > 0) { t.wet += amt * 1.3; if (t.wet > 1) { t.fire = 0; t.wet = 0; W.fires.splice(W.fires.indexOf(t), 1); t.inst.color(t.idx, 1, t.col); W.onHiss && W.onHiss(t.pos, t.d); } }
      }
    }
  };
  // set everything within angR of p alive (finale wave)
  W.wave = (p, angR) => {
    const cosA = Math.cos(angR), px = p.x, py = p.y, pz = p.z;
    for (let i = 0; i < n; i++) {
      if (!land[i] || life[i] >= 1.1) continue;
      if (dirs[i * 3] * px + dirs[i * 3 + 1] * py + dirs[i * 3 + 2] * pz > cosA) { life[i] = 1.2; lifeDirty = true; }
    }
    for (const f of W.flora) if (f.m < 2 && f.x * px + f.y * py + f.z * pz > cosA) f.m = 2;
    for (const t of W.trees) if (t.d.dot(p) > cosA) { t.m = 2; if (t.burnt) { t.burnt = false; t.inst.color(t.idx, 1, t.col); } }
  };
  W.ignite = (t) => {
    if (!t || t.fire > 0 || t.burnt || t.g < 0.3 || W.fires.length >= 9) return false;
    t.fire = 0.01; t.wet = 0; t.spread = 3.5 + rnd() * 2;
    W.fires.push(t);
    t.inst.color(t.idx, 1, FIRE);
    W.onIgnite && W.onIgnite(t);
    return true;
  };
  W.nearestTree = (d, angR) => {
    let best = null, bd = Math.cos(angR);
    for (const t of W.trees) { const k = t.d.dot(d); if (k > bd && t.g > 0.3 && !t.burnt) { bd = k; best = t; } }
    return best;
  };
  W.firesNear = (d, angR) => { const c = Math.cos(angR); let k = 0; for (const t of W.fires) if (t.d.dot(d) > c) k++; return k; };

  let bloomT = 0;
  W.update = (dt, time) => {
    W.uTime.value = time;
    if (lifeDirty) { lifeAttr.needsUpdate = true; lifeDirty = false; }
    for (const f of W.flora) {
      const target = sstep(0.1 + f.thr, 0.45 + f.thr, f.m);
      if (Math.abs(target - f.g) > 0.002 || Math.abs(f.gv) > 0.01) {
        f.gv += ((target - f.g) * 90 - f.gv * 9) * dt;
        f.g += f.gv * dt;
        f.inst.set(f.idx, Math.max(0, f.g));
      }
    }
    for (const t of W.trees) {
      if (t.m > 0.3 && t.m < 2 && !t.burnt) t.m += dt * 0.035;
      const target = t.burnt ? 0.45 : 0.12 * sstep(0.08, 0.3, t.m) + 0.88 * sstep(0.3, 1.5, t.m);
      if (Math.abs(target - t.g) > 0.002 || Math.abs(t.gv) > 0.01) {
        t.gv += ((target - t.g) * 60 - t.gv * 8) * dt;
        t.g += t.gv * dt;
        t.inst.set(t.idx, Math.max(0, t.g));
      }
      if (t.wet > 0 && t.fire === 0) t.wet = Math.max(0, t.wet - dt * 0.3);
    }
    for (let i = W.fires.length - 1; i >= 0; i--) {
      const t = W.fires[i];
      t.fire += dt;
      t.wet = Math.max(0, t.wet - dt * 0.15);
      if (W.fx) W.fx.flame(t.pos, t.d, 1.2 * t.g, dt);
      t.spread -= dt;
      if (t.spread <= 0) {
        t.spread = 3 + rnd() * 2.5;
        const c = Math.cos(0.15);
        for (const o of W.trees) if (o !== t && o.d.dot(t.d) > c && rnd() < 0.45) { W.ignite(o); break; }
      }
      if (t.fire > 15) { t.fire = 0; t.burnt = true; t.m = 0; W.fires.splice(i, 1); t.inst.color(t.idx, 1, CHAR); }
    }
    bloomT -= dt;
    if (bloomT <= 0) {
      bloomT = 0.5;
      let s = 0;
      for (let i = 0; i < n; i++) if (land[i]) s += Math.min(1, life[i]);
      W.bloom = s / landCount;
    }
  };
  W.stats = () => ({ verts: n, land: landCount / n, trees: W.trees.length, flora: W.flora.length, cands: cands.length });
  return W;
}
