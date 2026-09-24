/**
 * Fixed-window, in-memory rate limiter. Limits are per replica; control-api
 * runs as a single replica, and the gateway is the outer limit.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit; returns 0 when allowed, else seconds until the window resets. */
  hit(key: string): number {
    const now = this.now();
    this.sweep(now);
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }
    current.count += 1;
    if (current.count <= this.limit) return 0;
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
