import { definitions, type Settings } from "../world";

/** Owns the game's screens and dialogs, without owning world or input state. */
export class GameUI {
  private screen: HTMLElement | null = null;
  private cleanups: Array<() => void> = [];
  private dialogs = new Map<HTMLDialogElement, () => void>();

  constructor(private readonly app: HTMLElement) {}

  showMenu(actions: { start(): void; load(): void }) {
    this.clearScreen();
    this.app.innerHTML = `<main class="welcome"><div class="brand">FIELDNOTES <span>✳</span></div><div class="intro"><div class="eyebrow">A SMALL PLACE TO BEGIN</div><h1>Your city<br>is <i>waiting.</i></h1><p>Find a quiet corner of the world. Lay a road, plant a park, and see what grows.</p><button id="start" class="primary">Make a new world <b>↗</b></button><button id="load" class="textbtn">Continue your city　→</button><div class="note">NO GRID LIMITS · JUST A LITTLE IMAGINATION</div></div><aside class="art"><div class="sun"></div><div class="hill h1"></div><div class="hill h2"></div><div class="houses">⌂　⌂　⌂<br>　⌂　⌂　⌂</div><div class="caption">SOMEWHERE, THE MORNING IS JUST BEGINNING</div></aside></main>`;
    this.screen = this.app.firstElementChild as HTMLElement;
    this.listen(this.query("#start"), "click", () => actions.start());
    this.listen(this.query("#load"), "click", () => actions.load());
  }

  showSession(settings: Settings, actions: {
    create(settings: Settings): void;
    menu(): void;
    save(): void;
    selectTool(tool: string): void;
    settings(): void;
  }) {
    this.clearScreen();
    this.app.innerHTML = `<section class="game"><header class="top"><div class="brand">FIELDNOTES <span>✳</span></div><div class="place"><strong>Little Somewhere</strong><small>NEW HORIZONS · DAY 01</small></div><div class="weather">☀　<span>Clear skies</span></div><button id="save" class="save">Save city　⌘S</button><button id="settings" class="icon" aria-label="Settings">⚙</button><button id="menu" class="icon" aria-label="Main menu">↗</button></header><div id="world" class="world"></div><aside class="hud"><div class="tag">✳　YOUR CORNER OF THE WORLD</div><h2>Room to grow.</h2><p>Pick a place to start, then make it yours.</p><div class="stats"><span>POPULATION <b id="pop">0</b></span><span>TREASURY <b id="money">◈ 12,400</b></span></div><div class="hint">WASD to wander <i>·</i> drag to pan</div></aside><nav class="tools"><div class="toolhead">BUILD SOMETHING</div>${[
      ["select", "↖", "Select"],
      ["road", "╱", "Road"],
      ["house", "⌂", "House"],
      ["apartment", "▥", "Apartments"],
      ["commercial", "▤", "Shop"],
      ["industrial", "▦", "Workshop"],
      ["park", "♧", "Park"],
      ["bulldoze", "⌫", "Clear"],
    ].map((x) => `<button class="tool" data-tool="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join("")}<div class="rotate">R　rotate building　　Q E　turn world</div></nav><div class="coords" id="coords">SEED NEW WORLD</div><div id="worldmodal" class="modal"><div class="card"><div class="eyebrow">A FRESH PAGE</div><h2>Choose your landscape.</h2><label>WORLD SEED <div class="seedrow"><input id="seed" value=""><button id="random">↻</button></div></label><label>LANDSCAPE<select id="preset"><option>Mixed Terrain</option><option>Islands & Coastlines</option><option>Flat Plains</option><option>Mountains & Valleys</option></select></label><label>RELATIVE WATER COVERAGE <input id="water" type="range" min="20" max="70" value="42"></label><button class="primary" id="create">Let's begin　↗</button></div></div></section>`;
    this.screen = this.app.firstElementChild as HTMLElement;
    const seed = this.query<HTMLInputElement>("#seed");
    const preset = this.query<HTMLSelectElement>("#preset");
    const water = this.query<HTMLInputElement>("#water");
    preset.value = settings.preset;
    seed.value = settings.seed;
    this.listen(this.query("#random"), "click", () => {
      seed.value = Math.random().toString(36).slice(2, 9);
    });
    this.listen(this.query("#create"), "click", () => {
      const created: Settings = {
        generatorVersion: 2,
        chunkSize: 32,
        seed: seed.value,
        preset: preset.value,
        water: Number(water.value) / 100,
      };
      this.hideWorldModal();
      actions.create(created);
    });
    this.listen(this.query("#menu"), "click", () => actions.menu());
    this.listen(this.query("#save"), "click", () => actions.save());
    this.listen(this.query("#settings"), "click", () => actions.settings());
    this.screen.querySelectorAll<HTMLButtonElement>(".tool").forEach((button) => {
      const tool = button.dataset.tool!;
      this.listen(button, "click", () => {
        this.selectTool(tool);
        actions.selectTool(tool);
      });
      const definition = definitions[tool];
      if (definition) button.title = `${button.textContent?.trim()} · ${definition.cost} credits`;
    });
    this.selectTool("select");
  }

