# Fieldnotes — Mini City

A browser city-building sandbox built with Three.js, TypeScript, Vite, Tailwind and simplex noise. Saves stay in your browser's IndexedDB.

## Run

Requires Node 22.12+ (tested on Node 24).

```sh
npm ci
npm run dev
```

If the machine's default npm cache is not writable, use `npm_config_cache=/tmp/mini-city-npm npm ci`.

```sh
npm run build
npm test
```

## Browser testing

```sh
npm run test:e2e:smoke     # Chromium workflow, no model credentials needed
npm run test:e2e:ai        # Natural-language workflow; requires model credentials
```

See [Browser end-to-end tests](docs/e2e-testing.md) for runtime requirements,
model setup, coverage, reports and the current AI validation limitation.

## Play

Create a seeded world, choose one of four landscapes and set water coverage. Select a tool and click land to construct. Drag the road tool to draw continuous roads. Green/red tile previews indicate whether land can be built on. Transparent models preview structures. Construction clears natural objects at that tile.

- WASD / arrow keys: move
- Drag with Select, or right-drag with any tool: pan
- Wheel: zoom
- Q / E: orbit
- R: rotate the selected building
- Escape: select tool
- Ctrl/Cmd + S: save
- Gear: render quality and controls

Use Save city before leaving; Main menu → Continue your city reloads the latest save. Saves include seed, terrain settings, buildings, roads, cleared natural objects and camera state. One save slot is supported. Bulldozing refunds the construction budget; population is capacity rather than a citizen simulation.

## Implementation

- `world.ts`: deterministic world sampling, floor-based signed chunk coordinates, terrain/vegetation instancing, bounded 3×3 chunk streaming, construction rules and models.
- `roads.ts`: connected integer road strokes across chunk boundaries.
- `preview.ts`: reusable translucent construction preview.
- `storage.ts`: transactional IndexedDB persistence.
- `main.ts`: game lifecycle, camera, input and interface.

Only player changes are saved; natural terrain regenerates from the seed. Unloaded chunk GPU resources are disposed. Buildings are recreated when their chunk returns.

## Current scope and limits

This is a playable construction sandbox. Water, rivers and lakes are elevation/noise based rather than a water-flow simulation. All structures occupy one tile. There is no traffic, utilities, jobs, tax income, zoning or citizen simulation. Roads use simple tile markings and no bridge/tunnel system. The camera moves continuously but does not yet have inertial smoothing. The toolbar groups all six construction types together. There is no autosave or multi-world save browser. Fonts optionally load from Google Fonts with system fallbacks.

## Verification

Five focused tests cover deterministic sampling, negative chunk coordinates, water/overlap validation, chunk unloading/resource cleanup and continuous roads across chunk edges. Production build passes. A headless Chromium smoke check exercised world creation, construction, saving/reopening, settings, keyboard movement and road dragging with no page errors; saved population restored unchanged. Long-duration GPU memory stability and mobile gameplay have not been verified.
