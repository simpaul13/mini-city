import { createNoise2D } from 'simplex-noise';
import type { WorldSettings } from '../shared/types';
export const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export class WorldGenerator {
 noise: (x: number, z: number) => number;
 constructor(public settings: WorldSettings) {
  let n = hash(settings.seed);
  this.noise = createNoise2D(() => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; });
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
   const offset = (hash(this.settings.seed + ':river') % 10000) / 100;
   const center = Math.sin(z * 0.008 + offset) * 20 + Math.sin(z * 0.021 + offset) * 7;
   const width = 2.2 + (this.noise(z * 0.01 + 800, offset) + 1) * 1.2;
   if (Math.abs(x - center) < width) n = Math.min(n, (this.sea - 0.3) / 5);
  }
  return n;
 }
}
