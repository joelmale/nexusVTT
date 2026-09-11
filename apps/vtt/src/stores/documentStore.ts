/**
 * Document Store - Zustand store for managing document state
 *
 * This store manages the state of documents from NexusCodex, including:
 * - Document library (list of documents)
 * - Currently viewed document
 * - Search results
 * - Upload/download progress
 * - Document filters
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { documentService, type Document, type DocumentType, type SearchResult, type QuickSearchResult, type AskSearchCitation, type StructuredEntity } from '@/services/documentService';
import {
  documentWebSocketClient,
} from '@/services/documentWebSocketClient';
import { webSocketService } from '@/services/websocket';
import { useGameStore } from '@/stores/gameStore';

/**
 * Document upload progress
 */
export interface UploadProgress {
  documentId?: string;
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

/**
 * Document filters for library view
 */
export interface DocumentFilters {
  search?: string;
  type?: DocumentType;
  campaign?: string;
  tag?: string;
  skip: number;
  limit: number;
}

/**
 * Document store state
 */
export interface DocumentStoreState {
  // Document library
  documents: Document[];
  totalDocuments: number;
  filters: DocumentFilters;
  isLoadingDocuments: boolean;
  documentsError: string | null;
  documentsAvailable: boolean;
  documentsUnavailableReason: string | null;

  // Currently viewed document
  currentDocument: Document | null;
  currentDocumentContent: string | null;
  currentPage: number;
  isLoadingDocument: boolean;

  // Structured entities cache
  structuredEntities: Record<string, StructuredEntity[]>;
  isLoadingStructuredData: boolean;

  // Search
  searchResults: SearchResult[];
  quickSearchResults: QuickSearchResult[];
  searchQuery: string;
  isSearching: boolean;
  searchError: string | null;

  // Grounded Ask Q&A
  askQuestion: string;
  askAnswer: string | null;
  askCitations: AskSearchCitation[];
  isAsking: boolean;
  askError: string | null;

  // Upload
  uploadQueue: UploadProgress[];

  // Document sync
  documentSessionId: string | null;
  documentSyncDocumentId: string | null;
  isPresenter: boolean;
  isPresentationMode: boolean;
  syncScrollRatio: number | null;
  syncZoomScale: number | null;
  documentSyncError: string | null;

  // Actions
  loadDocuments: (force?: boolean) => Promise<void>;
  setFilters: (filters: Partial<DocumentFilters>) => void;
  resetFilters: () => void;

  searchDocuments: (query: string, filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[] }) => Promise<void>;
  quickSearch: (query: string, campaign?: string) => Promise<void>;
  clearSearch: () => void;

  // Q&A actions
  askCodexQuestion: (question: string, filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[] }) => Promise<void>;
  clearAsk: () => void;

  openDocument: (documentId: string, initialPage?: number) => Promise<void>;
  closeDocument: () => void;

  uploadDocument: (file: File, metadata: {
    title: string;
    description?: string;
    type: DocumentType;
    author?: string;
    tags?: string[];
    campaigns?: string[];
  }) => Promise<Document>;

  updateDocument: (documentId: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;

  setCurrentPage: (page: number) => void;
  loadStructuredDataForDocument: (documentId: string) => Promise<void>;

  // Document sync actions
  connectDocumentSync: (documentId: string) => Promise<void>;
  joinDocumentSyncSession: (
    documentId: string,
    sessionId: string,
    presenterId: string,
  ) => Promise<void>;
  disconnectDocumentSync: () => void;
  setPresentationMode: (enabled: boolean) => void;
  sendPageSync: (page: number) => void;
  sendScrollSync: (position: number) => void;
  sendZoomSync: (zoom: number) => void;
  handleIncomingSyncMessage: (
    type: 'page:changed' | 'scroll:synced' | 'zoom:synced',
    data: { page?: number; position?: number; zoom?: number },
  ) => void;

  reset: () => void;
}

/**
 * Default filters
 */
const defaultFilters: DocumentFilters = {
  skip: 0,
  limit: 50,
};

/**
 * Initial state
 */
