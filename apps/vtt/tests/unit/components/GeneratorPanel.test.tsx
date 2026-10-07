import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { GeneratorPanel } from '@/components/Generator/GeneratorPanel';

// Mock child components
vi.mock('@/components/Generator/DungeonGenerator', () => ({
   
  DungeonGenerator: ({ onMapGenerated }: { onMapGenerated: (data: string, format: string) => void }) => (
    <div data-testid="dungeon-generator">
      <button onClick={() => onMapGenerated('{"grid":true}', 'png')}>Generate JSON</button>
      <button onClick={() => onMapGenerated('data:image/png;base64,...', 'png')}>Generate Image</button>
    </div>
  )
}));

vi.mock('@/components/Generator/WorldGenerator', () => ({
  WorldGenerator: () => <div data-testid="world-generator" />
}));

const mockUpdateScene = vi.fn();
const mockSetActiveTab = vi.fn();

// Mock Zustand store and hooks
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      updateScene: mockUpdateScene,
      setActiveTab: mockSetActiveTab,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
  useActiveScene: vi.fn(() => ({ id: 'scene-1' })),
}));

// Mock BaseMapImporter
vi.mock('@/services/baseMapImporter', () => {
  class UploadAuthRequiredError extends Error {
    constructor(msg = 'Sign in required') {
      super(msg);
      this.name = 'UploadAuthRequiredError';
    }
  }

  return {
    BaseMapImporter: {
      importGeneratedMap: vi.fn(),
    },
    UploadAuthRequiredError,
  };
});

