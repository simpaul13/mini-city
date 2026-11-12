import { createNoise2D } from 'simplex-noise';
import type { TerrainSample, WaterType, WorldSettings } from '../shared/types';

// A generation rule, not a chunk/render radius: larger water bodies are seas.
export const MAX_LAKE_TILES = 1024;
export const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export class WorldGenerator {
 noise: (x: number, z: number) => number;
 private moistureNoise: (x: number, z: number) => number;
 constructor(public settings: WorldSettings) {
  let n = hash(settings.seed);
  this.noise = createNoise2D(() => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; });
  // Never consume the elevation RNG when adding a generation layer.
  let m = hash(settings.seed + ':moisture');
  this.moistureNoise = createNoise2D(() => { m = (Math.imul(m, 1664525) + 1013904223) >>> 0; return m / 4294967296; });
 }
 get sea() { return (this.settings.water - 0.42) * 5 - 0.15; }
 elevation(x: number, z: number) {
  const p = this.settings.preset;
  let n = this.noise(x * 0.015, z * 0.015) * 0.55 + this.noise(x * 0.05, z * 0.05) * 0.24 + this.noise(x * 0.13, z * 0.13) * 0.07;
  if (p === 'Flat Plains') n = n * 0.25 + 0.2;
  if (p === 'Islands & Coastlines') n += Math.sin(x * 0.006) * Math.cos(z * 0.007) * 0.3 - 0.18;
  if (p === 'Mountains & Valleys') n *= 2;
  if ((this.settings.generatorVersion ?? 1) === 1) {
   const river = Math.abs(this.noise(x * 0.008 + 300, z * 0.008 + 300));
   if (river < 0.025) n = Math.min(n, (this.sea - 0.3) / 5);
  } else {
   if (this.isRiver(x, z)) n = Math.min(n, (this.sea - 0.3) / 5);
  }
  return n;
 }
 private isRiver(x: number, z: number) {
  const offset = (hash(this.settings.seed + ':river') % 10000) / 100;
  const center = Math.sin(z * 0.008 + offset) * 20 + Math.sin(z * 0.021 + offset) * 7;
  const width = 2.2 + (this.noise(z * 0.01 + 800, offset) + 1) * 1.2;
  return Math.abs(x - center) < width;
 }
 /** Opt-in generated metadata for integer global tiles; never changes terrain. */
 sample(x: number, z: number): TerrainSample {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) throw new RangeError('Terrain samples require safe integer tile coordinates.');
  const elevation = this.elevation(x, z);
  const water = elevation * 5 < this.sea;
  if ((this.settings.generatorVersion ?? 1) === 1) return { elevation, water };
  const broad = this.moistureNoise(x * 0.006 + 100, z * 0.006 + 100);
  const detail = this.moistureNoise(x * 0.035 + 200, z * 0.035 + 200);
  const moisture = water ? 1 : Math.max(0, Math.min(1, (broad * 0.75 + detail * 0.25 + 1) / 2));
  return { elevation, water, moisture, waterType: water ? this.classifyWater(x, z) : null };
 }
 private classifyWater(x: number, z: number): WaterType {
  if (this.isRiver(x, z)) return 'river';
  const queue: [number, number][] = [[x, z]];
  const visited = new Set([`${x},${z}`]);
  for (let i = 0; i < queue.length; i++) {
   const [tx, tz] = queue[i];
   for (const [nx, nz] of [[tx - 1, tz], [tx + 1, tz], [tx, tz - 1], [tx, tz + 1]]) {
    // Beyond representable tile coordinates we cannot prove enclosure.
    if (!Number.isSafeInteger(nx) || !Number.isSafeInteger(nz)) return 'sea';
    const key = `${nx},${nz}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (this.elevation(nx, nz) * 5 >= this.sea) continue;
    // The v2 river is unbounded; connected off-channel water is not a lake.
    if (this.isRiver(nx, nz)) return 'sea';
    queue.push([nx, nz]);
    if (queue.length > MAX_LAKE_TILES) return 'sea';
   }
  }
  return 'lake';
 }
}
