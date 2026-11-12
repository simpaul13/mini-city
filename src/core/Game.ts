import { loadSnapshot, type Snapshot } from "../storage";
import type { Settings } from "../world";
import { GameSession } from "./GameSession";
import { GameUI } from "./GameUI";

/** Screen transitions own exactly one session and invalidate stale async loads. */
export class Game {
  private ui!: GameUI;
  private session?: GameSession;
  private revision = 0;

  start() {
    this.dispose();
    this.ui = new GameUI(document.querySelector<HTMLDivElement>("#app")!);
    this.menu();
  }

  private leaveSession() {
    this.revision++;
    this.session?.dispose();
    this.session = undefined;
  }

  private menu = () => {
    this.leaveSession();
    this.ui.showMenu({ start: () => this.setup(), load: () => { void this.load(); } });
  };

  private setup(saved?: Settings, snapshot?: Snapshot) {
    this.leaveSession();
    const settings = saved ?? { seed: Math.random().toString(36).slice(2, 9),
      preset: "Mixed Terrain", water: 0.42, generatorVersion: 2 as const, chunkSize: 32 };
    this.ui.showSession(settings, {
      create: settings => this.launch(settings),
      menu: this.menu,
      save: () => { void this.session?.save(); },
      selectTool: tool => this.session?.selectTool(tool),
      settings: () => this.session?.settings(),
    });
    if (snapshot) this.launch(settings, snapshot);
  }

  private launch(settings: Settings, snapshot?: Snapshot) {
    this.leaveSession();
    this.ui.hideWorldModal();
    this.session = new GameSession(this.ui, settings, snapshot);
  }

  private async load() {
    const revision = ++this.revision;
    try {
      const snapshot = await loadSnapshot();
      if (revision !== this.revision) return;
      if (snapshot) this.setup(snapshot.settings, snapshot);
      else this.setup();
    } catch {
      if (revision === this.revision) alert("Unable to load saved city. The save may be invalid or unsupported; it has not been changed.");
    }
  }

  dispose() {
    this.leaveSession();
    this.ui?.dispose();
  }
}
