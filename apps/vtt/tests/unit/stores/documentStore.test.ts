import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useGameStore } from '@/stores/gameStore';
import { documentService } from '@/services/documentService';
import { documentWebSocketClient } from '@/services/documentWebSocketClient';
import { webSocketService } from '@/services/websocket';
import type { Document } from '@/services/documentService';
import type {
  DocumentSessionState,
  DocumentWebSocketIncomingEvents,
} from '@/services/documentWebSocketClient';

const documentWsMock = vi.hoisted(() => {
  const subscribers = new Map<string, Set<(data: unknown) => void>>();

  return {
    subscribers,
    connect: vi.fn(),
    createSession: vi.fn(),
    joinSession: vi.fn(),
    disconnect: vi.fn(),
    updateSettings: vi.fn(),
    syncPage: vi.fn(),
    syncScroll: vi.fn(),
    syncZoom: vi.fn(),
    subscribe: vi.fn((type: string, callback: (data: unknown) => void) => {
      if (!subscribers.has(type)) {
        subscribers.set(type, new Set());
      }
      subscribers.get(type)?.add(callback);
      return () => subscribers.get(type)?.delete(callback);
    }),
    emit<T extends keyof DocumentWebSocketIncomingEvents>(
      type: T,
      data: DocumentWebSocketIncomingEvents[T],
    ) {
      subscribers.get(String(type))?.forEach((callback) => callback(data));
    },
    clear() {
      subscribers.clear();
    },
  };
});

vi.mock('@/services/documentWebSocketClient', async () => {
  const actual = await vi.importActual<typeof import('@/services/documentWebSocketClient')>(
    '@/services/documentWebSocketClient',
  );

  return {
    ...actual,
    documentWebSocketClient: {
      connect: documentWsMock.connect,
      createSession: documentWsMock.createSession,
      joinSession: documentWsMock.joinSession,
      disconnect: documentWsMock.disconnect,
      updateSettings: documentWsMock.updateSettings,
      syncPage: documentWsMock.syncPage,
      syncScroll: documentWsMock.syncScroll,
      syncZoom: documentWsMock.syncZoom,
      subscribe: documentWsMock.subscribe,
    },
  };
});

