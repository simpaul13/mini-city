import { BuildingPreview } from "../preview";
import { saveSnapshot, loadSnapshot, type Snapshot } from "../storage";
import { roadLine } from "../roads";
import * as THREE from "three";
import { World, definitions, type Settings } from "../world";

export class Game {
  start() {
const app = document.querySelector<HTMLDivElement>("#app")!;
let world: World,
  renderer: THREE.WebGLRenderer,
  camera: THREE.OrthographicCamera,
  scene: THREE.Scene,
  tool = "select",
  rotation = 0,
  zoom = 1,
  angle = Math.PI / 4,
  center = new THREE.Vector3(),
  last = { x: 0, y: 0 },
  mouse = new THREE.Vector2(),
  hover: { userData: { x: number; z: number } } | null = null;
const hoverTile = { userData: { x: 0, z: 0 } };
const ray = new THREE.Raycaster();
const ghost = new BuildingPreview();
const held = new Set<string>();
window.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => held.clear());
let frameId = 0;
function stop() {
  ghost.dispose();
  held.clear();
  cancelAnimationFrame(frameId);
  window.onresize = null;
  window.onkeydown = null;
  if (world) world.dispose();
  if (renderer) renderer.dispose();
}
const menu = () => {
  stop();
  app.innerHTML = `<main class="welcome"><div class="brand">FIELDNOTES <span>✳</span></div><div class="intro"><div class="eyebrow">A SMALL PLACE TO BEGIN</div><h1>Your city<br>is <i>waiting.</i></h1><p>Find a quiet corner of the world. Lay a road, plant a park, and see what grows.</p><button id="start" class="primary">Make a new world <b>↗</b></button><button id="load" class="textbtn">Continue your city　→</button><div class="note">NO GRID LIMITS · JUST A LITTLE IMAGINATION</div></div><aside class="art"><div class="sun"></div><div class="hill h1"></div><div class="hill h2"></div><div class="houses">⌂　⌂　⌂<br>　⌂　⌂　⌂</div><div class="caption">SOMEWHERE, THE MORNING IS JUST BEGINNING</div></aside></main>`;
  document.querySelector<HTMLElement>("#start")!.onclick = () => setup();
  document.querySelector<HTMLElement>("#load")!.onclick = load;
};
function setup(saved?: Settings) {
  stop();
  center.set(0, 0, 0);
  tool = "select"; rotation = 0; angle = Math.PI / 4; zoom = 1;
  world = undefined as unknown as World;
  const s = saved ?? {
    seed: Math.random().toString(36).slice(2, 9),
    preset: "Mixed Terrain",
    water: 0.42, generatorVersion: 2 as const, chunkSize: 32,
  };
  app.innerHTML = `<section class="game"><header class="top"><div class="brand">FIELDNOTES <span>✳</span></div><div class="place"><strong>Little Somewhere</strong><small>NEW HORIZONS · DAY 01</small></div><div class="weather">☀　<span>Clear skies</span></div><button id="save" class="save">Save city　⌘S</button><button id="settings" class="icon" aria-label="Settings">⚙</button><button id="menu" class="icon" aria-label="Main menu">↗</button></header><div id="world" class="world"></div><aside class="hud"><div class="tag">✳　YOUR CORNER OF THE WORLD</div><h2>Room to grow.</h2><p>Pick a place to start, then make it yours.</p><div class="stats"><span>POPULATION <b id="pop">0</b></span><span>TREASURY <b id="money">◈ 12,400</b></span></div><div class="hint">WASD to wander <i>·</i> drag to pan</div></aside><nav class="tools"><div class="toolhead">BUILD SOMETHING</div>${[
    ["select", "↖", "Select"],
    ["road", "╱", "Road"],
    ["house", "⌂", "House"],
    ["apartment", "▥", "Apartments"],
    ["commercial", "▤", "Shop"],
    ["industrial", "▦", "Workshop"],
    ["park", "♧", "Park"],
    ["bulldoze", "⌫", "Clear"],
  ]
    .map(
      (x) =>
        `<button class="tool" data-tool="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`,
    )
    .join(
      "",
    )}<div class="rotate">R　rotate building　　Q E　turn world</div></nav><div class="coords" id="coords">SEED NEW WORLD</div><div id="worldmodal" class="modal"><div class="card"><div class="eyebrow">A FRESH PAGE</div><h2>Choose your landscape.</h2><label>WORLD SEED <div class="seedrow"><input id="seed" value=""><button id="random">↻</button></div></label><label>LANDSCAPE<select id="preset"><option>Mixed Terrain</option><option>Islands & Coastlines</option><option>Flat Plains</option><option>Mountains & Valleys</option></select></label><label>RELATIVE WATER COVERAGE <input id="water" type="range" min="20" max="70" value="42"></label><button class="primary" id="create">Let's begin　↗</button></div></div></section>`;
  (document.querySelector("#preset") as HTMLSelectElement).value = s.preset;
  (document.querySelector("#seed") as HTMLInputElement).value = s.seed;
  document.querySelector<HTMLElement>("#random")!.onclick = () => {
    (document.querySelector<HTMLElement>("#seed") as HTMLInputElement).value =
      Math.random().toString(36).slice(2, 9);
  };
  document.querySelector<HTMLElement>("#create")!.onclick = () => {
    const settings: Settings = {
      generatorVersion: 2, chunkSize: 32,
      seed: (document.querySelector<HTMLElement>("#seed") as HTMLInputElement)
        .value,
      preset: (
        document.querySelector<HTMLElement>("#preset") as HTMLSelectElement
      ).value,
      water:
        Number(
          (document.querySelector<HTMLElement>("#water") as HTMLInputElement)
            .value,
        ) / 100,
    };
    document.querySelector<HTMLElement>("#worldmodal")!.classList.add("hidden");
    launch(settings);
  };
  document.querySelector<HTMLElement>("#menu")!.onclick = menu;
  document.querySelector<HTMLElement>("#save")!.onclick = save;
  document.querySelectorAll<HTMLButtonElement>(".tool").forEach(
    (b) =>
      (b.onclick = () => {
        tool = b.dataset.tool!;
        document
          .querySelectorAll(".tool")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      }),
  );
  document.querySelector("[data-tool=select]")!.classList.add("active");
  document.querySelector<HTMLElement>("#settings")!.onclick = settingsPanel;
  document.querySelectorAll<HTMLButtonElement>(".tool").forEach((b) => {
    const d = definitions[b.dataset.tool!];
    if (d) b.title = `${b.textContent?.trim()} · ${d.cost} credits`;
  });
  window.onkeydown = keys;
}
function launch(s: Settings, snapshot?: Snapshot) {
  const root = document.querySelector<HTMLElement>("#world")!;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce9df);
  scene.fog = new THREE.Fog(0xdce9df, 100, 220);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  root.appendChild(renderer.domElement);
  camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x798b68, 2));
  let sun = new THREE.DirectionalLight(0xfff1d3, 2.5);
  sun.position.set(-30, 50, 25);
  scene.add(sun);
  world = new World(scene, s);
  if (snapshot) {
    world.placed = new Map(snapshot.placed);
    world.deleted = new Set(snapshot.deleted);
    center.fromArray(snapshot.camera);
    angle = snapshot.angle ?? Math.PI / 4;
    zoom = snapshot.zoom ?? 1;
  }
  const resize = () => {
    let w = root.clientWidth,
      h = root.clientHeight;
    renderer.setSize(w, h);
    camera.left = -w / 40 / zoom;
    camera.right = w / 40 / zoom;
    camera.top = h / 40 / zoom;
    camera.bottom = -h / 40 / zoom;
    camera.updateProjectionMatrix();
  };
  window.onresize = resize;
  resize();
  bind(root);
  document.querySelector("#money")!.textContent =
    `◈ ${funds().toLocaleString()}`;
  document.querySelector("#pop")!.textContent = String(
    [...world.placed.values()].reduce(
      (n, b) => n + (definitions[b.type]?.pop ?? 0),
      0,
    ),
  );
  let previous = performance.now();
  function frame(now = performance.now()) {
    if (!root.isConnected) {
      stop();
      return;
    }
    frameId = requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.1); previous = now;
    const dx = Number(held.has("d") || held.has("arrowright")) - Number(held.has("a") || held.has("arrowleft"));
    const dz = Number(held.has("s") || held.has("arrowdown")) - Number(held.has("w") || held.has("arrowup"));
    const length = Math.hypot(dx, dz) || 1;
    center.x += dx / length * 18 * dt; center.z += dz / length * 18 * dt;
    world.sync(Math.floor(center.x / (world.chunkSize * 2)), Math.floor(center.z / (world.chunkSize * 2)));
    camera.position.set(
      center.x + 55 * Math.sin(angle),
      70,
      center.z + 55 * Math.cos(angle),
    );
    camera.lookAt(center.x, 0, center.z);
    renderer.render(scene, camera);
    updateHover();
  }
  frame();
}
const preview = new THREE.Mesh(
  new THREE.BoxGeometry(1.9, 0.08, 1.9),
  new THREE.MeshBasicMaterial({
    color: 0x58a56a,
    transparent: true,
    opacity: 0.65,
  }),
);
function bind(el: Element) {
  scene.add(preview, ghost.group);
  let moved = false,
    down = false,
    roadStart: [number, number] | null = null;
  const pointer = (p: PointerEvent) => {
    const r = el.getBoundingClientRect();
    mouse.set(
      ((p.clientX - r.left) / r.width) * 2 - 1,
      (-(p.clientY - r.top) / r.height) * 2 + 1,
    );
    updateHover();
  };
  el.addEventListener("pointerdown", (e) => {
    const p = e as PointerEvent;
    down = true;
    (el as HTMLElement).setPointerCapture(p.pointerId);
    moved = false;
    last = { x: p.clientX, y: p.clientY };
    pointer(p);
    roadStart = null;
    if (tool === "road" && p.button === 0) {
      place();
      if (hover) roadStart = [hover.userData.x, hover.userData.z];
    }
  });
  el.addEventListener("pointermove", (e) => {
    const p = e as PointerEvent;
    pointer(p);
    if (down) {
      if (Math.abs(p.clientX - last.x) + Math.abs(p.clientY - last.y) > 3)
        moved = true;
      if (tool === "select" || p.buttons === 2) {
        const dx = (p.clientX - last.x) * 0.08 / zoom, dy = (p.clientY - last.y) * 0.08 / zoom;
        center.x += -dx * Math.cos(angle) + dy * Math.sin(angle);
        center.z += dx * Math.sin(angle) + dy * Math.cos(angle);
      } else if (tool === "road" && p.buttons === 1 && hover) {
        const end: [number, number] = [hover.userData.x, hover.userData.z];
        if (roadStart) {
          for (const [x, z] of roadLine(...roadStart, ...end)) {
            hover.userData = { x, z };
            place();
          }
        } else place();
        roadStart = end;
      }
      last = { x: p.clientX, y: p.clientY };
    }
  });
  el.addEventListener("pointerup", (e) => {
    pointer(e as PointerEvent);
    if (!moved && (e as PointerEvent).button === 0 && tool !== "road") place();
    down = false;
  });
  el.addEventListener("pointercancel", () => { down = false; roadStart = null; });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom = Math.max(
        0.5,
        Math.min(2.2, zoom * ((e as WheelEvent).deltaY > 0 ? 0.9 : 1.1)),
      );
      window.onresize?.(new UIEvent("resize"));
    },
    { passive: false },
  );
}
function updateHover() {
  ray.setFromCamera(mouse, camera);
  const hit = ray
    .intersectObjects([...world.chunks.values()].map(group => group.children[0]), false)[0];
  hover = null;
  if (hit && hit.instanceId !== undefined) {
    const o = hit.object;
    hover = hoverTile;
    hover.userData = {
      x: o.userData.cx * world.chunkSize + Math.floor(hit.instanceId / world.chunkSize),
      z: o.userData.cz * world.chunkSize + (hit.instanceId % world.chunkSize),
    };
  }
  preview.visible = !!hover && tool !== "select";
  ghost.group.visible = preview.visible;
  if (hover) {
    const { x, z } = hover.userData;
    ghost.update(world, tool, x, z, rotation);
    preview.position.set(
      x * 2,
      Math.max(world.sea, world.elevation(x, z) * 5) + 0.1,
      z * 2,
    );
    preview.material.color.set(world.validate(tool, x, z).ok ? 0x58a56a : 0xd55c4b);
  }
  document.querySelector<HTMLElement>("#coords")!.textContent = hover
    ? `TILE ${hover.userData.x}, ${hover.userData.z} · ${tool.toUpperCase()} · ${world.chunks.size} CHUNKS`
    : `SEED ${world.settings.seed}`;
}
function funds() { return world.state.budget; }
function place() {
  if (!hover) return;
  const { x, z } = hover.userData,
    k = world.key(x, z);
  if (tool === "select") {
    const b = world.placed.get(k);
    document.querySelector(".hud p")!.textContent = b
      ? `${b.type} · ${x}, ${z}`
      : "Choose a tool to build here.";
    return;
  }
  if (tool === "bulldoze") {
    world.placed.delete(k);
    world.deleted.add(k);
  } else {
    const result = world.validate(tool, x, z);
    if (!result.ok) { document.querySelector(".hud p")!.textContent = `Cannot build here: ${result.reason}.`; return; }
    world.placed.set(k, { type: tool, rotation });
    world.deleted.add(k);
  }
  world.refresh(x, z);
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { if (world.placed.get(world.key(x+dx,z+dz))?.type === "road") world.refresh(x+dx,z+dz); }
  document.querySelector<HTMLElement>("#save")!.textContent = "Unsaved changes · Save";
  document.querySelector("#money")!.textContent =
    `◈ ${funds().toLocaleString()}`;
  document.querySelector<HTMLElement>("#pop")!.textContent = String(
    [...world.placed.values()].reduce(
      (n, b) => n + (definitions[b.type]?.pop ?? 0),
      0,
    ),
  );
}
async function save() {
  if (!world) return;
  try {
    const v: Snapshot = {
      schemaVersion: 2,
      generatorVersion: world.settings.generatorVersion ?? 1,
      settings: world.settings,
      placed: [...world.placed],
      deleted: [...world.deleted],
      camera: center.toArray(),
      angle,
      zoom,
    };
    await saveSnapshot(v);
    document.querySelector<HTMLElement>("#save")!.textContent = "Saved ✓";
  } catch {
    alert("Could not save this city. Check browser storage permissions.");
  }
}
async function load() {
  try {
    const v = await loadSnapshot();
    if (!v) {
      setup();
      return;
    }
    setup(v.settings);
    document.querySelector<HTMLElement>("#worldmodal")!.classList.add("hidden");
    launch(v.settings, v);
  } catch {
    alert("Unable to load saved city. The save may be invalid or unsupported; it has not been changed.");
  }
}
function keys(e: KeyboardEvent) {
  if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); held.delete("s"); void save(); return; }
  if (e.key.startsWith("Arrow")) e.preventDefault();
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement
  )
    return;
  if (e.key === "Escape") {
    tool = "select";
    document
      .querySelectorAll(".tool")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.tool === "select",
        ),
      );
  }
  if (e.key.toLowerCase() === "r") rotation++;
  if (e.key.toLowerCase() === "q") angle -= 0.12;
  if (e.key.toLowerCase() === "e") angle += 0.12;
  held.add(e.key.toLowerCase());
}
menu();

