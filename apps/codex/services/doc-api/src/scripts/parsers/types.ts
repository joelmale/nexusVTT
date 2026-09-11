import { StructuredDataType, DocumentType, DocumentFormat } from '@prisma/client';

/**
 * Parsed document ready for database insertion
 */
export interface ParsedDocument {
  // Document fields
  title: string;
  description: string;
  type: DocumentType;
  format: DocumentFormat;
  tags: string[];
  storageKey: string;
  fileSize: number;
  metadata: Record<string, any>;
  isPublic: boolean;

  // StructuredData fields
  structuredData: {
    type: StructuredDataType;
    name: string;
    data: Record<string, any>;
    searchText: string;
  };
}

/**
 * Parser interface for different content types
 */
export interface ContentParser {
  /**
   * Parse raw JSON data from 5e-database into our document format
   */
  parse(data: any): ParsedDocument;

  /**
   * Get the content type this parser handles
   */
  getContentType(): string;

  /**
   * Get the StructuredDataType for this parser
   */
  getStructuredDataType(): StructuredDataType;
}

/**
 * Helper to convert description arrays to Markdown
 */
export function formatDescription(desc: string | string[] | undefined): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc)) return desc.join('\n\n');
  return String(desc);
}

/**
 * Helper to flatten object for search text
 */
export function flattenForSearch(obj: any): string {
  const parts: string[] = [];

  function extract(value: any) {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(extract);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(extract);
    }
  }

  extract(obj);
  return parts.join(' ');
}

/**
 * Generate a virtual storage key for SRD content (no actual file)
 */
export function generateStorageKey(type: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `srd/${type}/${slug}.json`;
}
