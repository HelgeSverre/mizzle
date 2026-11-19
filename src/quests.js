import * as THREE from 'three';
import { R, clamp, lerp, sstep, damp, V, surfQuat, frameQuat, anyTangent, offsetOnSphere, part, merge, geo, T, vcMesh, rng, easeOutBack } from './util.js';
import { Pip, makeHouse } from './pips.js';
import { iconCanvas } from './ui.js';

export function createQuests(G) {
  const { scene, world: W, fx, audio, ui } = G;
  const rnd = rng(4242);
  const Q = { list: [], joy: 0, total: 9, thunder: false, ponds: [], pips: [], houses: [], pops: [], bud: null, moss: null };
  const _v = V(), _d = V(), _e = V();
  const cosA = Math.cos;

  const plant = (obj, d, yaw = 0, lift = 0) => { obj.position.copy(d).multiplyScalar(W.groundAt(d) + lift); surfQuat(d, yaw, obj.quaternion); scene.add(obj); return obj; };
  const hide = (obj) => { obj.visible = false; obj.scale.setScalar(0.001); return obj; };
  const pop = (obj, delay = 0, to = 1) => { obj.visible = true; obj.scale.setScalar(0.001); Q.pops.push({ obj, t: -delay, to, snd: true }); };
  const texCache = {};
  const tex = (kind) => { if (!texCache[kind]) { texCache[kind] = new THREE.CanvasTexture(iconCanvas(kind, true)); texCache[kind].colorSpace = THREE.SRGBColorSpace; } return texCache[kind]; };
  const bubble = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('drop'), depthWrite: false, color: 0xe6e6e6 })); s.center.set(0.5, 0); s.visible = false; s.renderOrder = 7; scene.add(s); return s; };
  const rotY = (a, m) => new THREE.Matrix4().makeRotationY(a).multiply(m);
  const rotZ = (a, m) => new THREE.Matrix4().makeRotationZ(a).multiply(m);

  const DEF = {
    turnip: {
      icon: 'drop', pips: [['Brambus', 0xffb37a, 'leaf']], cap: 0xe8584f, prop: [1.0, 0.5], stand: [0.3, 0.3],
      build(q) {
        const d = q.propD;
        q.patch = hide(plant(vcMesh([part(geo.cyl(0.6, 0.66, 0.14, 10), 0x7a5236, T(0, 0.04, 0)), ...[[-0.25, -0.1], [0.2, 0.2], [0.05, -0.3], [-0.1, 0.3]].map(([x, z]) => part(geo.cone(0.07, 0.26, 5), 0x6fcf5f, T(x, 0.22, z)))]), d, q.yaw));
        q.turnip = hide(plant(vcMesh([
          part(geo.sph(0.46, 14, 10), 0xfbf3ea, T(0, 0.4, 0, 1, 1.05, 1)), part(geo.dome(0.47, 14, 5, 1.2), 0xc06fe0, T(0, 0.4, 0, 1, 1.06, 1)),
          part(geo.cone(0.1, 0.5, 5), 0x5fcf5f, T(0, 1.05, 0)), part(geo.cone(0.09, 0.45, 5), 0x6fdc6a, T(0.16, 0.98, 0, 1, 1, 1, 0, 0, -0.5)), part(geo.cone(0.09, 0.45, 5), 0x4fbf5a, T(-0.16, 0.98, 0, 1, 1, 1, 0, 0, 0.5)),
        ], true), d, q.yaw));
        q.props = [q.patch];
      },
      rain(q, p, ang, dt) { if (q.propD.dot(p) > cosA(ang)) q.prog += dt / 3.2; },
      done(q) { pop(q.turnip); },
    },
    pond: {
      icon: 'drop', pips: [['Dot', 0x9fd8ff, 'flower']], cap: 0x4fb6c9, prop: [-1.0, 1.0], stand: [-0.2, 0.45],
      build(q) {
        const d = q.propD, parts = [part(geo.cyl(0.8, 0.8, 0.06, 18), 0x8f7b60, T(0, 0.02, 0))];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; parts.push(part(geo.ico(0.16 + (i % 3) * 0.03, 0), 0x9a96a6, T(Math.cos(a) * 0.86, 0.07, Math.sin(a) * 0.86))); }
        q.basin = hide(plant(vcMesh(parts), d, q.yaw));
        q.water = plant(new THREE.Mesh(geo.cyl(0.78, 0.78, 0.05, 24), new THREE.MeshPhongMaterial({ color: 0x48c2e0, transparent: true, opacity: 0.88, shininess: 120 })), d, 0, 0.08);
        q.water.visible = false;
        const dg = new THREE.Group();
        q.duckSpin = new THREE.Group(); dg.add(q.duckSpin);
        for (let i = 0; i < 3; i++) {
          const duck = vcMesh([part(geo.sph(0.1, 8, 6), 0xffd84a, T(0, 0.06, 0, 1, 0.8, 1.3)), part(geo.sph(0.065, 8, 6), 0xffd84a, T(0, 0.17, 0.09)), part(geo.cone(0.03, 0.08, 5), 0xff8a3c, T(0, 0.16, 0.18, 1, 1, 1, 1.57, 0, 0))], true);
          const a = (i / 3) * 6.283; duck.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); duck.rotation.y = -a;
          q.duckSpin.add(duck);
        }
        q.ducks = hide(plant(dg, d, 0, 0.1));
        q.props = [q.basin];
        Q.ponds.push(q);
      },
      rain(q, p, ang, dt) { if (q.propD.dot(p) > cosA(ang)) { q.prog += dt / 4.2; q.water.visible = true; const s = Math.max(0.05, Math.min(1, q.prog)); q.water.scale.set(s, 1, s); } },
      done(q) { q.water.scale.set(1, 1, 1); pop(q.ducks, 0.3); },
      tick(q, dt) { if (q.stage === 'done') q.duckSpin.rotation.y += dt * 0.6; },
    },
    windmill: {
      icon: 'bolt', zap: true, zh: 1.9, pips: [['Fennel', 0xd8f08a, 'cap']], cap: 0xf2b84b, prop: [1.2, -0.7], stand: [0.4, -0.1],
      build(q) {
        const g = new THREE.Group();
        g.add(vcMesh([part(geo.cyl(0.3, 0.46, 1.5, 8), 0xfff1d6, T(0, 0.75, 0)), part(geo.cone(0.44, 0.5, 8), 0xe8584f, T(0, 1.75, 0)), part(geo.box(0.2, 0.34, 0.06), 0x8a5a3c, T(0, 0.17, 0.42)), part(geo.cyl(0.05, 0.05, 0.3, 6), 0x6b5a4a, T(0, 1.42, 0.4, 1, 1, 1, 1.57, 0, 0))]));
        q.blades = vcMesh([0, 1, 2, 3].map((k) => part(geo.box(0.17, 0.95, 0.03), 0xf7f3e8, rotZ((k * Math.PI) / 2, T(0, 0.55, 0)))));
        q.blades.position.set(0, 1.42, 0.56);
        g.add(q.blades);
        q.g = hide(plant(g, q.propD, q.yaw));
        q.props = [q.g]; q.speed = 0;
      },
      zap(q) { q.prog = 1; q.speed = 16; },
      tick(q, dt) {
        q.speed = damp(q.speed, q.stage === 'done' ? 2.4 : 0, 1.2, dt);
        q.blades.rotation.z += q.speed * dt;
        if (q.stage === 'done' && Math.random() < dt * 1.2) fx.puff(_v.copy(q.g.position).addScaledVector(q.propD, 1.9), 1, 1, 1, 1, 0.3, 0.3, 1.6, 0.5);
      },
    },
    camp: {
      icon: 'fire', pips: [['Bob?', 0xffe08a, 'leaf']], cap: 0x9a6bd6, prop: [1.0, 0.8], stand: [0.25, 0.35],
      build(q) {
        const parts = [];
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283; parts.push(part(geo.ico(0.11, 0), 0x9a96a6, T(Math.cos(a) * 0.42, 0.05, Math.sin(a) * 0.42))); }
        for (let i = 0; i < 4; i++) parts.push(part(geo.cyl(0.055, 0.055, 0.6, 5), 0x6e4a30, rotY(i * 1.57, T(0.12, 0.24, 0, 1, 1, 1, 0, 0, 0.5))));
        q.g = hide(plant(vcMesh(parts), q.propD, q.yaw));
        q.props = [q.g]; q.fireOn = false; q.wetF = 0; q.ft = 0; q.ig = 0;
        q.treesD = [q.local(2.3, 0.5), q.local(1.6, 2.2), q.local(-0.1, 2.0), q.local(2.8, 1.9)];
      },
      start(q) { q.fireOn = true; q.trees = q.treesD.filter((d) => W.elev(d) > 0.03).map((d) => W.addTree(d, true, 0)).filter(Boolean); },
      rain(q, p, ang, dt) { if (q.fireOn && q.propD.dot(p) > cosA(ang)) { q.wetF += dt; if (q.wetF > 1.5) { q.fireOn = false; audio.hiss(); fx.puff(q.g.position, 10, 1, 1, 1, 1.2, 0.5, 1.2, 0.6); } } },
      tick(q, dt) {
        if (q.stage === 'wish') {
          q.ft += dt;
          while (q.ig < q.trees.length && q.ft > 1.5 + q.ig * 1.5) { W.ignite(q.trees[q.ig]); q.ig++; }
          if (q.ft > 8 && !q.fireOn && W.firesNear(q.p, 0.55) === 0) q.prog = 1;
        }
        if (q.fireOn) fx.flame(q.g.position, q.propD, 0.55, dt);
      },
    },
    moss: {
      icon: 'bolt', zap: true, zh: 1.6, noSeed: true,
      build(q) {
        const g = new THREE.Group();
        const parts = [
          part(geo.sph(1.3, 18, 12), 0x6f9a62, T(0, 0.7, 0, 1, 0.72, 1.25)),
          part(geo.ico(0.5, 1), 0x8fce6a, T(0.4, 1.45, 0.2, 1, 0.5, 1)), part(geo.ico(0.5, 1), 0x7fc463, T(-0.5, 1.38, -0.4, 1, 0.5, 1)), part(geo.ico(0.6, 1), 0x9bd873, T(0, 1.5, -0.3, 1, 0.45, 1)),
          part(geo.cyl(0.05, 0.05, 0.3, 5), 0x8a5a3c, T(-0.3, 1.7, 0.5)), part(geo.cone(0.28, 0.7, 6), 0x2f8f6f, T(-0.3, 2.15, 0.5)),
          part(geo.cyl(0.05, 0.05, 0.3, 5), 0x8a5a3c, T(0.45, 1.75, -0.5)), part(geo.ico(0.32, 1), 0xffa8c8, T(0.45, 2.1, -0.5)),
          part(geo.sph(0.55, 14, 10), 0x8fb07a, T(0, 0.62, 1.75)),
          part(geo.sph(0.1, 8, 6), 0xff9db4, T(-0.4, 0.5, 2.1, 1, 0.7, 0.4)), part(geo.sph(0.1, 8, 6), 0xff9db4, T(0.4, 0.5, 2.1, 1, 0.7, 0.4)),
          part(geo.cone(0.2, 0.6, 6), 0x6f9a62, T(0, 0.5, -1.75, 1, 1, 1, -1.57, 0, 0)),
        ];
        const body = new THREE.Group();
        body.add(vcMesh(parts, true));
        q.eyesC = vcMesh([part(geo.box(0.2, 0.045, 0.05), 0x22222c, T(-0.24, 0.74, 2.26)), part(geo.box(0.2, 0.045, 0.05), 0x22222c, T(0.24, 0.74, 2.26))]);
        q.eyesO = vcMesh([part(geo.sph(0.085, 8, 6), 0x22222c, T(-0.24, 0.76, 2.24)), part(geo.sph(0.085, 8, 6), 0x22222c, T(0.24, 0.76, 2.24))], true);
        q.eyesO.visible = false;
        body.add(q.eyesC, q.eyesO);
        const lm = new THREE.MeshLambertMaterial({ color: 0x7e9c6e });
        q.legs = [[0.8, 0.85], [-0.8, 0.85], [0.8, -0.85], [-0.8, -0.85]].map(([x, z]) => { const l = new THREE.Mesh(geo.cyl(0.28, 0.32, 0.8, 8), lm); l.position.set(x, 0.2, z); l.castShadow = true; body.add(l); return l; });
        g.add(body);
        scene.add(g);
        q.g = g; q.body = body; q.d = q.p.clone(); q.fwd = anyTangent(q.p).clone(); q.axis = V().crossVectors(q.d, q.fwd).normalize();
        q.awakeT = 0; q.zz = 0; q.props = []; q.stage = 'idle';
        Q.moss = q;
      },
      zap(q) { q.prog = 1; q.awakeT = 0.001; audio.roar(); q.eyesC.visible = false; q.eyesO.visible = true; fx.shake = 1.4; const lp = V(); ui.label('Old Moss', () => lp.copy(q.g.position).addScaledVector(q.d, 3.4), 4.5); },
      tick(q, dt) {
        let rise = 0;
        if (q.awakeT > 0) {
          q.awakeT += dt;
          rise = sstep(0.2, 2.6, q.awakeT);
          if (q.awakeT > 3.2) {
            q.d.applyAxisAngle(q.axis, 0.02 * dt).normalize();
            q.fwd.crossVectors(q.axis, q.d);
            W.addWater(q.d, 0.15, dt * 0.55);
            q.legs.forEach((l, i) => { l.position.y = 0.2 + Math.max(0, Math.sin(q.t * 2.2 + (i === 0 || i === 3 ? 0 : Math.PI))) * 0.22; });
            q.body.rotation.z = Math.sin(q.t * 2.2) * 0.035;
          }
          q.propD.copy(q.d);
        } else {
          q.zz -= dt;
          if (q.zz <= 0) { q.zz = 1.5; fx.zzz(_v.copy(q.g.position).addScaledVector(q.d, 1.6).addScaledVector(q.fwd, 2.2), q.d); fx.zzz(_v.addScaledVector(q.d, 0.3), q.d); }
        }
        const r = Math.max(W.radiusAt(q.d), R - 0.5) + lerp(-0.55, 0.3, rise);
        q.g.position.copy(q.d).multiplyScalar(r);
        frameQuat(q.d, q.fwd, q.g.quaternion);
        const br = 1 + Math.sin(q.t * (q.awakeT > 0 ? 2.2 : 1.2)) * 0.025;
        q.body.scale.set(1, br, 1);
      },
    },
    rocket: {
      icon: 'bolt', zap: true, zh: 1.7, pips: [['Capt. Sprig', 0xf2f2f7, 'helmet']], cap: 0xe8584f, prop: [1.2, 0.5], stand: [0.35, 0.3],
      build(q) {
        const d = q.propD;
        q.pad = hide(plant(vcMesh([part(geo.cyl(0.52, 0.6, 0.1, 10), 0x8f8f9c, T(0, 0.05, 0))]), d, 0));
        const parts = [part(geo.cyl(0.2, 0.24, 0.8, 12), 0xf4f4f8, T(0, 0.75, 0)), part(geo.cone(0.2, 0.42, 12), 0xe8584f, T(0, 1.36, 0)), part(geo.sph(0.085, 8, 6), 0x6fc8ff, T(0, 0.9, 0.19)), part(geo.cyl(0.12, 0.17, 0.14, 8), 0x555566, T(0, 0.29, 0))];
        for (let k = 0; k < 3; k++) parts.push(part(geo.box(0.04, 0.36, 0.26), 0xe8584f, rotY(k * 2.094, T(0, 0.44, 0.28))));
        q.rocket = hide(plant(vcMesh(parts, true), d, 0));
        q.props = [q.pad, q.rocket]; q.launchT = -1; q.rd = d.clone(); q.tan = anyTangent(d).clone(); q.oa = 0; q.fw = 0;
      },
      zap(q) { if (q.launchT < 0) { q.launchT = 0; audio.launch(); } },
      tick(q, dt) {
        if (q.launchT < 0) return;
        q.launchT += dt;
        const t = q.launchT, g0 = W.groundAt(q.rd), rk = q.rocket;
        if (t < 4) {
          const h = t < 0.8 ? 0 : Math.pow((t - 0.8) / 3.2, 2) * 7;
          rk.position.copy(q.rd).multiplyScalar(g0 + h).add(_v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(t < 0.8 ? 0.06 : 0.01));
          _v.copy(rk.position).addScaledVector(q.rd, 0.2);
          fx.puff(_v, 2, 0.95, 0.95, 0.95, 1.6, 0.5, 1.4, 0.6);
          fx.sparks(_v, 3, 3, 1.6, 0.4, 1.5, 0.3, 0.35, 0);
          if (t > 0.8) fx.shake = Math.max(fx.shake, 0.25);
          if (t > 3.1 && q.fw < 1) { q.fw = 1; q.prog = 1; }
        } else {
          q.oa += dt * 0.32;
          _d.copy(q.rd).multiplyScalar(Math.cos(q.oa)).addScaledVector(q.tan, Math.sin(q.oa));
          _e.copy(q.rd).multiplyScalar(-Math.sin(q.oa)).addScaledVector(q.tan, Math.cos(q.oa));
          rk.position.copy(_d).multiplyScalar(g0 + 7);
          const tq = frameQuat(_d, _e, new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(1, 0, 0), Math.PI / 2));
          rk.quaternion.slerp(tq, Math.min(1, dt * 2));
          if (Math.random() < dt * 30) fx.glow.spawn(_v.copy(rk.position).addScaledVector(_e, -0.5), _e.multiplyScalar(-0.4), 1.6, 0.3, 0.05, 2, 1.3, 0.5, 0.9);
        }
        if (q.fw >= 1 && q.fw < 5 && t > 3.1 + (q.fw - 1) * 0.45) { q.fw++; fx.firework(_v.copy(rk.position).add(_e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4))); audio.boom(); }
      },
    },
    snowman: {
      icon: 'snow', pips: [['Olm', 0xc9b8ff, 'scarf']], cap: 0x6f8fe8, prop: [1.0, -0.5], stand: [0.3, -0.1],
      build(q) {
        const d = q.propD;
        q.pile = hide(plant(vcMesh([part(geo.dome(0.36, 10, 4), 0xffffff, T(0, 0, 0, 1, 0.4, 1)), part(geo.cone(0.04, 0.2, 5), 0xff8a3c, T(0.34, 0.05, 0.2, 1, 1, 1, 0, 0, 1.4))]), d, q.yaw));
        const g = new THREE.Group();
        const st = 0x6e4a30;
        q.balls = [
          vcMesh([part(geo.sph(0.44, 14, 10), 0xffffff, T(0, 0.36, 0))], true),
          vcMesh([part(geo.sph(0.33, 14, 10), 0xffffff, T(0, 0.98, 0)), part(geo.cyl(0.02, 0.02, 0.55, 4), st, T(0.5, 1.08, 0, 1, 1, 1, 0, 0, -1.0)), part(geo.cyl(0.02, 0.02, 0.55, 4), st, T(-0.5, 1.08, 0, 1, 1, 1, 0, 0, 1.0))], true),
          vcMesh([part(geo.sph(0.25, 14, 10), 0xffffff, T(0, 1.46, 0)), part(geo.sph(0.03, 6, 5), 0x22222c, T(-0.09, 1.52, 0.22)), part(geo.sph(0.03, 6, 5), 0x22222c, T(0.09, 1.52, 0.22)), part(geo.cone(0.04, 0.22, 6), 0xff8a3c, T(0, 1.45, 0.34, 1, 1, 1, 1.57, 0, 0)), part(geo.cyl(0.16, 0.16, 0.2, 10), 0x22222c, T(0, 1.78, 0)), part(geo.cyl(0.24, 0.24, 0.03, 10), 0x22222c, T(0, 1.68, 0))], true),
        ];
        q.balls.forEach((b) => { hide(b); g.add(b); });
        plant(g, d, q.yaw);
        q.props = [q.pile]; q.built = 0;
      },
      rain(q, p, ang, dt, snow) {
        if (!snow || q.propD.dot(p) < cosA(ang)) return;
        q.prog += dt / 4.8;
        const n = Math.min(3, Math.floor(q.prog * 3 + 0.001));
        while (q.built < n) { pop(q.balls[q.built]); q.built++; }
      },
    },
    shade: {
      icon: 'shade', pips: [['Mrs. Tuft', 0xff9fb5, 'shades']], cap: 0xf28a4b, prop: [0.9, 0.4], stand: [0.9, 0.4],
      build(q) {
        q.towel = hide(plant(vcMesh([0, 1, 2, 3, 4].map((i) => part(geo.box(0.75, 0.03, 0.22), i % 2 ? 0xffffff : 0xff6b6b, T(0, 0.03, -0.44 + i * 0.22)))), q.propD, q.yaw));
        q.parasol = hide(plant(vcMesh([part(geo.cyl(0.025, 0.025, 1.4, 5), 0xf0e6d0, T(0, 0.7, 0)), part(geo.cone(0.85, 0.32, 10), 0xff6b6b, T(0, 1.45, 0)), part(geo.sph(0.05, 6, 5), 0xffffff, T(0, 1.63, 0))]), q.local(1.45, 0.85), 0));
        q.props = [q.towel];
      },
      hover(q, p, dt) { if (q.propD.dot(p) > cosA(0.085)) q.prog += dt / 3.5; },
      tick(q, dt) { if (q.stage === 'wish' && q.pips[0] && Math.random() < dt * 4) fx.soft.spawn(_v.copy(q.pips[0].pos).addScaledVector(q.propD, 0.7).add(_e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.4)), _e.copy(q.propD).multiplyScalar(-0.5), 0.6, 0.07, 0.05, 0.5, 0.8, 1, 0.9); },
      done(q) { pop(q.parasol); },
    },
    wedding: {
      icon: 'rainbow', pips: [['Juniper', 0xffc4dd, 'bow'], ['June', 0xa8d4ff, 'tophat']], cap: 0xff8fb0, prop: [0, 1.25], stand: [0, 1.25],
      build(q) {
        const parts = [part(geo.tor(0.8, 0.065, 6, 22, Math.PI), 0xffffff)];
        const cols = [0xff8fb5, 0xffd24a, 0xc49bff, 0x7fd6ff, 0xff9a4a];
        for (let i = 0; i < 11; i++) { const a = (i / 10) * Math.PI; parts.push(part(geo.ico(0.085, 0), cols[i % 5], T(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.07))); }
        const arch = vcMesh(parts);
        arch.position.copy(q.propD).multiplyScalar(W.groundAt(q.propD) - 0.05);
        frameQuat(q.propD, q.bz, arch.quaternion);
        scene.add(arch);
        q.arch = hide(arch); q.props = [arch];
      },
      start(q) {
        q.pips.forEach((pp, i) => { pp.home.copy(q.propD).multiplyScalar(R).addScaledVector(q.tx, i ? 0.3 : -0.3).normalize(); });
      },
      rain(q, p, ang, dt, snow) { if (!snow && q.p.dot(p) > cosA(0.42) && fx.rainbowAmt > 0.5) q.prog += dt / 3; },
      done(q) { fx.hearts(_v.copy(q.arch.position), q.propD, 26); },
    },
  };
  const ORDER = ['turnip', 'pond', 'windmill', 'camp', 'moss', 'rocket', 'snowman', 'shade', 'wedding'];

  ORDER.forEach((kind, idx) => {
    const def = DEF[kind], p = W.sites[kind].clone();
    const tx = anyTangent(p).clone(), bz = V().crossVectors(p, tx);
    // spin the site frame until the prop, the stand spot and the house all sit on dry land
    const need = [def.prop, def.stand, [-1.15, -0.85], [0.45, 0.1]].filter(Boolean);
    for (let k = 0; k < 12; k++) {
      if (need.every(([x, z]) => W.elev(_v.copy(p).multiplyScalar(R).addScaledVector(tx, x).addScaledVector(bz, z).normalize()) > 0.05)) break;
      tx.applyAxisAngle(p, Math.PI / 6); bz.crossVectors(p, tx);
    }
    const q = { kind, def, p, tx, bz, stage: 'seed', active: false, prog: 0, seedW: 0, t: rnd() * 10, yaw: rnd() * 6.28, props: [], pips: [], pitch: 0.8 + idx * 0.09 };
    q.local = (x, z, out = V()) => out.copy(p).multiplyScalar(R).addScaledVector(tx, x).addScaledVector(bz, z).normalize();
    q.propD = def.prop ? q.local(def.prop[0], def.prop[1]) : p.clone();
    q.bub = bubble();
    if (!def.noSeed) {
      q.mound = plant(vcMesh([part(geo.dome(0.36, 10, 4), 0x8a6a4a, T(0, 0, 0, 1, 0.55, 1)), part(geo.cyl(0.016, 0.016, 0.24, 4), 0x5fcf5f, T(0, 0.3, 0)), part(geo.sph(0.085, 6, 5), 0x6fdc6a, T(0.075, 0.42, 0, 1, 0.3, 0.55, 0, 0, 0.5)), part(geo.sph(0.085, 6, 5), 0x6fdc6a, T(-0.075, 0.42, 0, 1, 0.3, 0.55, 0, 0, -0.5))]), p, q.yaw);
    }
    def.build(q);
    Q.list.push(q);
  });
  Q.avoid = () => {
    const a = [];
    for (const q of Q.list) a.push({ d: q.p, r: q.kind === 'camp' ? 0.34 : 0.24 });
    a.push({ d: W.sites.bud, r: 0.22 });
    return a;
  };

  // ---------- the Great Bud ----------
  const B = (Q.bud = { p: W.sites.bud.clone(), stage: 'sleep', prog: 0, t: 0, ft: -1, tilts: [], fwT: 0, bub: bubble() });
  {
    const g = new THREE.Group();
    const parts = [part(geo.cyl(0.2, 0.34, 1.5, 8), 0x4fae5c, T(0, 0.75, 0))];
    for (let k = 0; k < 4; k++) parts.push(part(geo.sph(0.7, 10, 6), k % 2 ? 0x5cc46a : 0x49b36b, rotY(k * 1.57 + 0.4, T(0.75, 0.22, 0, 1, 0.16, 0.5, 0, 0, 0.35))));
    g.add(vcMesh(parts, true));
    B.core = new THREE.Mesh(geo.sph(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    B.core.position.y = 1.78;
    g.add(B.core);
    const mk = (n, col, sc, z, c, o, y) => {
      for (let k = 0; k < n; k++) {
        const piv = new THREE.Group(); piv.position.y = y; piv.rotation.y = (k / n) * 6.283 + (sc < 1 ? 0.4 : 0);
        const tilt = new THREE.Group(); tilt.position.z = z; tilt.rotation.x = c;
        tilt.add(vcMesh([part(geo.sph(1, 10, 8), col, T(0, 0.8 * sc, 0, 0.36 * sc, 0.85 * sc, 0.085))], true));
        piv.add(tilt); g.add(piv);
        B.tilts.push({ tilt, c, o });
      }
    };
    mk(8, 0xff8fb5, 1, 0.3, -0.18, 1.2, 1.5);
    mk(5, 0xffc2d6, 0.72, 0.16, -0.12, 0.75, 1.55);
    plant(g, B.p, 0, -0.05);
    g.scale.setScalar(1.05);
    B.g = g;
  }

  // ---------- flow ----------
  function setBubble(q, kind) {
    if (!kind) { q.bub.visible = false; return; }
    if (q.bub.material.map !== tex(kind)) { q.bub.material.map = tex(kind); q.bub.material.needsUpdate = true; }
    q.bub.visible = true;
  }
  function wake(q) {
    q.stage = 'idle';
    audio.pop(1.2); audio.chirp(q.pitch, true);
    fx.puff(q.mound.position, 14, 0.75, 0.6, 0.45, 1.6, 0.4, 0.9, 0.7);
    scene.remove(q.mound);
    q.def.pips.forEach(([name, col, hat], i) => {
      const d = i ? q.local(0.45, 0.1) : q.p.clone();
      const pip = new Pip(G, d, col, name, q.pitch * (i ? 1.25 : 1), hat);
      pip.happy = 1.6;
      Q.pips.push(pip); q.pips.push(pip);
      const lp = V();
      ui.label(name, () => lp.copy(pip.pos).addScaledVector(pip.d, 1.5), 3.8);
    });
    const hd = q.local(-1.15, -0.85);
    const house = makeHouse(q.def.cap);
    house.position.copy(hd).multiplyScalar(W.groundAt(hd) - 0.04);
    frameQuat(hd, _v.copy(q.p).sub(hd), house.quaternion);
    scene.add(house);
    pop(house, 0.7);
    Q.houses.push({ g: house, d: hd });
    fx.hearts(_v.copy(q.p).multiplyScalar(W.groundAt(q.p)), q.p, 5);
    G.cloud.joyT = 0.8;
  }
  function startWish(q) {
    q.stage = 'wish';
    if (q.def.zap && !Q.thunder) { Q.thunder = true; G.onThunderUnlock(); }
    q.props.forEach((o, i) => pop(o, 0.25 * i));
    const st = q.def.stand;
    q.pips.forEach((pp) => { pp.mode = 'stay'; if (st) q.local(st[0], st[1], pp.home); });
    q.def.start && q.def.start(q);
  }
  function complete(q) {
    q.stage = 'done';
    Q.joy++;
    setBubble(q, null);
    q.pips.forEach((pp) => { pp.happy = 3.2; pp.mode = 'wander'; pp.home.copy(q.p); pp.wait = 0; });
    const at = q.pips[0] ? q.pips[0].pos : q.g ? q.g.position : _v.copy(q.propD).multiplyScalar(W.groundAt(q.propD));
    fx.hearts(at, q.propD, 12);
    audio.sparkle(72 + (Q.joy % 3) * 2); audio.chirp(q.pitch, true);
    ui.hearts(Q.joy);
    G.cloud.level = Q.joy; G.cloud.joyT = 1.4;
    q.def.done && q.def.done(q);
  }

  Q.update = (dt) => {
    // director
    const live = Q.list.filter((q) => q.active && q.stage !== 'done').length;
    const want = Q.joy < 1 ? 1 : Q.joy < 4 ? 2 : 3;
    if (live < want) {
      const nq = Q.list.find((q) => !q.active);
      if (nq) nq.active = true;
    }
    for (const q of Q.list) {
      q.t += dt;
      if (q.active && q.stage === 'idle') startWish(q);
      if (q.stage === 'wish' && q.prog >= 1) complete(q);
      q.def.tick && q.def.tick(q, dt);
      if (q.stage === 'seed' && q.mound) { const s = 1 + q.seedW * 0.35 + (q.seedW > 0 ? Math.sin(q.t * 30) * 0.03 : 0); q.mound.scale.set(s, s, s); }
      // bubble
      const show = q.active && (q.stage === 'seed' || q.stage === 'wish');
      if (show) {
        setBubble(q, q.stage === 'seed' ? 'drop' : q.def.icon);
        const d = q.stage === 'seed' ? q.p : q.propD;
        const h = q.stage === 'seed' ? 1.0 : q.def.zh ? q.def.zh + 0.9 : 1.9;
        q.bub.position.copy(d).multiplyScalar(W.groundAt(d) + h + Math.sin(q.t * 2.5) * 0.08);
        const pr = q.stage === 'seed' ? q.seedW : q.prog;
        q.bub.scale.setScalar(1.3 * (1 + 0.3 * clamp(pr)) * (1 + Math.sin(q.t * 5) * 0.03));
      } else if (q.bub.visible) setBubble(q, null);
    }
    for (const pip of Q.pips) pip.update(dt);
    for (const h of Q.houses) {
      const night = sstep(0.1, -0.25, G.sun.dot(h.d));
      h.g.userData.win.material.color.setRGB(0.1 + night * 3.2, 0.12 + night * 2.2, 0.2 + night * 0.5);
    }
    for (let i = Q.pops.length - 1; i >= 0; i--) {
      const o = Q.pops[i];
      o.t += dt;
      if (o.t < 0) continue;
      if (o.snd) { o.snd = false; audio.pop(0.8 + Math.random() * 0.5); }
      const k = Math.min(1, o.t / 0.5);
      o.obj.scale.setScalar(Math.max(0.001, easeOutBack(k)) * o.to);
      if (k >= 1) Q.pops.splice(i, 1);
    }
    budUpdate(dt);
  };

  function budUpdate(dt) {
    B.t += dt;
    if (B.stage === 'sleep' && Q.joy >= Q.total) { B.stage = 'water'; if (!Q.thunder) { Q.thunder = true; G.onThunderUnlock(); } }
    const open = B.ft < 0 ? 0 : sstep(0, 3.6, B.ft);
    for (const t of B.tilts) t.tilt.rotation.x = lerp(t.c, t.o, open) + Math.sin(B.t * 1.3 + t.o * 7) * 0.015 * (1 + open * 3);
    const glow = 0.75 + B.prog * 1.2 + open * 2.2 + Math.sin(B.t * 3) * 0.12 * (0.3 + B.prog);
    B.core.material.color.setRGB(1.0 * glow, 0.78 * glow, 0.4 * glow);
    B.g.scale.setScalar(1.05 * (1 + B.prog * 0.12 + Math.sin(B.t * 1.1) * 0.012));
    const showB = B.stage === 'water' || B.stage === 'zap';
    B.bub.visible = showB;
    if (showB) {
      const k = B.stage === 'water' ? 'drop' : 'bolt';
      if (B.bub.material.map !== tex(k)) { B.bub.material.map = tex(k); B.bub.material.needsUpdate = true; }
      B.bub.position.copy(B.p).multiplyScalar(W.groundAt(B.p) + 4.2 + Math.sin(B.t * 2.5) * 0.1);
      B.bub.scale.setScalar(1.7 * (1 + 0.3 * clamp(B.prog)));
    }
    if (B.stage === 'bloom') {
      B.ft += dt;
      const ang = clamp((B.ft - 1.2) / 9) * Math.PI;
      if (ang > 0 && ang < Math.PI) {
        W.wave(B.p, ang);
        for (let k = 0; k < 10; k++) {
          offsetOnSphere(B.p, Math.random() * 6.283, ang, _d);
          _v.copy(_d).multiplyScalar(W.groundAt(_d) + 0.2);
          fx.glow.spawn(_v, _e.copy(_d).multiplyScalar(1 + Math.random() * 1.5), 1.2 + Math.random(), 0.3, 0.04, 2.2, 1.8, 0.8, 1);
        }
        const c = Math.cos(ang);
        for (const pp of Q.pips) if (pp.d.dot(B.p) > c) pp.happy = Math.max(pp.happy, 1.5);
      }
      if (B.ft < 3 && Math.random() < dt * 40) {
        _v.copy(B.g.position).addScaledVector(B.p, 2.0);
        fx.glow.spawn(_v, _e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(3).addScaledVector(B.p, 2.5), 2, 0.34, 0.05, 2.4, 1.5, 0.9, 1, 0.8, 0.5);
      }
      B.fwT -= dt;
      if (B.ft > 2 && B.fwT <= 0) {
        B.fwT = 0.45 + Math.random() * 0.5;
        offsetOnSphere(G.cloud.p, Math.random() * 6.283, 0.15 + Math.random() * 0.55, _d);
        fx.firework(_v.copy(_d).multiplyScalar(R + 4 + Math.random() * 3));
        if (Math.random() < 0.7) audio.boom();
      }
      if (B.ft > 3 && !B.baby) { B.baby = true; G.spawnBaby(_v.copy(B.g.position).addScaledVector(B.p, 2.0)); }
      if (B.ft > 14) { B.stage = 'done'; G.onEnd(); }
    }
    if (B.stage === 'done' && Math.random() < dt * 3) {
      _v.copy(B.g.position).addScaledVector(B.p, 2.0);
      fx.glow.spawn(_v, _e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.5).addScaledVector(B.p, 1.5), 2.5, 0.25, 0.04, 2.2, 1.6, 0.9, 1, 0.5, 0.4);
    }
  }

  Q.rain = (p, ang, dt, snow) => {
    const c = cosA(ang);
    for (const q of Q.list) {
      if (q.stage === 'seed') {
        if (q.p.dot(p) > cosA(ang * 0.85)) { q.seedW += dt / 2.2; if (q.seedW >= 1) wake(q); }
      } else if (q.stage === 'wish' && q.def.rain) q.def.rain(q, p, ang, dt, snow);
    }
    for (const pp of Q.pips) if (pp.d.dot(p) > c) pp.wet = 1.0;
    if (B.stage === 'water' && B.p.dot(p) > c) { B.prog += dt / 4.5; if (B.prog >= 1) { B.prog = 1; B.stage = 'zap'; audio.sparkle(79); } }
  };
  Q.hover = (p, dt) => { for (const q of Q.list) if (q.stage === 'wish' && q.def.hover) q.def.hover(q, p, dt); };
  Q.zapTarget = (p) => {
    const c = cosA(0.27);
    if (B.stage === 'zap' && B.p.dot(p) > c) return { d: B.p, h: 3.0, hit: () => { B.stage = 'bloom'; B.ft = 0; G.onFinale(); } };
    let best = null, bd = c;
    for (const q of Q.list) if (q.stage === 'wish' && q.def.zap && q.prog < 1 && !(q.launchT >= 0)) { const k = q.propD.dot(p); if (k > bd) { bd = k; best = q; } }
    return best ? { d: best.propD, h: best.def.zh, hit: () => best.def.zap(best) } : null;
  };
  Q.soot = (d) => { for (const pp of Q.pips) if (pp.d.dot(d) > cosA(0.07)) { pp.soot = 6; audio.chirp(pp.pitch, false); } };
  Q.pondAt = (p) => Q.ponds.some((q) => q.stage === 'done' && q.propD.dot(p) > cosA(0.1));
  Q.targets = () => {
    const out = [];
    for (const q of Q.list) if (q.active && (q.stage === 'seed' || q.stage === 'wish')) out.push({ id: q.kind, icon: q.stage === 'seed' ? 'drop' : q.def.icon, d: q.stage === 'seed' ? q.p : q.propD });
    if (B.stage === 'water' || B.stage === 'zap') out.push({ id: 'bud', icon: B.stage === 'water' ? 'drop' : 'bolt', d: B.p });
    return out;
  };
  // debug: finish whatever is currently asked for
  Q.skip = () => {
    for (const q of Q.list) if (q.active) { if (q.stage === 'seed') wake(q); else if (q.stage === 'wish') { if (q.def.zap) q.def.zap(q); if (q.kind === 'camp') { q.fireOn = false; q.ft = 9; } else if (q.kind === 'snowman') { while (q.built < 3) pop(q.balls[q.built++]); q.prog = 1; } else if (q.kind === 'pond') { q.water.visible = true; q.prog = 1; } else q.prog = 1; } }
  };
  return Q;
}
