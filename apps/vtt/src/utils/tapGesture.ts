/**
 * Distinguishes a tap from a drag for Simple Player Mode, where one finger
 * pans the map and a tap picks a destination. A gesture counts as a tap only
 * if it stays within a small radius and ends quickly.
 */

export const TAP_MAX_DISTANCE_PX = 10;
export const TAP_MAX_DURATION_MS = 400;

export interface TapTracker {
  startX: number;
  startY: number;
  startTime: number;
  maxDistance: number;
}

export function startTap(x: number, y: number, time: number): TapTracker {
  return { startX: x, startY: y, startTime: time, maxDistance: 0 };
}

export function trackTap(tracker: TapTracker, x: number, y: number): void {
  const distance = Math.hypot(x - tracker.startX, y - tracker.startY);
  if (distance > tracker.maxDistance) tracker.maxDistance = distance;
}

export function isTap(tracker: TapTracker, endTime: number): boolean {
  return (
    tracker.maxDistance <= TAP_MAX_DISTANCE_PX &&
    endTime - tracker.startTime <= TAP_MAX_DURATION_MS
  );
}
