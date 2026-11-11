import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { World, chunkCoordinate } from "../src/world";
const make = () =>
  new World(new THREE.Scene(), {
    seed: "test",
    preset: "Mixed Terrain",
    water: 0.42,
  });
describe("world", () => {
  it("uses floor coordinates on negative chunk edges", () => {
    expect([-33, -32, -1, 0, 31, 32].map(chunkCoordinate)).toEqual([
      -2, -1, -1, 0, 0, 1,
    ]);
  });
  it("regenerates identical terrain independently of sample order", () => {
    const a = make(),
      b = make();
    const points = [
      [31, 0],
      [32, 0],
      [-1, -32],
      [910, -310],
    ];
    const values = points.map(([x, z]) => a.elevation(x, z));
    points
      .slice()
      .reverse()
      .forEach(([x, z]) => b.elevation(x, z));
    expect(points.map(([x, z]) => b.elevation(x, z))).toEqual(values);
  });
  it("rejects water and occupied tiles", () => {
    const w = make();
    let land: number[] | undefined;
    for (let x = -60; x < 60; x++)
      for (let z = -60; z < 60; z++) {
        if (w.elevation(x, z) * 5 < w.sea) expect(w.valid(x, z)).toBe(false);
        if (w.valid(x, z)) land = [x, z];
      }
    expect(land).toBeDefined();
    const [x, z] = land!;
    w.placed.set(w.key(x, z), { type: "house", rotation: 0 });
    expect(w.valid(x, z)).toBe(false);
  });
  it("loads a bounded set and unloads distant chunks", () => {
    const w = make();
    w.sync(0, 0);
    expect(w.chunks.size).toBe(9);
    w.sync(-5, 5);
    expect(w.chunks.size).toBe(9);
    expect(w.chunks.has("0,0")).toBe(false);
    w.dispose();
    expect(w.scene.children.length).toBe(0);
  });
});

it('restores buildings after eviction with configurable chunk sizes', () => {
 const scene = new THREE.Scene();
 const world = new World(scene,{seed:'restore',preset:'Flat Plains',water:0.2,generatorVersion:2,chunkSize:16});
 world.placed.set('-1,0',{type:'house',rotation:1});
 world.deleted.add('-1,0');
 world.sync(-1,0);
 expect(world.chunks.get('-1,0')?.children.some(o => o.userData.building && o.userData.x === -1)).toBe(true);
 world.sync(4,4);
 expect(world.chunks.size).toBe(9);
 world.sync(-1,0);
 expect(world.chunks.get('-1,0')?.children.some(o => o.userData.building && o.userData.x === -1)).toBe(true);
 world.dispose(); expect(scene.children).toHaveLength(0);
});
