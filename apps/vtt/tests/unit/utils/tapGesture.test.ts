import { describe, expect, it } from 'vitest';
import {
  isTap,
  startTap,
  TAP_MAX_DISTANCE_PX,
  TAP_MAX_DURATION_MS,
  trackTap,
} from '@/utils/tapGesture';

describe('tapGesture', () => {
  it('accepts a short, still touch', () => {
    const tap = startTap(10, 10, 0);
    trackTap(tap, 13, 14);
    expect(isTap(tap, 100)).toBe(true);
  });

  it('rejects a drag beyond the radius, even if it comes back', () => {
    const tap = startTap(10, 10, 0);
    trackTap(tap, 10 + TAP_MAX_DISTANCE_PX + 5, 10);
    trackTap(tap, 10, 10);
    expect(isTap(tap, 100)).toBe(false);
  });

  it('rejects a long press', () => {
    expect(isTap(startTap(0, 0, 0), TAP_MAX_DURATION_MS + 1)).toBe(false);
  });
});
