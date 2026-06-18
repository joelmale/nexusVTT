/**
 * DocumentViewer Component
 * Displays document content with PDF.js support
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useGameStore } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import { StatusBadge } from '@/components/Dashboard/atoms/StatusBadge';

import { PDFDocumentProxy } from 'pdfjs-dist';

interface VttDocumentSyncMessage {
  type: string;
  data?: {
    name?: string;
    documentId?: unknown;
    sessionId?: unknown;
    presenterId?: unknown;
  };
}

export const DocumentViewer: React.FC = () => {
  const {
    currentDocument,
    currentDocumentContent,
    isLoadingDocument,
    closeDocument,
    currentPage,
    setCurrentPage,
    documentSessionId,
    isPresenter,
    isPresentationMode,
    syncScrollRatio,
    syncZoomScale,
    documentSyncError,
    connectDocumentSync,
    joinDocumentSyncSession,
    disconnectDocumentSync,
    setPresentationMode,
    sendPageSync,
    sendScrollSync,
    sendZoomSync,
  } = useDocumentStore();
  const { user, session } = useGameStore();
  const isHost = user.type === 'host';
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const scrollThrottleRef = useRef<number | null>(null);
  const lastSyncedPageRef = useRef<number | null>(null);

  const handleCloseDocument = useCallback(() => {
    disconnectDocumentSync();
    closeDocument();
  }, [closeDocument, disconnectDocumentSync]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDocument();
      }
    };

    if (currentDocument) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentDocument, handleCloseDocument]);

  useEffect(() => {
    const handleVttMessage = (event: Event) => {
      const message = (event as CustomEvent<VttDocumentSyncMessage>).detail;
      const data = message?.data;
      if (
        user.type === 'host' ||
        data?.name !== 'document/sync-session' ||
        typeof data.documentId !== 'string' ||
        typeof data.sessionId !== 'string' ||
        typeof data.presenterId !== 'string'
      ) {
        return;
      }

      void joinDocumentSyncSession(data.documentId, data.sessionId, data.presenterId);
    };

    webSocketService.addEventListener('message', handleVttMessage);
    return () => webSocketService.removeEventListener('message', handleVttMessage);
  }, [joinDocumentSyncSession, user.type]);

  useEffect(() => {
    if (!currentDocument?.id || !isHost || !session?.roomCode) {
      return;
    }

    void connectDocumentSync(currentDocument.id);
  }, [connectDocumentSync, currentDocument?.id, isHost, session?.roomCode]);

  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current !== null) {
        window.clearTimeout(scrollThrottleRef.current);
      }
      disconnectDocumentSync();
    };
  }, [disconnectDocumentSync]);

  /**
   * Render a PDF page
   */
  const renderPage = useCallback(async (pdf: PDFDocumentProxy, pageNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Set canvas dimensions
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
  }, [scale]);

  // Load and render PDF
  useEffect(() => {
    if (!currentDocumentContent || currentDocument?.format !== 'pdf') {
      return;
    }

    const loadPdf = async () => {
      try {
        // Dynamically import PDF.js
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument(currentDocumentContent);
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        // First page will be rendered by the page change useEffect
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setError('Failed to load PDF document');
      }
    };

    loadPdf();

    return () => {
      pdfDocRef.current = null;
    };
  }, [currentDocumentContent, currentDocument]);

  // Render page when page number or scale changes
  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0 && currentPage <= totalPages) {
      renderPage(pdfDocRef.current, currentPage);
    }
  }, [currentPage, scale, totalPages, renderPage]);

  useEffect(() => {
    if (!isPresenter || !isPresentationMode || currentPage === lastSyncedPageRef.current) {
      return;
    }

    lastSyncedPageRef.current = currentPage;
    sendPageSync(currentPage);
  }, [currentPage, isPresentationMode, isPresenter, sendPageSync]);

  useEffect(() => {
    if (isPresenter || syncZoomScale === null || syncZoomScale === scale) {
      return;
    }

    setScale(Math.min(Math.max(syncZoomScale, 0.5), 3.0));
  }, [isPresenter, scale, syncZoomScale]);

  useEffect(() => {
    if (isPresenter || syncScrollRatio === null) {
      return;
    }

    const content = contentRef.current;
    if (!content) {
      return;
    }

    const maxScrollTop = Math.max(content.scrollHeight - content.clientHeight, 0);
    content.scrollTop = maxScrollTop * syncScrollRatio;
  }, [currentPage, isPresenter, syncScrollRatio, scale]);

  const handleViewerScroll = useCallback(() => {
    if (!isPresenter || !isPresentationMode) {
      return;
    }

    if (scrollThrottleRef.current !== null) {
      return;
    }

    scrollThrottleRef.current = window.setTimeout(() => {
      scrollThrottleRef.current = null;
      const content = contentRef.current;
      if (!content) {
        return;
      }

      const maxScrollTop = Math.max(content.scrollHeight - content.clientHeight, 0);
      const ratio = maxScrollTop > 0 ? content.scrollTop / maxScrollTop : 0;
      sendScrollSync(ratio);
    }, 50);
  }, [isPresentationMode, isPresenter, sendScrollSync]);

  /**
   * Navigate to previous page
   */
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  /**
   * Navigate to next page
   */
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  /**
   * Zoom in
   */
  const handleZoomIn = () => {
    const nextScale = Math.min(scale + 0.25, 3.0);
    setScale(nextScale);
    sendZoomSync(nextScale);
  };

  /**
   * Zoom out
   */
  const handleZoomOut = () => {
    const nextScale = Math.max(scale - 0.25, 0.5);
    setScale(nextScale);
    sendZoomSync(nextScale);
  };

  /**
   * Reset zoom
   */
  const handleZoomReset = () => {
    setScale(1.0);
    sendZoomSync(1.0);
  };

  if (!currentDocument) {
    return null;
  }

  return (
    <div className="document-viewer-overlay" onClick={handleCloseDocument}>
      <div className="document-viewer glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="document-viewer-header">
          <div className="document-viewer-title">
            <h2>{currentDocument.title}</h2>
            {currentDocument.description && (
              <p className="document-viewer-description">{currentDocument.description}</p>
            )}
          </div>
          <button className="document-viewer-close" onClick={handleCloseDocument} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Toolbar */}
        {currentDocument.format === 'pdf' && (
          <div className="document-viewer-toolbar">
            {/* Pagination */}
            <div className="toolbar-group">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="toolbar-btn"
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="toolbar-btn"
                aria-label="Next page"
              >
                →
              </button>
            </div>

            {/* Zoom */}
            <div className="toolbar-group">
              <button onClick={handleZoomOut} className="toolbar-btn" aria-label="Zoom out">
                −
              </button>
              <span className="zoom-indicator">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} className="toolbar-btn" aria-label="Zoom in">
                +
              </button>
              <button onClick={handleZoomReset} className="toolbar-btn" aria-label="Reset zoom">
                100%
              </button>
            </div>

            {/* GM presentation sync */}
            {isHost && (
              <div className="toolbar-group">
                <button
                  onClick={() => setPresentationMode(!isPresentationMode)}
                  className={`toolbar-btn ${isPresentationMode ? 'active' : ''}`}
                  aria-pressed={isPresentationMode}
                  disabled={!documentSessionId}
                >
                  {isPresentationMode ? 'Presentation Mode' : 'Sync View to Players'}
                </button>
              </div>
            )}

            {!isHost && documentSessionId && (
              <div className="toolbar-group">
                <StatusBadge status="success">Synced with Presenter</StatusBadge>
              </div>
            )}

            {documentSyncError && (
              <div className="toolbar-group">
                <StatusBadge status="warning">{documentSyncError}</StatusBadge>
              </div>
            )}

            {/* Download */}
            <div className="toolbar-group">
              <a
                href={currentDocumentContent || ''}
                download={`${currentDocument.title}.pdf`}
                className="toolbar-btn"
                aria-label="Download"
              >
                ⬇️ Download
              </a>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="document-viewer-content"
          onScroll={handleViewerScroll}
        >
          {isLoadingDocument ? (
            <div className="loading-state">
              <span className="loading-spinner"></span>
              <p>Loading document...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : currentDocument.format === 'pdf' ? (
            <div className="pdf-canvas-container">
              <canvas ref={canvasRef} className="pdf-canvas" />
            </div>
          ) : currentDocument.format === 'markdown' || currentDocument.format === 'html' ? (
            <iframe
              src={currentDocumentContent || ''}
              className="document-iframe"
              title={currentDocument.title}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="error-state">
              <span className="error-icon">⚠️</span>
              <p>Unsupported document format: {currentDocument.format}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="document-viewer-footer">
          <div className="document-meta">
            {currentDocument.author && (
              <span className="meta-item">📝 {currentDocument.author}</span>
            )}
            <span className="meta-item">
              📅 {new Date(currentDocument.uploadedAt).toLocaleDateString()}
            </span>
            <span className="meta-item">
              📦 {(currentDocument.fileSize / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          {currentDocument.tags.length > 0 && (
            <div className="document-tags">
              {currentDocument.tags.map((tag) => (
                <span key={tag} className="document-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
