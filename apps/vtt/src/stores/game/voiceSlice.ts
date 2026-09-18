/**
 * Voice slice — the (still stubbed) WebRTC voice-channel actions.
 *
 * Extracted verbatim from gameStore.ts. The state itself (`voice`) stays in
 * the single gameStore state object, so every existing selector, getState()
 * read and the canonical snapshot are untouched; only these action bodies
 * moved. The factory is spread into the same `create()` call, so `set` here
 * is the same Immer `set` the rest of the store uses.
 */

import { v4 as uuidv4 } from 'uuid';
import type { VoiceChannel } from '@/types/game';
import type { GameStore, GameStoreSet } from '@/stores/game/types';

export type VoiceSlice = Pick<GameStore, 'createVoiceChannel' | 'joinVoiceChannel' | 'leaveVoiceChannel' | 'toggleMute' | 'toggleDeafen' | 'setAudioDevices' | 'selectAudioInput' | 'selectAudioOutput'>;

export const createVoiceSlice = (set: GameStoreSet): VoiceSlice => ({
  createVoiceChannel: (name) => {
    const channel: VoiceChannel = {
      id: uuidv4(),
      name,
      participants: [],
      isActive: true,
    };

    set((state) => {
      state.voice.channels.push(channel);
    });

    return channel;
  },

  joinVoiceChannel: async (channelId) => {
    // TODO: Implement WebRTC connection logic
    console.log(`🎤 Joining voice channel: ${channelId}`);

    set((state) => {
      const channel = state.voice.channels.find((c) => c.id === channelId);
      if (channel && !channel.participants.includes(state.user.id)) {
        channel.participants.push(state.user.id);
        state.voice.activeChannelId = channelId;
      }
    });
  },

  leaveVoiceChannel: () => {
    // TODO: Close WebRTC connections
    console.log('🎤 Leaving voice channel');

    set((state) => {
      if (state.voice.activeChannelId) {
        const channel = state.voice.channels.find(
          (c) => c.id === state.voice.activeChannelId,
        );
        if (channel) {
          channel.participants = channel.participants.filter(
            (id) => id !== state.user.id,
          );
        }
        state.voice.activeChannelId = null;
      }
    });
  },

  toggleMute: () => {
    set((state) => {
      state.voice.isMuted = !state.voice.isMuted;
      // TODO: Apply mute to WebRTC stream
    });
  },

  toggleDeafen: () => {
    set((state) => {
      state.voice.isDeafened = !state.voice.isDeafened;
      // TODO: Apply deafen to WebRTC streams
    });
  },

  setAudioDevices: (devices) => {
    set((state) => {
      state.voice.audioDevices = devices;
    });
  },

  selectAudioInput: (deviceId) => {
    set((state) => {
      state.voice.selectedInputDevice = deviceId;
      // TODO: Switch audio input device
    });
  },

  selectAudioOutput: (deviceId) => {
    set((state) => {
      state.voice.selectedOutputDevice = deviceId;
      // TODO: Switch audio output device
    });
  },
});