  hideWorldModal() {
    this.screen?.querySelector("#worldmodal")?.classList.add("hidden");
  }

  get worldRoot(): HTMLElement {
    return this.query("#world");
  }

  selectTool(tool: string) {
    this.screen?.querySelectorAll<HTMLElement>(".tool").forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === tool);
    });
  }

  setStats(budget: number, population: number) {
    this.setText("#money", `◈ ${budget.toLocaleString()}`);
    this.setText("#pop", String(population));
  }

  setMessage(text: string) {
    this.setText(".hud p", text);
  }

  setSaveLabel(text: string) {
    this.setText("#save", text);
  }

  setCoords(text: string) {
    this.setText("#coords", text);
  }

  showSettings(options: {
    seed: string;
    radius: number;
    pixelRatio: number;
    distance(value: number): void;
    quality(value: number): void;
  }) {
    const dialog = document.createElement("dialog");
    dialog.className = "card";
    dialog.innerHTML = `<h2>Your world</h2><p>Seed: <strong></strong></p><label>RENDER DISTANCE<select id="distance"><option value="1">Near</option><option value="2">Medium</option><option value="3">Far</option></select></label><label>RENDER QUALITY<select id="quality"><option value="1">Balanced</option><option value="1.5">High</option></select></label><p>WASD / arrows: move · right-drag: pan · wheel: zoom · Q/E: orbit · R: rotate · Escape: select</p><button class="primary">Back to city</button>`;
    dialog.querySelector("strong")!.textContent = options.seed;
    const button = dialog.querySelector("button")!;
    const distance = dialog.querySelector<HTMLSelectElement>("#distance")!;
    const quality = dialog.querySelector<HTMLSelectElement>("#quality")!;
    distance.value = String(options.radius);
    quality.value = String(options.pixelRatio > 1 ? 1.5 : 1);
    const close = () => dialog.close();
    const changeDistance = () => options.distance(Number(distance.value));
    const changeQuality = () => options.quality(Number(quality.value));
    const remove = () => {
      button.removeEventListener("click", close);
      distance.removeEventListener("change", changeDistance);
      quality.removeEventListener("change", changeQuality);
      dialog.removeEventListener("close", remove);
      if (dialog.open) dialog.close();
      dialog.remove();
      this.dialogs.delete(dialog);
    };
    button.addEventListener("click", close);
    distance.addEventListener("change", changeDistance);
    quality.addEventListener("change", changeQuality);
    dialog.addEventListener("close", remove);
    this.dialogs.set(dialog, remove);
    document.body.append(dialog);
    dialog.showModal();
  }

  dispose() {
    this.clearScreen();
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.screen?.querySelector<T>(selector);
    if (!element) throw new Error(`Game UI element not available: ${selector}`);
    return element;
  }

  private listen(element: HTMLElement, type: string, handler: () => void) {
    element.addEventListener(type, handler);
    this.cleanups.push(() => element.removeEventListener(type, handler));
  }

  private setText(selector: string, text: string) {
    const element = this.screen?.querySelector(selector);
    if (element) element.textContent = text;
  }

  private clearScreen() {
    for (const remove of this.dialogs.values()) remove();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.screen?.remove();
    this.screen = null;
  }
}
