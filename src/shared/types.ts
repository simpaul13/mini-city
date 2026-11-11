export type BuildingType = 'house' | 'apartment' | 'commercial' | 'industrial' | 'road' | 'park';
export type Tool = BuildingType | 'select' | 'bulldoze';
export type WorldSettings = { seed: string; preset: string; water: number; generatorVersion?: 1 | 2; chunkSize?: number };
export type Building = { type: string; rotation: number };
export type TileSample = { elevation: number; water: boolean };
export type ChunkData = { x: number; z: number; tiles: TileSample[] };
export type CameraState = { center: number[]; angle: number; zoom: number };
export type PlacementResult = { ok: true } | { ok: false; reason: 'water' | 'slope' | 'occupied' | 'insufficient funds' | 'empty' | 'unknown tool' };
