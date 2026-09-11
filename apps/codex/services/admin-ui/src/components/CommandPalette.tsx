import { useEffect, useMemo, useState } from 'react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuickResult = {
  documentId: string;
  title: string;
  type: string;
  score: number;
  snippet: string;
};

type SemanticResult = {
  chunkId: string;
  documentId: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  score: number;
  contentSnippet: string;
  document: {
    id: string;
    title: string;
    type: string;
  };
};

type AskResult = {
  answer: string;
  citations: Array<{ documentId: string }>;
};

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [quickResults, setQuickResults] = useState<QuickResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldSearch = useMemo(() => query.trim().length >= 2, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setQuickResults([]);
      setSemanticResults([]);
      setAskResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldSearch) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [quick, semantic, ask] = await Promise.all([
          fetch(`/api/search/quick?query=${encodeURIComponent(query)}&size=5`).then((res) => res.json()),
          fetch(`/api/search/semantic?query=${encodeURIComponent(query)}&topK=5`).then((res) => res.json()),
          fetch(`/api/search/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: query, topK: 5 }),
          }).then((res) => res.json()),
        ]);

        setQuickResults(quick.results || []);
        setSemanticResults(semantic.results || []);
        setAskResult(ask.answer ? ask : null);
      } catch (error) {
        console.error('Command palette search failed', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, query, shouldSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <input
            autoFocus
            className="flex-1 text-sm outline-none"
            placeholder="Ask anything, search docs, or jump to entities..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-slate-500">Searching...</div>
          )}

          {!loading && shouldSearch && (
            <div className="px-4 py-3 space-y-6">
              {askResult && (
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Ask Codex</h3>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {askResult.answer}
                    <div className="mt-2 text-xs text-slate-400">
                      Citations: {askResult.citations?.length || 0}
                    </div>
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Quick Matches</h3>
                {quickResults.length === 0 ? (
                  <p className="text-xs text-slate-500">No quick matches.</p>
                ) : (
                  <div className="space-y-2">
                    {quickResults.map((result) => (
                      <button
                        key={result.documentId}
                        onClick={() => window.open(`/reader/${result.documentId}`, '_blank')}
                        className="w-full text-left rounded-lg border border-slate-200 p-3 hover:border-slate-400"
                      >
                        <div className="text-sm font-medium text-slate-900">{result.title}</div>
                        <div className="text-xs text-slate-500">{result.type}</div>
                        <div className="text-xs text-slate-600 mt-1">{result.snippet}</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2">Semantic Chunks</h3>
                {semanticResults.length === 0 ? (
                  <p className="text-xs text-slate-500">No semantic matches.</p>
                ) : (
                  <div className="space-y-2">
                    {semanticResults.map((result) => (
                      <button
                        key={result.chunkId}
                        onClick={() => window.open(`/reader/${result.documentId}`, '_blank')}
                        className="w-full text-left rounded-lg border border-slate-200 p-3 hover:border-slate-400"
                      >
                        <div className="text-sm font-medium text-slate-900">{result.document.title}</div>
                        <div className="text-xs text-slate-500">
                          Pages {result.pageStart ?? '?'}–{result.pageEnd ?? '?'}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">{result.contentSnippet}</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {!loading && !shouldSearch && (
            <div className="px-4 py-6 text-sm text-slate-500">
              Start typing to search documents, chunks, or ask a rule question.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
