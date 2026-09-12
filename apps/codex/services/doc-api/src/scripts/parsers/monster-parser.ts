import { DocumentFormat } from '@prisma/client';
import {
  ContentParser,
  ParsedDocument,
  formatDescription,
  flattenForSearch,
  generateStorageKey,
} from './types';

/**
 * Parser for D&D 5e monsters with stat block formatting
 */
export class MonsterParser implements ContentParser {
  parse(data: any): ParsedDocument {
    const name = data.name;
    const cr = data.challenge_rating;
    const type = data.type || 'unknown';
    const size = data.size || 'Medium';

    // Build markdown stat block description
    let description = this.buildStatBlock(data);

    // Generate detailed tags
    const tags = [
      'srd',
      'monster',
      `cr-${cr}`,
      type.toLowerCase(),
      size.toLowerCase(),
    ];

    // Add special tags
    if (data.legendary_actions && data.legendary_actions.length > 0) {
      tags.push('legendary');
    }
    if (data.damage_immunities && data.damage_immunities.length > 0) {
      tags.push('damage-immune');
    }
    if (cr >= 20) tags.push('epic');

    return {
      title: name,
      description,
      type: 'srd_content',
      format: 'markdown' as DocumentFormat,
      tags,
      storageKey: generateStorageKey('monsters', name),
      fileSize: JSON.stringify(data).length,
      metadata: {
        source: '5e-srd',
        contentType: 'monsters',
        index: data.index,
        url: data.url,
        cr,
        type,
        size,
        alignment: data.alignment,
      },
      isPublic: true,
      structuredData: {
        type: 'monster',
        name,
        data,
        searchText: flattenForSearch(data),
      },
    };
  }

  /**
   * Build a formatted markdown stat block
   */
  private buildStatBlock(data: any): string {
    const parts: string[] = [];

    // Basic info
    parts.push(`**${data.size} ${data.type}, ${data.alignment}**\n`);

    // Defense
    parts.push(`**Armor Class:** ${data.armor_class || data.armor_class?.[0]?.value || '?'}`);
    parts.push(`**Hit Points:** ${data.hit_points} (${data.hit_dice})`);
    if (data.speed) {
      const speeds = Object.entries(data.speed)
        .map(([key, value]) => `${key} ${value}`)
        .join(', ');
      parts.push(`**Speed:** ${speeds}`);
    }
    parts.push(''); // Blank line

    // Ability scores
    const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const scores = abilities
      .map((ability) => {
        const score = data[ability.toLowerCase()] || 10;
        const modifier = Math.floor((score - 10) / 2);
        const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
        return `${ability} ${score} (${modStr})`;
      })
      .join(' | ');
    parts.push(scores);
    parts.push(''); // Blank line

    // Skills, senses, languages
    if (data.senses) {
      const senses = Object.entries(data.senses)
        .map(([key, value]) => `${key} ${value}`)
        .join(', ');
      parts.push(`**Senses:** ${senses}`);
    }
    if (data.languages) {
      parts.push(`**Languages:** ${data.languages}`);
    }
    parts.push(`**Challenge:** ${data.challenge_rating} (${data.xp} XP)`);
    parts.push(''); // Blank line

    // Special abilities
    if (data.special_abilities && data.special_abilities.length > 0) {
      parts.push('## Special Abilities\n');
      data.special_abilities.forEach((ability: any) => {
        parts.push(`**${ability.name}.** ${formatDescription(ability.desc)}\n`);
      });
    }

    // Actions
    if (data.actions && data.actions.length > 0) {
      parts.push('## Actions\n');
      data.actions.forEach((action: any) => {
        parts.push(`**${action.name}.** ${formatDescription(action.desc)}\n`);
      });
    }

    // Legendary actions
    if (data.legendary_actions && data.legendary_actions.length > 0) {
      parts.push('## Legendary Actions\n');
      data.legendary_actions.forEach((action: any) => {
        parts.push(`**${action.name}.** ${formatDescription(action.desc)}\n`);
      });
    }

    return parts.join('\n');
  }

  getContentType(): string {
    return 'monsters';
  }

  getStructuredDataType() {
    return 'monster' as const;
  }
}
