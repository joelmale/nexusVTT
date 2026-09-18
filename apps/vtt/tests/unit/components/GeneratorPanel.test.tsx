import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock Zustand store and hooks
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useActiveScene: vi.fn(() => ({ id: 'scene-1' }))
}));

// Mock procedural generation hook
let mockGeneratedData: unknown = null;
vi.mock('@/hooks/useProceduralGeneration', () => ({
  useProceduralGeneration: () => ({
    isGenerating: false,
    generatedData: mockGeneratedData,
    error: null,
    triggerGeneration: vi.fn()
  })
}));

let storedMapData: { imageData: string } | null = null;

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              put: () => { const req = { onsuccess: null, onerror: null }; setTimeout(() => (req.onsuccess as any)?.(), 0); return req; },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              get: () => { const req = { onsuccess: null, onerror: null, result: storedMapData }; setTimeout(() => (req.onsuccess as any)?.({ target: { result: storedMapData } }), 0); return req; },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete: () => { const req = { onsuccess: null, onerror: null }; setTimeout(() => (req.onsuccess as any)?.(), 0); return req; },
            }),
          }),
        };
        const req: unknown = { ...mockIDBRequest, result: mockedDb };
        setTimeout(() => {
          if ((req as { onsuccess: ((e: unknown) => void) | null }).onsuccess) {
            (req as { onsuccess: (e: unknown) => void }).onsuccess({ target: { result: mockedDb } });
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
});
