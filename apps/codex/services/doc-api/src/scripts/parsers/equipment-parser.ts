import { DocumentFormat } from '@prisma/client';
import {
  ContentParser,
  ParsedDocument,
  formatDescription,
  flattenForSearch,
  generateStorageKey,
} from './types';

/**
 * Parser for D&D 5e equipment and magic items
 */
export class EquipmentParser implements ContentParser {
  constructor(private isMagicItem: boolean = false) {}

  parse(data: any): ParsedDocument {
    const name = data.name;
    const category = data.equipment_category?.name || data.equipment_category?.index || 'item';

    // Format description
    let description = formatDescription(data.desc);

    // Add cost and weight if available
    if (data.cost) {
      description += `\n\n**Cost:** ${data.cost.quantity} ${data.cost.unit}`;
    }
    if (data.weight) {
      description += `\n**Weight:** ${data.weight} lb.`;
    }

    // Generate tags
    const tags = ['srd', this.isMagicItem ? 'magic-item' : 'equipment', category.toLowerCase()];

    // Add rarity for magic items
    if (this.isMagicItem && data.rarity) {
      tags.push(data.rarity.name?.toLowerCase() || data.rarity.toLowerCase());
    }

    // Add weapon/armor specific tags
    if (data.weapon_category) {
      tags.push('weapon', data.weapon_category.toLowerCase());
    }
    if (data.armor_category) {
      tags.push('armor', data.armor_category.toLowerCase());
    }
    if (data.tool_category) {
      tags.push('tool');
    }

    return {
      title: name,
      description,
      type: 'srd_content',
      format: 'markdown' as DocumentFormat,
      tags,
      storageKey: generateStorageKey(this.isMagicItem ? 'magic-items' : 'equipment', name),
      fileSize: JSON.stringify(data).length,
      metadata: {
        source: '5e-srd',
        contentType: this.isMagicItem ? 'magic-items' : 'equipment',
        index: data.index,
        url: data.url,
        category,
        rarity: data.rarity,
        cost: data.cost,
        weight: data.weight,
      },
      isPublic: true,
      structuredData: {
        type: 'item',
        name,
        data,
        searchText: flattenForSearch(data),
      },
    };
  }

  getContentType(): string {
    return this.isMagicItem ? 'magic-items' : 'equipment';
  }

  getStructuredDataType() {
    return 'item' as const;
  }
}
