/**
 * DocumentsPanel Component
 * In-game quick reference panel for accessing documents during gameplay
 */

import React, { useEffect, useState, Suspense } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useGameStore } from '@/stores/gameStore';
import { DocumentType } from '@/services/documentService';
import { EntityStatCard } from './Dashboard/molecules/EntityStatCard';
import { mapSrdEntity } from '@/utils/srdEntity';

// Lazy load DocumentViewer (includes PDF.js)
const DocumentViewer = React.lazy(() =>
  import('./DocumentViewer').then((module) => ({
    default: module.DocumentViewer,
  })),
);

/**
 * Document type icons for compact display
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

export const DocumentsPanel: React.FC = () => {
  const {
    documents,
    isLoadingDocuments,
    quickSearchResults,
    isSearching,
    loadDocuments,
    setFilters,
    quickSearch,
    clearSearch,
    openDocument,
    structuredEntities,
    loadStructuredDataForDocument,
  } = useDocumentStore();

  const { session } = useGameStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);

  // Load documents for current campaign on mount
  useEffect(() => {
    if (session?.campaignId) {
      setFilters({ campaign: session.campaignId });
    }
    loadDocuments();
  }, [session?.campaignId, loadDocuments, setFilters]);

  /**
   * Handle search input with debounce
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length >= 2) {
      quickSearch(query, session?.campaignId);
    } else {
      clearSearch();
    }
  };

  /**
   * Handle type filter
   */
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as DocumentType | '';
    setSelectedType(type);
    setFilters({ type: type || undefined });
  };

  /**
   * Handle document click
   */
  const handleDocumentClick = async (documentId: string) => {
    try {
      const doc = documents.find(d => d?.id === documentId) || 
                  quickSearchResults.find(r => r.documentId === documentId);
      
      if (doc?.type === 'srd_content') {
        if (expandedDocumentId === documentId) {
          setExpandedDocumentId(null);
        } else {
          setExpandedDocumentId(documentId);
          loadStructuredDataForDocument(documentId);
        }
      } else {
        await openDocument(documentId);
      }
    } catch (error) {
      console.error('Failed to open document:', error);
    }
  };

  /**
   * Clear search
   */
  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
  };

  // Show search results if searching, otherwise show filtered documents
  const displayDocuments = searchQuery.trim().length >= 2
    ? quickSearchResults.map(result => documents.find(d => d.id === result.documentId)).filter(Boolean)
    : documents;

  return (
    <div className="documents-panel">
      <div className="documents-panel-header">
        <h3>📚 Documents</h3>
        <p className="panel-description">Quick reference for your campaign</p>
      </div>

      {/* Search Bar */}
      <div className="documents-search">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="🔍 Search rulebooks, handouts..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="search-clear-btn"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Type Filter */}
      <div className="documents-filter">
        <select
          value={selectedType}
          onChange={handleTypeChange}
          className="type-filter-select"
        >
          <option value="">All Types</option>
          <option value="rulebook">📕 Rulebooks</option>
          <option value="handout">📄 Handouts</option>
          <option value="campaign_note">📝 Campaign Notes</option>
          <option value="map">🗺️ Maps</option>
          <option value="character_sheet">⚔️ Character Sheets</option>
          <option value="homebrew">🔮 Homebrew</option>
        </select>
      </div>

      {/* Quick Search Results */}
      {searchQuery.trim().length >= 2 && quickSearchResults.length > 0 && (
        <div className="quick-results">
          <div className="quick-results-header">
            <span>Quick Results</span>
            <span className="result-count">{quickSearchResults.length}</span>
          </div>
          {quickSearchResults.map((result) => {
            const isExpanded = expandedDocumentId === result.documentId;
            return (
              <div key={result.documentId} className="flex flex-col w-full">
                <div
                  className={`quick-result-item ${isExpanded ? 'active bg-[#1c1e22] border-l-2 border-amber-500' : ''}`}
                  onClick={() => handleDocumentClick(result.documentId)}
                >
                  <div className="result-icon">{DOCUMENT_TYPE_ICONS[result.type]}</div>
                  <div className="result-content">
                    <div className="result-title">{result.title}</div>
                    {result.snippet && (
                      <div className="result-snippet">{result.snippet}</div>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="p-2.5 border-t border-[#8c6b4a]/20 bg-[#1c1e22]/50 w-full overflow-hidden">
                    {(() => {
                      const entities = structuredEntities[result.documentId] || [];
                      const relevant = entities.find(e => e.type === 'spell' || e.type === 'monster');
                      
                      const mapped = relevant
                        ? mapSrdEntity(relevant.type, relevant.data)
                        : null;
                      if (relevant && mapped) {
                        return (
                          <EntityStatCard
                            type={relevant.type as 'spell' | 'monster'}
                            data={mapped}
                            className="w-full !max-w-full"
                          />
                        );
                      }
                      return (
                        <div className="text-[10px] font-serif italic text-amber-500 animate-pulse p-2">
                          Reading archives transcripts...
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document List */}
      <div className="documents-list">
        {isLoadingDocuments || isSearching ? (
          <div className="panel-loading">
            <span className="loading-spinner"></span>
            <p>Loading...</p>
          </div>
        ) : displayDocuments.length === 0 ? (
          <div className="panel-empty">
            <div className="empty-icon">📚</div>
            <p>
              {searchQuery.trim().length >= 2
                ? 'No documents found'
                : 'No documents available'}
            </p>
            <p className="empty-hint">
              Upload documents from the Dashboard
            </p>
          </div>
        ) : (
          displayDocuments.map((document) => {
            const isExpanded = expandedDocumentId === document!.id;
            return (
              <div key={document!.id} className="flex flex-col w-full">
                <div
                  className={`document-list-item ${isExpanded ? 'active bg-[#1c1e22] border-l-2 border-amber-500' : ''}`}
                  onClick={() => handleDocumentClick(document!.id)}
                >
                  <div className="document-icon">
                    {DOCUMENT_TYPE_ICONS[document!.type]}
                  </div>
                  <div className="document-info">
                    <div className="document-title">{document!.title}</div>
                    {document!.description && (
                      <div className="document-desc">{document!.description}</div>
                    )}
                    {document!.tags.length > 0 && (
                      <div className="document-tags-compact">
                        {document!.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="tag-compact">
                            {tag}
                          </span>
                        ))}
                        {document!.tags.length > 2 && (
                          <span className="tag-compact">+{document!.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="p-2.5 border-t border-[#8c6b4a]/20 bg-[#1c1e22]/50 w-full overflow-hidden">
                    {(() => {
                      const entities = structuredEntities[document!.id] || [];
                      const relevant = entities.find(e => e.type === 'spell' || e.type === 'monster');
                      
                      const mapped = relevant
                        ? mapSrdEntity(relevant.type, relevant.data)
                        : null;
                      if (relevant && mapped) {
                        return (
                          <EntityStatCard
                            type={relevant.type as 'spell' | 'monster'}
                            data={mapped}
                            className="w-full !max-w-full"
                          />
                        );
                      }
                      return (
                        <div className="text-[10px] font-serif italic text-amber-500 animate-pulse p-2">
                          Reading archives transcripts...
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Info */}
      {!isLoadingDocuments && displayDocuments.length > 0 && (
        <div className="documents-pagination">
          <span className="pagination-text">
            {displayDocuments.length} document{displayDocuments.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Document Viewer */}
      <Suspense fallback={<div className="document-loading">Loading document...</div>}>
        <DocumentViewer />
      </Suspense>
    </div>
  );
};
