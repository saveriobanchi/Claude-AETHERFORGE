# Aetherforge — ClaudeMobile

An independent, mobile-first implementation of the floating-world builder,
produced as a Claude one-shot. It is a complete web game (installable PWA) with
an Android wrapper, and is fully separate from any Unity/Unreal work.

> You begin with a tree on a scrap of land in an enormous sky. Everything else
> you grow, gather, make, automate — and build — yourself.

## Play

- **Phone (recommended):** open the deployed URL in Safari or Chrome.
  - iPhone: *Share → Add to Home Screen* — it then launches full-screen like an app.
  - Android: *⋮ → Install app* (or *Add to Home screen*).
- Landscape is the primary orientation; portrait works too.
- Your world saves itself on the device (IndexedDB, with rotating backups).
  *Settings → Export / Import* moves a world between devices.

### Controls

| Touch | Desktop |
| --- | --- |
| Tap — gather, open a machine, place | Click |
| One-finger drag — look around | Drag |
| Pinch — zoom | Mouse wheel |
| In build mode, drag — lay conveyors / ground in a line | Drag |
| Long-press — inspect | Long-press |

Keyboard extras: `B` build, `R` rotate, `O` observe mode, `Esc` back.

The **eye** button enters *observe mode*: the interface disappears and the
camera drifts so you can simply watch the island live.

## What is in the box (spoiler-light)

- A long progression from a single tree to a sprawling, automated sky-industry,
  with several distinct eras that each change *how* you play rather than just
  the numbers. The opening teaches itself through gentle notes; after that the
  island is yours.
- Real, physical production: items ride conveyors you lay, machines visibly
  work, idle, starve or back up, and tell you why.
- The island itself is built tile by tile, and space matters.
- Day and night with daily weather you can plan around, ambient life,
  synthesized music and sound.
- Sky traders with contracts to fill, a market, machine upgrades, and a few
  gentler side industries — all earned in play (no shop, no timers to pay off).
- Long-term goals for the grind: item mastery stars, renown levels with a
  perk build to plan, lucky output and bountiful harvests, gathering combos,
  rare gems and a codex of collections.
- An endgame that keeps going.

The rest is meant to be discovered. (Developers: see `docs/dev/DESIGN.md`,
which contains spoilers.)

## Develop

```bash
cd ClaudeMobile
npm ci
npm run dev          # http://localhost:5173  (?dev enables developer tools, ?demo a showcase world)
npm run check        # lint + typecheck + unit tests (including a full-game bot playthrough)
npm run build        # production PWA in dist/
npm run e2e          # Playwright smoke tests against the production build
```

Developer tools: append `?dev` to the URL, or tap the version line in
*Settings* seven times. They grant resources, unlock everything, speed up time,
show FPS and machine states, and inspect automated throughput.

### Android

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug     # needs JDK 21 + Android SDK
```

CI builds a debug APK on every push (artifact `aetherforge-debug-apk`). Release
signing is intentionally left to the owner (no credentials in the repo).

### iOS

The iPhone target is the PWA. The project is Capacitor-ready: on a Mac with
Xcode, `npx cap add ios && npx cap open ios` produces a native wrapper of the
same build; signing requires the owner's Apple developer account.

## Documentation

- `docs/ARCHITECTURE.md` — code structure, simulation, rendering, performance
- `docs/TESTING.md` — what is tested and how
- `THIRD_PARTY_ASSETS.md` — every external asset and its licence
- `docs/dev/DESIGN.md` — **spoilers**: full progression and balance model
