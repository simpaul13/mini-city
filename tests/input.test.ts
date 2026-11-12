import { describe, expect, it, vi } from "vitest";
import { bindKeyboard, bindPointer, bindResize } from "../src/core/GameInput";

class FakeTarget extends EventTarget {
  tagName?: string;
  captures = new Set<number>();
  setPointerCapture = vi.fn((id: number) => { this.captures.add(id); });
  hasPointerCapture = (id: number) => this.captures.has(id);
  releasePointerCapture = vi.fn((id: number) => { this.captures.delete(id); });
}

function emit(target: EventTarget, type: string, properties: Record<string, unknown> = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

function keyboard(tagName?: string) {
  const target = new FakeTarget();
  target.tagName = tagName;
  const actions = { save: vi.fn(), select: vi.fn(), rotate: vi.fn(), orbit: vi.fn() };
  const held = new Set<string>();
  const dispose = bindKeyboard(target as unknown as Window, actions, held);
  return { target, actions, held, dispose };
}

function pointer(tool = "house") {
  const target = new FakeTarget();
  let hover: [number, number] | null = [0, 0];
  const actions = {
    pointer: vi.fn(),
    getTool: () => tool,
    getHover: () => hover,
    place: vi.fn(),
    pan: vi.fn(),
    zoom: vi.fn(),
  };
  const dispose = bindPointer(target as unknown as HTMLElement, actions);
  const send = (type: string, properties: Record<string, unknown> = {}) => emit(target, type, {
    pointerId: 1, clientX: 10, clientY: 20, button: 0, buttons: 1, ...properties,
  });
  return { target, actions, dispose, send, setHover: (tile: [number, number] | null) => { hover = tile; } };
}

describe("bindKeyboard", () => {
  it("normalizes held keys, preserves shortcuts, and prevents arrow scrolling", () => {
    const { target, actions, held, dispose } = keyboard();
    for (const key of ["W", "r", "R", "q", "E", "Escape"]) emit(target, "keydown", { key });
    expect(held.has("w")).toBe(true);
    expect(actions.rotate).toHaveBeenCalledTimes(2);
    expect(actions.select).toHaveBeenCalledOnce();
    expect(actions.orbit.mock.calls).toEqual([[-0.12], [0.12]]);
    const arrow = emit(target, "keydown", { key: "ArrowRight" });
    expect(arrow.defaultPrevented).toBe(true);
    expect(held.has("arrowright")).toBe(true);
    emit(target, "keyup", { key: "W" });
    expect(held.has("w")).toBe(false);
    emit(target, "blur");
    expect(held.size).toBe(0);
    dispose();
  });

  it.each(["ctrlKey", "metaKey"])("saves with %s without leaving movement held", (modifier) => {
    const { target, actions, held, dispose } = keyboard();
    held.add("s");
    const event = emit(target, "keydown", { key: "S", [modifier]: true });
    expect(event.defaultPrevented).toBe(true);
    expect(actions.save).toHaveBeenCalledOnce();
    expect(held.has("s")).toBe(false);
    dispose();
  });

  it.each(["INPUT", "SELECT", "input"])("ignores typing in %s without DOM globals", (tagName) => {
    const { target, actions, held, dispose } = keyboard(tagName);
    for (const key of ["w", "r", "q", "e", "Escape"]) emit(target, "keydown", { key });
    expect(held.size).toBe(0);
    expect(actions.select).not.toHaveBeenCalled();
    expect(actions.rotate).not.toHaveBeenCalled();
    expect(actions.orbit).not.toHaveBeenCalled();
    // These two behaviors intentionally match the original ordering.
    expect(emit(target, "keydown", { key: "ArrowDown" }).defaultPrevented).toBe(true);
    emit(target, "keydown", { key: "s", ctrlKey: true });
    expect(actions.save).toHaveBeenCalledOnce();
    dispose();
  });

  it("removes all subscriptions, clears held keys, and supports repeated disposal", () => {
    const target = new FakeTarget();
    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    const held = new Set(["w"]);
    const actions = { save: vi.fn(), select: vi.fn(), rotate: vi.fn(), orbit: vi.fn() };
    const dispose = bindKeyboard(target as unknown as Window, actions, held);
    dispose();
    dispose();
    expect(held.size).toBe(0);
    expect(add.mock.calls.map(([type]) => type)).toEqual(["keydown", "keyup", "blur"]);
    expect(remove.mock.calls).toEqual(add.mock.calls);
    emit(target, "keydown", { key: "r" });
    expect(actions.rotate).not.toHaveBeenCalled();
    held.add("w");
    emit(target, "keyup", { key: "w" });
    emit(target, "blur");
    expect(held.has("w")).toBe(true);
  });
});

describe("bindPointer", () => {
  it("updates hover before clicks and captures/releases the active pointer", () => {
    const { target, actions, send, dispose } = pointer();
    send("pointermove");
    expect(actions.pointer).toHaveBeenCalledOnce();
    send("pointerdown");
    expect(target.setPointerCapture).toHaveBeenCalledWith(1);
    send("pointerup");
    expect(actions.place).toHaveBeenCalledExactlyOnceWith();
    expect(actions.pointer.mock.invocationCallOrder.at(-1)).toBeLessThan(actions.place.mock.invocationCallOrder[0]);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    dispose();
  });

  it("passes raw select-drag pixel deltas and preserves the movement threshold", () => {
    const { actions, send, dispose } = pointer("select");
    send("pointerdown");
    send("pointermove", { clientX: 13, clientY: 20 });
    send("pointermove", { clientX: 20, clientY: 16 });
    send("pointerup");
    expect(actions.pan.mock.calls).toEqual([[3, 0], [7, -4]]);
    expect(actions.place).not.toHaveBeenCalled();
    dispose();
  });

  it("allows clicks after a movement of exactly three pixels", () => {
    const { actions, send, dispose } = pointer();
    send("pointerdown");
    send("pointermove", { clientX: 12, clientY: 21 });
    send("pointerup");
    expect(actions.place).toHaveBeenCalledOnce();
    dispose();
  });

  it("pans right drags with building tools and never places on right release", () => {
    const { actions, send, dispose } = pointer("road");
    send("pointerdown", { button: 2, buttons: 2 });
    send("pointermove", { clientX: 25, clientY: 12, buttons: 2 });
    send("pointerup", { button: 2, buttons: 0 });
    expect(actions.pan).toHaveBeenCalledWith(15, -8);
    expect(actions.place).not.toHaveBeenCalled();
    dispose();
  });

  it("places the road start and every interpolated tile without mutating hover", () => {
    const { actions, send, setHover, dispose } = pointer("road");
    send("pointerdown");
    setHover([3, 2]);
    send("pointermove", { clientX: 30 });
    expect(actions.place.mock.calls).toEqual([
      [], [[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]], [[3, 1]], [[3, 2]],
    ]);
    expect(actions.getHover()).toEqual([3, 2]);
    send("pointerup");
    expect(actions.place).toHaveBeenCalledTimes(7);
    dispose();
  });

  it("starts roads after entering terrain from an empty hover", () => {
    const { actions, send, setHover, dispose } = pointer("road");
    setHover(null);
    send("pointerdown");
    send("pointermove");
    expect(actions.place).toHaveBeenCalledTimes(1);
    setHover([2, 1]);
    send("pointermove", { clientX: 20 });
    expect(actions.place.mock.calls).toEqual([[], []]);
    setHover([3, 1]);
    send("pointermove", { clientX: 30 });
    expect(actions.place.mock.calls.slice(2)).toEqual([[[2, 1]], [[3, 1]]]);
    dispose();
  });

  it.each(["pointercancel", "lostpointercapture"])("resets drag and road start on %s", (type) => {
    const { actions, send, setHover, dispose } = pointer("road");
    send("pointerdown");
    send(type);
    actions.place.mockClear();
    setHover([8, 8]);
    send("pointermove", { clientX: 100 });
    send("pointerup");
    expect(actions.place).not.toHaveBeenCalled();
    send("pointerdown");
    setHover([9, 8]);
    send("pointermove", { clientX: 30 });
    expect(actions.place.mock.calls).toEqual([[], [[8, 8]], [[9, 8]]]);
    dispose();
  });

  it("ignores unmatched releases and other pointers during an active drag", () => {
    const { actions, send, dispose } = pointer();
    send("pointerup");
    send("pointerdown");
    send("pointerdown", { pointerId: 2 });
    send("pointermove", { pointerId: 2, clientX: 100 });
    send("pointercancel", { pointerId: 2 });
    send("lostpointercapture", { pointerId: 2 });
    send("pointerup", { pointerId: 2 });
    expect(actions.place).not.toHaveBeenCalled();
    send("pointerup");
    expect(actions.place).toHaveBeenCalledOnce();
    dispose();
  });

  it("prevents context menus and wheel scrolling and forwards wheel deltas", () => {
    const { target, actions, dispose } = pointer();
    expect(emit(target, "contextmenu").defaultPrevented).toBe(true);
    expect(emit(target, "wheel", { deltaY: -120 }).defaultPrevented).toBe(true);
    expect(actions.zoom).toHaveBeenCalledWith(-120);
    dispose();
    expect(emit(target, "wheel", { deltaY: 20 }).defaultPrevented).toBe(false);
    expect(emit(target, "contextmenu").defaultPrevented).toBe(false);
  });

  it("removes every listener and releases capture on idempotent disposal", () => {
    const target = new FakeTarget();
    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    const actions = { pointer: vi.fn(), getTool: () => "house", getHover: () => null, place: vi.fn(), pan: vi.fn(), zoom: vi.fn() };
    const dispose = bindPointer(target as unknown as HTMLElement, actions);
    emit(target, "pointerdown", { pointerId: 42, clientX: 0, clientY: 0, button: 0 });
    dispose();
    dispose();
    expect(remove.mock.calls).toEqual(add.mock.calls);
    expect(add.mock.calls.find(([type]) => type === "wheel")?.[2]).toEqual({ passive: false });
    expect(target.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(42);
    actions.pointer.mockClear();
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
      emit(target, type, { pointerId: 42 });
    }
    expect(actions.pointer).not.toHaveBeenCalled();
    expect(actions.place).not.toHaveBeenCalled();
    expect(actions.pan).not.toHaveBeenCalled();
  });
});

it("bindResize adds rather than replaces existing listeners and is disposable", () => {
  const target = new FakeTarget();
  const existing = vi.fn();
  const resize = vi.fn();
  target.addEventListener("resize", existing);
  const dispose = bindResize(target as unknown as Window, resize);
  emit(target, "resize");
  expect(existing).toHaveBeenCalledOnce();
  expect(resize).toHaveBeenCalledOnce();
  dispose();
  dispose();
  emit(target, "resize");
  expect(existing).toHaveBeenCalledTimes(2);
  expect(resize).toHaveBeenCalledOnce();
});
