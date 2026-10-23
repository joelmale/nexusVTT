import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  applyMoodToDocument,
  getMoodOption,
  loadLocalMood,
  resolveCampaignMood,
  saveLocalMood,
  type CampaignMood,
  type MoodOption,
} from './moodModel';
import { updateCampaign } from '@/services/campaign-api';

export interface MoodContextValue {
  currentMood: CampaignMood;
  activeOption: MoodOption;
  setMood: (mood: CampaignMood, persistToCampaign?: boolean) => Promise<void>;
  isMoodPickerOpen: boolean;
  openMoodPicker: () => void;
  closeMoodPicker: () => void;
  toggleMoodPicker: () => void;
}

export const MoodContext = createContext<MoodContextValue | null>(null);

export interface MoodProviderProps {
  children: ReactNode;
  campaignId?: string;
  campaignMood?: string | null;
  isEditable?: boolean;
}

export function MoodProvider({
  children,
  campaignId,
  campaignMood,
  isEditable = false,
}: MoodProviderProps) {
  const [localMood, setLocalMood] = useState<CampaignMood | null>(() => loadLocalMood());
  const [isMoodPickerOpen, setIsMoodPickerOpen] = useState(false);

  const currentMood = useMemo(
    () => resolveCampaignMood(campaignMood, localMood),
    [campaignMood, localMood],
  );

  const activeOption = useMemo(() => getMoodOption(currentMood), [currentMood]);

  // Synchronize data-mood and color-scheme on documentElement whenever currentMood changes
  useEffect(() => {
    applyMoodToDocument(currentMood);
  }, [currentMood]);

  const setMood = useCallback(
    async (nextMood: CampaignMood, persistToCampaign = false) => {
      setLocalMood(nextMood);
      saveLocalMood(nextMood);
      applyMoodToDocument(nextMood);

      if (persistToCampaign && isEditable && campaignId) {
        try {
          await updateCampaign(campaignId, { mood: nextMood });
        } catch (err) {
          console.error('Failed to persist mood to campaign:', err);
        }
      }
    },
    [campaignId, isEditable],
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

export function useCampaignMood(): MoodContextValue {
  const ctx = useContext(MoodContext);
  if (!ctx) {
    const fallbackMood = resolveCampaignMood(null, loadLocalMood());
    return {
      currentMood: fallbackMood,
      activeOption: getMoodOption(fallbackMood),
      setMood: () => Promise.resolve(),
      isMoodPickerOpen: false,
      openMoodPicker: () => {},
      closeMoodPicker: () => {},
      toggleMoodPicker: () => {},
    };
  }
  return ctx;
}
