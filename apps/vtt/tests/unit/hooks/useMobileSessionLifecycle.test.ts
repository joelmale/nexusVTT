import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTION_POLL_MS,
  useMobileSessionLifecycle,
  type UseMobileSessionLifecycleOptions,
} from '@/hooks/useMobileSessionLifecycle';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function installWakeLock() {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ release });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  });
  return { request, release };
}

function removeWakeLock() {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: undefined,
  });
}

function options(
  overrides: Partial<UseMobileSessionLifecycleOptions> = {},
): UseMobileSessionLifecycleOptions {
  return {
    wakeLock: false,
    isSocketOpen: () => false,
    onResumeSession: vi.fn(),
    ...overrides,
  };
}

describe('useMobileSessionLifecycle', () => {
  beforeEach(() => {
    setVisibility('visible');
    setOnline(true);
    removeWakeLock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('polls the socket for connection state', () => {
    vi.useFakeTimers();
    let open = true;
    const { result } = renderHook(() =>
      useMobileSessionLifecycle(options({ isSocketOpen: () => open })),
    );
    expect(result.current.connectionState).toBe('connected');
    open = false;
    act(() => vi.advanceTimersByTime(CONNECTION_POLL_MS));
    expect(result.current.connectionState).toBe('reconnecting');
    vi.useRealTimers();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.connectionState).toBe('offline');
  });

  it('resumes when the tab becomes visible and the socket is closed', async () => {
    const onResumeSession = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useMobileSessionLifecycle(options({ onResumeSession })));

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResumeSession).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(onResumeSession).toHaveBeenCalledTimes(1));
  });

  it('does not resume when the socket is still open', () => {
    const onResumeSession = vi.fn();
    renderHook(() =>
      useMobileSessionLifecycle(
        options({ onResumeSession, isSocketOpen: () => true }),
      ),
    );
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    expect(onResumeSession).not.toHaveBeenCalled();
  });

  it('resumes on pageshow and when coming back online', async () => {
    const onResumeSession = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMobileSessionLifecycle(options({ onResumeSession })),
    );
    window.dispatchEvent(new Event('pageshow'));
    await waitFor(() => expect(onResumeSession).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.connectionState).toBe('reconnecting');
    await waitFor(() => expect(onResumeSession).toHaveBeenCalledTimes(2));
  });

  it('ignores overlapping resume triggers and swallows failures', async () => {
    let finish: (() => void) | undefined;
    const onResumeSession = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          finish = () => reject(new Error('nope'));
        }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderHook(() => useMobileSessionLifecycle(options({ onResumeSession })));

    window.dispatchEvent(new Event('pageshow'));
    await waitFor(() => expect(onResumeSession).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('pageshow'));
    expect(onResumeSession).toHaveBeenCalledTimes(1);

    finish?.();
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    window.dispatchEvent(new Event('pageshow'));
    await waitFor(() => expect(onResumeSession).toHaveBeenCalledTimes(2));
  });

  it('acquires, re-acquires and releases the wake lock', async () => {
    const { request, release } = installWakeLock();
    const { unmount } = renderHook(() =>
      useMobileSessionLifecycle(options({ wakeLock: true })),
    );
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    unmount();
    expect(release).toHaveBeenCalled();
  });

  it('does not request a wake lock while hidden, or when disabled', () => {
    const { request } = installWakeLock();
    setVisibility('hidden');
    renderHook(() => useMobileSessionLifecycle(options({ wakeLock: true })));
    renderHook(() => useMobileSessionLifecycle(options({ wakeLock: false })));
    expect(request).not.toHaveBeenCalled();
  });

  it('releases a lock that resolves after unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    let grant: (() => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          grant = () => resolve({ release });
        }),
    );
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });
    const { unmount } = renderHook(() =>
      useMobileSessionLifecycle(options({ wakeLock: true })),
    );
    unmount();
    grant?.();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('tolerates a rejected wake lock request', async () => {
    const request = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });
    renderHook(() => useMobileSessionLifecycle(options({ wakeLock: true })));
    await waitFor(() => expect(request).toHaveBeenCalled());
  });
});
