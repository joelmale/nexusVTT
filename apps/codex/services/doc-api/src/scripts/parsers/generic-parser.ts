import { StructuredDataType, DocumentFormat } from '@prisma/client';
import {
  ContentParser,
  ParsedDocument,
  formatDescription,
  flattenForSearch,
  generateStorageKey,
} from './types';

/**
 * Generic parser for simple content types (skills, languages, conditions, etc.)
 */
export class GenericParser implements ContentParser {
  constructor(
    private contentType: string,
    private structuredDataType: StructuredDataType
  ) {}

  parse(data: any): ParsedDocument {
    const name = data.name || data.index || 'Unknown';
    const description = formatDescription(data.desc || data.description);

    // Generate basic tags
    const tags = ['srd', this.contentType];
    if (data.index) tags.push(data.index);

    return {
      title: name,
      description,
      type: 'srd_content',
      format: 'markdown' as DocumentFormat,
      tags,
      storageKey: generateStorageKey(this.contentType, name),
      fileSize: JSON.stringify(data).length,
      metadata: {
        source: '5e-srd',
        contentType: this.contentType,
        index: data.index,
        url: data.url,
      },
      isPublic: true,
      structuredData: {
        type: this.structuredDataType,
        name,
        data,
        searchText: flattenForSearch(data),
      },
    };
  }

  getContentType(): string {
    return this.contentType;
  }

  getStructuredDataType(): StructuredDataType {
    return this.structuredDataType;
  }
}
