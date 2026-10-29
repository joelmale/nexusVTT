import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  applyCampaignBackupAssets,
  buildCampaignBackup,
  buildCampaignBackupFilename,
  downloadCampaignBackup,
  parseCampaignBackup,
  type CampaignBackupData,
} from '@/services/campaignBackup';
import type { Scene } from '@/types/game';
import type { Token } from '@/types/token';
import type { PropLibrary } from '@/types/prop';

describe('campaignBackup', () => {
  const mockScene: Scene = {
    id: 'scene-1',
    name: 'Tavern Floor 1',
    gridSize: 50,
    width: 1000,
    height: 1000,
    lighting: 'bright',
    tokens: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('buildCampaignBackupFilename', () => {
    it('creates a safe filename using the campaign name', () => {
      const filename = buildCampaignBackupFilename('The Lost Mine of Phandelver!');
      expect(filename).toMatch(/^nexus-the-lost-mine-of-phandelver-\d{4}-\d{2}-\d{2}T.*\.json$/);
    });

    it('falls back to "campaign" when name is missing', () => {
      const filename = buildCampaignBackupFilename();
      expect(filename).toMatch(/^nexus-campaign-\d{4}-\d{2}-\d{2}T.*\.json$/);
    });
  });

  describe('buildCampaignBackup', () => {
    it('creates backup payload including scenes and localStorage assets', () => {
      const customTokens: Partial<Token>[] = [{ id: 'tok-1', name: 'Goblin Scout' }];
      const customProps: Partial<PropLibrary>[] = [{ id: 'prop-lib-1', name: 'Dungeon Props' }];

      localStorage.setItem('nexus-custom-tokens', JSON.stringify(customTokens));
      localStorage.setItem('nexus_prop_libraries', JSON.stringify(customProps));

      const backup = buildCampaignBackup({
        scenes: [mockScene],
        activeSceneId: 'scene-1',
        campaign: { id: 'camp-1', name: 'Test Campaign', description: 'A test' },
      });

      expect(backup.version).toBe('1.0.0');
      expect(backup.campaign?.name).toBe('Test Campaign');
      expect(backup.scenes).toHaveLength(1);
      expect(backup.scenes[0].id).toBe('scene-1');
      expect(backup.activeSceneId).toBe('scene-1');
      expect(backup.assets?.customTokens).toEqual(customTokens);
      expect(backup.assets?.customPropLibraries).toEqual(customProps);
    });

    it('handles empty localStorage gracefully with safe fallback', () => {
      localStorage.setItem('nexus-custom-tokens', 'invalid json {{{');
      const backup = buildCampaignBackup({
        scenes: [],
        activeSceneId: null,
      });

      expect(backup.assets?.customTokens).toEqual([]);
      expect(backup.activeSceneId).toBeNull();
    });
  });

  describe('parseCampaignBackup', () => {
    it('parses valid backup file content', async () => {
      const backupData: CampaignBackupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        scenes: [mockScene],
      };
      const file = {
        text: vi.fn().mockResolvedValue(JSON.stringify(backupData)),
      } as unknown as File;

      const parsed = await parseCampaignBackup(file);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.scenes).toHaveLength(1);
    });

    it('rejects backup file without scenes array', async () => {
      const invalidData = { version: '1.0.0', exportedAt: new Date().toISOString() };
      const file = {
        text: vi.fn().mockResolvedValue(JSON.stringify(invalidData)),
      } as unknown as File;

      await expect(parseCampaignBackup(file)).rejects.toThrow('Invalid backup file: missing scenes');
    });
  });

  describe('applyCampaignBackupAssets', () => {
    it('restores tokens and prop libraries to localStorage', () => {
      const backup: CampaignBackupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        scenes: [],
        assets: {
          customTokens: [{ id: 'tok-2', name: 'Orc Warrior' } as Token],
          customPropLibraries: [{ id: 'prop-2', name: 'Forest Props' } as PropLibrary],
        },
      };

      applyCampaignBackupAssets(backup);

      expect(JSON.parse(localStorage.getItem('nexus-custom-tokens')!)).toHaveLength(1);
      expect(JSON.parse(localStorage.getItem('nexus_prop_libraries')!)).toHaveLength(1);
    });
  });

  describe('downloadCampaignBackup', () => {
    it('triggers browser anchor click to download file', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();
      window.URL.createObjectURL = createObjectURL;
      window.URL.revokeObjectURL = revokeObjectURL;

      const clickMock = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      const backup: CampaignBackupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        scenes: [mockScene],
      };

      downloadCampaignBackup(backup, 'custom-backup.json');

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
  });
});
