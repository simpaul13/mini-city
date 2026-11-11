import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
export type Settings = { seed: string; preset: string; water: number };
export type Building = { type: string; rotation: number };
export const definitions: Record<
  string,
  { color: number; height: number; cost: number; pop: number }
> = {
  house: { color: 0xe4be91, height: 1.5, cost: 100, pop: 4 },
  apartment: { color: 0xc6d3cb, height: 3.2, cost: 400, pop: 16 },
  commercial: { color: 0xe3ba79, height: 1.7, cost: 200, pop: 0 },
  industrial: { color: 0xb19a89, height: 1.4, cost: 250, pop: 0 },
  road: { color: 0x626b66, height: 0.08, cost: 10, pop: 0 },
  park: { color: 0x76a866, height: 0.08, cost: 50, pop: 0 },
};
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
export const chunkCoordinate = (v: number) => Math.floor(v / 32);
export class World {
  chunks = new Map<string, THREE.Group>();
  placed = new Map<string, Building>();
  deleted = new Set<string>();
  noise: (x: number, y: number) => number;
  chunkSize = 32;
  tile = 2;
  constructor(
    public scene: THREE.Scene,
    public settings: Settings,
  ) {
    let n = hash(settings.seed);
    this.noise = createNoise2D(() => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    });
  }
  get sea() {
    return (this.settings.water - 0.42) * 5 - 0.15;
  }
  elevation(x: number, z: number) {
    const p = this.settings.preset;
    let n =
      this.noise(x * 0.015, z * 0.015) * 0.55 +
      this.noise(x * 0.05, z * 0.05) * 0.24 +
      this.noise(x * 0.13, z * 0.13) * 0.07;
    if (p === "Flat Plains") n = n * 0.25 + 0.2;
    if (p === "Islands & Coastlines")
      n += Math.sin(x * 0.006) * Math.cos(z * 0.007) * 0.3 - 0.18;
    if (p === "Mountains & Valleys") n *= 2;
    const river = Math.abs(this.noise(x * 0.008 + 300, z * 0.008 + 300));
    if (river < 0.025) n = Math.min(n, (this.sea - 0.3) / 5);
    return n;
  }
  key(x: number, z: number) {
    return `${x},${z}`;
  }
  valid(x: number, z: number) {
    const h = this.elevation(x, z) * 5;
    return (
      h > this.sea + 0.08 &&
      !this.placed.has(this.key(x, z)) &&
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].every(([a, b]) => Math.abs(this.elevation(x + a, z + b) * 5 - h) < 0.8)
    );
  }
  sync(cx: number, cz: number) {
    const needed = new Set<string>();
    for (let a = cx - 1; a <= cx + 1; a++)
      for (let b = cz - 1; b <= cz + 1; b++) {
        const k = `${a},${b}`;
        needed.add(k);
        if (!this.chunks.has(k)) this.make(a, b, k);
      }
    for (const [k, g] of this.chunks)
      if (!needed.has(k)) {
        this.disposeGroup(g);
        this.chunks.delete(k);
      }
  }
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
    this.chunks.forEach((g) => this.disposeGroup(g));
    this.chunks.clear();
  }
  make(cx: number, cz: number, k: string) {
    const g = new THREE.Group(),
      geo = new THREE.BoxGeometry(2, 0.65, 2),
      mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const terrain = new THREE.InstancedMesh(geo, mat, 1024),
      treePositions: number[][] = [];
    terrain.userData.terrain = true;
    terrain.userData.cx = cx;
    terrain.userData.cz = cz;
    const dummy = new THREE.Object3D();
    for (let x = 0; x < 32; x++)
      for (let z = 0; z < 32; z++) {
        const wx = cx * 32 + x,
          wz = cz * 32 + z,
          h = this.elevation(wx, wz) * 5,
          wet = h < this.sea;
        dummy.position.set(wx * 2, (wet ? this.sea : h) - 0.325, wz * 2);
        dummy.updateMatrix();
        const i = x * 32 + z;
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
    g.add(trees);
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x929989, flatShading: true }),
      Math.floor(treePositions.length / 4),
    );
    treePositions
      .slice(0, Math.floor(treePositions.length / 4))
      .forEach(([x, y, z], i) => {
        dummy.position.set(x + 0.6, y + 0.2, z + 0.6);
        dummy.scale.set(1, 0.65, 1);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
    g.add(rocks);

    this.scene.add(g);
    this.chunks.set(k, g);
    for (const [key, b] of this.placed) {
      const [x, z] = key.split(",").map(Number);
      if (chunkCoordinate(x) === cx && chunkCoordinate(z) === cz)
        this.renderBuilding(x, z, b, g);
    }
  }
  renderBuilding(x: number, z: number, b: Building, g: THREE.Group) {
    const d = definitions[b.type];
    if (!d) return;
    const group = new THREE.Group();
    group.userData = { building: true, x, z };
    group.position.set(x * 2, this.elevation(x, z) * 5, z * 2);
    group.rotation.y = (b.rotation * Math.PI) / 2;
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
      for (const p of [-0.5, 0.5])
        add(new THREE.BoxGeometry(0.08, 0.02, 0.35), 0xf4e9c9, 0, 0.09, p);
    } else if (b.type !== "park") {
      for (let y = 0.5; y < d.height; y += 0.7)
        for (const px of [-0.45, 0.45])
          add(new THREE.BoxGeometry(0.28, 0.32, 0.04), 0x54777b, px, y, 0.91);
    }
    g.add(group);
  }
  refresh(x: number, z: number) {
    const k = `${chunkCoordinate(x)},${chunkCoordinate(z)}`,
      g = this.chunks.get(k);
    if (g) {
      this.disposeGroup(g);
      this.chunks.delete(k);
      this.make(chunkCoordinate(x), chunkCoordinate(z), k);
    }
  }
}