vi.mock('@/services/documentService', () => ({
  documentService: {
    getWsToken: vi.fn(),
    getDocument: vi.fn(),
    getDocumentContentUrl: vi.fn(),
    listDocuments: vi.fn(),
    searchDocuments: vi.fn(),
    quickSearch: vi.fn(),
    ask: vi.fn(),
    createDocument: vi.fn(),
    uploadFile: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getDocumentStructuredData: vi.fn(),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    sendEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

const mockDocument: Document = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'Rules',
  description: '',
  type: 'rulebook',
  format: 'pdf',
  fileSize: 1000,
  uploadedBy: 'gm-1',
  uploadedAt: '2026-06-17T00:00:00.000Z',
  tags: [],
  campaigns: [],
  isPublic: true,
  status: 'completed',
};

const mockSession: DocumentSessionState = {
  sessionId: '123e4567-e89b-12d3-a456-426614174000',
  documentId: mockDocument.id,
  campaignId: 'campaign-1',
  roomCode: 'ABCD',
  presenter: 'gm-1',
  viewers: [],
  currentPage: 3,
  scrollPosition: 0.25,
  zoom: 1.5,
  syncSettings: {
    syncPage: true,
    syncScroll: true,
    syncHighlight: true,
    syncZoom: true,
  },
};

const setGameSession = (type: 'host' | 'player') => {
  const current = useGameStore.getState();
  useGameStore.setState({
    user: {
      ...current.user,
      id: type === 'host' ? 'gm-1' : 'player-1',
      name: type === 'host' ? 'GM' : 'Player',
      type,
      connected: true,
    },
    session: {
      roomCode: 'ABCD',
      hostId: 'gm-1',
      campaignId: 'campaign-1',
      players: [],
      status: 'connected',
    },
  });
};

describe('documentStore sync actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentWsMock.clear();
    act(() => {
      useDocumentStore.getState().reset();
    });
    vi.mocked(documentService.getWsToken).mockResolvedValue('ws-token');
    documentWsMock.connect.mockResolvedValue(undefined);
  });

  it('creates a presenter session and broadcasts it through the VTT room', async () => {
    setGameSession('host');

    await act(async () => {
      await useDocumentStore.getState().connectDocumentSync(mockDocument.id);
    });

    expect(documentWebSocketClient.connect).toHaveBeenCalledWith('ws-token');
    expect(documentWebSocketClient.createSession).toHaveBeenCalledWith(
      mockDocument.id,
      'campaign-1',
      'ABCD',
      'gm-1',
      {
        syncPage: true,
        syncScroll: true,
        syncHighlight: true,
        syncZoom: true,
      },
    );

    act(() => {
      documentWsMock.emit('session:created', mockSession);
    });

    expect(documentWebSocketClient.joinSession).toHaveBeenCalledWith(
      mockSession.sessionId,
      'gm-1',
      true,
    );
    expect(webSocketService.sendEvent).toHaveBeenCalledWith({
      type: 'document/sync-session',
      data: {
        documentId: mockDocument.id,
        sessionId: mockSession.sessionId,
        presenterId: 'gm-1',
      },
    });
  });

  it('joins a presenter document sync session as a player', async () => {
    setGameSession('player');
    useDocumentStore.setState({ currentDocument: mockDocument });

    await act(async () => {
      await useDocumentStore
        .getState()
        .joinDocumentSyncSession(mockDocument.id, mockSession.sessionId, 'gm-1');
    });

    expect(documentWebSocketClient.connect).toHaveBeenCalledWith('ws-token');
    expect(documentWebSocketClient.joinSession).toHaveBeenCalledWith(
      mockSession.sessionId,
      'player-1',
    );
    expect(useDocumentStore.getState().isPresenter).toBe(false);
    expect(useDocumentStore.getState().documentSessionId).toBe(mockSession.sessionId);
  });

  it('maps incoming page, scroll, and zoom sync messages into state', () => {
    act(() => {
      useDocumentStore
        .getState()
        .handleIncomingSyncMessage('page:changed', { page: 7 });
      useDocumentStore
        .getState()
        .handleIncomingSyncMessage('scroll:synced', { position: 1.2 });
      useDocumentStore
        .getState()
        .handleIncomingSyncMessage('zoom:synced', { zoom: 1.75 });
    });

    const state = useDocumentStore.getState();
    expect(state.currentPage).toBe(7);
    expect(state.syncScrollRatio).toBe(1);
    expect(state.syncZoomScale).toBe(1.75);
  });

  it('only sends page, scroll, and zoom sync while presenting', () => {
    useDocumentStore.setState({
      documentSessionId: mockSession.sessionId,
      isPresenter: true,
      isPresentationMode: false,
    });

    act(() => {
      useDocumentStore.getState().sendPageSync(2);
      useDocumentStore.getState().sendScrollSync(0.5);
      useDocumentStore.getState().sendZoomSync(2);
    });

    expect(documentWebSocketClient.syncPage).not.toHaveBeenCalled();
    expect(documentWebSocketClient.syncScroll).not.toHaveBeenCalled();
    expect(documentWebSocketClient.syncZoom).not.toHaveBeenCalled();

    useDocumentStore.setState({ isPresentationMode: true });

    act(() => {
      useDocumentStore.getState().sendPageSync(2);
      useDocumentStore.getState().sendScrollSync(-0.5);
      useDocumentStore.getState().sendZoomSync(2);
    });

    expect(documentWebSocketClient.syncPage).toHaveBeenCalledWith(2);
    expect(documentWebSocketClient.syncScroll).toHaveBeenCalledWith(0);
    expect(documentWebSocketClient.syncZoom).toHaveBeenCalledWith(2);
  });

  describe('library, search, and CRUD actions', () => {
    it('loads documents successfully and updates state', async () => {
      vi.mocked(documentService.listDocuments).mockResolvedValue({
        documents: [mockDocument],
        pagination: { total: 1, limit: 50, skip: 0, hasMore: false },
      });

      await act(async () => {
        await useDocumentStore.getState().loadDocuments();
      });

      const state = useDocumentStore.getState();
      expect(state.documents).toEqual([mockDocument]);
      expect(state.totalDocuments).toBe(1);
      expect(state.isLoadingDocuments).toBe(false);
      expect(state.documentsAvailable).toBe(true);
    });

    it('handles document loading failure and flags unavailability gracefully', async () => {
      vi.mocked(documentService.listDocuments).mockRejectedValue(
        new Error('Document service unavailable: fetch failed'),
      );

      await act(async () => {
        await useDocumentStore.getState().loadDocuments();
      });

      const state = useDocumentStore.getState();
      expect(state.documentsError).toContain('Document service unavailable');
      expect(state.documentsAvailable).toBe(false);
      expect(state.isLoadingDocuments).toBe(false);
    });

    it('sets and resets filters, triggering reloads', async () => {
      vi.mocked(documentService.listDocuments).mockResolvedValue({
        documents: [],
        pagination: { total: 0, limit: 50, skip: 0, hasMore: false },
      });

      act(() => {
        useDocumentStore.getState().setFilters({ search: 'dragon', type: 'rulebook' });
      });

      expect(useDocumentStore.getState().filters.search).toBe('dragon');
      expect(useDocumentStore.getState().filters.type).toBe('rulebook');
      expect(useDocumentStore.getState().filters.skip).toBe(0);

      act(() => {
        useDocumentStore.getState().resetFilters();
      });

      expect(useDocumentStore.getState().filters.search).toBeUndefined();
    });

    it('performs full-text search and quick search', async () => {
      const mockResult = {
        documentId: mockDocument.id,
        title: mockDocument.title,
        type: mockDocument.type,
        format: mockDocument.format,
        score: 0.95,
        highlights: { content: ['Rule *highlight*'] },
      };

      vi.mocked(documentService.searchDocuments).mockResolvedValue({
        results: [mockResult],
        total: 1,
        query: 'fireball',
      });

      await act(async () => {
        await useDocumentStore.getState().searchDocuments('fireball');
      });

      expect(useDocumentStore.getState().searchResults).toEqual([mockResult]);
      expect(useDocumentStore.getState().isSearching).toBe(false);

      vi.mocked(documentService.quickSearch).mockResolvedValue({
        results: [{ id: mockDocument.id, title: 'Quick', type: 'rulebook', score: 1 }],
      });

      await act(async () => {
        await useDocumentStore.getState().quickSearch('quick');
      });

      expect(useDocumentStore.getState().quickSearchResults).toHaveLength(1);

      act(() => {
        useDocumentStore.getState().clearSearch();
      });
      expect(useDocumentStore.getState().searchResults).toEqual([]);
      expect(useDocumentStore.getState().quickSearchResults).toEqual([]);
    });

    it('asks questions to the Codex and handles clearAsk', async () => {
      vi.mocked(documentService.ask).mockResolvedValue({
        answer: 'Fireball deals 8d6 fire damage.',
        citations: [
          {
            documentId: mockDocument.id,
            documentTitle: 'PHB',
            pageNumber: 241,
            snippet: 'A bright streak flashes...',
          },
        ],
      });

      await act(async () => {
        await useDocumentStore.getState().askCodexQuestion('How much damage does fireball do?');
      });

      expect(useDocumentStore.getState().askAnswer).toContain('8d6 fire damage');
      expect(useDocumentStore.getState().askCitations).toHaveLength(1);

      act(() => {
        useDocumentStore.getState().clearAsk();
      });
      expect(useDocumentStore.getState().askQuestion).toBe('');
      expect(useDocumentStore.getState().askAnswer).toBeNull();
    });

    it('opens, views, sets page, and closes documents', async () => {
      vi.mocked(documentService.getDocument).mockResolvedValue(mockDocument);
      vi.mocked(documentService.getDocumentContentUrl).mockResolvedValue('blob:http://localhost/doc');

      await act(async () => {
        await useDocumentStore.getState().openDocument(mockDocument.id, 5);
      });

      expect(useDocumentStore.getState().currentDocument).toEqual(mockDocument);
      expect(useDocumentStore.getState().currentDocumentContent).toBe('blob:http://localhost/doc');
      expect(useDocumentStore.getState().currentPage).toBe(5);

      act(() => {
        useDocumentStore.getState().setCurrentPage(6);
      });
      expect(useDocumentStore.getState().currentPage).toBe(6);

      act(() => {
        useDocumentStore.getState().closeDocument();
      });
      expect(useDocumentStore.getState().currentDocument).toBeNull();
      expect(useDocumentStore.getState().currentDocumentContent).toBeNull();
    });

    it('updates and deletes documents', async () => {
      useDocumentStore.setState({
        documents: [mockDocument],
        totalDocuments: 1,
        currentDocument: mockDocument,
      });

      const updated = { ...mockDocument, title: 'Updated Rules' };
      vi.mocked(documentService.updateDocument).mockResolvedValue(updated);

      await act(async () => {
        await useDocumentStore.getState().updateDocument(mockDocument.id, { title: 'Updated Rules' });
      });

      expect(useDocumentStore.getState().documents[0].title).toBe('Updated Rules');
      expect(useDocumentStore.getState().currentDocument?.title).toBe('Updated Rules');

      vi.mocked(documentService.deleteDocument).mockResolvedValue(undefined);

      await act(async () => {
        await useDocumentStore.getState().deleteDocument(mockDocument.id);
      });

      expect(useDocumentStore.getState().documents).toHaveLength(0);
      expect(useDocumentStore.getState().totalDocuments).toBe(0);
      expect(useDocumentStore.getState().currentDocument).toBeNull();
    });

    it('loads structured data for documents and caches it', async () => {
      const mockEntities = [
        { id: 'e-1', type: 'spell', name: 'Magic Missile', documentId: mockDocument.id, page: 1 },
      ];
      vi.mocked(documentService.getDocumentStructuredData).mockResolvedValue(mockEntities);

      await act(async () => {
        await useDocumentStore.getState().loadStructuredDataForDocument(mockDocument.id);
      });

      expect(useDocumentStore.getState().structuredEntities[mockDocument.id]).toEqual(mockEntities);

      // Second call returns cached immediately
      vi.mocked(documentService.getDocumentStructuredData).mockClear();
      await act(async () => {
        await useDocumentStore.getState().loadStructuredDataForDocument(mockDocument.id);
      });
      expect(documentService.getDocumentStructuredData).not.toHaveBeenCalled();
    });

    it('disconnects document sync and cleans up subscriptions', () => {
      useDocumentStore.setState({
        documentSessionId: 'sess-1',
        documentSyncDocumentId: 'doc-1',
        isPresenter: true,
        isPresentationMode: true,
      });

      act(() => {
        useDocumentStore.getState().disconnectDocumentSync();
      });

      const state = useDocumentStore.getState();
      expect(state.documentSessionId).toBeNull();
      expect(state.documentSyncDocumentId).toBeNull();
      expect(state.isPresenter).toBe(false);
      expect(state.isPresentationMode).toBe(false);
    });
  });
});
