import type { Scene } from '@/types/game';
import type { Token } from '@/types/token';
import type { PropLibrary } from '@/types/prop';

const CUSTOM_TOKENS_KEY = 'nexus-custom-tokens';
const CUSTOM_PROP_LIBRARIES_KEY = 'nexus_prop_libraries';
const BACKUP_VERSION = '1.0.0';

export interface CampaignBackupData {
  version: string;
  exportedAt: string;
  campaign?: {
    id?: string;
    name?: string;
    description?: string | null;
  };
  scenes: Scene[];
  activeSceneId?: string | null;
  assets?: {
    customTokens?: Token[];
    customPropLibraries?: PropLibrary[];
  };
}

const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse campaign backup JSON:', error);
    return fallback;
  }
};

const getCustomTokens = (): Token[] =>
  safeParseJson<Token[]>(localStorage.getItem(CUSTOM_TOKENS_KEY), []);

const getCustomPropLibraries = (): PropLibrary[] =>
  safeParseJson<PropLibrary[]>(
    localStorage.getItem(CUSTOM_PROP_LIBRARIES_KEY),
    [],
  );

export const buildCampaignBackup = (options: {
  scenes: Scene[];
  activeSceneId?: string | null;
  campaign?: CampaignBackupData['campaign'];
}): CampaignBackupData => {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    campaign: options.campaign,
    scenes: JSON.parse(JSON.stringify(options.scenes)) as Scene[],
    activeSceneId: options.activeSceneId ?? null,
    assets: {
      customTokens: getCustomTokens(),
      customPropLibraries: getCustomPropLibraries(),
    },
  };
};

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildCampaignBackupFilename = (campaignName?: string): string => {
  const safeName = campaignName ? sanitizeFileSegment(campaignName) : 'campaign';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `nexus-${safeName}-${timestamp}.json`;
};

export const downloadCampaignBackup = (
  backup: CampaignBackupData,
  filename?: string,
): void => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || buildCampaignBackupFilename(backup.campaign?.name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseCampaignBackup = async (
  file: File,
): Promise<CampaignBackupData> => {
  const text = await file.text();
  const parsed = JSON.parse(text) as CampaignBackupData;

  if (!parsed?.scenes || !Array.isArray(parsed.scenes)) {
    throw new Error('Invalid backup file: missing scenes');
  }

  return parsed;
};

export const applyCampaignBackupAssets = (backup: CampaignBackupData): void => {
  if (backup.assets?.customTokens) {
    localStorage.setItem(
      CUSTOM_TOKENS_KEY,
      JSON.stringify(backup.assets.customTokens),
    );
  }

  if (backup.assets?.customPropLibraries) {
    localStorage.setItem(
      CUSTOM_PROP_LIBRARIES_KEY,
      JSON.stringify(backup.assets.customPropLibraries),
    );
  }
};
