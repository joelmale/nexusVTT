import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import {
  panelRegistry,
  serializeObjectPanelId,
  parseObjectPanelId,
  ObjectLink,
} from '../../../src/services/panelRegistry';
import { useUIStackStore } from '../../../src/stores/uiStackStore';

describe('PanelRegistryService', () => {
  beforeEach(() => {
    useUIStackStore.setState({
      panelStack: [],
      activePanels: [],
      poppedOutPanels: [],
      dockedPanels: {},
    });
  });

  const DummyComponent: React.FC = () => null;

  it('serializes and parses object panel IDs', () => {
    const link: ObjectLink = { kind: 'character', id: 'char-123' };
    const panelId = serializeObjectPanelId(link);
    expect(panelId).toBe('panel:character:char-123');

    const parsed = parseObjectPanelId(panelId);
    expect(parsed).toEqual({ kind: 'character', id: 'char-123' });

    expect(parseObjectPanelId('invalid-panel-id')).toBeNull();
    expect(parseObjectPanelId('panel:invalid')).toBeNull();
  });

  it('registers and unregisters panel definitions', () => {
    const unregister = panelRegistry.register({
      kind: 'monster',
      title: (l) => `Monster: ${l.id}`,
      component: DummyComponent,
    });

    const def = panelRegistry.getDefinition('monster');
    expect(def).toBeDefined();
    expect(def?.title({ kind: 'monster', id: 'goblin' })).toBe('Monster: goblin');

    unregister();
    expect(panelRegistry.getDefinition('monster')).toBeUndefined();
  });

  it('opens panel and adds to uiStackStore activePanels', () => {
    const link: ObjectLink = { kind: 'spellbook', id: 'book-1' };
    const listener = vi.fn();
    const unsub = panelRegistry.subscribe(listener);

    const panelId = panelRegistry.open(link, { docked: 'right' });
    expect(panelId).toBe('panel:spellbook:book-1');
    expect(panelRegistry.getLink(panelId)).toEqual(link);
    expect(listener).toHaveBeenCalled();

    const state = useUIStackStore.getState();
    expect(state.activePanels).toContain(panelId);
    expect(state.dockedPanels[panelId]).toBe('right');

    unsub();
  });

  it('supports popout panel option', () => {
    const link: ObjectLink = { kind: 'encounter', id: 'enc-99' };
    const panelId = panelRegistry.open(link, { popout: true });

    const state = useUIStackStore.getState();
    expect(state.poppedOutPanels).toContain(panelId);
  });

  it('closes active panel and removes from registry', () => {
    const link: ObjectLink = { kind: 'character', id: 'hero-1' };
    const panelId = panelRegistry.open(link);

    expect(panelRegistry.getLink(panelId)).toBeDefined();
    panelRegistry.close(link);

    expect(panelRegistry.getLink(panelId)).toBeUndefined();
    expect(useUIStackStore.getState().activePanels).not.toContain(panelId);
  });
});
