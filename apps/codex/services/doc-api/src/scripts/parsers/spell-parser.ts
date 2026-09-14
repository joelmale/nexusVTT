import { DocumentFormat } from '@prisma/client';
import {
  ContentParser,
  ParsedDocument,
  formatDescription,
  flattenForSearch,
  generateStorageKey,
} from './types';

/**
 * Parser for D&D 5e spells with spell-specific tagging and formatting
 */
export class SpellParser implements ContentParser {
  parse(data: any): ParsedDocument {
    const name = data.name;
    const level = data.level;
    const school = data.school?.name || data.school?.index || 'unknown';
    const classes = data.classes?.map((c: any) => c.name || c.index) || [];

    // Format description with higher level info
    let description = formatDescription(data.desc);
    if (data.higher_level && data.higher_level.length > 0) {
      description += '\n\n**At Higher Levels:** ' + formatDescription(data.higher_level);
    }

    // Generate detailed tags
    const tags = [
      'srd',
      'spell',
      level === 0 ? 'cantrip' : `level-${level}`,
      school.toLowerCase(),
      ...classes.map((c: string) => c.toLowerCase()),
    ];

    // Add component tags
    if (data.components?.includes('V')) tags.push('verbal');
    if (data.components?.includes('S')) tags.push('somatic');
    if (data.components?.includes('M')) tags.push('material');
    if (data.ritual) tags.push('ritual');
    if (data.concentration) tags.push('concentration');

    return {
      title: name,
      description,
      type: 'srd_content',
      format: 'markdown' as DocumentFormat,
      tags,
      storageKey: generateStorageKey('spells', name),
      fileSize: JSON.stringify(data).length,
      metadata: {
        source: '5e-srd',
        contentType: 'spells',
        index: data.index,
        url: data.url,
        level,
        school,
        classes,
        ritual: data.ritual || false,
        concentration: data.concentration || false,
      },
      isPublic: true,
      structuredData: {
        type: 'spell',
        name,
        data,
        searchText: flattenForSearch(data),
      },
    };
  }

  getContentType(): string {
    return 'spells';
  }

  getStructuredDataType() {
    return 'spell' as const;
  }
}
