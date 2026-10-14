import type { Canvas, Face, Tex } from '../iso';
import { Paint, type TexLib } from '../tex';

/** Minecraft-style machines: full or partial blocks with purpose-made faces. */

const F = (t: Tex, glow = false): Face => ({ tex: t, glow });

/** Crafting table: planked block, gridded top with tools, tool-hung sides. */
export function workbench(c: Canvas, L: TexLib): void {
  const planks = L.get('a/oak_planks');
  const top = new Paint(16, 16, planks).frame(0, 0, 16, 16, 0x5a3a26).frame(1, 1, 14, 14, 0x8a5a36);
  for (const k of [5, 10]) { top.rect(k, 2, 1, 12, 0x6a4430); top.rect(2, k, 12, 1, 0x6a4430); }
  top.draw(['..ss', '.s..', 's...'], { s: 0x9aa2aa }, 11, 2).draw(['hh', 'hh', '.w', '.w'], { h: 0x6a7480, w: 0x8a5a36 }, 3, 10);
  const side = new Paint(16, 16, L.get('a/beech_log_side')).rect(0, 0, 16, 3, 0x7a4e30).rect(0, 1, 16, 1, 0x9a6a40);
  side.blit(L.get('as/default_tool_stoneaxe'), 0, 1, 0, 0, 16, 15);
  const side2 = new Paint(16, 16, L.get('a/beech_log_side')).rect(0, 0, 16, 3, 0x7a4e30).rect(0, 1, 16, 1, 0x9a6a40);
  side2.blit(L.get('as/default_tool_woodpick'), 0, 1, 0, 0, 16, 15);
  c.shadow(0, 0, 1.15, 1.15);
  c.box([0.0625, 0.0625, 0], [0.9375, 0.9375, 0.875], F(top), F(side), F(side2), 5);
}

/** Furnace: cobblestone block with a glowing fire mouth on its front and a brick chimney. */
export function furnace(c: Canvas, L: TexLib, f = 0): void {
  const cobble = L.get('b/cobblestone');
  const front = new Paint(16, 16, cobble);
  front.rect(3, 6, 10, 8, 0x2a1c1c).frame(2, 5, 12, 10, 0x5a5a62);
  const fire = [0xffe08a, 0xffa03a, 0xe0502a, 0x9a2a1a];
  for (let x = 4; x < 12; x++) {
    const hgt = 2 + ((x * 7 + f * 5) % 4);
    for (let y = 0; y < hgt; y++) front.set(x, 13 - y, fire[Math.min(3, y)]);
  }
  front.rect(4, 13, 8, 1, 0xffe08a);
  const top = new Paint(16, 16, cobble).rect(4, 4, 8, 8, 0x3a3a42).frame(4, 4, 8, 8, 0x5a5a62);
  c.shadow(0, 0, 1.15, 1.15);
  c.box([0, 0, 0], [1, 1, 1], F(top), F(front), F(cobble), 5);
  // brick chimney with a soot cap
  const brick = L.get('a/mud_bricks');
  c.box([0.125, 0.125, 1], [0.4375, 0.4375, 1.625], F(brick), F(brick), F(brick), 6);
  c.box([0.0625, 0.0625, 1.625], [0.5, 0.5, 1.75], F(L.get('b/stone')), F(L.get('b/stone')), F(L.get('b/stone')), 6);
}
