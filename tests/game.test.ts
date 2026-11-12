import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "../src/core/Game";
import type { Settings } from "../src/world";
import type { Snapshot } from "../src/storage";

type MenuActions = { start(): void; load(): void };
type SessionActions = {
  create(settings: Settings): void;
  menu(): void;
  save(): void;
  selectTool(tool: string): void;
  settings(): void;
};

const mocks = vi.hoisted(() => {
  const makeUI = () => ({
    showMenu: vi.fn<(actions: MenuActions) => void>(),
    showSession: vi.fn<(settings: Settings, actions: SessionActions) => void>(),
    hideWorldModal: vi.fn(),
    dispose: vi.fn(),
  });
  const makeSession = () => ({
    dispose: vi.fn(),
    save: vi.fn(),
    selectTool: vi.fn(),
    settings: vi.fn(),
  });
  return {
    makeUI,
    makeSession,
    uis: [] as ReturnType<typeof makeUI>[],
    sessions: [] as Array<ReturnType<typeof makeSession> & {
      ui: ReturnType<typeof makeUI>;
      initialSettings: Settings;
      snapshot?: Snapshot;
    }>,
    load: vi.fn<() => Promise<Snapshot | undefined>>(),
  };
});

vi.mock("../src/core/GameUI", () => ({
  GameUI: class {
    constructor() {
      const ui = mocks.makeUI();
      mocks.uis.push(ui);
      return ui;
    }
  },
}));
vi.mock("../src/core/GameSession", () => ({
  GameSession: class {
    constructor(ui: ReturnType<typeof mocks.makeUI>, settings: Settings, snapshot?: Snapshot) {
      const session = { ...mocks.makeSession(), ui, initialSettings: settings, snapshot };
      mocks.sessions.push(session);
      return session;
    }
  },
}));
vi.mock("../src/storage", () => ({ loadSnapshot: mocks.load }));

const settings: Settings = {
  seed: "new-city", preset: "Mixed Terrain", water: 0.42, generatorVersion: 2, chunkSize: 32,
};
function snapshot(): Snapshot {
  return {
    schemaVersion: 2,
    generatorVersion: 1,
    settings: { seed: "legacy-city", preset: "Islands & Coastlines", water: 0.65, generatorVersion: 1, chunkSize: 32 },
    placed: [["-2,3", { type: "house", rotation: 3 }]],
    deleted: ["-2,3", "4,5"],
    camera: [12, 0, -34],
    angle: 0.25,
    zoom: 1.8,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function menu(ui = mocks.uis.at(-1)!) {
  return ui.showMenu.mock.calls.at(-1)![0];
}
function sessionActions(ui = mocks.uis.at(-1)!) {
  return ui.showSession.mock.calls.at(-1)![1];
}

let game: Game;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.uis.length = 0;
  mocks.sessions.length = 0;
  mocks.load.mockReset();
  vi.stubGlobal("document", { querySelector: vi.fn(() => ({})) });
  vi.stubGlobal("alert", vi.fn());
  game = new Game();
  game.start();
});
afterEach(() => {
  game.dispose();
  vi.unstubAllGlobals();
});

