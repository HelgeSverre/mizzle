import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createPost(renderer, scene, camera) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.75, 1.0);
  composer.addPass(bloom);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.45 }, uBlur: { value: 1 }, uFlash: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBlur, uFlash, uTime, uFade; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float d = abs(vUv.y - uFocus);
        float amt = smoothstep(0.13, 0.55, d) * uBlur;
        vec3 col = vec3(0.0);
        float rot = hash(vUv * uRes) * 6.2831;
        vec2 asp = vec2(uRes.y / uRes.x, 1.0) * 0.016 * amt;
        for (int i = 0; i < 20; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 20.0), a = fi * 2.39996 + rot;
          col += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * asp).rgb;
        }
        col /= 20.0;
        vec2 q = vUv - 0.5;
        col *= 1.0 - dot(q, q) * 0.55;
        col = mix(col, vec3(dot(col, vec3(0.3, 0.6, 0.1))), -0.12);
        col += vec3(0.9, 0.95, 1.0) * uFlash;
        col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.022;
        gl_FragColor = vec4(max(col, 0.0) * uFade, 1.0);
      }`,
  });
  composer.addPass(fin);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, fin,
    setSize(w, h, pr) {
      renderer.setPixelRatio(pr); renderer.setSize(w, h);
      composer.setPixelRatio(pr); composer.setSize(w, h);
      fin.uniforms.uRes.value.set(w * pr, h * pr);
    },
  };
}
