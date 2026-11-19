import * as THREE from 'three';
import { R, clamp, lerp, V, surfQuat, frameQuat, anyTangent } from './util.js';

const _a = V(), _b = V(), _c = V(), _d = V(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = V();

export class Particles {
  constructor(scene, max, mode) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false,
      blending: mode === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute vec4 pcol; attribute float psize; uniform float uScale; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: mode === 'heart'
        ? 'varying vec4 vC; void main(){ vec2 q = (gl_PointCoord - 0.5) * 2.7; q.y = -q.y + 0.2; float hh = q.x*q.x + q.y*q.y - 1.0; float h = hh*hh*hh - q.x*q.x*q.y*q.y*q.y; if (h > 0.0) discard; gl_FragColor = vec4(vC.rgb, vC.a); }'
        : 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }',
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = mode === 'glow' ? 6 : 5;
    scene.add(this.points);
    this.geo = g;
  }
  spawn(p, v, life, s0, s1, r, g, b, a = 1, grav = 0, drag = 0) {
    const i = this.i; this.i = (i + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = 0;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, life, maxLife, size, col } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const j = i * 3;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const t = 1 - life[i] / maxLife[i];
      if (this.grav[i] !== 0) {
        const il = this.grav[i] * dt / Math.hypot(pos[j], pos[j + 1], pos[j + 2]);
        vel[j] -= pos[j] * il; vel[j + 1] -= pos[j + 1] * il; vel[j + 2] -= pos[j + 2] * il;
      }
      if (this.drag[i] !== 0) { const k = Math.max(0, 1 - this.drag[i] * dt); vel[j] *= k; vel[j + 1] *= k; vel[j + 2] *= k; }
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      size[i] = lerp(this.s0[i], this.s1[i], t);
      col[i * 4 + 3] = this.a0[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcol.needsUpdate = true;
    this.geo.attributes.psize.needsUpdate = true;
  }
}

const rs = () => Math.random() * 2 - 1;

