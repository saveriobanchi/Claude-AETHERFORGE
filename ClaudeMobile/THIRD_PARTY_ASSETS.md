# Third-party assets

Everything visible or audible in Aetherforge that is not listed here is
**original work created for this project**:

- All pixel art (terrain, undersides, buildings, trees, items, icons, sky,
  clouds, effects, UI glyphs, app icons, Android launcher/splash) is generated
  procedurally at runtime or build time by code in `src/render/art/` and
  `src/ui/glyphs.ts` / `src/dev/icon.ts`.
- All sound and music is synthesized at runtime with the Web Audio API
  (`src/platform/audio.ts`). No samples are used.

## Art packs (CC0, vendored in `art/cc0/`)

The world, buildings and items are assembled from these public-domain
texture packs by the bake step (`npm run art`). The PNGs were losslessly
re-saved as plain RGBA (no visual change); everything else is unmodified.
Extra machine faces are composed in code from these textures.

| Folder | Pack | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| `art/cc0/blocks-a/` | 16x16 Block Texture Set (blocks + plants) | ARoachIFoundOnMyPillow | https://opengameart.org/content/16x16-block-texture-set | CC0 1.0 |
| `art/cc0/blocks-b/` | 16*16 Block Textures | ARoachIFoundOnMyPillow | https://opengameart.org/content/1616-block-textures | CC0 1.0 |
| `art/cc0/assorted/` | Assorted Minecraft style textures (two archives) | JoeEnderman | https://opengameart.org/content/assorted-minecraft-style-textures-defaultsteelblockpng | CC0 1.0 |
| `art/cc0/kenney-voxel/` | Voxel Pack | Kenney (www.kenney.nl) | https://kenney.nl/assets/voxel-pack | CC0 1.0 — `art/cc0/kenney-voxel/License.txt` |

The archives were downloaded by the project owner from the pages above,
which list them as CC0 (public domain dedication). Credit is not required
but is given here with thanks.

## Fonts

| Asset | Source | Author | Licence | Modifications |
| --- | --- | --- | --- | --- |
| Pixelify Sans (`src/assets/fonts/PixelifySans.ttf`) | https://github.com/google/fonts/tree/main/ofl/pixelifysans (obtained from the owner's approved Cloudroot asset set) | The Pixelify Sans Project Authors (Stefie Justprince) | SIL Open Font License 1.1 — `licenses/PixelifySans-OFL.txt` | Renamed file only |
| Atkinson Hyperlegible (`src/assets/fonts/AtkinsonHyperlegible.ttf`) | https://www.brailleinstitute.org/freefont/ (obtained from the owner's approved Cloudroot asset set) | Braille Institute of America | SIL Open Font License 1.1 — `licenses/AtkinsonHyperlegible-OFL.txt` | Renamed file only |

## Code libraries (bundled)

| Library | Licence |
| --- | --- |
| PixiJS 8 (`pixi.js`) | MIT |
| Capacitor 7 (`@capacitor/core`, `@capacitor/android`, Android wrapper template) | MIT |

Build/test tooling (Vite, TypeScript, Vitest, Playwright, ESLint) is not shipped.

## References (not included)

The owner's approved Cloudroot art direction (teal sky, cream clouds, warm
accents, 2:1 pixel isometry) was studied as a quality reference. No artwork
from it, from ISO-CORE, or from any other game is included.
