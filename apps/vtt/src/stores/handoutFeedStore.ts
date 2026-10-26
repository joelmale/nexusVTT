import { create } from 'zustand';

/**
 * Handouts the DM has revealed this session, for Simple Player Mode's
 * spotlight and Rolls-drawer list. Ephemeral: reveals are broadcast events,
 * not canonical game state.
 */

export interface RevealedHandout {
  id: string;
  title: string;
  /** Origin-relative image or plain-text path resolved by the server. */
  url?: string;
  revealedAt: number;
}

interface HandoutFeedState {
  handouts: RevealedHandout[];
  spotlightId: string | null;
  addHandout: (handout: RevealedHandout) => void;
  openSpotlight: (id: string) => void;
  dismissSpotlight: () => void;
  reset: () => void;
}

const MAX_HANDOUTS = 20;

export const useHandoutFeedStore = create<HandoutFeedState>()((set) => ({
  handouts: [],
  spotlightId: null,
  addHandout: (handout) =>
    set((state) => ({
      handouts: [
        handout,
        ...state.handouts.filter((h) => h.id !== handout.id),
      ].slice(0, MAX_HANDOUTS),
      spotlightId: handout.url ? handout.id : state.spotlightId,
    })),
  openSpotlight: (id) => set({ spotlightId: id }),
  dismissSpotlight: () => set({ spotlightId: null }),
  reset: () => set({ handouts: [], spotlightId: null }),
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Records a `handout/revealed` event payload; malformed payloads are ignored. */
export function recordRevealedHandout(data: unknown): void {
  if (!isRecord(data)) return;
  const id =
    typeof data.commandId === 'string' && data.commandId
      ? data.commandId
      : `handout-${Date.now()}`;
  const title =
    typeof data.title === 'string' && data.title ? data.title : 'Handout';
  // Only same-origin paths: the server resolves these from the asset service.
  const url =
    typeof data.url === 'string' && /^\/(?!\/)/.test(data.url)
      ? data.url
      : undefined;
  useHandoutFeedStore
    .getState()
    .addHandout({ id, title, url, revealedAt: Date.now() });
}
