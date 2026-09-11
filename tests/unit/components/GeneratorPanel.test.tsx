import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('GeneratorPanel Containment (S0.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratedData = null;
    
    // Mock indexedDB for the component
    const mockIDBRequest = {
      onsuccess: null,
      onerror: null,
      result: null
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
              get: () => { const req = { onsuccess: null, onerror: null, result: null }; setTimeout(() => (req.onsuccess as any)?.({ target: { result: null } }), 0); return req; },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete: () => { const req = { onsuccess: null, onerror: null }; setTimeout(() => (req.onsuccess as any)?.(), 0); return req; }
            })
          })
        };
        const req: unknown = { ...mockIDBRequest, result: mockedDb };
        setTimeout(() => {
          if ((req as { onsuccess: ((e: unknown) => void) | null }).onsuccess) {
            (req as { onsuccess: (e: unknown) => void }).onsuccess({ target: { result: mockedDb } });
          }
        }, 0);
        return req as IDBOpenDBRequest;
      })
    } as unknown as IDBFactory;
  });

  it('prevents Add to Scene when no valid image artifact exists', async () => {
    render(<GeneratorPanel />);
    
    // Expand the controls panel first if necessary (GeneratorFloatingControls defaults to collapsed)
    const toggleButton = screen.getByTitle('Open controls');
    fireEvent.click(toggleButton);

    const addButton = screen.getByText('🗺️ Add to Scene');
    expect(addButton).toBeDisabled();
  });

  it('prevents procedural JSON from enabling Add to Scene', async () => {
    render(<GeneratorPanel />);
    
    const toggleButton = screen.getByTitle('Open controls');
    fireEvent.click(toggleButton);
    
    // Simulate generation of JSON payload
    const genJsonBtn = screen.getByText('Generate JSON');
    fireEvent.click(genJsonBtn);
    
    const addButton = screen.getByText('🗺️ Add to Scene');
    expect(addButton).toBeDisabled();
    expect(addButton.title).toBe('No generated map to add to scene.');
  });

  it('enables Add to Scene when a valid image is generated', async () => {
    render(<GeneratorPanel />);
    
    const toggleButton = screen.getByTitle('Open controls');
    fireEvent.click(toggleButton);
    
    // Simulate generation of valid image payload
    const genImgBtn = screen.getByText('Generate Image');
    fireEvent.click(genImgBtn);
    
    const addButton = screen.getByText('🗺️ Add to Scene');
    expect(addButton).not.toBeDisabled();
  });

  it('clears the current generated artifact when switching generator types', async () => {
    render(<GeneratorPanel />);
    
    const toggleButton = screen.getByTitle('Open controls');
    fireEvent.click(toggleButton);
    
    // Generate valid image
    const genImgBtn = screen.getByText('Generate Image');
    fireEvent.click(genImgBtn);
    
    let addButton = screen.getByText('🗺️ Add to Scene');
    expect(addButton).not.toBeDisabled();
    
    // Switch to another generator
    const caveTab = screen.getByText(/Cave/);
    fireEvent.click(caveTab);
    
    // Artifact should be cleared
    addButton = screen.getByText('🗺️ Add to Scene');
    expect(addButton).toBeDisabled();
  });
});
