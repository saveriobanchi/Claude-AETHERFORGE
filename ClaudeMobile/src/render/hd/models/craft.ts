import { MAT } from '../mats';
import { Model } from '../sdf';

/** Carpenter's workbench with tools, a vise and a hanging lantern. */
export function workbench(): Model {
  const m = new Model();
  // stone footing
  m.box([0, 0, 0.02], [0.44, 0.44, 0.02], MAT.stone, 0.01);
  // legs + stretchers
  for (const [x, y] of [[-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28]]) m.box([x, y, 0.24], [0.035, 0.035, 0.22], MAT.post, 0.008);
  m.box([0, -0.28, 0.12], [0.34, 0.025, 0.025], MAT.beamX, 0.006);
  m.box([0, 0.28, 0.12], [0.34, 0.025, 0.025], MAT.beamX, 0.006);
  // lower shelf with a stack of boards
  m.box([0, 0, 0.13], [0.32, 0.26, 0.012], MAT.deck, 0.004);
  for (let i = 0; i < 3; i++) m.box([-0.06, -0.04 + i * 0.01, 0.16 + i * 0.024], [0.2, 0.09, 0.011], MAT.oak, 0.004);
  // heavy top
  m.box([0, 0, 0.475], [0.42, 0.34, 0.035], MAT.deck, 0.01);
  // vise
  m.box([0.33, -0.22, 0.54], [0.05, 0.05, 0.035], MAT.iron, 0.008);
  m.cyl([0.33, -0.31, 0.54], 0.01, 0.07, MAT.ironDark, 'y');
  // saw
  m.box([-0.08, 0.12, 0.515], [0.2, 0.06, 0.004], MAT.iron, 0.002, { rot: [0, 0, 0.25] });
  m.box([0.13, 0.17, 0.53], [0.05, 0.02, 0.018], MAT.oak, 0.006, { rot: [0, 0, 0.25] });
  // mallet
  m.cyl([-0.22, -0.14, 0.545], 0.035, 0.06, MAT.beamY, 'y');
  m.cyl([-0.1, -0.1, 0.525], 0.012, 0.1, MAT.post, 'x');
  // wood shavings
  for (let i = 0; i < 6; i++) m.torus([0.08 + i * 0.035, -0.12 + (i % 2) * 0.05, 0.515], 0.016, 0.004, MAT.shaving);
  // lantern on a post
  m.box([0.4, 0.33, 0.45], [0.018, 0.018, 0.43], MAT.post, 0.005);
  m.box([0.4, 0.27, 0.86], [0.012, 0.06, 0.012], MAT.post, 0.004);
  m.cyl([0.4, 0.22, 0.79], 0.03, 0.04, MAT.lamp);
  m.cone([0.4, 0.22, 0.85], 0.045, 0.012, 0.02, MAT.ironDark);
  m.cyl([0.4, 0.22, 0.745], 0.04, 0.006, MAT.ironDark);
  return m;
}

