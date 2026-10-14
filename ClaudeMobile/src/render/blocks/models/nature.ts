import type { Canvas, Face } from '../iso';
import type { TexLib } from '../tex';

const h = (a: number, b: number, c = 0) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

export type Wood = 'oak' | 'beech' | 'maple' | 'pine' | 'eucalyptus';

/**
 * Block tree on one tile: a slim log trunk and a crown of leaf blocks in
 * half-block steps that spills a little over the neighbours.
 */
export function tree(c: Canvas, L: TexLib, wood: Wood, seed: number, sway = 0, fruit = 0): void {
  const log: Face = { tex: L.get(`a/${wood}_log_side`) };
  const logTop: Face = { tex: L.get(`a/${wood}_log_top`) };
  const leaves: Face = { tex: L.get(`a/${wood}_leaves`) };
  const trunkH = wood === 'pine' ? 2.5 : 2;
  c.box([0.3125, 0.3125, 0], [0.6875, 0.6875, trunkH], logTop, log, log, 2);
  // roots
  c.box([0.25, 0.25, 0], [0.75, 0.75, 0.1875], logTop, log, log, 2);
  const s = sway * 0.0625;
  if (wood === 'pine') {
    for (let k = 0; k < 4; k++) {
      const r = 0.9 - k * 0.2, z = 1.25 + k * 0.5;
      c.box([0.5 - r + s * k, 0.5 - r, z], [0.5 + r + s * k, 0.5 + r, z + 0.5], leaves, leaves, leaves, 3);
    }
    c.box([0.375 + s * 4, 0.375, 3.25], [0.625 + s * 4, 0.625, 3.5], leaves, leaves, leaves, 3);
    return;
  }
  // main crown: a 2×2 core with stepped lumps, upper part sways
  c.box([-0.375, -0.375, 1.75], [1.375, 1.375, 2.75], leaves, leaves, leaves, 3);
  c.box([-0.125 + s, -0.125, 2.75], [1.125 + s, 1.125, 3.25], leaves, leaves, leaves, 3);
  for (let i = 0; i < 6; i++) {
    const a = h(seed, i, 1) * Math.PI * 2;
    const r = 0.95;
    const x = 0.5 + Math.cos(a) * r, y = 0.5 + Math.sin(a) * r, z = 1.75 + Math.floor(h(seed, i, 2) * 3) * 0.25;
    c.box([x - 0.25, y - 0.25, z], [x + 0.25, y + 0.25, z + 0.5], leaves, leaves, leaves, 3);
  }
  c.box([0.125 + s, 0.125, 3.25], [0.875 + s, 0.875, 3.5], leaves, leaves, leaves, 3);
  // fruit / blossoms dotted on the crown's visible faces
  for (let i = 0; i < fruit; i++) {
    const side = i % 3;
    const t1 = h(seed, i, 7), t2 = h(seed, i, 8);
    const p: [number, number, number] = side === 0 ? [-0.375 + t1 * 1.75, 1.39, 1.85 + t2 * 0.8] : side === 1 ? [1.39, -0.375 + t1 * 1.75, 1.85 + t2 * 0.8] : [-0.3 + t1 * 1.6, -0.3 + t2 * 1.6, 2.76];
    c.box(p, [p[0] + 0.0625 * 1.5, p[1] + 0.0625 * 1.5, p[2] + 0.0625 * 1.5], { tex: L.get('as/default_apple') , uv: [6, 6, 8, 8] }, { tex: L.get('as/default_apple'), uv: [5, 7, 7, 9] }, { tex: L.get('as/default_apple'), uv: [5, 7, 7, 9] }, 4);
  }
}
