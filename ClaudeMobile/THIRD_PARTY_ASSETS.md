# Third-party assets

Everything visible or audible in Aetherforge that is not listed here is
**original work created for this project**:

- All pixel art (terrain, undersides, buildings, trees, items, icons, sky,
  clouds, effects, UI glyphs, app icons, Android launcher/splash) is generated
  procedurally at runtime or build time by code in `src/render/art/` and
  `src/ui/glyphs.ts` / `src/dev/icon.ts`.
- All sound and music is synthesized at runtime with the Web Audio API
  (`src/platform/audio.ts`). No samples are used.

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
