# Claude-AETHERFORGE

This repository hosts **ClaudeMobile/** — an independent Claude one-shot
implementation of the Aetherforge floating-world builder as a mobile-first
web game (installable PWA) with an Android (Capacitor) wrapper.

It is deliberately separate from the Unity/Unreal work in other repositories so
the two development approaches can be compared.

- Play / develop: see [`ClaudeMobile/README.md`](ClaudeMobile/README.md)
- CI/CD: [`.github/workflows/claude-mobile.yml`](.github/workflows/claude-mobile.yml)
  (lint → typecheck → unit tests incl. full-game bot → build → e2e → GitHub Pages + debug APK)
