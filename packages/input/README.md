# Nox shared input package

Shared canvas/photo capture, request identity/cancellation, speech, command and interpretation modules used by the root Nox app. The standalone UI is an earlier prototype retained with its tests; start Nox from the repository root for the current 3D product.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Run these commands in this directory. Shared expected-data fixtures live under `../../docs/product/examples`. They are controlled examples, not fresh model acceptance. See the [root README](../../README.md), [architecture](../../docs/ARCHITECTURE.md) and [runtime setup](../../docs/RUNTIME.md).