describe("Game coordinator lifecycle", () => {
  it("repeated setup, create, menu and start dispose each former session exactly once", () => {
    const firstUI = mocks.uis[0];
    const start = menu().start;
    start();
    expect(firstUI.showSession.mock.calls[0][0]).toMatchObject({
      preset: "Mixed Terrain", water: 0.42, generatorVersion: 2, chunkSize: 32,
    });
    expect(mocks.sessions).toHaveLength(0);
    sessionActions().create(settings);
    const first = mocks.sessions[0];
    // Replacing an active city via setup disposes it even before the next create.
    start();
    expect(first.dispose).toHaveBeenCalledOnce();
    sessionActions().create(settings);
    const second = mocks.sessions[1];
    // A repeated create must not leave the old renderer/session alive.
    sessionActions().create({ ...settings, seed: "replacement" });
    const third = mocks.sessions[2];
    expect(second.dispose).toHaveBeenCalledOnce();
    sessionActions().menu();
    expect(third.dispose).toHaveBeenCalledOnce();
    menu().start();
    sessionActions().create(settings);
    const fourth = mocks.sessions[3];
    game.start();
    expect(firstUI.dispose).toHaveBeenCalledOnce();
    expect(fourth.dispose).toHaveBeenCalledOnce();
    expect(mocks.uis).toHaveLength(2);
    expect(mocks.uis[1].showMenu).toHaveBeenCalledOnce();
    menu().start();
    sessionActions().create(settings);
    const fifth = mocks.sessions[4];
    game.dispose();
    game.dispose();
    for (const session of [first, second, third, fourth, fifth]) {
      expect(session.dispose).toHaveBeenCalledOnce();
    }
  });

  it("routes toolbar actions only to the currently owned session", () => {
    menu().start();
    const actions = sessionActions();
    actions.save();
    actions.selectTool("house");
    actions.settings();
    expect(mocks.sessions).toHaveLength(0);
    actions.create(settings);
    const first = mocks.sessions[0];
    actions.save();
    actions.selectTool("road");
    actions.settings();
    expect(first.save).toHaveBeenCalledOnce();
    expect(first.selectTool).toHaveBeenCalledExactlyOnceWith("road");
    expect(first.settings).toHaveBeenCalledOnce();
    actions.menu();
    actions.save();
    actions.selectTool("park");
    actions.settings();
    expect(first.save).toHaveBeenCalledOnce();
    expect(first.selectTool).toHaveBeenCalledOnce();
    expect(first.settings).toHaveBeenCalledOnce();
  });

  it.each(["menu", "new world", "dispose", "restart"] as const)(
    "ignores a pending load after %s",
    async (transition) => {
      menu().start();
      const actions = sessionActions();
      actions.create(settings);
      const pending = deferred<Snapshot | undefined>();
      mocks.load.mockReturnValueOnce(pending.promise);
      menu().load();
      if (transition === "menu") actions.menu();
      else if (transition === "new world") menu().start();
      else if (transition === "dispose") game.dispose();
      else game.start();
      const ui = mocks.uis.at(-1)!;
      const screenCalls = ui.showSession.mock.calls.length;
      pending.resolve(snapshot());
      await pending.promise;
      await Promise.resolve();
      expect(mocks.sessions).toHaveLength(1);
      expect(mocks.sessions[0].dispose).toHaveBeenCalledOnce();
      expect(ui.showSession).toHaveBeenCalledTimes(screenCalls);
      expect(alert).not.toHaveBeenCalled();
    },
  );

  it("restores the exact saved settings, placements and camera snapshot without mutation", async () => {
    const saved = snapshot();
    const original = structuredClone(saved);
    mocks.load.mockResolvedValueOnce(saved);
    menu().load();
    await Promise.resolve();
    expect(mocks.sessions).toHaveLength(1);
    const restored = mocks.sessions[0];
    expect(restored.ui).toBe(mocks.uis[0]);
    expect(restored.initialSettings).toBe(saved.settings);
    expect(restored.snapshot).toBe(saved);
    expect(saved).toEqual(original);
    expect(mocks.uis[0].showSession).toHaveBeenCalledWith(saved.settings, expect.any(Object));
    expect(mocks.uis[0].hideWorldModal).toHaveBeenCalledOnce();
  });

  it("only accepts the newest of overlapping loads", async () => {
    const first = deferred<Snapshot | undefined>();
    const second = deferred<Snapshot | undefined>();
    mocks.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    menu().load();
    menu().load();
    const newest = snapshot();
    second.resolve(newest);
    await second.promise;
    first.resolve({ ...snapshot(), settings });
    await first.promise;
    expect(mocks.sessions).toHaveLength(1);
    expect(mocks.sessions[0].snapshot).toBe(newest);
  });

  it("opens setup instead of launching when there is no save", async () => {
    mocks.load.mockResolvedValueOnce(undefined);
    menu().load();
    await Promise.resolve();
    expect(mocks.uis[0].showSession).toHaveBeenCalledOnce();
    expect(mocks.sessions).toHaveLength(0);
    expect(mocks.uis[0].hideWorldModal).not.toHaveBeenCalled();
  });

  it("reports a current load failure but suppresses errors after leaving its screen", async () => {
    mocks.load.mockRejectedValueOnce(new Error("invalid save"));
    menu().load();
    await Promise.resolve();
    expect(alert).toHaveBeenCalledOnce();
    expect(mocks.sessions).toHaveLength(0);
    const pending = deferred<Snapshot | undefined>();
    mocks.load.mockReturnValueOnce(pending.promise);
    menu().load();
    menu().start();
    pending.reject(new Error("stale invalid save"));
    await pending.promise.catch(() => {});
    expect(alert).toHaveBeenCalledOnce();
  });
});
