/**
 * Fast deterministic 3D gradient noise, fBm and cellular noise for the
 * offline HD renderer. No allocations in the hot paths.
 */

const P = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 1234567;
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}

const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0];
const GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1];
const GZ = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1];

function grad(h: number, x: number, y: number, z: number): number {
  const g = h & 15;
  return GX[g] * x + GY[g] * y + GZ[g] * z;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Gradient noise in roughly [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  x -= xi; y -= yi; z -= zi;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
  const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const l = (a: number, b: number, t: number) => a + t * (b - a);
  return l(
    l(l(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), l(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    l(l(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), l(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v),
    w,
  );
}

/** Fractal noise, roughly [-1, 1]. */
export function fbm(x: number, y: number, z: number, oct = 4, lac = 2.03, gain = 0.5): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    n += a;
    a *= gain;
    f *= lac;
  }
  return s / n;
}

/** Ridged fractal noise in [0, 1] (cracks, veins). */
export function ridged(x: number, y: number, z: number, oct = 4): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * (1 - Math.abs(noise3(x * f, y * f, z * f)));
    n += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / n;
}

export function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Cellular noise: returns F1 distance and writes F2 and cell id to `cell`. */
export const cell = { f2: 0, id: 0 };
export function voronoi(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, f2 = 9, id = 0;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, cz = zi + k;
    const px = cx + hash3(cx, cy, cz), py = cy + hash3(cx + 17, cy, cz), pz = cz + hash3(cx, cy + 31, cz);
    const dx = px - x, dy = py - y, dz = pz - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < f1) { f2 = f1; f1 = d; id = hash3(cx, cy, cz + 7); } else if (d < f2) f2 = d;
  }
  cell.f2 = Math.sqrt(f2);
  cell.id = id;
  return Math.sqrt(f1);
}

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Polynomial smooth minimum. */
export function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return mix(b, a, h) - k * h * (1 - h);
}

/** sRGB hex → linear RGB triple. */
export function lin(hex: number): [number, number, number] {
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

/** 2D gradient noise that wraps with integer `period` on both axes (tileable textures). */
export function pnoise2(x: number, y: number, period: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const w = (n: number) => ((n % period) + period) % period;
  const g = (ix: number, iy: number, dx: number, dy: number) => {
    const h = P[(P[w(ix) & 255] + (w(iy) & 255)) & 511] & 7;
    const gx = [1, -1, 1, -1, 0.7071, -0.7071, 0.7071, -0.7071][h], gy = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071][h];
    return gx * dx + gy * dy;
  };
  const u = fade(fx), v = fade(fy);
  const a = g(xi, yi, fx, fy), b = g(xi + 1, yi, fx - 1, fy), c = g(xi, yi + 1, fx, fy - 1), d = g(xi + 1, yi + 1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
}

/** Tileable fBm over a unit tile: (x, y) in tile units, `f` cells per tile (integer). */
export function tfbm(x: number, y: number, f: number, oct = 4, seed = 0): number {
  let s = 0, a = 0.5, n = 0, fr = f;
  for (let i = 0; i < oct; i++) {
    s += a * pnoise2(x * fr + seed * 17.3 * (i + 1), y * fr + seed * 31.7, fr);
    n += a; a *= 0.5; fr *= 2;
  }
  return s / n;
}
