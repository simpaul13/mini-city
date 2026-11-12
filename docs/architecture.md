# Architecture and ownership

`src/main.ts` starts `Game`. `core/Game.ts` currently owns screen transitions, the session loop, controls, and UI event handlers. `world.ts` remains the compatibility facade and owns Three.js chunk rendering; `world/ChunkManager.ts` owns the active streaming window via load and unload callbacks. `world/WorldState.ts` holds player structures and clear overrides; `world/Grid.ts` handles signed grid coordinates. `generators/WorldGenerator.ts` produces deterministic elevation and opt-in v2 moisture/water classifications without Three.js or DOM. The building catalog and placement and road rules live in `systems/`. `storage.ts` owns IndexedDB transactions and `storage/SaveTypes.ts` validates the boundary. `preview.ts` owns preview meshes.

Flow: UI commands call the current session coordinator; placement is checked by the shared validator, changes player state, and refreshes affected render objects. Save snapshots contain settings, player changes and camera, not generated terrain. Loaded state is restored before streaming starts.

This is an incremental extraction, not the complete target architecture. World rendering and streaming are still coupled, UI/controllers are not separate modules, and state totals are recomputed rather than incrementally indexed. See verification.md for remaining work.
