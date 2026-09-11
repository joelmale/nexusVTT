import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenAssetManager, tokenAssetManager } from '@/services/tokenAssets';
import type { Token } from '@/types/token';

function createCustomToken(name: string): Token {
  return {
    id: `remote-token-${crypto.randomUUID()}`,
    name,
    image: 'data:image/png;base64,AA==',
    size: 'medium',
    category: 'pc',
    isCustom: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('TokenAssetManager multiplayer asset replay', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('notifies mounted renderers when a custom token keeps its remote id', () => {
    const library = tokenAssetManager.createCustomLibrary(
      `Remote tokens ${crypto.randomUUID()}`,
    );
    const token = createCustomToken('Remote player');
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener('token-assets-updated', listener);

    try {
      tokenAssetManager.addCustomTokenWithId(library.id, token);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
      expect(
        (listener.mock.calls[0]?.[0] as CustomEvent<{ tokenId: string }>)
          .detail,
      ).toEqual({ tokenId: token.id });
    } finally {
      window.removeEventListener('token-assets-updated', listener);
    }
  });

  it('restores standalone custom token ids after a page lifecycle', async () => {
    const token = createCustomToken('Persisted remote player');
    localStorage.setItem('nexus-custom-tokens', JSON.stringify([token]));
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ tokens: { items: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const manager = new TokenAssetManager();

    await manager.initialize();

    expect(manager.getTokenById(token.id)).toEqual(token);
    expect(
      manager.getLibraries().find((library) => library.name === 'Custom Tokens')
        ?.tokens,
    ).toContainEqual(token);
  });
});
