import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TokenAssetManager,
  tokenAssetManager,
  GuestUploadForbiddenError,
} from '@/services/tokenAssets';
import type { Token, TokenLibrary } from '@/types/token';

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
      manager.getLibraries().find((library: TokenLibrary) => library.name === 'Custom Tokens')
        ?.tokens,
    ).toContainEqual(token);
  });
});

describe('TokenAssetManager core methods & library management', () => {
  let manager: TokenAssetManager;

  beforeEach(async () => {
    localStorage.clear();
    vi.unstubAllGlobals();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');

    // Mock fetch to return fallback or fail cleanly
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({
          tokens: {
            items: [
              {
                id: 'manifest-wizard',
                name: 'Manifest Wizard',
                path: '/tokens/wizard.png',
                size: 'medium',
                category: 'pc',
                tags: ['arcane', 'magic'],
              },
              {
                id: 'manifest-goblin',
                name: 'Cave Goblin',
                path: '/tokens/goblin.png',
                size: 'small',
                category: 'monster',
                tags: ['goblinoid', 'sneaky'],
              },
            ],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    manager = new TokenAssetManager();
    await manager.initialize();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('initializes tokens from manifest when available', () => {
    const tokens = manager.getAllTokens();
    expect(tokens.length).toBe(2);
    expect(manager.getTokenById('manifest-wizard')?.name).toBe('Manifest Wizard');
    expect(manager.getTokenById('manifest-goblin')?.name).toBe('Cave Goblin');
  });

  it('falls back to default fantasy & modern libraries when manifest fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('Network error')),
    );
    const fallbackManager = new TokenAssetManager();
    await fallbackManager.initialize();

    const libs = fallbackManager.getLibraries();
    expect(libs.some((l: TokenLibrary) => l.name === 'Fantasy Tokens')).toBe(true);
    expect(libs.some((l: TokenLibrary) => l.name === 'Modern Tokens')).toBe(true);

    const all = fallbackManager.getAllTokens();
    expect(all.some((t: Token) => t.name === 'Human Fighter')).toBe(true);
    expect(all.some((t: Token) => t.name === 'Police Officer')).toBe(true);
  });

  it('filters tokens by category', () => {
    const pcTokens = manager.getTokensByCategory('pc');
    expect(pcTokens.length).toBe(1);
    expect(pcTokens[0].name).toBe('Manifest Wizard');

    const monsterTokens = manager.getTokensByCategory('monster');
    expect(monsterTokens.length).toBe(1);
    expect(monsterTokens[0].name).toBe('Cave Goblin');

    const vehicleTokens = manager.getTokensByCategory('vehicle');
    expect(vehicleTokens).toEqual([]);
  });

  it('searches tokens by query matching name, category, and tags', () => {
    expect(manager.searchTokens('wizard').length).toBe(1);
    expect(manager.searchTokens('magic').length).toBe(1);
    expect(manager.searchTokens('monster').length).toBe(1);
    expect(manager.searchTokens('goblinoid').length).toBe(1);
    expect(manager.searchTokens('nonexistent').length).toBe(0);
    expect(manager.searchTokens('   ').length).toBe(2);
  });

  it('creates custom library and adds custom token to it', () => {
    const customLib = manager.createCustomLibrary('My Custom Group', 'Description');
    expect(customLib.name).toBe('My Custom Group');
    expect(customLib.isDefault).toBe(false);

    const added = manager.addCustomToken(customLib.id, {
      name: 'Custom Paladin',
      image: 'data:image/png;base64,123',
      size: 'medium',
      category: 'pc',
      tags: ['holy', 'warrior'],
    });

    expect(added.id).toContain('token-');
    expect(added.isCustom).toBe(true);
    expect(manager.getTokenById(added.id)?.name).toBe('Custom Paladin');
  });

  it('throws error when adding custom token to non-existent library', () => {
    expect(() =>
      manager.addCustomToken('bogus-library', {
        name: 'Fail Token',
        image: '',
        size: 'medium',
        category: 'npc',
      }),
    ).toThrow('Library not found: bogus-library');
  });

  it('updates an existing token and persists customizations', () => {
    const updated = manager.updateToken('manifest-wizard', {
      name: 'Archmage Wizard',
    });
    expect(updated.name).toBe('Archmage Wizard');
    expect(manager.getTokenById('manifest-wizard')?.name).toBe('Archmage Wizard');

    expect(() => manager.updateToken('unknown-token', { name: 'X' })).toThrow(
      'Token not found: unknown-token',
    );
  });

  it('selects default token for character matching class or generic fallback', async () => {
    const wizardMatch = await manager.getDefaultTokenForCharacter({
      name: 'Elminster',
      class: 'Wizard',
    });
    expect(wizardMatch.name).toBe('Manifest Wizard');

    const fighterFallback = await manager.getDefaultTokenForCharacter({
      name: 'Bob',
      class: 'Barbarian',
    });
    expect(fighterFallback).toBeDefined();
    expect(fighterFallback.category).toBe('pc');
  });

  it('tracks cache statistics and clears image cache', () => {
    const stats = manager.getCacheStats();
    expect(stats.totalTokens).toBe(2);
    expect(stats.cachedImages).toBe(0);
    expect(stats.libraries).toBeGreaterThan(0);

    manager.clearCache();
    expect(manager.getCacheStats().cachedImages).toBe(0);
  });

  it('generates placeholder token image data url with initials', () => {
    const placeholder = manager.createPlaceholderTokenImage('Rogue Assassin');
    expect(placeholder).toBeDefined();
    expect(typeof placeholder).toBe('string');
  });

  it('loads and caches token images', async () => {
    const originalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      get src(): string {
        return this._src;
      }
      set src(url: string) {
        this._src = url;
        setTimeout(() => {
          if (url.includes('fail')) {
            this.onerror?.();
          } else {
            this.onload?.();
          }
        }, 0);
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    try {
      const img = await manager.loadTokenImage('/tokens/wizard.png');
      expect(img.src).toBe('/tokens/wizard.png');

      // Second load should resolve immediately from cache
      const cached = await manager.loadTokenImage('/tokens/wizard.png');
      expect(cached).toBe(img);

      // Preload batch
      await manager.preloadTokenImages([
        {
          id: '1',
          name: 'T1',
          image: '/tokens/t1.png',
          size: 'medium',
          category: 'pc',
          createdAt: 0,
          updatedAt: 0,
        },
      ]);

      // Error case
      await expect(manager.loadTokenImage('/tokens/fail.png')).rejects.toThrow(
        'Failed to load image: /tokens/fail.png',
      );
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('uploads token to server and adds to Uploaded Tokens library', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            asset: {
              id: 'asset-999',
              name: 'dragon.png',
              fullImage: 'uploads/dragon.png',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const file = new File(['dummy content'], 'dragon.png', { type: 'image/png' });
    const uploaded = await manager.uploadTokenToServer(file, 'user-123');

    expect(uploaded.id).toBe('asset-999');
    expect(uploaded.image).toBe('/api/uploads/dragon.png');
    expect(manager.getTokenById('asset-999')?.name).toBe('dragon.png');
  });

  it('throws GuestUploadForbiddenError when server responds with 403 guest forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'guest-upload-forbidden',
            message: 'Sign in to upload assets',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const file = new File(['dummy content'], 'goblin.png', { type: 'image/png' });
    await expect(
      manager.uploadTokenToServer(file, 'guest-user'),
    ).rejects.toThrow(GuestUploadForbiddenError);
  });

  it('imports legacy custom tokens from localStorage and handles guest skipping', async () => {
    const customTokens: Token[] = [
      {
        id: 'legacy-1',
        name: 'Legacy Hero',
        image: 'data:image/png;base64,QUJD',
        size: 'medium',
        category: 'pc',
        isCustom: true,
        createdAt: 100,
        updatedAt: 100,
      },
    ];
    localStorage.setItem('nexus-custom-tokens', JSON.stringify(customTokens));

    // When server returns 403 guest-upload-forbidden, import should catch and continue without failing
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('data:')) {
          return Promise.resolve(
            new Response(new Blob(['test'], { type: 'image/png' })),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: 'guest-upload-forbidden' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }),
    );

    await expect(manager.importFromLocalStorage('guest-id')).resolves.not.toThrow();
  });
});
