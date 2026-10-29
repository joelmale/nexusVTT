import { createContext, useContext } from 'react';

import {
  getMoodOption,
  loadLocalMood,
  resolveCampaignMood,
  type CampaignMood,
  type MoodOption,
} from './moodModel';

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
