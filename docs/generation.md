# Generation

## Versions and compatibility

Unversioned saves use generator 1 and fixed 32-tile chunks. Its simplex elevation, river test, and tree-dependent rock selection are retained. New sessions use generator 2 and persist their chunk size (default 32). Both versions use global coordinates and the four existing elevation presets. The water slider expresses relative coverage; increasing it raises sea level.

The v2 moisture and lake layers are **additive metadata**, not new terrain carving. Existing v1 **and v2** elevation values, wet tiles, trees, rocks, placement rules and rendering remain unchanged. Saved buildings therefore keep their original terrain. Settings and player overrides remain the source of truth: generated terrain, moisture and classifications are never serialized, and the save schema and one-slot IndexedDB storage are unchanged.

## Version 2 rules

- Elevation combines the existing three simplex scales and preset adjustment. The seed initializes the original elevation RNG; new layers never consume that stream.
- The river follows the existing continuous global sinusoidal centerline, seeded with `seed + ':river'`, with noise-varying width. It is carved below the selected sea level. Rock candidates remain independently hashed.
- `WorldGenerator.sample(x, z)` accepts safe integer **global tile coordinates**, not chunk-local coordinates or world-space distances. It returns the existing elevation (before the renderer's `* 5`) and `water` flag (`elevation * 5 < sea`), plus v2 `moisture` and `waterType`. Land has `waterType: null`; water is `river`, `lake` or `sea`. Legacy/unversioned generators return only elevation and water, without new metadata.
- Moisture uses an independent simplex permutation initialized by the same LCG algorithm with `hash(seed + ':moisture')`. Its broad layer samples `(x * 0.006 + 100, z * 0.006 + 100)` with weight `0.75`; its detail layer samples `(x * 0.035 + 200, z * 0.035 + 200)` with weight `0.25`. The weighted sum is mapped from `[-1, 1]` to `[0, 1]` and clamped. Water is saturated (`1`). Land moisture does not depend on preset or chunk size, and it does not yet change vegetation or colors.
- Explicit river-band tiles take precedence and are classified as `river`, including the band in flooded areas. Other wet tiles are classified by their **cardinally connected wet component**, including river water: an enclosed component of at most **1024 tiles** is a `lake`; a larger component is a `sea`. Diagonal contact does not connect components. Water connected to the unbounded river is not enclosed and is classified as `sea` off the river band. The lake size cap is a generation rule (large enclosed basins are also seas), not a claim to solve unrestricted hydrology on an infinite world.
- Water classification explores global neighbors, not a chunk or render window. It stops on discovering a river tile or a 1025th wet tile. At the safe-integer boundary, unrepresentable neighbors conservatively prevent a lake classification. There is no sampling-order-dependent state or cache; changing chunk size, sampling order or streaming radius cannot move a lake boundary.

Sampling metadata is opt-in. The renderer still uses the unchanged elevation path and existing colors, so no new visual treatment is introduced. Classifying one wet tile can explore up to 1024 tiles and their neighbors; callers should not repeatedly sample an entire rendered world per frame. A separate immutable generated-chunk cache remains future work. Streaming currently renders a square radius of 1–3 chunks and disposes unloaded groups.

## Verification

`tests/generation.test.ts` and its checked-in snapshots cover baseline elevation digests captured from revision `89b5c782bdf23a65656bc32603808b23a17695cb`: both generator versions, two seeds, all four presets, three water levels and a signed 33-by-33 coordinate grid per configuration. Metadata fixtures cover two seeds and every preset, including real enclosed lakes for all four presets. Tests additionally cover sampling order and chunk-size independence, empty seeds, moisture range and continuity, river continuity, strict sea-level comparison, negative-coordinate lakes, cardinal versus diagonal connectivity, exact 1024/1025-tile boundaries, bounded ocean traversal, and v1's unchanged sample shape. Existing recovery tests retain the legacy save and exact terrain fixtures and exercise IndexedDB round trips.

Run `npm test` and `npm run build`. Do not update the baseline elevation snapshots to accommodate a terrain change; an intentional change needs a new generator version and compatibility design.
