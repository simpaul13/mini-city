import { roadLine } from "../roads";

type KeyboardActions = {
  save(): void;
  select(): void;
  rotate(): void;
  orbit(delta: number): void;
};

type PointerActions = {
  pointer(event: PointerEvent): void;
  getTool(): string;
  getHover(): [number, number] | null;
  place(tile?: [number, number]): void;
  pan(dx: number, dy: number): void;
  zoom(deltaY: number): void;
};

/** Keep every subscription owned by a binding in one disposable collection. */
function subscriptions(target: EventTarget) {
  const removers: (() => void)[] = [];
  return {
    on(type: string, listener: EventListener, options?: AddEventListenerOptions) {
      target.addEventListener(type, listener, options);
      removers.push(() => target.removeEventListener(type, listener, options));
    },
    dispose() {
      for (const remove of removers.splice(0)) remove();
    },
  };
}

export function bindKeyboard(
  target: Window,
  actions: KeyboardActions,
  held: Set<string>,
): () => void {
  const listeners = subscriptions(target);
  listeners.on("keydown", (event) => {
    const e = event as KeyboardEvent;
    const key = e.key.toLowerCase();
    // Save and arrow suppression intentionally precede the typing guard.
    if (key === "s" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      held.delete("s");
      actions.save();
      return;
    }
    if (e.key.startsWith("Arrow")) e.preventDefault();
    const tagName = (e.target as { tagName?: string } | null)?.tagName?.toUpperCase();
    if (tagName === "INPUT" || tagName === "SELECT") return;
    if (e.key === "Escape") actions.select();
    if (key === "r") actions.rotate();
    if (key === "q") actions.orbit(-0.12);
    if (key === "e") actions.orbit(0.12);
    held.add(key);
  });
  listeners.on("keyup", (event) => held.delete((event as KeyboardEvent).key.toLowerCase()));
  listeners.on("blur", () => held.clear());
  return () => {
    listeners.dispose();
    held.clear();
  };
}

export function bindPointer(el: HTMLElement, actions: PointerActions): () => void {
  const listeners = subscriptions(el);
  let activePointer: number | null = null;
  let moved = false;
  let last = { x: 0, y: 0 };
  let roadStart: [number, number] | null = null;

  const reset = () => {
    activePointer = null;
    moved = false;
    roadStart = null;
  };
  const release = (pointerId: number) => {
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  };
  listeners.on("pointerdown", (event) => {
    const p = event as PointerEvent;
    if (activePointer !== null) return;
    activePointer = p.pointerId;
    el.setPointerCapture(p.pointerId);
    moved = false;
    last = { x: p.clientX, y: p.clientY };
    actions.pointer(p);
    roadStart = null;
    if (actions.getTool() === "road" && p.button === 0) {
      actions.place();
      const hover = actions.getHover();
      if (hover) roadStart = [...hover];
    }
  });
  listeners.on("pointermove", (event) => {
    const p = event as PointerEvent;
    if (activePointer !== null && activePointer !== p.pointerId) return;
    actions.pointer(p);
    if (activePointer === null) return;
    const dx = p.clientX - last.x;
    const dy = p.clientY - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    const tool = actions.getTool();
    if (tool === "select" || p.buttons === 2) {
      actions.pan(dx, dy);
    } else if (tool === "road" && p.buttons === 1) {
      const hover = actions.getHover();
      if (hover) {
        const end: [number, number] = [...hover];
        if (roadStart) {
          for (const tile of roadLine(...roadStart, ...end)) actions.place(tile);
        } else actions.place();
        roadStart = end;
      }
    }
    last = { x: p.clientX, y: p.clientY };
  });
  listeners.on("pointerup", (event) => {
    const p = event as PointerEvent;
    if (activePointer !== p.pointerId) return;
    actions.pointer(p);
    const place = !moved && p.button === 0 && actions.getTool() !== "road";
    reset();
    release(p.pointerId);
    if (place) actions.place();
  });
  listeners.on("pointercancel", (event) => {
    const p = event as PointerEvent;
    if (activePointer !== p.pointerId) return;
    reset();
    release(p.pointerId);
  });
  listeners.on("lostpointercapture", (event) => {
    if (activePointer === (event as PointerEvent).pointerId) reset();
  });
  listeners.on("contextmenu", (event) => event.preventDefault());
  listeners.on("wheel", (event) => {
    event.preventDefault();
    actions.zoom((event as WheelEvent).deltaY);
  }, { passive: false });
  return () => {
    listeners.dispose();
    const pointerId = activePointer;
    reset();
    if (pointerId !== null) release(pointerId);
  };
}

export function bindResize(target: Window, resize: () => void): () => void {
  const listeners = subscriptions(target);
  listeners.on("resize", resize);
  return () => listeners.dispose();
}
