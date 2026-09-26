import React from 'react';
import { useUIStackStore, PanelId } from '@/stores/uiStackStore';

export type ObjectKind =
  | 'character'
  | 'monster'
  | 'encounter'
  | 'spellbook'
  | 'item'
  | 'rule'
  | 'campaign-entry'
  | 'session-plan';

export interface ObjectLink {
  kind: ObjectKind;
  id: string;
  campaignId?: string;
  revision?: number;
  title?: string;
}

export interface PanelHostOptions {
  popout?: boolean;
  docked?: 'left' | 'right' | 'bottom';
  focus?: boolean;
}

export interface PanelComponentProps {
  link: ObjectLink;
  onClose: () => void;
  isPopout: boolean;
}

export interface PanelDefinition {
  kind: ObjectKind;
  title: (link: ObjectLink) => string;
  defaultDimensions?: { width: number; height: number };
  component: React.ComponentType<PanelComponentProps>;
}

export function serializeObjectPanelId(link: ObjectLink): PanelId {
  return `panel:${link.kind}:${link.id}`;
}

export function parseObjectPanelId(panelId: PanelId): ObjectLink | null {
  if (!panelId.startsWith('panel:')) return null;
  const parts = panelId.split(':');
  if (parts.length < 3) return null;
  const kind = parts[1] as ObjectKind;
  const id = parts.slice(2).join(':');
  return { kind, id };
}

class PanelRegistryService {
  private definitions = new Map<ObjectKind, PanelDefinition>();
  private activeLinks = new Map<PanelId, ObjectLink>();
  private listeners = new Set<() => void>();

  /**
   * Register a component host for a specific object kind
   */
  register(definition: PanelDefinition): () => void {
    this.definitions.set(definition.kind, definition);
    this.notify();
    return () => {
      this.definitions.delete(definition.kind);
      this.notify();
    };
  }

  /**
   * Get the registered panel definition for a kind
   */
  getDefinition(kind: ObjectKind): PanelDefinition | undefined {
    return this.definitions.get(kind);
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Open an object in the floating panel stack or secondary window
   */
  open(link: ObjectLink, options: PanelHostOptions = {}): PanelId {
    const panelId = serializeObjectPanelId(link);
    this.activeLinks.set(panelId, link);

    const uiStack = useUIStackStore.getState();

    // Add to active panels if not already present
    if (!uiStack.activePanels.includes(panelId)) {
      uiStack.selectPanel(panelId);
    } else {
      uiStack.bringToFront(panelId);
    }

    if (options.docked) {
      uiStack.dockPanel(panelId, options.docked);
    }

    if (options.popout) {
      uiStack.popOutPanel(panelId);
    }

    this.notify();
    return panelId;
  }

  /**
   * Close a registered object panel
   */
  close(linkOrId: ObjectLink | PanelId): void {
    const panelId =
      typeof linkOrId === 'string'
        ? linkOrId
        : serializeObjectPanelId(linkOrId);
    this.activeLinks.delete(panelId);

    const uiStack = useUIStackStore.getState();
    if (uiStack.activePanels.includes(panelId)) {
      uiStack.togglePanel(panelId);
    }

    this.notify();
  }

  /**
   * Get all currently active object links
   */
  getActiveLinks(): Map<PanelId, ObjectLink> {
    return new Map(this.activeLinks);
  }

  /**
   * Get active object link by panel ID
   */
  getLink(panelId: PanelId): ObjectLink | undefined {
    return this.activeLinks.get(panelId);
  }
}

export const panelRegistry = new PanelRegistryService();
