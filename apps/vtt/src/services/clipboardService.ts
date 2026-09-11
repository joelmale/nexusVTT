/**
 * Clipboard Service for Managing Copy/Cut/Paste of Drawings
 */

import type { Drawing } from '@/types/drawing';

class ClipboardService {
  private clipboard: Drawing[] = [];

  /**
   * Copy drawings to clipboard
   */
  copy(drawings: Drawing[]): void {
    // Deep clone the drawings to avoid reference issues
    this.clipboard = drawings.map((drawing) => ({
      ...drawing,
      // Generate new IDs when pasting
      id: drawing.id,
    }));
    console.log(`📋 Copied ${drawings.length} drawing(s) to clipboard`);
  }

  /**
   * Get drawings from clipboard
   */
  paste(): Drawing[] {
    if (this.clipboard.length === 0) {
      console.log('📋 Clipboard is empty');
      return [];
    }

    // Create new drawings with new IDs and slight offset
    const pastedDrawings = this.clipboard.map((drawing): Drawing => {
      // Offset position by 20 pixels to make it visible
      const offset = 20;
      const newId = `${drawing.type}-${Date.now()}-${Math.random()}`;
      const newCreatedAt = Date.now();

      switch (drawing.type) {
        case 'line':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            start: {
              x: drawing.start.x + offset,
              y: drawing.start.y + offset,
            },
            end: {
              x: drawing.end.x + offset,
              y: drawing.end.y + offset,
            },
          };
        case 'rectangle':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            x: drawing.x + offset,
            y: drawing.y + offset,
          };
        case 'circle':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            center: {
              x: drawing.center.x + offset,
              y: drawing.center.y + offset,
            },
          };
        case 'aoe-sphere':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            center: {
              x: drawing.center.x + offset,
              y: drawing.center.y + offset,
            },
          };
        case 'polygon':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            points: drawing.points.map((p) => ({
              x: p.x + offset,
              y: p.y + offset,
            })),
          };
        case 'pencil':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            points: drawing.points.map((p) => ({
              x: p.x + offset,
              y: p.y + offset,
            })),
          };
        case 'cone':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            origin: {
              x: drawing.origin.x + offset,
              y: drawing.origin.y + offset,
            },
          };
        case 'aoe-cube':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            origin: {
              x: drawing.origin.x + offset,
              y: drawing.origin.y + offset,
            },
          };
        case 'text':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            position: {
              x: drawing.position.x + offset,
              y: drawing.position.y + offset,
            },
          };
        case 'ping':
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
            position: {
              x: drawing.position.x + offset,
              y: drawing.position.y + offset,
            },
          };
        default:
          // For any other types, just return with updated id/timestamp
          return {
            ...drawing,
            id: newId,
            createdAt: newCreatedAt,
          };
      }
    });

    console.log(`📌 Pasted ${pastedDrawings.length} drawing(s) from clipboard`);
    return pastedDrawings;
  }

  /**
   * Check if clipboard has content
   */
  hasContent(): boolean {
    return this.clipboard.length > 0;
  }

  /**
   * Clear clipboard
   */
  clear(): void {
    this.clipboard = [];
    console.log('📋 Clipboard cleared');
  }

  /**
   * Get clipboard content count
   */
  getCount(): number {
    return this.clipboard.length;
  }
}

export const clipboardService = new ClipboardService();
