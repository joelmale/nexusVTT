import React, { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocumentStore } from '@/stores/documentStore';
import { SearchInput } from '../molecules/SearchInput';
import { GothicHeader } from '../atoms/Typography';
import { DocumentType, AskSearchCitation } from '@/services/documentService';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Filter from 'lucide-react/dist/esm/icons/filter';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Send from 'lucide-react/dist/esm/icons/send';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import { ChatBubble } from '../molecules/ChatBubble';
import { EntityStatCard } from '../molecules/EntityStatCard';
import { mapSrdEntity } from '@/utils/srdEntity';

interface DocumentSidebarProps {
  className?: string;
}

interface ChatMessage {
  sender: 'user' | 'codex';
  text: string;
  citations?: AskSearchCitation[];
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const getDocTypeIcon = (type: DocumentType): string => {
  switch (type) {
    case 'rulebook':
      return '📕';
    case 'campaign_note':
      return '📝';
    case 'handout':
      return '📄';
    case 'map':
      return '🗺️';
    case 'character_sheet':
      return '⚔️';
    case 'homebrew':
      return '🔮';
    case 'srd_content':
      return '🔮';
    default:
      return '📄';
  }
};

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  className = '',
}) => {
  // Narrow selector: the old `useDocumentStore()` (no selector) subscribed
  // to the whole store, re-rendering on every unrelated set().
  const {
    documents,
    filters,
    isLoadingDocuments,
    documentsAvailable,
    documentsUnavailableReason,
    loadDocuments,
    setFilters,
    openDocument,
    askQuestion,
    askAnswer,
    askCitations,
    isAsking,
    askError,
    askCodexQuestion,
    clearAsk,
    structuredEntities,
    loadStructuredDataForDocument,
  } = useDocumentStore(
    useShallow((state) => ({
      documents: state.documents,
      filters: state.filters,
      isLoadingDocuments: state.isLoadingDocuments,
      documentsAvailable: state.documentsAvailable,
      documentsUnavailableReason: state.documentsUnavailableReason,
      loadDocuments: state.loadDocuments,
      setFilters: state.setFilters,
      openDocument: state.openDocument,
      askQuestion: state.askQuestion,
      askAnswer: state.askAnswer,
      askCitations: state.askCitations,
      isAsking: state.isAsking,
      askError: state.askError,
      askCodexQuestion: state.askCodexQuestion,
      clearAsk: state.clearAsk,
      structuredEntities: state.structuredEntities,
      loadStructuredDataForDocument: state.loadStructuredDataForDocument,
    })),
  );

  const [activeTab, setActiveTab] = useState<'library' | 'ask'>('ask');
  const [searchVal, setSearchVal] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [askInputVal, setAskInputVal] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedEntityDocId, setSelectedEntityDocId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Scroll chat history to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  // Sync Ask answers from Zustand store into local chat history
  useEffect(() => {
    if (askQuestion && !isAsking) {
      // Intentional store→local sync: mirror the latest Ask result from the
      // Zustand store into local chat history. The updater is idempotent (guards
      // against duplicate appends), so the cascading-render concern doesn't apply.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatHistory((prev) => {
        // Prevent duplicate appends if we already registered the latest question and reply
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.sender === 'codex' && prev[prev.length - 2]?.text === askQuestion) {
          return prev;
        }

        const newHistory = [...prev];
        const hasUserQuery = prev.some(
          (m) => m.sender === 'user' && m.text === askQuestion
        );

        if (!hasUserQuery) {
          newHistory.push({ sender: 'user', text: askQuestion });
        }

        if (askAnswer) {
          const citations = askCitations || [];
          newHistory.push({
            sender: 'codex',
            text: askAnswer,
            citations: citations,
          });
          // Cache structured data for SRD citations automatically
          citations.forEach((cit) => {
            loadStructuredDataForDocument(cit.documentId);
          });
        } else if (askError) {
          newHistory.push({
            sender: 'codex',
            text: `⚠️ Error consulting archives: ${askError}`,
          });
        }

        return newHistory;
      });
    }
  }, [askQuestion, askAnswer, askError, isAsking, askCitations, loadStructuredDataForDocument]);

  // Handle document keyword search
  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    setFilters({ search: val || undefined });
  };

  // Handle document click to open viewer overlay
  const handleDocumentClick = async (documentId: string, initialPage = 1) => {
    try {
      const doc = documents.find((d) => d.id === documentId);
      if (doc?.type === 'srd_content') {
        setSelectedEntityDocId(documentId);
        loadStructuredDataForDocument(documentId);
      } else {
        await openDocument(documentId, initialPage);
      }
    } catch (err) {
      console.error('Failed to open document:', err);
    }
  };

  // Helper to render entity cards below chat messages
  const renderCitationsEntities = (message: ChatMessage) => {
    if (!message.citations) return null;

    return message.citations.map((cit) => {
      const entities = structuredEntities[cit.documentId] || [];
      const relevantEntities = entities.filter(
        (ent) => ent.type === 'spell' || ent.type === 'monster'
      );

      if (relevantEntities.length === 0) return null;

      return (
        <div key={cit.chunkId} className="mt-2 flex flex-col gap-2 w-full">
          {relevantEntities.map((ent) => {
            const mappedData = mapSrdEntity(ent.type, ent.data);
            if (!mappedData) return null;
            return (
              <EntityStatCard
                key={ent.id}
                type={ent.type as 'spell' | 'monster'}
                data={mappedData}
                className="w-full !max-w-full border border-[#8c6b4a]/30 shadow-md"
              />
            );
          })}
        </div>
      );
    });
  };

  // Handle submitting Q&A question
  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = askInputVal.trim();
    if (!query || isAsking) return;

    setChatHistory((prev) => [...prev, { sender: 'user', text: query }]);
    setAskInputVal('');
    askCodexQuestion(query);
  };

  // Clear chat log
  const handleClearChat = () => {
    setChatHistory([]);
    clearAsk();
  };

  // Trigger quick prompt helper
  const handleQuickAsk = (prompt: string) => {
    if (isAsking) return;
    setChatHistory((prev) => [...prev, { sender: 'user', text: prompt }]);
    askCodexQuestion(prompt);
  };

  // Simple list: the most recent documents only.
  const displayedDocs = documents.slice(0, 12);

  return (
    <aside
      className={`
        relative flex flex-col p-5 rounded-sm bg-[#252a31] border border-[#8c6b4a]/40 shadow-2xl h-full min-h-[36rem] gap-4
        ${className}
      `}
    >
      <GothicHeader level={3} variant="medieval" className="flex items-center gap-2 border-b border-[#8c6b4a]/30 pb-3">
        <BookOpen size={18} className="text-amber-500" />
        Document Library
      </GothicHeader>

      {/* Tab bar selector */}
      <div className="flex border-b border-[#8c6b4a]/20">
        <button
          onClick={() => setActiveTab('ask')}
          className={`unstyled 
            flex-1 py-2 font-['Oswald',sans-serif] text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 cursor-pointer
            ${activeTab === 'ask'
              ? 'text-amber-400 border-amber-600'
              : 'text-[#c4b7a4]/75 border-transparent hover:text-[#c4b7a4]'}
          `}
        >
          🔮 Ask Codex
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`unstyled 
            flex-1 py-2 font-['Oswald',sans-serif] text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 cursor-pointer
            ${activeTab === 'library'
              ? 'text-amber-400 border-amber-600'
              : 'text-[#c4b7a4]/75 border-transparent hover:text-[#c4b7a4]'}
          `}
        >
          📚 Library
        </button>
      </div>

      {/* Offline notice: static and calm, with a way to retry */}
      {!documentsAvailable && (
        <div
          role="status"
          className="
            flex items-center gap-2.5 p-3 rounded-sm
            bg-amber-900/30 border border-amber-600/50 text-amber-200
          "
        >
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
          <span className="flex-1 font-['Oswald',sans-serif] font-bold text-xs uppercase tracking-wider">
            {documentsUnavailableReason?.includes('ECONNREFUSED') ||
            documentsUnavailableReason?.includes('503')
              ? 'NexusCodex offline'
              : 'Document service offline'}
          </span>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            className="unstyled px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wider text-amber-100 border border-amber-500/60 hover:bg-amber-700/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Retry
          </button>
        </div>
      )}

      {/* TAB CONTENT: LIBRARY */}
      {activeTab === 'library' && (
        <>
          {/* Search & Filter Bar */}
          <div className="flex gap-2">
            <SearchInput
              value={searchVal}
              onChange={handleSearchChange}
              placeholder="Search library..."
            />
            <button
              onClick={() => setShowFilter(!showFilter)}
              type="button"
              className={`unstyled 
                p-2 rounded-sm bg-[#1c1e22] text-[#f1e6d3] border transition-all duration-200 cursor-pointer
                ${showFilter ? 'border-[#d97706] shadow-vtt-amber-glow' : 'border-[#8c6b4a]/40'}
                hover:border-[#d97706]
              `}
              title="Filter documents"
            >
              <Filter size={14} />
            </button>
          </div>

          {/* Type Filter Panel */}
          {showFilter && (
            <div className="p-3 rounded-sm bg-[#1b1e22] border border-[#8c6b4a]/40 flex flex-col gap-2">
              <span className="font-['Oswald',sans-serif] text-[11px] font-bold tracking-widest uppercase text-amber-500">
                Filter by Type
              </span>
              <select
                value={filters.type || ''}
                onChange={(e) =>
                  setFilters({
                    type: (e.target.value || undefined) as DocumentType,
                  })
                }
                className="w-full p-1.5 rounded-sm bg-[#252a31] border border-[#8c6b4a]/40 text-[#f1e6d3] text-xs font-serif"
              >
                <option value="">All Document Types</option>
                <option value="rulebook">📕 Rulebook</option>
                <option value="campaign_note">📝 Campaign Note</option>
                <option value="handout">📄 Handout</option>
                <option value="map">🗺️ Map</option>
                <option value="character_sheet">⚔️ Character Sheet</option>
                <option value="homebrew">🔮 Homebrew</option>
              </select>
            </div>
          )}

          {/* Document list */}
          <div className="relative flex-1 min-h-[22rem] overflow-y-auto rounded-sm bg-[#1c1e22]/50 border border-[#8c6b4a]/20">
            {isLoadingDocuments ? (
              <div className="flex flex-col items-center justify-center gap-2 h-full p-6">
                <RefreshCw size={24} className="motion-safe:animate-spin text-amber-500" />
                <span className="font-['Oswald',sans-serif] text-[11px] font-bold tracking-widest text-[#c4b7a4]/75 uppercase">
                  Reading Scrolls...
                </span>
              </div>
            ) : displayedDocs.length === 0 ? (
              <p className="p-6 text-center text-xs font-serif italic text-[#c4b7a4]/75">
                No documents yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#8c6b4a]/20">
                {displayedDocs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => handleDocumentClick(doc.id)}
                      className="unstyled 
                        flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer
                        text-[#cbd5e1] hover:bg-[#252a31] hover:text-amber-400
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset
                      "
                    >
                      <span className="text-sm shrink-0" aria-hidden="true">
                        {getDocTypeIcon(doc.type)}
                      </span>
                      <span className="flex-1 min-w-0 font-serif text-xs font-bold text-[#f1e6d3] truncate">
                        {doc.title}
                      </span>
                      <span className="font-['Oswald',sans-serif] text-[11px] tracking-wider text-[#c4b7a4]/75 uppercase shrink-0">
                        {doc.type.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-[#c4b7a4]/75 font-mono shrink-0">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* TAB CONTENT: ASK THE CODEX */}
      {activeTab === 'ask' && (
        <div className="flex-1 flex flex-col min-h-[22rem] gap-3">
          {/* Chat history pane */}
          <div className="flex-1 overflow-y-auto max-h-[20rem] p-3 rounded-sm bg-[#1c1e22]/60 border border-[#8c6b4a]/25 flex flex-col gap-3 font-serif text-sm">
            {chatHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[#c4b7a4]/75">
                <Sparkles size={28} className="text-amber-500/40 mb-2" />
                <span className="font-['Cinzel',serif] text-xs font-bold text-amber-500/70 mb-1">
                  Ask the Great Library
                </span>
                <p className="text-xs leading-relaxed max-w-[180px]">
                  Submit questions regarding rules, spells, or monsters to retrieve grounded answers with citations.
                </p>

                {/* Quick ask buttons */}
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[180px]">
                  <button
                    onClick={() => handleQuickAsk('What is the casting time of Fireball?')}
                    className="unstyled text-[11px] font-['Oswald',sans-serif] tracking-wider uppercase bg-[#252a31] hover:bg-[#2e343d] border border-[#8c6b4a]/40 text-[#c4b7a4] py-1 px-2 rounded-sm text-left transition-colors"
                  >
                    ☄️ Fireball casting time?
                  </button>
                  <button
                    onClick={() => handleQuickAsk('Tell me about the creature known as a Lich.')}
                    className="unstyled text-[11px] font-['Oswald',sans-serif] tracking-wider uppercase bg-[#252a31] hover:bg-[#2e343d] border border-[#8c6b4a]/40 text-[#c4b7a4] py-1 px-2 rounded-sm text-left transition-colors"
                  >
                    💀 What is a Lich?
                  </button>
                </div>
              </div>
            ) : (
              chatHistory.map((msg, index) => (
                <React.Fragment key={index}>
                  <ChatBubble
                    sender={msg.sender}
                    message={msg.text}
                    citations={msg.citations?.map((cit) => ({
                      id: cit.documentId,
                      documentName: cit.title,
                      pageNumber: cit.pageStart,
                      excerpt: undefined,
                    }))}
                    onCitationClick={(docId, pageNum) => handleDocumentClick(docId, pageNum)}
                  />
                  {msg.sender === 'codex' && renderCitationsEntities(msg)}
                </React.Fragment>
              ))
            )}

            {isAsking && (
              <div className="self-start flex items-center gap-2 max-w-[85%]">
                <div className="bg-[#252a31] border border-[#8c6b4a]/30 p-2.5 rounded-sm rounded-tl-none flex items-center gap-2 text-xs text-[#cbd5e1]/70 animate-pulse">
                  <Sparkles size={12} className="text-amber-500 animate-spin" />
                  <span>Consulting scrolls...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleAskSubmit} className="flex gap-2">
            <input
              type="text"
              value={askInputVal}
              onChange={(e) => setAskInputVal(e.target.value)}
              placeholder="Ask the Codex..."
              disabled={isAsking || !documentsAvailable}
              className="
                flex-1 px-3 py-2 text-xs bg-[#1c1e22] text-[#f1e6d3] border border-[#8c6b4a]/40 rounded-sm
                focus:outline-none focus:border-amber-600 transition-colors placeholder:text-[#c4b7a4]/30
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <button
              type="submit"
              disabled={isAsking || !askInputVal.trim() || !documentsAvailable}
              className="unstyled 
                p-2 rounded-sm bg-[#31231c]/70 hover:bg-[#3d2e26] text-amber-400 border border-[#8c6b4a]/50
                flex items-center justify-center transition-colors cursor-pointer
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              <Send size={12} />
            </button>
            {chatHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="unstyled 
                  p-2 rounded-sm bg-[#1c1e22] hover:bg-[#25282d] text-[#c4b7a4]/75 border border-[#8c6b4a]/40
                  flex items-center justify-center transition-colors cursor-pointer
                "
                title="Clear archives log"
              >
                <Trash2 size={12} />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Structured Entity Modal */}
      {selectedEntityDocId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedEntityDocId(null)}
        >
          <div 
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-sm border border-[#8c6b4a]/50 shadow-2xl animate-[fadeIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedEntityDocId(null)}
              className="unstyled absolute top-3 right-3 text-[#2C1E16]/75 hover:text-[#2C1E16] z-10 font-bold text-sm bg-[#8c6b4a]/10 hover:bg-[#8c6b4a]/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
            {(() => {
              const entities = structuredEntities[selectedEntityDocId] || [];
              const relevant = entities.find(e => e.type === 'spell' || e.type === 'monster');
              const doc = documents.find(d => d.id === selectedEntityDocId);
              
              const mapped = relevant
                ? mapSrdEntity(relevant.type, relevant.data)
                : null;
              if (relevant && mapped) {
                return (
                  <EntityStatCard
                    type={relevant.type as 'spell' | 'monster'}
                    data={mapped}
                    className="w-full border-none shadow-none"
                  />
                );
              }
              
              return (
                <div className="bg-[#FDFBF7] text-[#2C1E16] p-6 font-serif border border-[#8c6b4a]/50 rounded-sm">
                  <h3 className="font-['Cinzel',serif] text-lg font-bold mb-2">
                    {doc?.title || 'Loading Archives...'}
                  </h3>
                  <div className="text-xs leading-relaxed opacity-80 animate-pulse">
                    Consulting library transcripts...
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </aside>
  );
};
