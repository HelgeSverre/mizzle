export function makeNoise(seed) {
  const h = (x, y, z) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const l = (a, b, t) => a + (b - a) * t;
  function n3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    ) * 2 - 1;
  }
  function fbm(x, y, z, o = 5) {
    let a = 0.5, s = 0, fq = 1, norm = 0;
    for (let i = 0; i < o; i++) { s += a * n3(x * fq, y * fq, z * fq); norm += a; a *= 0.5; fq *= 2.03; }
    return s / norm;
  }
  return { n3, fbm };
}