// Mock notifications
vi.mock('@/utils/notifications', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock procedural generation hook
let mockGeneratedData: unknown = null;
vi.mock('@/hooks/useProceduralGeneration', () => ({
  useProceduralGeneration: () => ({
    isGenerating: false,
    generatedData: mockGeneratedData,
    error: null,
    triggerGeneration: vi.fn(),
  }),
}));

let storedMapData: {
  imageData: string;
  width?: number;
  height?: number;
} | null = null;

describe('GeneratorPanel Containment (S0.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratedData = null;
    storedMapData = null;

    // Mock indexedDB for the component
    const mockIDBRequest = {
      onsuccess: null,
      onerror: null,
      result: null,
    };

    global.indexedDB = {
      open: vi.fn(() => {
        const mockedDb = {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              put: () => {
                const req: {
                  onsuccess: (() => void) | null;
                  onerror: (() => void) | null;
                } = { onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.(), 0);
                return req;
              },
              get: () => {
                const req: {
                  onsuccess:
                    | ((ev?: {
                        target: { result: typeof storedMapData };
                      }) => void)
                    | null;
                  onerror: (() => void) | null;
                  result: typeof storedMapData;
                } = {
                  onsuccess: null,
                  onerror: null,
                  result: storedMapData,
                };
                setTimeout(
                  () =>
                    req.onsuccess?.({
                      target: { result: storedMapData },
                    }),
                  0,
                );
                return req;
              },
              delete: () => {
                const req: {
                  onsuccess: (() => void) | null;
                  onerror: (() => void) | null;
                } = { onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.(), 0);
                return req;
              },
            }),
          }),
        };
        const req: unknown = { ...mockIDBRequest, result: mockedDb };
        setTimeout(() => {
          if ((req as { onsuccess: ((e: unknown) => void) | null }).onsuccess) {
            (req as { onsuccess: (e: unknown) => void }).onsuccess({
              target: { result: mockedDb },
            });
          }
        }, 0);
        return req as IDBOpenDBRequest;
      }),
    } as unknown as IDBFactory;
  });

  it('prevents Add to Scene when no valid image artifact exists', async () => {
    render(<GeneratorPanel />);

    const addButton = screen.getByText('🗺️ Add to Scene').closest('button');
    expect(addButton).toBeDisabled();
  });

  it('prevents procedural JSON from enabling Add to Scene', async () => {
    storedMapData = { imageData: '{"grid":true,"rooms":[]}' };
    render(<GeneratorPanel />);

    const addButton = await screen.findByText('🗺️ Add to Scene');
    const button = addButton.closest('button');
    expect(button).toBeDisabled();
  });

  it('enables Add to Scene when a valid image is generated/loaded', async () => {
    storedMapData = { imageData: 'data:image/webp;base64,validImageData' };
    render(<GeneratorPanel />);

    const addButton = screen.getByText('🗺️ Add to Scene').closest('button');
    await waitFor(() => {
      expect(addButton).not.toBeDisabled();
    });
  });

  it('clears the current generated artifact when switching generator types', async () => {
    storedMapData = { imageData: 'data:image/webp;base64,validImageData' };
    render(<GeneratorPanel />);

    const addButton = screen.getByText('🗺️ Add to Scene').closest('button');
    await waitFor(() => {
      expect(addButton).not.toBeDisabled();
    });

    // Switch to another generator
    const caveTab = screen.getByText(/Cave/);
    fireEvent.click(caveTab);

    // Artifact should be cleared and button disabled
    await waitFor(() => {
      expect(addButton).toBeDisabled();
    });
  });

  it('applies widescreen dimensions and centered offsets when inserting generated map into scene', async () => {
    const { BaseMapImporter } = await import('@/services/baseMapImporter');
    vi.mocked(BaseMapImporter.importGeneratedMap).mockResolvedValue({
      assetId: 'asset-widescreen',
      sceneUrl: 'https://cdn.nexusvtt.com/maps/widescreen.webp',
    });

    const onSwitch = vi.fn();
    render(<GeneratorPanel onSwitchToScenes={onSwitch} />);

    const configuredHubUrl =
      import.meta.env.VITE_GENERATOR_HUB_URL ||
      (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
    const hubOrigin = new URL(configuredHubUrl, window.location.href).origin;

    // Simulate generator sending an export-ready message with widescreen dimensions (1920x1080)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: hubOrigin,
        data: {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: 'export-wide-1',
            importId: 'import-wide-1',
            source: 'dungeon',
            generatorVersion: '1.0',
            byteLength: 4096,
            grid: { bakedIntoImage: true },
            payload: {
              kind: 'raster',
              blob: new Blob(['fake-wide-content'], { type: 'image/webp' }),
              mimeType: 'image/webp',
              width: 1920,
              height: 1080,
            },
          },
        },
      }),
    );

    const addButton = await screen.findByText('🗺️ Add to Scene');
    await waitFor(() => {
      expect(addButton.closest('button')).not.toBeDisabled();
    });

    fireEvent.click(addButton.closest('button')!);

    await waitFor(() => {
      expect(BaseMapImporter.importGeneratedMap).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1920,
          height: 1080,
        }),
      );
      expect(mockUpdateScene).toHaveBeenCalledWith('scene-1', {
        backgroundImage: {
          url: 'https://cdn.nexusvtt.com/maps/widescreen.webp',
          width: 1920,
          height: 1080,
          offsetX: -960,
          offsetY: -540,
          scale: 1,
        },
      });
      expect(onSwitch).toHaveBeenCalled();
    });
  });

  it('maintains widescreen dimensions and centered offsets when falling back to local data URL', async () => {
    const { BaseMapImporter, UploadAuthRequiredError } = await import(
      '@/services/baseMapImporter'
    );
    vi.mocked(BaseMapImporter.importGeneratedMap).mockRejectedValue(
      new UploadAuthRequiredError('Sign in required'),
    );

    render(<GeneratorPanel />);

    const configuredHubUrl =
      import.meta.env.VITE_GENERATOR_HUB_URL ||
      (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
    const hubOrigin = new URL(configuredHubUrl, window.location.href).origin;

    // Post an export with 2560x1440 widescreen dimensions
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: hubOrigin,
        data: {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: 'export-wide-2',
            importId: 'import-wide-2',
            source: 'world',
            generatorVersion: '1.0',
            byteLength: 8192,
            grid: { bakedIntoImage: true },
            payload: {
              kind: 'raster',
              blob: new Blob(['fake-qhd-content'], { type: 'image/webp' }),
              mimeType: 'image/webp',
              width: 2560,
              height: 1440,
            },
          },
        },
      }),
    );

    const addButton = await screen.findByText('🗺️ Add to Scene');
    await waitFor(() => {
      expect(addButton.closest('button')).not.toBeDisabled();
    });

    fireEvent.click(addButton.closest('button')!);

    await waitFor(() => {
      expect(BaseMapImporter.importGeneratedMap).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockUpdateScene).toHaveBeenCalledWith('scene-1', {
        backgroundImage: {
          url: expect.stringMatching(/^data:/),
          width: 2560,
          height: 1440,
          offsetX: -1280,
          offsetY: -720,
          scale: 1,
        },
      });
    });
  });

  it('forwards reroll action to the generator hub iframe', async () => {
    render(<GeneratorPanel />);

    const iframe = screen.getByTitle('Generator Hub') as HTMLIFrameElement;
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postMessageSpy },
      writable: true,
    });

    const rerollButton = screen.getByTitle('Reroll new map (Enter)');
    fireEvent.click(rerollButton);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'generator/action',
        keyCode: 13,
      }),
      '*',
    );
  });

  it('handles cave, city, and dwelling exports and enables adding to scene', async () => {
    const { BaseMapImporter } = await import('@/services/baseMapImporter');
    vi.mocked(BaseMapImporter.importGeneratedMap).mockResolvedValue({
      assetId: 'asset-cave-1',
      sceneUrl: 'https://cdn.nexusvtt.com/maps/cave.png',
    });

    render(<GeneratorPanel />);

    const configuredHubUrl =
      import.meta.env.VITE_GENERATOR_HUB_URL ||
      (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
    const hubOrigin = new URL(configuredHubUrl, window.location.href).origin;

    // Simulate cave export
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: hubOrigin,
        data: {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: 'cave-export-1',
            importId: 'cave-import-1',
            source: 'cave',
            generatorVersion: '1.0',
            byteLength: 4096,
            grid: { bakedIntoImage: true },
            payload: {
              kind: 'raster',
              blob: new Blob(['fake-cave-content'], { type: 'image/png' }),
              mimeType: 'image/png',
              width: 1600,
              height: 1200,
            },
          },
        },
      }),
    );

    const addButton = await screen.findByText('🗺️ Add to Scene');
    await waitFor(() => {
      expect(addButton.closest('button')).not.toBeDisabled();
    });

    fireEvent.click(addButton.closest('button')!);

    await waitFor(() => {
      expect(mockUpdateScene).toHaveBeenCalledWith('scene-1', {
        backgroundImage: {
          url: 'https://cdn.nexusvtt.com/maps/cave.png',
          width: 1600,
          height: 1200,
          offsetX: -800,
          offsetY: -600,
          scale: 1,
        },
      });
    });
  });

  it('scales down oversized dungeon generator maps (>2000px) to fit scene appropriately', async () => {
    const { BaseMapImporter } = await import('@/services/baseMapImporter');
    vi.mocked(BaseMapImporter.importGeneratedMap).mockResolvedValue({
      assetId: 'asset-dungeon-large',
      sceneUrl: 'https://cdn.nexusvtt.com/maps/dungeon-large.webp',
    });

    render(<GeneratorPanel />);

    const configuredHubUrl =
      import.meta.env.VITE_GENERATOR_HUB_URL ||
      (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
    const hubOrigin = new URL(configuredHubUrl, window.location.href).origin;

    // Simulate an oversized print/poster export from dungeon generator (e.g. 4000x3000)
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: hubOrigin,
        data: {
          type: 'generator/export-ready',
          payload: {
            protocolVersion: '1.0',
            exportId: 'export-oversized-dungeon',
            importId: 'import-oversized-dungeon',
            source: 'dungeon',
            generatorVersion: '1.0',
            byteLength: 16384,
            grid: { bakedIntoImage: true },
            payload: {
              kind: 'raster',
              blob: new Blob(['fake-large-dungeon'], { type: 'image/webp' }),
              mimeType: 'image/webp',
              width: 4000,
              height: 3000,
            },
          },
        },
      }),
    );

    const addButton = await screen.findByText('🗺️ Add to Scene');
    await waitFor(() => {
      expect(addButton.closest('button')).not.toBeDisabled();
    });

    fireEvent.click(addButton.closest('button')!);

    // Scale factor: min(1600 / 4000, 1600 / 3000) = 0.4
    // Expected scaled width = 4000 * 0.4 = 1600, height = 3000 * 0.4 = 1200
    await waitFor(() => {
      expect(BaseMapImporter.importGeneratedMap).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1600,
          height: 1200,
        }),
      );
      expect(mockUpdateScene).toHaveBeenCalledWith('scene-1', {
        backgroundImage: {
          url: 'https://cdn.nexusvtt.com/maps/dungeon-large.webp',
          width: 1600,
          height: 1200,
          offsetX: -800,
          offsetY: -600,
          scale: 1,
        },
      });
    });
  });
  describe('action acknowledgements', () => {
    const hubOrigin = () => {
      const configuredHubUrl =
        import.meta.env.VITE_GENERATOR_HUB_URL ||
        (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
      return new URL(configuredHubUrl, window.location.href).origin;
    };

    const setupIframe = () => {
      const iframe = screen.getByTitle('Generator Hub') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        writable: true,
      });
      return postMessageSpy;
    };

    it('tags each action with a request id and shows it pending until acknowledged', async () => {
      render(<GeneratorPanel />);
      const postMessageSpy = setupIframe();

      const reroll = screen.getByTitle('Reroll new map (Enter)');
      fireEvent.click(reroll);

      const sent = postMessageSpy.mock.calls[0][0];
      expect(sent).toEqual(
        expect.objectContaining({
          type: 'generator/action',
          actionId: 'reroll',
          keyCode: 13,
          requestId: expect.any(String),
        }),
      );
      await waitFor(() => expect(reroll).toBeDisabled());

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: hubOrigin(),
          data: {
            type: 'generator/action-result',
            payload: { requestId: sent.requestId, status: 'done' },
          },
        }),
      );
      await waitFor(() => expect(reroll).not.toBeDisabled());
    });

    it('reports a failed action with an error toast and clears pending', async () => {
      const { toast } = await import('@/utils/notifications');
      render(<GeneratorPanel />);
      const postMessageSpy = setupIframe();

      const reroll = screen.getByTitle('Reroll new map (Enter)');
      fireEvent.click(reroll);
      const { requestId } = postMessageSpy.mock.calls[0][0];

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: hubOrigin(),
          data: {
            type: 'generator/action-result',
            payload: { requestId, status: 'error', error: 'boom' },
          },
        }),
      );

      await waitFor(() => expect(reroll).not.toBeDisabled());
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });

    it('warns and re-enables the button when the generator never responds', async () => {
      const { toast } = await import('@/utils/notifications');
      render(<GeneratorPanel />);
      setupIframe();

      const reroll = screen.getByTitle('Reroll new map (Enter)');
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        fireEvent.click(reroll);
        expect(reroll).toBeDisabled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(4100);
        });

        expect(toast.warning).toHaveBeenCalled();
        expect(reroll).not.toBeDisabled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('waits for the export that follows an action before adding to the scene', async () => {
      const { BaseMapImporter } = await import('@/services/baseMapImporter');
      vi.mocked(BaseMapImporter.importGeneratedMap).mockResolvedValue({
        assetId: 'asset-fresh',
        sceneUrl: 'https://cdn.nexusvtt.com/maps/fresh.webp',
      });

      render(<GeneratorPanel />);
      const postMessageSpy = setupIframe();

      const exportMessage = (exportId: string) =>
        new MessageEvent('message', {
          origin: hubOrigin(),
          data: {
            type: 'generator/export-ready',
            payload: {
              protocolVersion: '1.0',
              exportId,
              importId: exportId,
              source: 'dungeon',
              generatorVersion: '1.0',
              byteLength: 10,
              grid: { bakedIntoImage: true },
              payload: {
                kind: 'raster',
                blob: new Blob([exportId], { type: 'image/webp' }),
                mimeType: 'image/webp',
                width: 800,
                height: 600,
              },
            },
          },
        });

      // An initial export is cached.
      window.dispatchEvent(exportMessage('old-export'));
      const addButton = (await screen.findByText('🗺️ Add to Scene')).closest(
        'button',
      )!;
      await waitFor(() => expect(addButton).not.toBeDisabled());

      // A layer action is acknowledged, but its re-export has not landed yet.
      fireEvent.click(screen.getByTitle('Reroll new map (Enter)'));
      const { requestId } = postMessageSpy.mock.calls[0][0];
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: hubOrigin(),
          data: {
            type: 'generator/action-result',
            payload: { requestId, status: 'done' },
          },
        }),
      );

      fireEvent.click(addButton);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(BaseMapImporter.importGeneratedMap).not.toHaveBeenCalled();

      // The fresh export arrives; the import now uses it, not the old one.
      window.dispatchEvent(exportMessage('new-export'));
      await waitFor(() => {
        expect(BaseMapImporter.importGeneratedMap).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: expect.stringContaining('new-export'),
          }),
        );
      });
    });

    it('ignores results sent from another origin', async () => {
      render(<GeneratorPanel />);
      const postMessageSpy = setupIframe();

      const reroll = screen.getByTitle('Reroll new map (Enter)');
      fireEvent.click(reroll);
      const { requestId } = postMessageSpy.mock.calls[0][0];

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example',
          data: {
            type: 'generator/action-result',
            payload: { requestId, status: 'done' },
          },
        }),
      );

      expect(reroll).toBeDisabled();
    });
  });
});