function settingsPanel() {
  held.clear();
  const dialog = document.createElement("dialog");
  dialog.className = "card";
  dialog.innerHTML = `<h2>Your world</h2><p>Seed: <strong></strong></p><label>RENDER DISTANCE<select id="distance"><option value="1">Near</option><option value="2">Medium</option><option value="3">Far</option></select></label><label>RENDER QUALITY<select id="quality"><option value="1">Balanced</option><option value="1.5">High</option></select></label><p>WASD / arrows: move · right-drag: pan · wheel: zoom · Q/E: orbit · R: rotate · Escape: select</p><button class="primary">Back to city</button>`;
  dialog.querySelector("strong")!.textContent = world.settings.seed;
  dialog.querySelector("button")!.onclick = () => dialog.close();
  const distance = dialog.querySelector<HTMLSelectElement>("#distance")!;
  distance.value = String(world.radius);
  distance.onchange = () => { world.radius = Number(distance.value); };
  dialog.querySelector<HTMLSelectElement>("#quality")!.value = String(renderer.getPixelRatio() > 1 ? 1.5 : 1);
  dialog.querySelector<HTMLSelectElement>("#quality")!.onchange = (e) => {
    renderer.setPixelRatio(Number((e.target as HTMLSelectElement).value));
    window.dispatchEvent(new Event("resize"));
  };
  dialog.onclose = () => dialog.remove();
  document.body.append(dialog);
  dialog.showModal();
}
  }
}
