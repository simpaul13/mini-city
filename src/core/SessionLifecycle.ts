/** Owns subscriptions, animation and render resources for one session. */
export class SessionLifecycle {
  private cleanups: (() => void)[] = [];
  private disposed = false;

  own(cleanup: () => void) {
    if (this.disposed) cleanup();
    else this.cleanups.push(cleanup);
  }

  animate(
    frame: (now: number) => void,
    request = requestAnimationFrame,
    cancel = cancelAnimationFrame,
  ) {
    let id: number;
    const tick = (now: number) => {
      if (this.disposed) return;
      frame(now);
      if (!this.disposed) id = request(tick);
    };
    this.own(() => cancel(id));
    if (!this.disposed) id = request(tick);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups.reverse()) cleanup();
    this.cleanups = [];
  }
}
