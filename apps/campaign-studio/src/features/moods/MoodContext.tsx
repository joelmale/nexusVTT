import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { CampaignContext } from '@/features/campaigns/CampaignContext';
import { SectionContext } from '@/features/section-shell/SectionContext';
import { updateCampaign } from '@/services/campaign-api';

import {
  applyMoodToDocument,
  getMoodOption,
  loadLocalMood,
  resolveCampaignMood,
  saveLocalMood,
  type CampaignMood,
} from './moodModel';
import { MoodContext, type MoodContextValue } from './moodState';

export interface MoodProviderProps {
  children: ReactNode;
  campaignId?: string;
  campaignMood?: string | null;
  isEditable?: boolean;
}

export type SetMoodPersistenceOption =
  | boolean
  | {
      saveAsCampaignDefault?: boolean;
      persistToCampaign?: boolean;
    };

export function MoodProvider({
  children,
  campaignId,
  campaignMood,
  isEditable = false,
}: MoodProviderProps) {
  const campaignContext = useContext(CampaignContext);
  const sectionContext = useContext(SectionContext);

  const effectiveCampaignId =
    campaignId ??
    sectionContext?.bundle.catalog.campaign.id ??
    campaignContext?.activeCampaign?.id;
  const propCampaignMood =
    campaignMood !== undefined
      ? campaignMood
      : (sectionContext?.bundle.catalog.campaign.mood ??
        campaignContext?.activeCampaign?.mood);

  const [localMoodState, setLocalMoodState] = useState<{
    campaignId: string | undefined;
    mood: CampaignMood | null;
  }>(() => ({
    campaignId: effectiveCampaignId,
    mood: loadLocalMood(effectiveCampaignId),
  }));
  const [defaultMoodOverride, setDefaultMoodOverride] = useState<{
    campaignId: string | undefined;
    baseMood: string | null | undefined;
    mood: CampaignMood;
  } | null>(null);
  const [isMoodPickerOpen, setIsMoodPickerOpen] = useState(false);

  const localMood =
    localMoodState.campaignId === effectiveCampaignId
      ? localMoodState.mood
      : loadLocalMood(effectiveCampaignId);

  const effectiveCampaignMood =
    defaultMoodOverride &&
    defaultMoodOverride.campaignId === effectiveCampaignId &&
    defaultMoodOverride.baseMood === propCampaignMood
      ? defaultMoodOverride.mood
      : propCampaignMood;

  const currentMood = useMemo(
    () => resolveCampaignMood(effectiveCampaignMood, localMood),
    [effectiveCampaignMood, localMood],
  );

  const activeOption = useMemo(() => getMoodOption(currentMood), [currentMood]);

  // Synchronize data-mood and color-scheme on documentElement whenever currentMood changes
  useEffect(() => {
    applyMoodToDocument(currentMood);
  }, [currentMood]);

  const setMood = useCallback(
    async (
      nextMood: CampaignMood,
      persistOrOptions: SetMoodPersistenceOption = false,
    ) => {
      const shouldPersist =
        typeof persistOrOptions === 'boolean'
          ? persistOrOptions
          : Boolean(
              persistOrOptions?.saveAsCampaignDefault ??
                persistOrOptions?.persistToCampaign,
            );

      setLocalMoodState({ campaignId: effectiveCampaignId, mood: nextMood });
      saveLocalMood(nextMood, effectiveCampaignId);
      applyMoodToDocument(nextMood);

      if (shouldPersist && isEditable && effectiveCampaignId) {
        await updateCampaign(effectiveCampaignId, { mood: nextMood });
        setDefaultMoodOverride({
          campaignId: effectiveCampaignId,
          baseMood: propCampaignMood,
          mood: nextMood,
        });
        saveLocalMood(nextMood, effectiveCampaignId);

        if (
          campaignContext?.activeCampaign &&
          campaignContext.activeCampaign.id === effectiveCampaignId &&
          !Object.isFrozen(campaignContext.activeCampaign)
        ) {
          campaignContext.activeCampaign.mood = nextMood;
        }
        if (campaignContext?.campaigns) {
          for (const entry of campaignContext.campaigns) {
            if (entry.id === effectiveCampaignId && !Object.isFrozen(entry)) {
              entry.mood = nextMood;
            }
          }
        }
        if (
          sectionContext?.bundle.catalog.campaign &&
          sectionContext.bundle.catalog.campaign.id === effectiveCampaignId &&
          !Object.isFrozen(sectionContext.bundle.catalog.campaign)
        ) {
          sectionContext.bundle.catalog.campaign.mood = nextMood;
        }
        if (
          sectionContext?.bundle.campaign &&
          sectionContext.bundle.campaign.id === effectiveCampaignId &&
          !Object.isFrozen(sectionContext.bundle.campaign)
        ) {
          (
            sectionContext.bundle.campaign as { mood?: CampaignMood }
          ).mood = nextMood;
        }
      }
    },
    [
      campaignContext,
      effectiveCampaignId,
      isEditable,
      propCampaignMood,
      sectionContext,
    ],
  );

  const openMoodPicker = useCallback(() => setIsMoodPickerOpen(true), []);
  const closeMoodPicker = useCallback(() => setIsMoodPickerOpen(false), []);
  const toggleMoodPicker = useCallback(
    () => setIsMoodPickerOpen((prev) => !prev),
    [],
  );

  const value = useMemo<MoodContextValue>(
    () => ({
      currentMood,
      activeOption,
      setMood,
      isMoodPickerOpen,
      openMoodPicker,
      closeMoodPicker,
      toggleMoodPicker,
    }),
    [
      currentMood,
      activeOption,
      setMood,
      isMoodPickerOpen,
      openMoodPicker,
      closeMoodPicker,
      toggleMoodPicker,
    ],
  );

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
