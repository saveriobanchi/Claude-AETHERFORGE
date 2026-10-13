/** OKLab helpers for pixel-art colour quantisation (linear sRGB in/out). */

export function linToOklab(r: number, g: number, b: number, o: Float64Array): void {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  o[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  o[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

export function oklabToLin(L: number, a: number, b: number, o: Float64Array): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

/**
 * Pixel-art posterise: snap lightness to bands, chroma to steps and hue to
 * sectors, nudging dark bands toward violet and light bands toward gold.
 */
export function posterize(o: Float64Array, bands = 14, dither = 0): void {
  let L = o[0];
  const a = o[1], b = o[2];
  let C = Math.hypot(a, b);
  let H = Math.atan2(b, a);
  L = Math.round(L * bands + dither) / bands;
  C = Math.round(C * 40) / 40;
  const sector = Math.PI / 12;
  H = Math.round(H / sector) * sector;
  // hue shift: shadows cooler/violet, highlights warmer
  const warm = 1.2, cool = -1.9; // radians targets (≈ 70° gold, ≈ 250° violet)
  const shift = L < 0.45 ? (0.45 - L) * 0.6 : L > 0.8 ? -(L - 0.8) * 0.35 : 0;
  const target = shift > 0 ? cool : warm;
  const d = Math.atan2(Math.sin(target - H), Math.cos(target - H));
  H += d * Math.min(0.35, Math.abs(shift));
  if (L < 0.3) C *= 0.85 + L * 0.5;
  o[0] = L; o[1] = Math.cos(H) * C; o[2] = Math.sin(H) * C;
}