const initialState = {
  documents: [],
  totalDocuments: 0,
  filters: { ...defaultFilters },
  isLoadingDocuments: false,
  documentsError: null,
  documentsAvailable: true,
  documentsUnavailableReason: null,

  // Currently viewed document
  currentDocument: null,
  currentDocumentContent: null,
  currentPage: 1,
  isLoadingDocument: false,

  // Structured entities cache
  structuredEntities: {},
  isLoadingStructuredData: false,

  searchResults: [],
  quickSearchResults: [],
  searchQuery: '',
  isSearching: false,
  searchError: null,

  // Q&A Initial state
  askQuestion: '',
  askAnswer: null,
  askCitations: [],
  isAsking: false,
  askError: null,

  uploadQueue: [],

  // Document sync
  documentSessionId: null,
  documentSyncDocumentId: null,
  isPresenter: false,
  isPresentationMode: false,
  syncScrollRatio: null,
  syncZoomScale: null,
  documentSyncError: null,
};

const clampSyncRatio = (position: number): number => Math.min(Math.max(position, 0), 1);

/**
 * Document store
 */
export const useDocumentStore = create<DocumentStoreState>()(
  immer((set, get) => {
    let documentSyncUnsubscribers: Array<() => void> = [];

    const clearDocumentSyncSubscriptions = () => {
      documentSyncUnsubscribers.forEach((unsubscribe) => unsubscribe());
      documentSyncUnsubscribers = [];
    };

    const ensureDocumentSyncSubscriptions = () => {
      if (documentSyncUnsubscribers.length > 0) {
        return;
      }

      documentSyncUnsubscribers = [
        documentWebSocketClient.subscribe('session:created', (session) => {
          const { user } = useGameStore.getState();
          documentWebSocketClient.joinSession(session.sessionId, user.id, true);

          set((state) => {
            state.documentSessionId = session.sessionId;
            state.documentSyncDocumentId = session.documentId;
            state.isPresenter = true;
            state.documentSyncError = null;
          });

          webSocketService.sendEvent({
            type: 'document/sync-session',
            data: {
              documentId: session.documentId,
              sessionId: session.sessionId,
              presenterId: session.presenter,
            },
          });
        }),
        documentWebSocketClient.subscribe('session:joined', ({ session }) => {
          if (!session) {
            return;
          }

          set((state) => {
            state.documentSessionId = session.sessionId;
            state.documentSyncDocumentId = session.documentId;
            state.currentPage = session.currentPage;
            state.syncScrollRatio = session.scrollPosition;
            state.syncZoomScale = session.zoom;
            state.documentSyncError = null;
          });
        }),
        documentWebSocketClient.subscribe('page:changed', ({ page }) => {
          get().handleIncomingSyncMessage('page:changed', { page });
        }),
        documentWebSocketClient.subscribe('scroll:synced', ({ position }) => {
          get().handleIncomingSyncMessage('scroll:synced', { position });
        }),
        documentWebSocketClient.subscribe('zoom:synced', ({ zoom }) => {
          get().handleIncomingSyncMessage('zoom:synced', { zoom });
        }),
        documentWebSocketClient.subscribe('error', ({ message, error }) => {
          set((state) => {
            state.documentSyncError = error ? `${message}: ${error}` : message;
          });
        }),
      ];
    };

    return {
    ...initialState,

    /**
     * Load documents with current filters
     */
    loadDocuments: async (force = false) => {
      set((state) => {
        state.isLoadingDocuments = true;
        state.documentsError = null;
      });

      try {
        const { filters, documentsAvailable, documentsUnavailableReason } =
          get();

        // If the document service is known to be unavailable, avoid spamming requests unless forced
        if (!force && !documentsAvailable && documentsUnavailableReason) {
          set((state) => {
            state.isLoadingDocuments = false;
            state.documentsError = documentsUnavailableReason;
          });
          return;
        }

        const response = await documentService.listDocuments(filters);

        set((state) => {
          state.documents = response.documents;
          state.totalDocuments = response.pagination.total;
          state.isLoadingDocuments = false;
          state.documentsAvailable = true;
          state.documentsUnavailableReason = null;
        });
      } catch (error) {
        console.error('Failed to load documents:', error);
        set((state) => {
          const message =
            error instanceof Error ? error.message : 'Failed to load documents';
          state.documentsError = message;
          // Flag the document service as unavailable when we detect it, so the UI can degrade gracefully
          if (
            message.includes('Document service unavailable') ||
            message.toLowerCase().includes('fetch failed') ||
            message.includes('ECONNREFUSED') ||
            message.includes('Request failed: 503')
          ) {
            state.documentsAvailable = false;
            state.documentsUnavailableReason = message;
          }
          state.isLoadingDocuments = false;
        });
      }
    },

    /**
     * Update filters and reload documents
     */
    setFilters: (newFilters: Partial<DocumentFilters>) => {
      set((state) => {
        state.filters = { ...state.filters, ...newFilters };
        // Reset to first page when filters change
        if (newFilters.search !== undefined || newFilters.type !== undefined || newFilters.campaign !== undefined || newFilters.tag !== undefined) {
          state.filters.skip = 0;
        }
      });
      get().loadDocuments();
    },

    /**
     * Reset filters to defaults
     */
    resetFilters: () => {
      set((state) => {
        state.filters = { ...defaultFilters };
      });
      get().loadDocuments();
    },

    /**
     * Search documents with full-text search
     */
    searchDocuments: async (query: string, filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[] }) => {
      set((state) => {
        state.isSearching = true;
        state.searchError = null;
        state.searchQuery = query;
      });

      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        const response = await documentService.searchDocuments({
          query,
          ...filters,
          from: 0,
          size: 20,
        });

        set((state) => {
          state.searchResults = response.results;
          state.isSearching = false;
          state.documentsAvailable = true;
          state.documentsUnavailableReason = null;
        });
      } catch (error) {
        console.error('Search failed:', error);
        set((state) => {
          const message = error instanceof Error ? error.message : 'Search failed';
          state.searchError = message;
          if (
            message.includes('Document service unavailable') ||
            message.toLowerCase().includes('fetch failed') ||
            message.includes('ECONNREFUSED') ||
            message.includes('Request failed: 503')
          ) {
            state.documentsAvailable = false;
            state.documentsUnavailableReason = message;
          }
          state.isSearching = false;
        });
      }
    },

    /**
     * Quick search for top results
     */
    quickSearch: async (query: string, campaign?: string) => {
      set((state) => {
        state.isSearching = true;
        state.searchError = null;
        state.searchQuery = query;
      });

      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        const response = await documentService.quickSearch(query, campaign, 5);

        set((state) => {
          state.quickSearchResults = response.results;
          state.isSearching = false;
          state.documentsAvailable = true;
          state.documentsUnavailableReason = null;
        });
      } catch (error) {
        console.error('Quick search failed:', error);
        set((state) => {
          const message =
            error instanceof Error ? error.message : 'Quick search failed';
          state.searchError = message;
          if (
            message.includes('Document service unavailable') ||
            message.toLowerCase().includes('fetch failed') ||
            message.includes('ECONNREFUSED') ||
            message.includes('Request failed: 503')
          ) {
            state.documentsAvailable = false;
            state.documentsUnavailableReason = message;
          }
          state.isSearching = false;
        });
      }
    },

    /**
     * Clear search results
     */
    clearSearch: () => {
      set((state) => {
        state.searchResults = [];
        state.quickSearchResults = [];
        state.searchQuery = '';
        state.searchError = null;
      });
    },

    /**
     * Ask the Codex a natural language question (Grounded RAG Q&A)
     */
    askCodexQuestion: async (question: string, filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[] }) => {
      set((state) => {
        state.isAsking = true;
        state.askError = null;
        state.askQuestion = question;
        state.askAnswer = null;
        state.askCitations = [];
      });

      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        const response = await documentService.ask(question, filters);

        set((state) => {
          state.askAnswer = response.answer;
          state.askCitations = response.citations;
          state.isAsking = false;
        });
      } catch (error) {
        console.error('Ask Q&A search failed:', error);
        set((state) => {
          const message = error instanceof Error ? error.message : 'Ask Q&A search failed';
          state.askError = message;
          if (
            message.includes('Document service unavailable') ||
            message.toLowerCase().includes('fetch failed') ||
            message.includes('ECONNREFUSED') ||
            message.includes('Request failed: 503')
          ) {
            state.documentsAvailable = false;
            state.documentsUnavailableReason = message;
          }
          state.isAsking = false;
        });
      }
    },

    /**
     * Clear active Ask Q&A query and results
     */
    clearAsk: () => {
      set((state) => {
        state.askQuestion = '';
        state.askAnswer = null;
        state.askCitations = [];
        state.askError = null;
        state.isAsking = false;
      });
    },

    /**
     * Open a document for viewing
     */
    openDocument: async (documentId: string, initialPage = 1) => {
      set((state) => {
        state.isLoadingDocument = true;
        state.currentPage = initialPage;
      });

      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        const document = await documentService.getDocument(documentId);
        const contentUrl = await documentService.getDocumentContentUrl(documentId);

        set((state) => {
          state.currentDocument = document;
          state.currentDocumentContent = contentUrl;
          state.currentPage = initialPage;
          state.isLoadingDocument = false;
        });
      } catch (error) {
        console.error('Failed to open document:', error);
        set((state) => {
          state.isLoadingDocument = false;
        });
        throw error;
      }
    },

    /**
     * Close the currently viewed document
     */
    closeDocument: () => {
      set((state) => {
        state.currentDocument = null;
        state.currentDocumentContent = null;
      });
    },

    /**
     * Upload a new document
     */
    uploadDocument: async (file: File, metadata) => {
      const { documentsAvailable, documentsUnavailableReason } = get();
      if (!documentsAvailable && documentsUnavailableReason) {
        throw new Error(documentsUnavailableReason);
      }

      // Add to upload queue
      set((state) => {
        state.uploadQueue.push({
          fileName: file.name,
          progress: 0,
          status: 'pending',
        });
      });

      try {
        // Update progress
        set((state) => {
          const upload = state.uploadQueue.find(u => u.fileName === file.name);
          if (upload) {
            upload.status = 'uploading';
            upload.progress = 10;
          }
        });

        // Create document and get upload URL
        const response = await documentService.createDocument({
          ...metadata,
          fileSize: file.size,
          fileName: file.name,
          format: file.type === 'application/pdf' ? 'pdf' : 'html',
        });

        set((state) => {
          const upload = state.uploadQueue.find(u => u.fileName === file.name);
          if (upload) {
            upload.documentId = response.document.id;
            upload.progress = 30;
          }
        });

        // Upload file to S3
        await documentService.uploadFile(response.uploadUrl, file);

        set((state) => {
          const upload = state.uploadQueue.find(u => u.fileName === file.name);
          if (upload) {
            upload.progress = 80;
            upload.status = 'processing';
          }
        });

        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mark as completed
        set((state) => {
          const upload = state.uploadQueue.find(u => u.fileName === file.name);
          if (upload) {
            upload.progress = 100;
            upload.status = 'completed';
          }
        });

        // Remove from queue after a delay
        setTimeout(() => {
          set((state) => {
            state.uploadQueue = state.uploadQueue.filter(u => u.fileName !== file.name);
          });
        }, 3000);

        // Reload documents
        get().loadDocuments();

        return response.document;
      } catch (error) {
        console.error('Upload failed:', error);

        set((state) => {
          const upload = state.uploadQueue.find(u => u.fileName === file.name);
          if (upload) {
            upload.status = 'error';
            upload.error = error instanceof Error ? error.message : 'Upload failed';
          }
        });

        throw error;
      }
    },

    /**
     * Update document metadata
     */
    updateDocument: async (documentId: string, updates: Partial<Document>) => {
      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        const updated = await documentService.updateDocument(documentId, updates);

        set((state) => {
          // Update in documents list
          const index = state.documents.findIndex(d => d.id === documentId);
          if (index !== -1) {
            state.documents[index] = updated;
          }

          // Update current document if it's open
          if (state.currentDocument?.id === documentId) {
            state.currentDocument = updated;
          }
        });
      } catch (error) {
        console.error('Failed to update document:', error);
        throw error;
      }
    },

    /**
     * Delete a document
     */
    deleteDocument: async (documentId: string) => {
      try {
        const { documentsAvailable, documentsUnavailableReason } = get();
        if (!documentsAvailable && documentsUnavailableReason) {
          throw new Error(documentsUnavailableReason);
        }

        await documentService.deleteDocument(documentId);

        set((state) => {
          // Remove from documents list
          state.documents = state.documents.filter(d => d.id !== documentId);
          state.totalDocuments--;

          // Close if currently open
          if (state.currentDocument?.id === documentId) {
            state.currentDocument = null;
            state.currentDocumentContent = null;
          }
        });
      } catch (error) {
        console.error('Failed to delete document:', error);
        throw error;
      }
    },
    setCurrentPage: (page: number) => {
      set((state) => {
        state.currentPage = page;
      });
    },

    loadStructuredDataForDocument: async (documentId: string) => {
      if (get().structuredEntities[documentId]) {
        return;
      }

      set((state) => {
        state.isLoadingStructuredData = true;
      });

      try {
        const data = await documentService.getDocumentStructuredData(documentId);
        set((state) => {
          state.structuredEntities[documentId] = data;
          state.isLoadingStructuredData = false;
        });
      } catch (error) {
        console.error(`Failed to load structured data for document ${documentId}:`, error);
        set((state) => {
          state.isLoadingStructuredData = false;
        });
      }
    },

    connectDocumentSync: async (documentId: string) => {
      const { user, session } = useGameStore.getState();
      if (!session?.roomCode || !user.id) {
        set((state) => {
          state.documentSyncError = 'Game session required for document sync';
        });
        return;
      }

      const currentState = get();
      if (
        currentState.documentSessionId &&
        currentState.documentSyncDocumentId === documentId &&
        currentState.isPresenter
      ) {
        return;
      }

      if (
        currentState.documentSessionId &&
        currentState.documentSyncDocumentId !== documentId
      ) {
        get().disconnectDocumentSync();
      }

      ensureDocumentSyncSubscriptions();

      try {
        const token = await documentService.getWsToken();
        await documentWebSocketClient.connect(token);

        set((state) => {
          state.documentSyncDocumentId = documentId;
          state.isPresenter = user.type === 'host';
          state.documentSyncError = null;
        });

        if (user.type === 'host') {
          documentWebSocketClient.createSession(
            documentId,
            session.campaignId || session.roomCode,
            session.roomCode,
            user.id,
            {
              syncPage: true,
              syncScroll: true,
              syncHighlight: true,
              syncZoom: true,
            },
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to connect document sync';
        set((state) => {
          state.documentSyncError = message;
        });
      }
    },

    joinDocumentSyncSession: async (
      documentId: string,
      sessionId: string,
      presenterId: string,
    ) => {
      const { user } = useGameStore.getState();
      if (!user.id || user.id === presenterId) {
        return;
      }

      ensureDocumentSyncSubscriptions();

      try {
        if (get().currentDocument?.id !== documentId) {
          await get().openDocument(documentId);
        }

        const token = await documentService.getWsToken();
        await documentWebSocketClient.connect(token);
        documentWebSocketClient.joinSession(sessionId, user.id);

        set((state) => {
          state.documentSessionId = sessionId;
          state.documentSyncDocumentId = documentId;
          state.isPresenter = false;
          state.isPresentationMode = false;
          state.documentSyncError = null;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to join document sync';
        set((state) => {
          state.documentSyncError = message;
        });
      }
    },

    disconnectDocumentSync: () => {
      documentWebSocketClient.disconnect();
      clearDocumentSyncSubscriptions();
      set((state) => {
        state.documentSessionId = null;
        state.documentSyncDocumentId = null;
        state.isPresenter = false;
        state.isPresentationMode = false;
        state.syncScrollRatio = null;
        state.syncZoomScale = null;
        state.documentSyncError = null;
      });
    },

    setPresentationMode: (enabled: boolean) => {
      const { documentSessionId, isPresenter } = get();
      set((state) => {
        state.isPresentationMode = enabled;
      });

      if (documentSessionId && isPresenter) {
        documentWebSocketClient.updateSettings({
          syncPage: enabled,
          syncScroll: enabled,
          syncZoom: enabled,
        });
      }
    },

    sendPageSync: (page: number) => {
      const { isPresenter, isPresentationMode, documentSessionId } = get();
      if (documentSessionId && isPresenter && isPresentationMode) {
        documentWebSocketClient.syncPage(page);
      }
    },

    sendScrollSync: (position: number) => {
      const { isPresenter, isPresentationMode, documentSessionId } = get();
      if (documentSessionId && isPresenter && isPresentationMode) {
        documentWebSocketClient.syncScroll(clampSyncRatio(position));
      }
    },

    sendZoomSync: (zoom: number) => {
      const { isPresenter, isPresentationMode, documentSessionId } = get();
      if (documentSessionId && isPresenter && isPresentationMode) {
        documentWebSocketClient.syncZoom(zoom);
      }
    },

    handleIncomingSyncMessage: (type, data) => {
      set((state) => {
        if (type === 'page:changed' && typeof data.page === 'number') {
          state.currentPage = data.page;
        }
        if (type === 'scroll:synced' && typeof data.position === 'number') {
          state.syncScrollRatio = clampSyncRatio(data.position);
        }
        if (type === 'zoom:synced' && typeof data.zoom === 'number') {
          state.syncZoomScale = data.zoom;
        }
      });
    },

    /**
     * Reset store to initial state
     */
    reset: () => {
      documentWebSocketClient.disconnect();
      clearDocumentSyncSubscriptions();
      set(initialState);
    },
  };
  })
);
