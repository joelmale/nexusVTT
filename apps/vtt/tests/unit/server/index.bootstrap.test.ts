import { afterEach, describe, expect, it, vi } from 'vitest';

describe('server bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes port resolution without starting infrastructure during import', async () => {
    vi.stubEnv('PORT', '6123');
    // server/auth.ts constructs a DatabaseService at module scope (it only
    // stores connection config; pg.Pool connects lazily on first query, so
    // this doesn't touch a real database). CI's unit-test job has no
    // DATABASE_URL by design -- see tests/setup.ts -- so importing
    // server/index.js transitively throws without a placeholder here.
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
    const bootstrap = await import('../../../server/index.js');

    expect(bootstrap.resolveServerPort()).toBe(6123);
    expect(bootstrap.resolveServerPort('7000')).toBe(7000);
    expect(bootstrap.resolveServerPort('')).toBe(5001);
    expect(bootstrap.startNexusServer).toBeTypeOf('function');
    expect(bootstrap.NexusServer).toBeTypeOf('function');
  });

  it('starts through an injected factory and shuts down only once per signal', async () => {
    // See the note in the previous test: only needed if this import runs
    // before server/index.js has been cached by an earlier test in this file.
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
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
