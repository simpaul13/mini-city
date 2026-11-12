import * as THREE from "three";
import { BuildingPreview } from "../preview";
import { saveSnapshot, type Snapshot } from "../storage";
import { World, definitions, type Settings } from "../world";
import { GameUI } from "./GameUI";
import { bindKeyboard, bindPointer, bindResize } from "./GameInput";
import { SessionLifecycle } from "./SessionLifecycle";

/** Rendering and commands for a single city; never reused across screen entries. */
export class GameSession {
  private lifecycle = new SessionLifecycle();
  private world: World;
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 500);
  private scene = new THREE.Scene();
  private ghost = new BuildingPreview();
  private preview = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.08, 1.9),
    new THREE.MeshBasicMaterial({ color: 0x58a56a, transparent: true, opacity: 0.65 }),
  );
  private center = new THREE.Vector3();
  private mouse = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  private hover: [number, number] | null = null;
  private held = new Set<string>();
  private tool = "select";
  private rotation = 0;
  private angle = Math.PI / 4;
  private zoom = 1;
  private disposed = false;

  constructor(private ui: GameUI, settings: Settings, snapshot?: Snapshot) {
    const root = ui.worldRoot;
    this.scene.background = new THREE.Color(0xdce9df);
    this.scene.fog = new THREE.Fog(0xdce9df, 100, 220);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.lifecycle.own(() => {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    root.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x798b68, 2));
    const sun = new THREE.DirectionalLight(0xfff1d3, 2.5);
    sun.position.set(-30, 50, 25);
    this.scene.add(sun);
    this.world = new World(this.scene, settings);
    this.lifecycle.own(() => this.world.dispose());
    this.lifecycle.own(() => {
      this.ghost.dispose();
      this.preview.geometry.dispose();
      this.preview.material.dispose();
      this.scene.clear();
    });
    if (snapshot) {
      this.world.placed = new Map(snapshot.placed);
      this.world.deleted = new Set(snapshot.deleted);
      this.center.fromArray(snapshot.camera);
      this.angle = snapshot.angle ?? Math.PI / 4;
      this.zoom = snapshot.zoom ?? 1;
    }
    this.scene.add(this.preview, this.ghost.group);
    this.lifecycle.own(bindResize(window, this.resize));
    this.resize();
    this.lifecycle.own(bindKeyboard(window, {
      save: () => { void this.save(); },
      select: () => this.selectTool("select"),
      rotate: () => { this.rotation++; },
      orbit: delta => { this.angle += delta; },
    }, this.held));
    this.lifecycle.own(bindPointer(root, {
      pointer: event => {
        const bounds = root.getBoundingClientRect();
        this.mouse.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1);
        this.updateHover();
      },
      getTool: () => this.tool,
      getHover: () => this.hover,
      place: tile => this.place(tile),
      pan: (x, y) => {
        const dx = x * 0.08 / this.zoom, dy = y * 0.08 / this.zoom;
        this.center.x += -dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        this.center.z += dx * Math.sin(this.angle) + dy * Math.cos(this.angle);
      },
      zoom: delta => {
        this.zoom = Math.max(0.5, Math.min(2.2, this.zoom * (delta > 0 ? 0.9 : 1.1)));
        this.resize();
      },
    }));
    this.updateStats();
    let previous = performance.now();
    this.lifecycle.animate(now => {
      if (!root.isConnected) { this.dispose(); return; }
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const dx = Number(this.held.has("d") || this.held.has("arrowright")) - Number(this.held.has("a") || this.held.has("arrowleft"));
      const dz = Number(this.held.has("s") || this.held.has("arrowdown")) - Number(this.held.has("w") || this.held.has("arrowup"));
      const length = Math.hypot(dx, dz) || 1;
      this.center.x += dx / length * 18 * dt;
      this.center.z += dz / length * 18 * dt;
      this.world.sync(Math.floor(this.center.x / (this.world.chunkSize * 2)), Math.floor(this.center.z / (this.world.chunkSize * 2)));
      this.camera.position.set(this.center.x + 55 * Math.sin(this.angle), 70, this.center.z + 55 * Math.cos(this.angle));
      this.camera.lookAt(this.center.x, 0, this.center.z);
      this.renderer.render(this.scene, this.camera);
      this.updateHover();
    });
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.ui.worldRoot;
    this.renderer.setSize(w, h);
    Object.assign(this.camera, { left: -w / 40 / this.zoom, right: w / 40 / this.zoom,
      top: h / 40 / this.zoom, bottom: -h / 40 / this.zoom });
    this.camera.updateProjectionMatrix();
  };

  selectTool(tool: string) { this.tool = tool; this.ui.selectTool(tool); }

  private updateHover() {
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = this.ray.intersectObjects([...this.world.chunks.values()].map(group => group.children[0]), false)[0];
    this.hover = null;
    if (hit && hit.instanceId !== undefined) {
      this.hover = [hit.object.userData.cx * this.world.chunkSize + Math.floor(hit.instanceId / this.world.chunkSize),
        hit.object.userData.cz * this.world.chunkSize + (hit.instanceId % this.world.chunkSize)];
    }
    this.preview.visible = !!this.hover && this.tool !== "select";
    this.ghost.group.visible = this.preview.visible;
    if (this.hover) {
      const [x, z] = this.hover;
      this.ghost.update(this.world, this.tool, x, z, this.rotation);
      this.preview.position.set(x * 2, Math.max(this.world.sea, this.world.elevation(x, z) * 5) + 0.1, z * 2);
      this.preview.material.color.set(this.world.validate(this.tool, x, z).ok ? 0x58a56a : 0xd55c4b);
    }
    this.ui.setCoords(this.hover ? `TILE ${this.hover[0]}, ${this.hover[1]} · ${this.tool.toUpperCase()} · ${this.world.chunks.size} CHUNKS` : `SEED ${this.world.settings.seed}`);
  }

  private updateStats() {
    this.ui.setStats(this.world.state.budget, [...this.world.placed.values()].reduce((n, b) => n + (definitions[b.type]?.pop ?? 0), 0));
  }

  private place(tile = this.hover) {
    if (!tile) return;
    const [x, z] = tile, k = this.world.key(x, z);
    if (this.tool === "select") {
      const building = this.world.placed.get(k);
      this.ui.setMessage(building ? `${building.type} · ${x}, ${z}` : "Choose a tool to build here.");
      return;
    }
    if (this.tool === "bulldoze") {
      this.world.placed.delete(k);
      this.world.deleted.add(k);
    } else {
      const result = this.world.validate(this.tool, x, z);
      if (!result.ok) { this.ui.setMessage(`Cannot build here: ${result.reason}.`); return; }
      this.world.placed.set(k, { type: this.tool, rotation: this.rotation });
      this.world.deleted.add(k);
    }
    this.world.refresh(x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.world.placed.get(this.world.key(x + dx, z + dz))?.type === "road") this.world.refresh(x + dx, z + dz);
    }
    this.ui.setSaveLabel("Unsaved changes · Save");
    this.updateStats();
  }

  async save() {
    if (this.disposed) return;
    try {
      await saveSnapshot({ schemaVersion: 2, generatorVersion: this.world.settings.generatorVersion ?? 1,
        settings: this.world.settings, placed: [...this.world.placed], deleted: [...this.world.deleted],
        camera: this.center.toArray(), angle: this.angle, zoom: this.zoom });
      if (!this.disposed) this.ui.setSaveLabel("Saved ✓");
    } catch {
      if (!this.disposed) alert("Could not save this city. Check browser storage permissions.");
    }
  }

  settings() {
    this.held.clear();
    this.ui.showSettings({ seed: this.world.settings.seed, radius: this.world.radius, pixelRatio: this.renderer.getPixelRatio(),
      distance: value => { this.world.radius = value; },
      quality: value => { this.renderer.setPixelRatio(value); this.resize(); } });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.lifecycle.dispose();
  }
}
