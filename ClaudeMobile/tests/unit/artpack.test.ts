import { existsSync, readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { BUILDINGS } from '../../src/core/content/buildings';
import { ITEM_IDS } from '../../src/core/content/items';
// the art pack is baked by `npm run art` (CI bakes it in the build step, after unit tests)
it.skipIf(!existsSync('public/art/manifest.json'))('the baked art pack covers every item and building', () => {
  const man = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
  const lacking = (ITEM_IDS as string[]).filter((id) => !man.rects[`icon:${id}`]).concat(Object.keys(BUILDINGS).filter((id) => BUILDINGS[id].kind !== 'belt' && !man.sprites[id] && !man.sprites[id + '_meadow']));
  expect(lacking).toEqual([]);
});
