import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { WorldGenerator } from '../src/generators/WorldGenerator';
import { validateSnapshot } from '../src/storage/SaveTypes';
import { loadSnapshot, saveSnapshot } from '../src/storage';
import { WorldState } from '../src/world/WorldState';
import { validatePlacement } from '../src/systems/PlacementValidator';
import { roadConnections } from '../src/systems/RoadSystem';
import legacy from './fixtures/legacy-save.json';
import terrain from './fixtures/legacy-terrain.json';

describe('compatibility and gameplay', () => {
 it('preserves captured legacy terrain', () => {
  const g = new WorldGenerator(legacy.settings);
  for (const sample of terrain) expect(g.elevation(sample.x, sample.z)).toBe(sample.elevation);
 });
 it('migrates legacy saves in memory and rejects unsupported data', () => {
  const result = validateSnapshot(legacy);
  expect(result.generatorVersion).toBe(1); expect(result.settings.chunkSize).toBe(32);
  expect(() => validateSnapshot({ ...legacy, schemaVersion: 99 })).toThrow();
 });
 it('validates terrain, occupancy and funds consistently', () => {
  const s = new WorldState(); const flat = () => 1;
  expect(validatePlacement(s,'house',0,0,flat,0)).toEqual({ok:true});
  expect(validatePlacement(s,'house',0,0,() => -1,0)).toEqual({ok:false,reason:'water'});
  s.placed.set('0,0',{type:'house',rotation:0});
  expect(validatePlacement(s,'house',0,0,flat,0)).toEqual({ok:false,reason:'occupied'});
  expect(s.budget).toBe(12300); expect(s.population).toBe(4);
  expect(validatePlacement(s,'bulldoze',0,0,() => -1,0)).toEqual({ok:true});
  for(let i=1;i<=31;i++) s.placed.set(`${i},0`,{type:'apartment',rotation:0});
  expect(validatePlacement(s,'house',100,0,flat,0)).toEqual({ok:false,reason:'insufficient funds'});
 });
 it('connects roads across signed chunk edges', () => {
  const s = new WorldState(); s.placed.set('-1,0',{type:'road',rotation:0}); s.placed.set('0,0',{type:'road',rotation:0});
  expect(roadConnections(s.placed,-1,0).east).toBe(true);
  expect(roadConnections(s.placed,0,0).west).toBe(true);
 });
});
describe('IndexedDB', () => {
 beforeEach(async () => { await new Promise<void>((resolve,reject) => { const r=indexedDB.deleteDatabase('fieldnotes'); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); }); });
 it('loads an actual unversioned record without rewriting it', async () => {
  await new Promise<void>((resolve,reject) => {
   const request = indexedDB.open('fieldnotes',1);
   request.onupgradeneeded = () => request.result.createObjectStore('worlds');
   request.onsuccess = () => { const db=request.result; const tx=db.transaction('worlds','readwrite'); tx.objectStore('worlds').put(legacy,'latest'); tx.oncomplete=()=>{db.close();resolve()}; tx.onerror=()=>reject(tx.error); };
   request.onerror=()=>reject(request.error);
  });
  expect((await loadSnapshot())?.generatorVersion).toBe(1);
  const stored = await new Promise<any>((resolve,reject) => { const request=indexedDB.open('fieldnotes',1); request.onsuccess=()=>{const db=request.result;const tx=db.transaction('worlds');const get=tx.objectStore('worlds').get('latest');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error); });
  expect(stored).toEqual(legacy);
 });
 it('round trips an existing v2 save without serializing new generated metadata', async () => {
  const snapshot = validateSnapshot({ ...legacy, schemaVersion: 2, generatorVersion: 2, settings: { ...legacy.settings, generatorVersion: 2, chunkSize: 16 } });
  const before = new WorldGenerator(snapshot.settings);
  const samples = terrain.map(({ x, z }) => before.sample(x, z));
  await saveSnapshot(snapshot);
  const loaded = await loadSnapshot();
  expect(loaded).toEqual(snapshot);
  expect(loaded).not.toHaveProperty('moisture');
  expect(loaded).not.toHaveProperty('waterType');
  const after = new WorldGenerator(loaded!.settings);
  expect(terrain.map(({ x, z }) => after.sample(x, z))).toEqual(samples);
 });
 it('round trips snapshots and does not overwrite on invalid input', async () => {
  const snapshot = validateSnapshot(legacy); await saveSnapshot(snapshot);
  expect((await loadSnapshot())?.placed).toEqual(legacy.placed);
  await expect(saveSnapshot({ ...snapshot, schemaVersion: 99 } as never)).rejects.toThrow();
  expect((await loadSnapshot())?.placed).toEqual(legacy.placed);
 });
});

describe('version 2 generation', () => {
 for (const preset of ['Mixed Terrain','Flat Plains','Islands & Coastlines','Mountains & Valleys']) {
  it(`is deterministic and water coverage is monotonic for ${preset}`, () => {
   const settings = {seed:'new-world',preset,water:0.2,generatorVersion:2 as const,chunkSize:16};
   const low = new WorldGenerator(settings), high = new WorldGenerator({...settings, water:0.7});
   const repeat = new WorldGenerator(settings);
   for (let x=-64;x<=64;x+=4) for(let z=-64;z<=64;z+=4) {
    expect(repeat.elevation(x,z)).toBe(low.elevation(x,z));
    if(low.elevation(x,z)*5 < low.sea) expect(high.elevation(x,z)*5).toBeLessThan(high.sea);
   }
  });
 }
 it('samples an unbroken river channel across chunk boundaries', () => {
  const g = new WorldGenerator({seed:'river',preset:'Flat Plains',water:0.2,generatorVersion:2,chunkSize:16});
  for(let z=-80;z<=80;z++) expect(Array.from({length:81},(_,i)=>i-40).some(x=>g.elevation(x,z)*5 < g.sea)).toBe(true);
 });
});