/** Open-sided sawmill shed: shingle roof on posts, a big saw blade, a log on a carriage, plank stack. */
export function sawmill(rot = 0): Model {
  const m = new Model();
  m.box([0, 0, 0.03], [0.46, 0.46, 0.03], MAT.stone, 0.015);
  m.box([0, 0, 0.065], [0.42, 0.42, 0.008], MAT.deck, 0.004);
  // posts and beams
  for (const [x, y] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) m.box([x, y, 0.42], [0.035, 0.035, 0.36], MAT.post, 0.01);
  m.box([0, -0.38, 0.79], [0.42, 0.035, 0.035], MAT.beamX, 0.01);
  m.box([0, 0.38, 0.79], [0.42, 0.035, 0.035], MAT.beamX, 0.01);
  // braces
  for (const sx of [-1, 1]) for (const y of [-0.38, 0.38]) m.capsule([sx * 0.38, y, 0.62], [sx * 0.22, y, 0.77], 0.015, MAT.post);
  // gable roof along x with overhang
  m.roof([0, 0, 0.98], 0.52, 0.56, 0.18, MAT.roof);
  m.box([0, 0, 1.17], [0.53, 0.03, 0.025], MAT.beamX, 0.012);
  // saw bench + carriage with a log
  m.box([0, 0.02, 0.2], [0.3, 0.14, 0.12], MAT.oak, 0.01);
  m.cyl([-0.05, 0.02, 0.4], 0.085, 0.28, MAT.logX, 'x');
  m.cyl([0.235, 0.02, 0.4], 0.085, 0.005, MAT.logEnd, 'x');
  // circular blade standing in the x-z plane, teeth rotate with `rot`
  m.add((x, y, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x) + rot;
    const teeth = 0.17 + 0.012 * Math.abs(((a / (Math.PI * 2)) * 24) % 1 - 0.5);
    return Math.max(r - teeth, Math.abs(y) - 0.006);
  }, MAT.blade3, [0.12, 0.14, 0.42], [0.2, 0.02, 0.2]);
  m.cyl([0.12, 0.155, 0.42], 0.03, 0.012, MAT.brass, 'y');
  // stacked planks beside
  for (let i = 0; i < 4; i++) m.box([-0.16 + (i % 2) * 0.01, -0.28, 0.1 + i * 0.03], [0.22, 0.07, 0.013], MAT.oak, 0.005);
  // sawdust pile
  m.ellipsoid([0.3, 0.3, 0.07], 0.09, 0.08, 0.04, MAT.shaving);
  return m;
}

/** Windmill: tapered stone tower, timber cap with a shingle cone roof, four lattice sails. */
export function windmill(rot = 0): Model {
  const m = new Model();
  m.box([0, 0, 0.03], [0.46, 0.46, 0.03], MAT.stone, 0.015);
  m.cone([0, 0, 0.62], 0.4, 0.3, 0.56, MAT.towerStone);
  // door and window
  m.box([0.0, 0.36, 0.22], [0.08, 0.04, 0.14], MAT.darkWood, 0.02, { rot: [0, 0, 0] });
  m.box([0.27, 0.15, 0.78], [0.04, 0.05, 0.06], MAT.window, 0.01);
  // timber cap
  m.cyl([0, 0, 1.24], 0.34, 0.08, MAT.oak);
  m.cone([0, 0, 1.52], 0.4, 0.02, 0.22, MAT.roof);
  // hub on the +y side facing the viewer
  const hub: [number, number, number] = [0, 0.44, 1.2];
  m.cyl([0, 0.32, 1.2], 0.035, 0.14, MAT.beamY, 'y');
  m.sphere(hub, 0.06, MAT.ironDark);
  for (let s = 0; s < 4; s++) {
    const a = rot + (s * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tip: [number, number, number] = [hub[0] + ca * 0.95, hub[1], hub[2] + sa * 0.95];
    m.capsule(hub, tip, 0.018, MAT.post);
    // sail panel: a thin board beside the arm, with lattice ribs
    const px = -sa, pz = ca; // perpendicular in the sail plane
    const c: [number, number, number] = [hub[0] + ca * 0.58 + px * 0.09, hub[1] + 0.01, hub[2] + sa * 0.58 + pz * 0.09];
    m.box(c, [0.34, 0.006, 0.075], MAT.sail, 0.004, { rot: [0, -a, 0] });
    for (let r = 0; r < 5; r++) {
      const t = 0.28 + r * 0.16;
      m.capsule([hub[0] + ca * t, hub[1] + 0.012, hub[2] + sa * t], [hub[0] + ca * t + px * 0.17, hub[1] + 0.012, hub[2] + sa * t + pz * 0.17], 0.008, MAT.post);
    }
    m.capsule([hub[0] + ca * 0.25 + px * 0.17, hub[1] + 0.012, hub[2] + sa * 0.25 + pz * 0.17], [tip[0] + px * 0.17, hub[1] + 0.012, tip[2] + pz * 0.17], 0.008, MAT.post);
  }
  return m;
}
