import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MAX_LAKE_TILES, WorldGenerator, hash } from '../src/generators/WorldGenerator';

const presets = ['Mixed Terrain', 'Flat Plains', 'Islands & Coastlines', 'Mountains & Valleys'];

describe('captured terrain compatibility', () => {
 it('preserves baseline elevations across seeds, versions, water levels and presets', () => {
  const fixtures: Record<string, string> = {};
  for (const generatorVersion of [1, 2] as const) {
   for (const seed of ['new-world', 'river']) for (const preset of presets) for (const water of [0.2, 0.42, 0.7]) {
    const generator = new WorldGenerator({ seed, preset, water, generatorVersion });
    const values: number[] = [];
    for (let x = -128; x <= 128; x += 8) for (let z = -128; z <= 128; z += 8) values.push(generator.elevation(x, z));
    fixtures[`${generatorVersion}/${seed}/${preset}/${water}`] = createHash('sha256').update(JSON.stringify(values)).digest('hex');
   }
  }
  expect(fixtures).toMatchSnapshot();
 });
});

const settings = { seed: 'new-world', preset: 'Mixed Terrain', water: 0.42, generatorVersion: 2 as const, chunkSize: 16 };
const points = [[-33, -32], [-32, -1], [-1, 0], [0, 0], [31, 32], [123, 456]];

