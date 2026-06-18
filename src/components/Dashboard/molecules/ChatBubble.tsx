import React from 'react';
import { ParchmentPanel } from '../atoms/ParchmentPanel';
import { SectionDivider } from '../atoms/SectionDivider';

export interface ChatCitation {
  id: string;
  documentName: string;
  pageNumber: number;
  excerpt?: string;
}

interface ChatBubbleProps {
  sender: 'user' | 'codex';
  message: string;
  timestamp?: string;
  citations?: ChatCitation[];
  onCitationClick?: (documentId: string, pageNumber: number) => void;
  className?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  sender,
  message,
  timestamp,
  citations = [],
  onCitationClick,
  className = '',
}) => {
  const isCodex = sender === 'codex';

  return (
    <div
      className={`flex flex-col w-full my-2.5 ${
        isCodex ? 'items-start' : 'items-end'
      } ${className}`}
    >
      <div className={`max-w-[85%] sm:max-w-[75%] shadow-sm rounded-md overflow-hidden`}>
        <ParchmentPanel
          variant={isCodex ? 'vellum' : 'ivory'}
          className={`!p-4 border ${
            isCodex
              ? 'border-[#8c6b4a]/40 rounded-tl-none shadow-md'
              : 'border-amber-900/20 rounded-tr-none'
          }`}
        >
          {/* Header metadata */}
          <div className="flex justify-between items-center gap-4 mb-1.5 select-none">
            <span
              className={`font-['Oswald',sans-serif] text-[10px] font-bold uppercase tracking-wider ${
                isCodex ? 'text-amber-800' : 'text-emerald-800'
              }`}
            >
              {isCodex ? '🔮 Codex Assistant' : '👤 DM Explorer'}
            </span>
            {timestamp && (
              <span className="font-mono text-[9px] text-[#2C1E16]/40">{timestamp}</span>
            )}
          </div>

          {/* Message content */}
          <div className="text-xs font-serif leading-relaxed text-[#2C1E16] whitespace-pre-wrap selection:bg-amber-100">
            {message}
          </div>

          {/* Citations section */}
          {isCodex && citations.length > 0 && (
            <>
              <SectionDivider className="!my-2" />
              <div className="mt-1.5">
                <span className="font-sans text-[8px] font-bold uppercase tracking-wider text-[#2C1E16]/50 block mb-1 select-none">
                  Sources & Citations:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((cite, index) => (
                    <button
                      key={`${cite.id}-${cite.pageNumber}-${index}`}
                      onClick={() => onCitationClick?.(cite.id, cite.pageNumber)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#8c6b4a]/30 
                        bg-[#FDFBF7] text-[#2C1E16] hover:bg-[#8c6b4a]/10 hover:border-[#8c6b4a]/50
                        font-['Oswald',sans-serif] text-[9px] font-bold uppercase tracking-wide
                        transition-all duration-150 cursor-pointer shadow-sm active:translate-y-[1px]"
                      title={cite.excerpt || `Go to ${cite.documentName} page ${cite.pageNumber}`}
                    >
                      <span className="text-amber-800">📖</span>
                      <span className="truncate max-w-[120px]">{cite.documentName}</span>
                      <span className="text-[#2C1E16]/50 font-mono text-[8px]">
                        p. {cite.pageNumber}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </ParchmentPanel>
      </div>
    </div>
  );
};
