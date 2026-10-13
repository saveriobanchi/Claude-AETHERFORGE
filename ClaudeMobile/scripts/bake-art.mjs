// Pre-bakes all voxel sprite/icon art into public/art (PNG sheets + manifest)
// so devices load images instead of generating art on startup.
// Usage: node scripts/bake-art.mjs
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = process.cwd();
const tmp = join(root, 'node_modules', '.cache', 'bake-art');
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, 'bake.mjs');
await build({ entryPoints: [join(root, 'src/render/bake.ts')], bundle: true, format: 'esm', platform: 'node', outfile: entry, logLevel: 'warning' });

const t0 = Date.now();
const { bakeArt } = await import(pathToFileURL(entry).href + '?t=' + t0);
const { manifest, sheets } = bakeArt();

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = join(root, 'public', 'art');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let bytes = 0;
sheets.forEach((s, i) => { const b = png(s.w, s.h, s.data); bytes += b.length; writeFileSync(join(out, `sheet${i}.png`), b); });
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`baked ${Object.keys(manifest.sprites).length} sprites into ${sheets.length} sheet(s), ${(bytes / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
