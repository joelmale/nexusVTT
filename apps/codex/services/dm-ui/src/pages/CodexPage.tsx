import { useState } from 'react';
import { Search, Book, Filter, X } from 'lucide-react';
import { useSearchDocuments } from '@/hooks/useCodex';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Document } from '@/services/codex-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

const DOCUMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'srd_content', label: 'SRD Content' },
  { value: 'rulebook', label: 'Rulebooks' },
  { value: 'adventure', label: 'Adventures' },
  { value: 'supplement', label: 'Supplements' },
  { value: 'homebrew', label: 'Homebrew' }
];

const COMMON_TAGS = [
  'spell',
  'monster',
  'magic-item',
  'equipment',
  'class',
  'race',
  'background',
  'feat',
  'condition'
];

export function CodexPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const { data: searchResults, isLoading, error } = useSearchDocuments({
    term: searchTerm || undefined,
    type: selectedType || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: 50
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setSelectedTags([]);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Codex Browser</h1>
        <p className="text-muted-foreground">
          Browse SRD documents, spells, monsters, and more
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents, spells, monsters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>

          {(searchTerm || selectedType || selectedTags.length > 0) && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            {/* Document Type Filter */}
            <div>
              <Label htmlFor="type">Document Type</Label>
              <Select
                id="type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Tag Filters */}
          <div>
            <Label>Tags</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    selectedTags.includes(tag)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {isLoading && (
          <div className="text-center text-muted-foreground">
            Searching codex...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            Failed to search codex. Check the DM UI DOC_API_URL configuration.
          </div>
        )}

        {searchResults && searchResults.documents.length === 0 && (
          <div className="text-center text-muted-foreground">
            No documents found. Try adjusting your search or filters.
          </div>
        )}

        {searchResults && searchResults.documents.length > 0 && (
          <>
            <div className="text-sm text-muted-foreground">
              Found {searchResults.total} document{searchResults.total !== 1 ? 's' : ''}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => setSelectedDocument(doc)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Document Preview Dialog */}
      <Dialog
        open={!!selectedDocument}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
      >
        <DialogContent
          className="max-w-2xl"
          onClose={() => setSelectedDocument(null)}
        >
          {selectedDocument && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDocument.title}</DialogTitle>
                <DialogDescription>
                  {selectedDocument.description || 'No description available'}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-secondary px-2 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Type: {selectedDocument.type}</p>
                  <p>
                    Uploaded: {new Date(selectedDocument.uploadedAt).toLocaleDateString()}
                  </p>
                  {selectedDocument.metadata && (
                    <pre className="mt-2 rounded bg-muted p-2 text-xs">
                      {JSON.stringify(selectedDocument.metadata, null, 2)}
                    </pre>
                  )}
                </div>

                {/* TODO: Add structured data display if available */}
                {/* TODO: Add link to campaign entity button */}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DocumentCardProps {
  document: Document;
  onClick: () => void;
}

function DocumentCard({ document, onClick }: DocumentCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-semibold line-clamp-2">{document.title}</h3>
        <Book className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </div>

      {document.description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {document.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {document.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
        {document.tags.length > 3 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            +{document.tags.length - 3}
          </span>
        )}
      </div>
    </button>
  );
}
