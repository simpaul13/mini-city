import * as THREE from "three";
import { WorldGenerator, hash } from "./generators/WorldGenerator";
import { chunkCoordinate as gridChunkCoordinate } from "./world/Grid";
import { definitions } from "./systems/BuildingCatalog";
import { roadConnections } from "./systems/RoadSystem";
import { ChunkManager } from "./world/ChunkManager";
import { WorldState } from "./world/WorldState";
import { validatePlacement } from "./systems/PlacementValidator";
import type { WorldSettings, Building } from "./shared/types";
export { definitions };
export const chunkCoordinate = (value: number) => gridChunkCoordinate(value);
export type Settings = WorldSettings;
export type { Building };
export class World {
  chunks = new Map<string, THREE.Group>();
  chunkManager = new ChunkManager(this.chunks, (x, z, key) => this.make(x, z, key), group => this.disposeGroup(group));
  state = new WorldState();
  get placed() { return this.state.placed; }
  set placed(value: Map<string, Building>) { this.state.placed = value; }
  get deleted() { return this.state.deleted; }
  set deleted(value: Set<string>) { this.state.deleted = value; }
  generator: WorldGenerator;
  chunkSize: number;
  radius = 1;
  tile = 2;
  constructor(public scene: THREE.Scene, public settings: Settings) {
    this.generator = new WorldGenerator(settings);
    this.chunkSize = settings.generatorVersion === 2 ? settings.chunkSize ?? 32 : 32;
  }
  get sea() { return this.generator.sea; }
  elevation(x: number, z: number) { return this.generator.elevation(x, z); }
  key(x: number, z: number) {
    return `${x},${z}`;
  }
  validate(tool: string, x: number, z: number) { return validatePlacement(this.state, tool, x, z, (a,b) => this.elevation(a,b), this.sea); }
  valid(x: number, z: number) { return this.validate("house", x, z).ok; }
  sync(cx: number, cz: number) { this.chunkManager.sync(cx, cz, this.radius); }
  disposeGroup(g: THREE.Group) {
    this.scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
        if (o instanceof THREE.InstancedMesh) o.dispose();
      }
    });
  }
  dispose() {
    this.chunkManager.dispose();
  }
  make(cx: number, cz: number, k: string) {
    const g = new THREE.Group(),
      geo = new THREE.BoxGeometry(2, 0.65, 2),
      mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const terrain = new THREE.InstancedMesh(geo, mat, this.chunkSize * this.chunkSize),
      treePositions: number[][] = [], rockPositions: number[][] = [];
    terrain.userData.terrain = true;
    terrain.userData.cx = cx;
    terrain.userData.cz = cz;
    const dummy = new THREE.Object3D();
    for (let x = 0; x < this.chunkSize; x++)
      for (let z = 0; z < this.chunkSize; z++) {
        const wx = cx * this.chunkSize + x,
          wz = cz * this.chunkSize + z,
          h = this.elevation(wx, wz) * 5,
          wet = h < this.sea;
        dummy.position.set(wx * 2, (wet ? this.sea : h) - 0.325, wz * 2);
        dummy.updateMatrix();
        const i = x * this.chunkSize + z;
        terrain.setMatrixAt(i, dummy.matrix);
        terrain.setColorAt(
          i,
          new THREE.Color(
            wet
              ? 0x75b3b2
              : h < this.sea + 0.3
                ? 0xd9c98f
                : h > 3
                  ? 0x969d91
                  : h > 1.4
                    ? 0x82966c
                    : 0x9cb879,
          ),
        );
        if (
          !wet &&
          h > this.sea + 0.5 &&
          hash(`${this.settings.seed},${wx},${wz}`) % 17 === 0 &&
          !this.deleted.has(this.key(wx, wz)) &&
          !this.placed.has(this.key(wx, wz))
        )
          treePositions.push([wx * 2, h, wz * 2]);
        if (this.settings.generatorVersion === 2 && !wet && h > this.sea + 0.5 && hash(`${this.settings.seed},rock,${wx},${wz}`) % 68 === 0 && !this.deleted.has(this.key(wx, wz)) && !this.placed.has(this.key(wx, wz))) rockPositions.push([wx * 2, h, wz * 2]);
      }
    g.add(terrain);
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.6, 1.8, 5),
      new THREE.MeshStandardMaterial({ color: 0x456e4c, flatShading: true }),
      treePositions.length,
    );
    treePositions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y + 0.9, z);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    });
    trees.userData.positions = treePositions;
    g.add(trees);
    const rockCandidates = this.settings.generatorVersion === 2 ? rockPositions : treePositions.slice(0, Math.floor(treePositions.length / 4));
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x929989, flatShading: true }),
      rockCandidates.length,
    );
    rockCandidates.forEach(([x, y, z], i) => {
        dummy.position.set(x + 0.6, y + 0.2, z + 0.6);
        dummy.scale.set(1, 0.65, 1);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
    rocks.userData.positions = rockCandidates;
    g.add(rocks);

    this.scene.add(g);
    this.chunks.set(k, g);
    for (const [key, b] of this.placed) {
      const [x, z] = key.split(",").map(Number);
      if (gridChunkCoordinate(x, this.chunkSize) === cx && gridChunkCoordinate(z, this.chunkSize) === cz)
        this.renderBuilding(x, z, b, g);
    }
  }
  renderBuilding(x: number, z: number, b: Building, g: THREE.Group) {
    const d = definitions[b.type];
    if (!d) return;
    const group = new THREE.Group();
    group.userData = { building: true, x, z };
    group.position.set(x * 2, this.elevation(x, z) * 5, z * 2);
    group.rotation.y = b.type === "road" ? 0 : (b.rotation * Math.PI) / 2;
    const add = (
      geo: THREE.BufferGeometry,
      color: number,
      px: number,
      py: number,
      pz: number,
    ) => {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color, flatShading: true }),
      );
      m.position.set(px, py, pz);
      group.add(m);
    };
    add(new THREE.BoxGeometry(1.8, d.height, 1.8), d.color, 0, d.height / 2, 0);
    if (b.type === "house") {
      add(new THREE.ConeGeometry(1.32, 0.8, 4), 0xaa715c, 0, d.height + 0.4, 0);
      group.children[1].rotation.y = Math.PI / 4;
    }
    if (b.type === "park")
      add(new THREE.ConeGeometry(0.7, 1.8, 5), 0x456e4c, 0, 1, 0);
    if (b.type === "road") {
      const links = roadConnections(this.placed, x, z);
      for (const [connected, px, pz, horizontal] of [[links.north, 0, -0.5, false], [links.south, 0, 0.5, false], [links.east, 0.5, 0, true], [links.west, -0.5, 0, true]] as const) {
        if (connected) add(new THREE.BoxGeometry(horizontal ? 0.35 : 0.08, 0.02, horizontal ? 0.08 : 0.35), 0xf4e9c9, px, 0.09, pz);
      }
    } else if (b.type !== "park") {
      for (let y = 0.5; y < d.height; y += 0.7)
        for (const px of [-0.45, 0.45])
          add(new THREE.BoxGeometry(0.28, 0.32, 0.04), 0x54777b, px, y, 0.91);
    }
    g.add(group);
  }
  refresh(x: number, z: number) {
    const cx = gridChunkCoordinate(x, this.chunkSize), cz = gridChunkCoordinate(z, this.chunkSize);
    const k = `${cx},${cz}`, g = this.chunks.get(k);
    if (!g) return;
    // Legacy rock selection depends on the remaining tree list and must be regenerated.
    if ((this.settings.generatorVersion ?? 1) === 1) {
      this.disposeGroup(g); this.chunks.delete(k); this.make(cx, cz, k); return;
    }
    for (const child of [...g.children]) {
      if (child.userData.building && child.userData.x === x && child.userData.z === z) {
        g.remove(child);
        child.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } });
      }
    }
    for (const mesh of [g.children[1], g.children[2]]) {
      if (!(mesh instanceof THREE.InstancedMesh)) continue;
      const positions = mesh.userData.positions as number[][];
      const index = positions.findIndex(([px,,pz]) => px === x * 2 && pz === z * 2);
      if (index >= 0 && (this.deleted.has(this.key(x,z)) || this.placed.has(this.key(x,z)))) {
        const matrix = new THREE.Matrix4().makeScale(0,0,0); mesh.setMatrixAt(index, matrix); mesh.instanceMatrix.needsUpdate = true;
      }
    }
    const building = this.placed.get(this.key(x,z));
    if (building) this.renderBuilding(x,z,building,g);
  }
}
