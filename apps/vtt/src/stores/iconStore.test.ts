import { describe, it, expect, beforeEach } from 'vitest';
import { useIconStore } from './iconStore';

describe('iconStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useIconStore.setState({
      globalCampaignPackId: 'nexus-vector-gold',
      localUserOverrides: {},
    });
  });

  it('resolves default campaign pack icon for a registered panel', () => {
    const icon = useIconStore.getState().getResolvedIcon('panel:atlas');
    expect(icon.id).toBe('panel:atlas');
    expect(icon.name).toBe('Atlas Studio');
    expect(icon.url).toBe('/assets/icons/panels/atlas.png');
    expect(icon.fallback).toBe('📚');
    expect(icon.isCustomOverride).toBe(false);
  });

  it('switches to default emoji pack and resolves without image URL', () => {
    useIconStore.getState().setGlobalCampaignPack('default-emoji');
    const icon = useIconStore.getState().getResolvedIcon('panel:dice');
    expect(icon.url).toBeUndefined();
    expect(icon.fallback).toBe('🎲');
  });

  it('prioritizes local user override over global campaign pack', () => {
    const customDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    useIconStore.getState().setLocalUserIcon('panel:atlas', customDataUrl);

    const icon = useIconStore.getState().getResolvedIcon('panel:atlas');
    expect(icon.url).toBe(customDataUrl);
    expect(icon.isCustomOverride).toBe(true);

    // Persisted in localStorage
    expect(localStorage.getItem('nexus-user-icon-overrides')).toContain('panel:atlas');
  });

  it('clears specific local user override', () => {
    useIconStore.getState().setLocalUserIcon('panel:tokens', 'data:image/png;base64,abc');
    expect(useIconStore.getState().localUserOverrides['panel:tokens']).toBe('data:image/png;base64,abc');

    useIconStore.getState().clearLocalUserIcon('panel:tokens');
    expect(useIconStore.getState().localUserOverrides['panel:tokens']).toBeUndefined();

    // Falls back to global campaign pack
    const resolved = useIconStore.getState().getResolvedIcon('panel:tokens');
    expect(resolved.url).toBe('/assets/icons/panels/tokens.png');
    expect(resolved.isCustomOverride).toBe(false);
  });

  it('clears all local overrides', () => {
    useIconStore.getState().setLocalUserIcon('panel:1', 'url1');
    useIconStore.getState().setLocalUserIcon('panel:2', 'url2');
    expect(Object.keys(useIconStore.getState().localUserOverrides).length).toBe(2);

    useIconStore.getState().clearAllLocalOverrides();
    expect(Object.keys(useIconStore.getState().localUserOverrides).length).toBe(0);
  });

  it('exports and imports a portable local pack JSON', () => {
    useIconStore.getState().setLocalUserIcon('panel:chat', 'data:image/png;base64,customchat');
    const exportedJson = useIconStore.getState().exportLocalPack('My Pack');

    expect(exportedJson).toContain('My Pack');
    expect(exportedJson).toContain('panel:chat');

    // Clear and import into clean state
    useIconStore.getState().clearAllLocalOverrides();
    expect(useIconStore.getState().localUserOverrides['panel:chat']).toBeUndefined();

    const success = useIconStore.getState().importLocalPack(exportedJson);
    expect(success).toBe(true);
    expect(useIconStore.getState().localUserOverrides['panel:chat']).toBe('data:image/png;base64,customchat');
  });

  it('rejects invalid JSON on import', () => {
    const success = useIconStore.getState().importLocalPack('{ invalid json');
    expect(success).toBe(false);
  });
});
