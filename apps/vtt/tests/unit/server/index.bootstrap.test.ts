import { afterEach, describe, expect, it, vi } from 'vitest';

describe('server bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes port resolution without starting infrastructure during import', async () => {
    vi.stubEnv('PORT', '6123');
    const bootstrap = await import('../../../server/index.js');

    expect(bootstrap.resolveServerPort()).toBe(6123);
    expect(bootstrap.resolveServerPort('7000')).toBe(7000);
    expect(bootstrap.resolveServerPort('')).toBe(5001);
    expect(bootstrap.startNexusServer).toBeTypeOf('function');
    expect(bootstrap.NexusServer).toBeTypeOf('function');
  });

  it('starts through an injected factory and shuts down only once per signal', async () => {
    const { startNexusServer } = await import('../../../server/index.js');
    const shutdown = vi.fn(async () => undefined);
    const createServer = vi.fn(() => ({ shutdown }) as never);
    const handlers = new Map<string, () => void>();
    const once = vi.spyOn(process, 'once').mockImplementation((signal, handler) => {
      handlers.set(String(signal), handler as () => void);
      return process;
    });

    const server = startNexusServer(7010, createServer);
    expect(server).toEqual(expect.objectContaining({ shutdown }));
    expect(createServer).toHaveBeenCalledWith(7010);
    expect(once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    handlers.get('SIGTERM')?.();
    handlers.get('SIGTERM')?.();
    await Promise.resolve();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
