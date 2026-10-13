# Architecture

```
src/
  core/            pure TypeScript simulation — no DOM, fully unit-tested
    content/       items, recipes, buildings, discoveries, land/islets/endgame data
    state.ts       world state, tile/building indices, seeded RNG, stash
    sim.ts         fixed 20 Hz tick: power, machines, logistics, wisps, nature, islets
    actions.ts     every player command (place, expand, harvest, craft, load, …)
    progression.ts discovery conditions and journal riddles
    offline.ts     time-away model
    save.ts        versioned JSON save, migrations, export/import
  render/
    hd/            offline art renderer (runs in Node at build time):
      sdf.ts       signed-distance model kit (boxes, cylinders, roofs, blobs…)
      render.ts    iso sphere tracer: soft shadows, AO, sky/sun/bounce light,
                   pixel-art palette snapping and selective outlines
      mats.ts      procedural materials (planks, masonry, foliage, metal…)
      models/      every building, tree, item icon, terrain piece and decor
      catalog.ts   what to bake: frames, variants, lights, smoke points
    artpack.ts     loads the baked sheets and hands out textures / UI URLs
    art/           small pixel-canvas helpers for effects and UI glyphs
    world.ts       Pixi scene: chunked terrain, depth-sorted buildings, belts,
                   items, lights, overlays, wisps
    sky.ts         golden-hour sky gradient, sun bloom, painterly clouds,
                   distant voxel islets with waterfalls, stars, cloud sea
    camera.ts      inertial pan, focal pinch-zoom, eased focus, soft bounds
    effects.ts     pooled particles
    atlas.ts       shelf-packed texture atlas (few draw calls)
  input/gestures.ts  touch-first gestures (mouse emulates a finger)
  ui/              DOM interface (HUD, build tray, panels, journal, settings)
  platform/        IndexedDB storage, Web Audio synth, haptics
  game.ts          loop, modes, input→actions with feedback, persistence
```

## Simulation

- Deterministic fixed-step tick (`TICK = 0.05 s`); the renderer interpolates
  conveyor items between ticks. All randomness uses a seeded RNG stored in the
  save, so identical inputs give identical worlds (tested).
- Topology caches (belt processing order, pylon fields, roost reach, island
  edge set, stash capacity) are rebuilt only when the world changes.
- Conveyors are processed downstream-first so lines compress without gaps;
  each belt holds items as `(item, position)` with minimum spacing.
- Power ("breeze") is a global pool: generation vs demand gives a ratio that
  scales powered machines.
- Depots never block (overflow spills and is counted) so automation cannot
  deadlock when the stash fills.

## Offline progression

Short absences (< 90 s) are simulated exactly. Longer ones use the measured
net automated flow into the stash over the last ~5 minutes of play, at reduced
efficiency and a capped duration; if a consumed input would run out, all
production is assumed to stop at that moment.

## Rendering & performance

- All game art is modelled in code (src/render/hd) and baked by
  `npm run art` (part of `npm run dev` and `npm run build`) into two PNG
  sheets plus a manifest in `public/art/` (~1 MB, generated, not committed).
  The bake renders each model with a sphere tracer in the game's exact
  isometric projection, then snaps colours to hue-shifted pixel-art bands and
  draws selective outlines, at 2 texels per world pixel. It runs on all CPU
  cores (~80 s) and is skipped when the art sources are unchanged.
- Terrain is one rock-column sprite plus one top sprite per tile (chosen by
  depth-from-edge and open-edge mask), drawn back to front; decor and
  waterfalls are scattered deterministically per tile.
- The world is drawn crisp at a whole number of device pixels per art pixel
  into an offscreen texture, then scaled smoothly to the exact zoom, so pixels
  stay even-sized and pans/zooms glide sub-pixel without shimmer. The sky is
  drawn with smooth filtering on its own.
- Buildings, terrain, items and decor come from two baked sheets → heavily batched.
- Off-screen buildings are culled; sprites, items and particles are pooled.
- Night lights are additive sprites, drawn only when it is dark.
- Adaptive quality: if a device cannot hold ~40 fps it switches once to 1×
  resolution, fewer clouds and particles (overridable in Settings).
- Measured: ~2 ms CPU per frame for a mid-size factory; ~0.03 ms per sim tick
  for ~30 machines (linear in machine count).

## Saves

`save` key in IndexedDB (localStorage fallback), autosave every ~20 s and on
hide/close, three rotating backups every 5 minutes, migrations by version,
corrupt-slot recovery, text export/import.
