import { describe, expect, it, vi } from "vitest";
import { SessionLifecycle } from "../src/core/SessionLifecycle";

function scheduler() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    pending,
    request: (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; },
    cancel: (id: number) => { pending.delete(id); },
    tick: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(16)); },
  };
}

describe("session resource lifecycle", () => {
  it("disposes subscriptions and resources once in reverse ownership order", () => {
    const session = new SessionLifecycle();
    const calls: number[] = [];
    session.own(() => calls.push(1));
    session.own(() => calls.push(2));
    session.dispose();
    session.dispose();
    expect(calls).toEqual([2, 1]);
    session.own(() => calls.push(3));
    expect(calls).toEqual([2, 1, 3]);
  });

  it("repeated session entry keeps only the current animation alive", () => {
    const clock = scheduler();
    const frame = vi.fn();
    for (let i = 0; i < 5; i++) {
      const session = new SessionLifecycle();
      session.animate(frame, clock.request, clock.cancel);
      expect(clock.pending.size).toBe(1);
      clock.tick();
      expect(clock.pending.size).toBe(1);
      session.dispose();
      expect(clock.pending.size).toBe(0);
    }
    clock.tick();
    expect(frame).toHaveBeenCalledTimes(5);
  });

  it("cannot reschedule a session disposed during its frame or by a late callback", () => {
    const clock = scheduler();
    const session = new SessionLifecycle();
    const frame = vi.fn(() => session.dispose());
    session.animate(frame, clock.request, clock.cancel);
    const late = [...clock.pending.values()][0];
    clock.tick();
    late(32);
    expect(frame).toHaveBeenCalledOnce();
    expect(clock.pending.size).toBe(0);
  });
});
