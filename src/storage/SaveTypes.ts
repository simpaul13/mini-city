import type { WorldSettings, Building } from '../shared/types';
export type Snapshot = { schemaVersion?: 2; generatorVersion?: 1 | 2; settings: WorldSettings; placed: [string, Building][]; deleted: string[]; camera: number[]; angle?: number; zoom?: number };
const presets = ['Mixed Terrain', 'Islands & Coastlines', 'Flat Plains', 'Mountains & Valleys'];
const types = ['house', 'apartment', 'commercial', 'industrial', 'road', 'park'];
const key = (v: unknown) => typeof v === 'string' && /^-?\d+,-?\d+$/.test(v) && v.split(',').every(n => Number.isSafeInteger(Number(n)));
export function validateSnapshot(value: unknown): Snapshot {
 const v = value as Snapshot;
 const fail = () => { throw new Error('This city save is invalid or uses an unsupported version.'); };
 if (!v || typeof v !== 'object' || (v.schemaVersion !== undefined && v.schemaVersion !== 2) || (v.generatorVersion !== undefined && v.generatorVersion !== 1 && v.generatorVersion !== 2)) return fail();
 const s = v.settings;
 if (!s || typeof s.seed !== 'string' || !presets.includes(s.preset) || !Number.isFinite(s.water) || s.water < 0 || s.water > 1) return fail();
 const version = v.schemaVersion === undefined ? 1 : v.generatorVersion;
 if (!version || (version === 2 && (!Number.isInteger(s.chunkSize) || s.chunkSize! < 8 || s.chunkSize! > 128))) return fail();
 if (!Array.isArray(v.placed) || !v.placed.every(e => Array.isArray(e) && e.length === 2 && key(e[0]) && e[1] && types.includes(e[1].type) && Number.isInteger(e[1].rotation))) return fail();
 if (new Set(v.placed.map(e => e[0])).size !== v.placed.length || !Array.isArray(v.deleted) || !v.deleted.every(key)) return fail();
 if (!Array.isArray(v.camera) || v.camera.length !== 3 || !v.camera.every(Number.isFinite) || (v.angle !== undefined && !Number.isFinite(v.angle)) || (v.zoom !== undefined && (!Number.isFinite(v.zoom) || v.zoom < 0.5 || v.zoom > 2.2))) return fail();
 return { ...v, generatorVersion: version, settings: { ...s, generatorVersion: version, chunkSize: version === 1 ? 32 : s.chunkSize } };
}