describe('version 2 generated metadata', () => {
 it('captures representative seeds and all terrain presets', () => {
  const fixtures: Record<string, unknown> = {};
  for (const seed of ['new-world', 'river']) for (const preset of presets) {
   const generator = new WorldGenerator({ ...settings, seed, preset });
   fixtures[`${seed}/${preset}`] = points.map(([x, z]) => ({ x, z, ...generator.sample(x, z) }));
  }
  expect(fixtures).toMatchSnapshot();
 });

 it('captures actual enclosed lakes for every preset without altering elevation', () => {
  const lakes = [
   { preset: 'Mixed Terrain', water: 0.42, x: -254, z: -3 },
   { preset: 'Flat Plains', water: 0.6, x: -256, z: -126 },
   { preset: 'Islands & Coastlines', water: 0.42, x: -75, z: -15 },
   { preset: 'Mountains & Valleys', water: 0.42, x: -240, z: -79 },
  ].map(({ preset, water, x, z }) => {
   const generator = new WorldGenerator({ ...settings, preset, water });
   const sample = generator.sample(x, z);
   expect(sample.waterType).toBe('lake');
   expect(sample.elevation).toBe(generator.elevation(x, z));
   return { preset, waterLevel: water, x, z, ...sample };
  });
  expect(lakes).toMatchSnapshot();
 });

 it('is independent of sampling order, generator instance and chunk size', () => {
  for (const seed of ['', 'new-world', 'river']) for (const preset of presets) for (const water of [0, 0.42, 1]) {
   const a = new WorldGenerator({ ...settings, seed, preset, water });
   const b = new WorldGenerator({ ...settings, seed, preset, water, chunkSize: 128 });
   const samples = points.map(([x, z]) => a.sample(x, z));
   for (const [x, z] of [...points].reverse()) b.sample(x, z);
   expect(points.map(([x, z]) => b.sample(x, z))).toEqual(samples);
   samples.forEach((sample, i) => {
    expect(sample.elevation).toBe(a.elevation(...points[i] as [number, number]));
    expect(sample.water).toBe(sample.elevation * 5 < a.sea);
    expect(sample.waterType === null).toBe(!sample.water);
    expect(sample.moisture).toBeGreaterThanOrEqual(0);
    expect(sample.moisture).toBeLessThanOrEqual(1);
    if (sample.water) expect(sample.moisture).toBe(1);
   });
  }
 });

 it('uses seed-dependent, smoothly varying broad and detail moisture layers on land', () => {
  const a = new WorldGenerator({ ...settings, preset: 'Flat Plains', water: 0 });
  const b = new WorldGenerator({ ...settings, preset: 'Flat Plains', water: 0, seed: 'another seed' });
  const samples = Array.from({ length: 32 }, (_, i) => a.sample(1000 + i, -32));
  expect(samples.every(sample => !sample.water)).toBe(true);
  expect(new Set(samples.map(sample => sample.moisture)).size).toBe(32);
  samples.slice(1).forEach((sample, i) => expect(Math.abs(sample.moisture! - samples[i].moisture!)).toBeLessThan(0.1));
  expect(samples.map(sample => sample.moisture)).not.toEqual(Array.from({ length: 32 }, (_, i) => b.sample(1000 + i, -32).moisture));
 });

 it('retains the unbroken river classification across signed chunk boundaries', () => {
  const generator = new WorldGenerator({ ...settings, seed: 'river', preset: 'Flat Plains', water: 0.2 });
  const offset = (hash('river:river') % 10000) / 100;
  for (let z = -80; z <= 80; z++) {
   const x = Math.round(Math.sin(z * 0.008 + offset) * 20 + Math.sin(z * 0.021 + offset) * 7);
   expect(generator.sample(x, z).waterType).toBe('river');
  }
 });

 it('does not add metadata or change the elevation stream for legacy settings', () => {
  for (const generatorVersion of [undefined, 1] as const) {
   const generator = new WorldGenerator({ ...settings, generatorVersion });
   for (const [x, z] of points) {
    const elevation = generator.elevation(x, z);
    expect(generator.sample(x, z)).toEqual({ elevation, water: elevation * 5 < generator.sea });
    expect(generator.elevation(x, z)).toBe(elevation);
   }
  }
 });

 it('rejects fractional, nonfinite and unsafe coordinates for the tile sampling API', () => {
  const generator = new WorldGenerator(settings);
  for (const value of [0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
   expect(() => generator.sample(value, 0)).toThrow(RangeError);
   expect(() => generator.sample(0, value)).toThrow(RangeError);
  }
 });
});

describe('water component classification', () => {
 // Synthetic elevations isolate connectivity and size rules from the noise fixtures.
 function terrain(wet: (x: number, z: number) => boolean) {
  const generator = new WorldGenerator(settings);
  vi.spyOn(generator, 'elevation').mockImplementation((x, z) => wet(x, z) ? -1 : 1);
  return generator;
 }

 it('classifies enclosed water across negative chunk edges, including exactly 1024 tiles', () => {
  expect(MAX_LAKE_TILES).toBe(1024);
  const generator = terrain((x, z) => x >= -1056 && x < -1024 && z >= -32 && z < 0);
  for (const [x, z] of [[-1056, -32], [-1055, -31], [-1033, -16], [-1025, -1]]) expect(generator.sample(x, z).waterType).toBe('lake');
  expect(generator.sample(-1024, -1).waterType).toBeNull();
 });

 it('classifies a 1025-tile component and unbounded water as sea with bounded work', () => {
  const generator = terrain((x, z) => x >= 1000 && x < 2025 && z === -1);
  expect(generator.sample(1000, -1).waterType).toBe('sea');
  expect(generator.sample(2024, -1).waterType).toBe('sea');
  const ocean = terrain(() => true);
  expect(ocean.sample(10000, -10000).waterType).toBe('sea');
  expect(vi.mocked(ocean.elevation).mock.calls.length).toBeLessThanOrEqual(1 + MAX_LAKE_TILES * 4);
 });

 it('uses cardinal rather than diagonal connectivity and strict sea-level comparison', () => {
  const generator = terrain((x, z) => (x === -1000 && z === -1) || (x >= -999 && z >= 0));
  expect(generator.sample(-1000, -1).waterType).toBe('lake');
  expect(generator.sample(-999, 0).waterType).toBe('sea');
  vi.mocked(generator.elevation).mockReturnValue(generator.sea / 5);
  expect(generator.sample(-1000, 0)).toMatchObject({ water: false, waterType: null });
 });

 it('conservatively classifies unrepresentable neighbors as sea', () => {
  const generator = terrain((x, z) => x === Number.MAX_SAFE_INTEGER && z === 0);
  expect(generator.sample(Number.MAX_SAFE_INTEGER, 0).waterType).toBe('sea');
 });

 it('does not call river-connected off-channel water a lake', () => {
  const generator = terrain((x, z) => x >= -100 && x <= 100 && z === 0);
  expect(generator.sample(50, 0).waterType).toBe('sea');
 });
});
