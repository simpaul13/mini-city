import * as THREE from "three";
import { World, definitions } from "./world";
export class BuildingPreview {
  group = new THREE.Group();
  type = "";
  update(world: World, type: string, x: number, z: number, rotation: number) {
    if (this.type !== type) {
      this.dispose();
      this.type = type;
      if (definitions[type])
        world.renderBuilding(0, 0, { type, rotation: 0 }, this.group);
      this.group.children.forEach((o) => o.position.set(0, 0, 0));
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const material = o.material as THREE.MeshStandardMaterial;
          material.transparent = true;
          material.opacity = 0.5;
          material.depthWrite = false;
        }
      });
    }
    this.group.position.set(x * 2, world.elevation(x, z) * 5 + 0.15, z * 2);
    this.group.rotation.y = (rotation * Math.PI) / 2;
  }
  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.group.clear();
    this.type = "";
  }
}
