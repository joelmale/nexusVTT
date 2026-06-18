/**
 * DocumentLibrary Component
 * Displays document library in the Dashboard with search, filtering, and upload
 */

import React, { useEffect, useState, useRef } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { DocumentType } from '@/services/documentService';
import { DocumentViewer } from './DocumentViewer';

/**
 * Document type display names
 */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rulebook: '📕 Rulebook',
  campaign_note: '📝 Campaign Note',
  handout: '📄 Handout',
  map: '🗺️ Map',
  character_sheet: '⚔️ Character Sheet',
  homebrew: '🔮 Homebrew',
  srd_content: '🔮 SRD Content',
};

/**
 * Document type icons
 */
const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  rulebook: '📕',
  campaign_note: '📝',
  handout: '📄',
  map: '🗺️',
  character_sheet: '⚔️',
  homebrew: '🔮',
  srd_content: '🔮',
};

export const DocumentLibrary: React.FC = () => {
  const {
    documents,
    totalDocuments,
    filters,
    isLoadingDocuments,
    documentsError,
    documentsAvailable,
    documentsUnavailableReason,
    uploadQueue,
    loadDocuments,
    setFilters,
    resetFilters,
    openDocument,
    uploadDocument,
    deleteDocument,
  } = useDocumentStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('rulebook');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /**
   * Handle search input
   */
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value || undefined });
  };

  /**
   * Handle type filter
   */
  const handleTypeFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ type: (e.target.value || undefined) as DocumentType | undefined });
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Auto-fill title from filename
      if (!uploadTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
    }
  };

  /**
   * Handle upload submission
   */
  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file');
      return;
    }

    if (!uploadTitle.trim()) {
      setUploadError('Please enter a title');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await uploadDocument(uploadFile, {
        title: uploadTitle.trim(),
        description: uploadDescription.trim() || undefined,
        type: uploadType,
        tags: uploadTags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      });

      // Close modal and reset form
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadTags('');
      setUploadType('rulebook');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle document click
   */
  const handleDocumentClick = async (documentId: string) => {
    try {
      await openDocument(documentId);
      // TODO: Open document viewer modal
      console.log('Document opened:', documentId);
    } catch (error) {
      console.error('Failed to open document:', error);
    }
  };

  /**
   * Handle document delete
   */
  const handleDelete = async (documentId: string, documentTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${documentTitle}"?`)) {
      return;
    }

    try {
      await deleteDocument(documentId);
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    }
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="dashboard-section">
      <div className="section-header document-section-header">
        <h2>📚 Document Library</h2>
        <div className="section-actions document-header-actions">
          <button
            onClick={() => setShowUploadModal(true)}
            className="action-btn glass-button primary document-upload-button"
            disabled={isLoadingDocuments || !documentsAvailable}
          >
            <span>⬆️</span>
            Upload Document
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="document-filters glass-panel">
        <div className="filter-row">
          <input
            type="text"
            placeholder="🔍 Search documents..."
            value={filters.search || ''}
            onChange={handleSearch}
            className="filter-input"
          />
          <select value={filters.type || ''} onChange={handleTypeFilter} className="filter-select">
            <option value="">All Types</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button onClick={resetFilters} className="action-btn glass-button secondary small">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="upload-queue glass-panel">
          {uploadQueue.map((upload, index) => (
            <div key={index} className="upload-item">
              <div className="upload-info">
                <span className="upload-filename">{upload.fileName}</span>
                <span className="upload-status">{upload.status}</span>
              </div>
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-fill"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              {upload.error && <div className="upload-error">{upload.error}</div>}
            </div>
          ))}
        </div>
      )}

      {!documentsAvailable && (
        <div className="empty-state glass-panel">
          <div className="empty-state-icon">📕</div>
          <h3>Document service is offline</h3>
          <p>
            {documentsUnavailableReason ||
              'Start NexusCodex (doc-api/doc-websocket) or set DOC_API_URL to enable the library.'}
          </p>
          <button
            onClick={() => loadDocuments(true)}
            className="action-btn glass-button primary"
            disabled={isLoadingDocuments}
          >
            Retry connection
          </button>
        </div>
      )}

      {/* Error Message */}
      {documentsError && (
        <div className="error-message glass-panel error">
          <span className="error-icon">⚠️</span>
          {documentsError}
        </div>
      )}

      {/* Documents Grid */}
      {documentsAvailable && (isLoadingDocuments ? (
        <div className="loading-state">
          <span className="loading-spinner"></span>
          <p>Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-state-icon">📚</div>
          <h3>No documents yet</h3>
          <p>Upload rulebooks, handouts, and other documents for your campaigns!</p>
          <button onClick={() => setShowUploadModal(true)} className="action-btn glass-button primary">
            <span>⬆️</span>
            Upload Document
          </button>
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            {documents.map((document) => (
              <div
                key={document.id}
                className="document-card glass-panel"
                onClick={() => handleDocumentClick(document.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="document-card-header">
                  <div className="document-type-icon">
                    {DOCUMENT_TYPE_ICONS[document.type]}
                  </div>
                  <h3>{document.title}</h3>
                </div>
                {document.description && (
                  <p className="document-description">{document.description}</p>
                )}
                <div className="document-meta">
                  <span className="document-type">{DOCUMENT_TYPE_LABELS[document.type]}</span>
                  <span className="document-size">{formatFileSize(document.fileSize)}</span>
                </div>
                {document.tags.length > 0 && (
                  <div className="document-tags">
                    {document.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="document-tag">
                        {tag}
                      </span>
                    ))}
                    {document.tags.length > 3 && (
                      <span className="document-tag">+{document.tags.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="document-actions">
                  <button
                    className="action-btn glass-button secondary small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(document.id, document.title);
                    }}
                  >
                    <span>🗑️</span>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {totalDocuments > filters.limit && (
            <div className="pagination">
              <button
                onClick={() => setFilters({ skip: Math.max(0, filters.skip - filters.limit) })}
                disabled={filters.skip === 0}
                className="action-btn glass-button secondary small"
              >
                Previous
              </button>
              <span className="pagination-info">
                Showing {filters.skip + 1} - {Math.min(filters.skip + filters.limit, totalDocuments)} of {totalDocuments}
              </span>
              <button
                onClick={() => setFilters({ skip: filters.skip + filters.limit })}
                disabled={filters.skip + filters.limit >= totalDocuments}
                className="action-btn glass-button secondary small"
              >
                Next
              </button>
            </div>
          )}
        </>
      ))}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button
                className="modal-close"
                onClick={() => setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.html"
                  onChange={handleFileSelect}
                  className="file-input"
                />
                {uploadFile && (
                  <div className="file-preview">
                    📄 {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Document description"
                  className="text-input"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as DocumentType)}
                  className="select-input"
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tags (comma-separated, optional)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="D&D 5e, Magic Items, Spells"
                  className="text-input"
                />
              </div>

              {uploadError && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {uploadError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowUploadModal(false)}
                className="action-btn glass-button secondary"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="action-btn glass-button primary"
                disabled={uploading || !uploadFile}
              >
                {uploading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span>⬆️</span>
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer */}
      <DocumentViewer />
    </div>
  );
};
