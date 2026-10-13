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
    art/           pixel canvas toolkit, sprite registry, legacy flat art
    vox/           voxel art engine: 16-voxel blocks per tile, per-face light,
                   ambient occlusion, emissive materials; block terrain,
                   building/tree/item models with moving parts
    bake.ts        bakes every sprite/icon into packed sheets (runs in Node)
    artpack.ts     loads the pre-baked sheets at startup (production)
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

- All art is procedural voxel models (no external image assets). `npm run art`
  (part of `npm run build`) bakes every sprite, belt frame and icon into PNG
  sheets in `public/art/` (~300 KB, generated, not committed); production
  loads those instead of generating art on the device. Dev (`npm run dev`)
  and `?liveart` generate art live.
- The world is drawn crisp at a whole number of device pixels per art pixel
  into an offscreen texture, then scaled smoothly to the exact zoom, so pixels
  stay even-sized and pans/zooms glide sub-pixel without shimmer. The sky is
  drawn with smooth filtering on its own.
- Terrain is voxel-rasterised on the CPU per 8×8-tile chunk into one texture
  each and only re-rendered when ground changes (`tileRev`); after the first
  build, changed chunks re-render one per frame, nearest the camera first.
- Buildings, items and effects come from one atlas page → heavily batched.
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
