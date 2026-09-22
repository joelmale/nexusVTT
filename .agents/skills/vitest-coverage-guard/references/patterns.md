# Mocking & Testing Reference Patterns

This guide provides concrete, copy-pasteable patterns for common testing scenarios across our monorepo.

---

## 1. IndexedDB with `fake-indexeddb`

For repositories utilizing local-first storage or Dexie/idb adapters:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { indexedDBAdapter } from '@/services/indexedDBAdapter';

describe('IndexedDB Persistence', () => {
  beforeEach(async () => {
    // Reinitialize a clean in-memory database instance before every test
    globalThis.indexedDB = new IDBFactory();
    await indexedDBAdapter.init();
  });

  it('persists and retrieves entity state without data loss', async () => {
    const sampleToken = { id: 'tok-1', x: 100, y: 200, name: 'Rogue' };
    await indexedDBAdapter.saveEntity('tokens', sampleToken);

    const retrieved = await indexedDBAdapter.getEntity('tokens', 'tok-1');
    expect(retrieved).toEqual(sampleToken);
  });

  it('handles missing entities gracefully returning null', async () => {
    const missing = await indexedDBAdapter.getEntity('tokens', 'non-existent');
    expect(missing).toBeNull();
  });
});
```

---

## 2. Comlink Worker Proxy Mocking

Web Workers wrapped in Comlink (`src/services/storageWorkerClient.ts`, parser workers) cannot run directly in Node/JSDOM environments. Mock the client bridge:

```typescript
import { vi } from 'vitest';

export const mockStorageWorker = {
  saveGameStateSnapshot: vi.fn().mockResolvedValue({ success: true, version: 1 }),
  loadGameStateSnapshot: vi.fn().mockResolvedValue(null),
  clearCampaignData: vi.fn().mockResolvedValue(undefined),
  pruneHistory: vi.fn().mockResolvedValue(10),
};

vi.mock('@/services/storageWorkerClient', () => ({
  storageWorkerClient: mockStorageWorker,
  initStorageWorker: vi.fn().mockResolvedValue(mockStorageWorker),
}));
```

---

## 3. Realtime WebSocket Mock with Bi-directional Dispatch

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ type: 'close' });
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.({ type: 'open' });
    }, 0);
  }

  // Helper to simulate incoming server message
  simulateMessage(data: unknown) {
    this.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }

  static clear() {
    MockWebSocket.instances = [];
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);
```

---

## 4. React Testing Library Best Practices

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterSheet } from '@/components/CharacterSheet';

describe('CharacterSheet Component', () => {
  const defaultProps = {
    characterId: 'char-101',
    initialName: 'Aelar',
    onSave: vi.fn(),
  };

  it('renders correctly and accepts user input using accessible queries', async () => {
    const user = userEvent.setup();
    render(<CharacterSheet {...defaultProps} />);

    // Accessible query - find the text input by associated label
    const nameInput = screen.getByRole('textbox', { name: /character name/i });
    expect(nameInput).toHaveValue('Aelar');

    await user.clear(nameInput);
    await user.type(nameInput, 'Corvax');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Corvax' })
      );
    });
  });

  it('displays validation error when name is empty (Branch Coverage)', async () => {
    const user = userEvent.setup();
    render(<CharacterSheet {...defaultProps} />);

    const nameInput = screen.getByRole('textbox', { name: /character name/i });
    await user.clear(nameInput);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(screen.getByRole('alert')).toHaveTextContent(/name cannot be blank/i);
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });
});
```
