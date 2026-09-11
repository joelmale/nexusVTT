import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface Token {
  id: string;
  position: { x: number; y: number };
  label: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  lightRadius: number; // in feet
  aura: 'None' | 'Frightened' | 'Charmed' | 'Poisoned' | 'Custom';
  conditions: string[];
  isDead: boolean;
  isHidden: boolean;
  isInInitiative: boolean;
  controlledBy: string[]; // player IDs
  roomCode: string;
}

export interface TokenState {
  tokens: Token[];
  selectedTokenId: string | null;
  activeToolbarTool: string | null; // which tool's panel is open
}

export interface TokenActions {
  // Token management
  addToken: (token: Omit<Token, 'id'>) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;
  removeToken: (id: string) => void;
  duplicateToken: (id: string) => void;

  // Selection
  selectToken: (id: string | null) => void;
  clearSelection: () => void;

  // Toolbar
  setActiveToolbarTool: (tool: string | null) => void;

  // Token properties
  updateTokenLabel: (id: string, label: string) => void;
  updateTokenSize: (id: string, size: Token['size']) => void;
  updateTokenLight: (id: string, radius: number) => void;
  updateTokenAura: (id: string, aura: Token['aura']) => void;
  toggleTokenCondition: (id: string, condition: string) => void;
  toggleTokenDead: (id: string) => void;
  toggleTokenHidden: (id: string) => void;
  toggleTokenInitiative: (id: string) => void;
  updateTokenControl: (id: string, playerIds: string[]) => void;

  // Utility
  getSelectedToken: () => Token | null;
  getTokensForRoom: (roomCode: string) => Token[];
}

const initialState: TokenState = {
  tokens: [],
  selectedTokenId: null,
  activeToolbarTool: null,
};

export const useTokenStore = create<TokenState & TokenActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Token management
    addToken: (tokenData) => {
      const newToken: Token = {
        ...tokenData,
        id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      set((state) => ({
        tokens: [...state.tokens, newToken],
      }));
    },

    updateToken: (id, updates) => {
      set((state) => ({
        tokens: state.tokens.map((token) =>
          token.id === id ? { ...token, ...updates } : token,
        ),
      }));
    },

    removeToken: (id) => {
      set((state) => ({
        tokens: state.tokens.filter((token) => token.id !== id),
        selectedTokenId:
          state.selectedTokenId === id ? null : state.selectedTokenId,
        activeToolbarTool:
          state.selectedTokenId === id ? null : state.activeToolbarTool,
      }));
    },

    duplicateToken: (id) => {
      const originalToken = get().tokens.find((t) => t.id === id);
      if (originalToken) {
        const newToken: Omit<Token, 'id'> = {
          ...originalToken,
          position: {
            x: originalToken.position.x + 50,
            y: originalToken.position.y + 50,
          },
          label: `${originalToken.label} (Copy)`,
        };
        get().addToken(newToken);
      }
    },

    // Selection
    selectToken: (id) => {
      console.log('📍 tokenStore.selectToken called:', id);
      set({ selectedTokenId: id, activeToolbarTool: null });
      console.log('📍 tokenStore state after select:', get().selectedTokenId);
    },

    clearSelection: () => {
      set({ selectedTokenId: null, activeToolbarTool: null });
    },

    // Toolbar
    setActiveToolbarTool: (tool) => {
      set({ activeToolbarTool: tool });
    },

    // Token properties
    updateTokenLabel: (id, label) => {
      get().updateToken(id, { label });
    },

    updateTokenSize: (id, size) => {
      get().updateToken(id, { size });
    },

    updateTokenLight: (id, radius) => {
      get().updateToken(id, { lightRadius: radius });
    },

    updateTokenAura: (id, aura) => {
      get().updateToken(id, { aura });
    },

    toggleTokenCondition: (id, condition) => {
      const token = get().tokens.find((t) => t.id === id);
      if (token) {
        const hasCondition = token.conditions.includes(condition);
        const newConditions = hasCondition
          ? token.conditions.filter((c) => c !== condition)
          : [...token.conditions, condition];
        get().updateToken(id, { conditions: newConditions });
      }
    },

    toggleTokenDead: (id) => {
      const token = get().tokens.find((t) => t.id === id);
      if (token) {
        get().updateToken(id, { isDead: !token.isDead });
      }
    },

    toggleTokenHidden: (id) => {
      const token = get().tokens.find((t) => t.id === id);
      if (token) {
        get().updateToken(id, { isHidden: !token.isHidden });
      }
    },

    toggleTokenInitiative: (id) => {
      const token = get().tokens.find((t) => t.id === id);
      if (token) {
        get().updateToken(id, { isInInitiative: !token.isInInitiative });
      }
    },

    updateTokenControl: (id, playerIds) => {
      get().updateToken(id, { controlledBy: playerIds });
    },

    // Utility
    getSelectedToken: () => {
      const { tokens, selectedTokenId } = get();
      return selectedTokenId
        ? tokens.find((t) => t.id === selectedTokenId) || null
        : null;
    },

    getTokensForRoom: (roomCode) => {
      return get().tokens.filter((token) => token.roomCode === roomCode);
    },
  })),
);

// Selectors for common use cases
// Note: This hook is deprecated and returns tokens from the library, not placed tokens
// Use useSelectedPlacedToken from gameStore instead for scene canvas operations
export const useSelectedToken = () =>
  useTokenStore((state) => state.getSelectedToken());
export const useTokensForRoom = (roomCode: string) =>
  useTokenStore((state) => state.getTokensForRoom(roomCode));
export const useTokenToolbar = () =>
  useTokenStore((state) => ({
    selectedTokenId: state.selectedTokenId,
    activeToolbarTool: state.activeToolbarTool,
    setActiveToolbarTool: state.setActiveToolbarTool,
  }));