export class FX {
  constructor(scene) {
    this.soft = new Particles(scene, 3500, 'soft');
    this.glow = new Particles(scene, 3500, 'glow');
    this.heart = new Particles(scene, 300, 'heart');
    this.flash = 0; this.shake = 0; this.rainbowAmt = 0;

    // rain streaks
    this.RN = 170;
    this.rain = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 4), new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.8 }), this.RN);
    this.rain.frustumCulled = false; this.rain.renderOrder = 4;
    scene.add(this.rain);
    this.drops = [];
    for (let i = 0; i < this.RN; i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random());
      this.drops.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ph: Math.random(), sp: 8 + Math.random() * 4 });
    }

    // lightning ribbon
    this.BMAX = 48;
    const bg = new THREE.BufferGeometry();
    this.bpos = new Float32Array(this.BMAX * 18);
    bg.setAttribute('position', new THREE.BufferAttribute(this.bpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.bolt = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3), side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.bolt.frustumCulled = false; this.bolt.visible = false; this.bolt.renderOrder = 8;
    scene.add(this.bolt);
    this.boltT = 0;
    this.light = new THREE.PointLight(0xcfe0ff, 0, 30, 1.5);
    scene.add(this.light);

    // rainbow
    this.rainbow = new THREE.Mesh(new THREE.RingGeometry(2.3, 3.3, 72, 1, 0, Math.PI), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uMoon: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA; uniform float uMoon; varying vec2 vP;
        vec3 band(float t){ vec3 c = vec3(0.62, 0.36, 0.95);
          c = mix(c, vec3(0.25, 0.55, 1.0), smoothstep(0.12, 0.2, t)); c = mix(c, vec3(0.25, 0.9, 0.55), smoothstep(0.3, 0.38, t));
          c = mix(c, vec3(1.0, 0.92, 0.3), smoothstep(0.48, 0.56, t)); c = mix(c, vec3(1.0, 0.6, 0.2), smoothstep(0.66, 0.74, t));
          c = mix(c, vec3(1.0, 0.3, 0.35), smoothstep(0.84, 0.92, t)); return c; }
        void main(){ float r = length(vP); float t = (r - 2.3) / 1.0;
          float a = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t) * smoothstep(0.0, 1.1, vP.y);
          vec3 c = mix(band(t), vec3(0.8, 0.88, 1.0) * 0.9, uMoon);
          gl_FragColor = vec4(c * 1.15, a * uA * mix(0.85, 0.4, uMoon)); }`,
    }));
    this.rainbow.visible = false; this.rainbow.renderOrder = 3; this.rainbow.frustumCulled = false;
    scene.add(this.rainbow);
  }

  setScale(s) { this.soft.mat.uniforms.uScale.value = s; this.glow.mat.uniforms.uScale.value = s; this.heart.mat.uniforms.uScale.value = s; }

  update(dt) {
    this.soft.update(dt); this.glow.update(dt); this.heart.update(dt);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.boltT > 0) {
      this.boltT -= dt;
      this.bolt.visible = this.boltT > 0 && Math.sin(this.boltT * 95) > -0.45;
    }
    this.light.intensity *= Math.exp(-dt * 7);
  }

  // rain streaks (or snow) falling from the cloud
  rainUpdate(cloud, groundR, amt, snow, dt) {
    const p = cloud.p, H = Math.max(0.6, cloud.alt - groundR - 0.35), rad = cloud.size * 1.25;
    _a.crossVectors(cloud.f, p);
    surfQuat(p, 0, _q);
    const vis = snow ? 0 : amt;
    for (let i = 0; i < this.RN; i++) {
      const d = this.drops[i];
      if (i / this.RN >= vis) { _s.setScalar(1e-4); _m.compose(cloud.pos, _q, _s); this.rain.setMatrixAt(i, _m); continue; }
      d.ph += dt * d.sp / H;
      if (d.ph > 1) {
        d.ph -= 1;
        if (Math.random() < 0.5) {
          _b.copy(p).multiplyScalar(groundR + 0.05).addScaledVector(_a, d.x * rad).addScaledVector(cloud.f, d.z * rad);
          _c.copy(p).multiplyScalar(0.9).addScaledVector(_a, rs() * 0.6).addScaledVector(cloud.f, rs() * 0.6);
          this.soft.spawn(_b, _c, 0.28, 0.07, 0.14, 0.85, 0.95, 1, 0.8, 4);
        }
      }
      _b.copy(cloud.pos).addScaledVector(_a, d.x * rad).addScaledVector(cloud.f, d.z * rad).addScaledVector(p, -(0.35 + d.ph * H));
      _s.set(1, 1, 1);
      _m.compose(_b, _q, _s);
      this.rain.setMatrixAt(i, _m);
    }
    this.rain.instanceMatrix.needsUpdate = true;
    if (snow && amt > 0.3) {
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * rad;
        _b.copy(cloud.pos).addScaledVector(_a, Math.cos(a) * r).addScaledVector(cloud.f, Math.sin(a) * r).addScaledVector(p, -0.4);
        _c.copy(p).multiplyScalar(-1.5).addScaledVector(_a, rs() * 0.35).addScaledVector(cloud.f, rs() * 0.35);
        this.soft.spawn(_b, _c, H / 1.5, 0.13, 0.1, 1, 1, 1, 0.95);
      }
    }
  }

  vapor(cloud, groundR) {
    const p = cloud.p;
    _a.crossVectors(cloud.f, p);
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * 6.283, r = 0.3 + Math.random() * 1.1;
      _b.copy(p).multiplyScalar(groundR + 0.1).addScaledVector(_a, Math.cos(a) * r).addScaledVector(cloud.f, Math.sin(a) * r);
      _c.copy(cloud.pos).sub(_b).multiplyScalar(0.85);
      this.soft.spawn(_b, _c, 1.05, 0.1, 0.34, 0.8, 0.95, 1, 0.55);
    }
  }

  flame(pos, d, s, dt) {
    const k = Math.random() < dt * 55 ? 2 : 1;
    for (let i = 0; i < k; i++) {
      _b.copy(pos).addScaledVector(d, (0.5 + Math.random() * 0.9) * s).add(_c.set(rs(), rs(), rs()).multiplyScalar(0.3 * s));
      _c.copy(d).multiplyScalar(1.1 + Math.random()).add(_d.set(rs(), rs(), rs()).multiplyScalar(0.25));
      this.glow.spawn(_b, _c, 0.5 + Math.random() * 0.4, 0.55 * s, 0.08, 2.2, 0.75 + Math.random() * 0.5, 0.12, 0.7);
    }
    if (Math.random() < dt * 9) {
      _b.copy(pos).addScaledVector(d, 1.4 * s);
      _c.copy(d).multiplyScalar(0.9).add(_d.set(rs(), rs(), rs()).multiplyScalar(0.2));
      this.soft.spawn(_b, _c, 2.2, 0.3, 0.9, 0.25, 0.24, 0.26, 0.4);
    }
  }

  puff(pos, n, r, g, b, speed = 1, size = 0.3, life = 0.9, a = 0.7) {
    for (let i = 0; i < n; i++) {
      _c.set(rs(), rs(), rs()).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.soft.spawn(pos, _c, life * (0.6 + Math.random() * 0.6), size * 0.5, size * 1.4, r, g, b, a, 0, 2);
    }
  }

  sparks(pos, n, r, g, b, speed = 3, size = 0.16, life = 0.8, grav = 3) {
    for (let i = 0; i < n; i++) {
      _c.set(rs(), rs(), rs()).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.glow.spawn(pos, _c, life * (0.5 + Math.random() * 0.7), size, size * 0.2, r, g, b, 1, grav, 1.2);
    }
  }

  firework(pos) {
    const hue = Math.random();
    const c = new THREE.Color().setHSL(hue, 0.9, 0.6), c2 = new THREE.Color().setHSL((hue + 0.12) % 1, 0.9, 0.7);
    for (let i = 0; i < 90; i++) {
      _c.set(rs(), rs(), rs()).normalize().multiplyScalar(3.2 * (0.75 + Math.random() * 0.3));
      const k = i % 2 ? c : c2;
      this.glow.spawn(pos, _c, 1.3 + Math.random() * 0.7, 0.3, 0.05, k.r * 2.5, k.g * 2.5, k.b * 2.5, 1, 1.2, 1.6);
    }
    this.sparks(pos, 14, 3, 3, 3, 1.2, 0.4, 0.3, 0);
  }

  hearts(pos, up, n = 6) {
    anyTangent(up, _a);
    for (let i = 0; i < n; i++) {
      _b.copy(pos).addScaledVector(up, 0.5 + Math.random() * 0.4).add(_c.set(rs(), rs(), rs()).multiplyScalar(0.3));
      _c.copy(up).multiplyScalar(0.9 + Math.random() * 0.7).add(_d.set(rs(), rs(), rs()).multiplyScalar(0.45));
      this.heart.spawn(_b, _c, 1.5 + Math.random() * 0.8, 0.42, 0.22, 1.0, 0.36, 0.52, 1, 0, 0.8);
    }
  }

  zzz(pos, up) {
    _c.copy(up).multiplyScalar(0.45).add(_d.set(rs(), rs(), rs()).multiplyScalar(0.12));
    this.soft.spawn(pos, _c, 1.8, 0.08, 0.22, 0.9, 0.95, 1, 0.6);
  }

  strike(from, to, camPos) {
    const pts = [], n = 12;
    _a.copy(to).sub(from);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = from.clone().addScaledVector(_a, t);
      if (i > 0 && i < n) p.add(_c.set(rs(), rs(), rs()).multiplyScalar(0.42));
      pts.push(p);
    }
    const segs = [];
    for (let i = 0; i < n; i++) segs.push([pts[i], pts[i + 1], 0.11 * (1 - (i / n) * 0.4)]);
    for (let b = 0; b < 3; b++) {
      let p = pts[2 + Math.floor(Math.random() * 7)].clone();
      _d.set(rs(), rs(), rs()).normalize().multiplyScalar(0.5).addScaledVector(_a, 0.06);
      for (let i = 0; i < 4; i++) {
        const q = p.clone().add(_d).add(_c.set(rs(), rs(), rs()).multiplyScalar(0.22));
        segs.push([p, q, 0.05]);
        p = q;
      }
    }
    let k = 0;
    for (const [a, b, w] of segs) {
      if (k >= this.BMAX) break;
      _b.copy(b).sub(a);
      _c.copy(a).sub(camPos);
      _d.crossVectors(_b, _c).normalize().multiplyScalar(w);
      const o = k * 18, P = this.bpos;
      const put = (j, v, s) => { P[o + j * 3] = v.x + _d.x * s; P[o + j * 3 + 1] = v.y + _d.y * s; P[o + j * 3 + 2] = v.z + _d.z * s; };
      put(0, a, -1); put(1, a, 1); put(2, b, 1); put(3, a, -1); put(4, b, 1); put(5, b, -1);
      k++;
    }
    this.bolt.geometry.setDrawRange(0, k * 6);
    this.bolt.geometry.attributes.position.needsUpdate = true;
    this.boltT = 0.3; this.bolt.visible = true;
    this.flash = 0.9; this.shake = 1;
    this.light.position.copy(to).multiplyScalar(1.08);
    this.light.intensity = 220;
    this.sparks(to, 46, 4, 3.6, 2, 5, 0.22, 0.7, 6);
    this.puff(to, 8, 0.9, 0.9, 0.95, 1.4, 0.5, 0.8, 0.5);
  }

  rainbowUpdate(cloud, groundR, camPos, sunlit, dt, target) {
    this.rainbowAmt = clamp(this.rainbowAmt + (target ? dt * 0.6 : -dt * 0.35));
    const m = this.rainbow;
    m.visible = this.rainbowAmt > 0.01;
    if (!m.visible) return;
    m.material.uniforms.uA.value = this.rainbowAmt;
    m.material.uniforms.uMoon.value = sunlit ? 0 : 1;
    if (target) {
      _a.copy(cloud.p).addScaledVector(cloud.f, 0.16).normalize();
      m.position.copy(_a).multiplyScalar(groundR - 0.5);
      _b.copy(camPos).sub(m.position);
      frameQuat(_a, _b, m.quaternion);
    }
  }
}
export { R };
