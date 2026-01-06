export type TokenSize =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'huge'
  | 'gargantuan';
export type TokenCategory =
  | 'pc'
  | 'npc'
  | 'monster'
  | 'object'
  | 'vehicle'
  | 'effect';
export type TokenLayer = 'background' | 'tokens' | 'overlay';

export interface Point {
  x: number;
  y: number;
}

export interface TokenStats {
  hp?: number;
  ac?: number;
  speed?: number;
  cr?: string; // Challenge Rating for monsters
  [key: string]: unknown; // Allow custom stats, 'unknown' is safer than 'any'
}

export interface TokenCondition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface Token {
  id: string;
  name: string;
  image: string; // Can be URL, base64, or hash checksum for IndexedDB
  imageChecksum?: string; // SHA-1 hash for IndexedDB lookups
  thumbnailImage?: string;
  thumbnailChecksum?: string; // SHA-1 hash for thumbnail
  size: TokenSize;
  category: TokenCategory;
  tags?: string[];
  stats?: TokenStats;
  description?: string;
  isCustom?: boolean; // User-uploaded vs system tokens
  isPublic?: boolean; // Public = available to all players, Private = DM only
  exclusive?: boolean; // Only one instance can exist on the board at a time
  createdAt: number;
  updatedAt: number;
}

export interface PlacedToken {
  id: string;
  tokenId: string; // Reference to the base Token
  characterId?: string; // Links to Character.id from characterStore
  sceneId: string;
  roomCode: string; // Links token to specific game room
  x: number;
  y: number;
  rotation: number; // In degrees
  scale: number; // Multiplier (1.0 = normal size)
  layer: TokenLayer;

  // Visibility and permissions
  visibleToPlayers: boolean;
  dmNotesOnly: boolean;

  // Per-instance overrides (override base Token properties)
  nameOverride?: string; // Custom name for this instance
  sizeOverride?: TokenSize; // Custom size for this instance
  lightRadiusOverride?: number; // Custom light radius (in feet)
  auraOverride?: string; // Custom aura effect

  // Game state
  conditions: TokenCondition[];
  currentStats?: Partial<TokenStats>; // Override base token stats
  isDead?: boolean; // Token is dead/defeated
  isInInitiative?: boolean; // Token is in initiative tracker

  // Metadata
  placedBy: string; // User ID who placed the token
  createdAt: number;
  updatedAt: number;
}

export interface TokenLibrary {
  id: string;
  name: string;
  description?: string;
  tokens: Token[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// Token size to grid squares mapping (for D&D 5e)
export const TOKEN_SIZE_GRID_MAPPING: Record<TokenSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

// Token size to pixel dimensions (based on grid size)
export const getTokenPixelSize = (
  size: TokenSize,
  gridSize: number,
): number => {
  return TOKEN_SIZE_GRID_MAPPING[size] * gridSize;
};

// Utility functions
export const createToken = (
  data: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>,
): Token => {
  return {
    ...data,
    id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const createPlacedToken = (
  token: Token,
  position: Point,
  sceneId: string,
  roomCode: string,
  placedBy: string,
  options: Partial<PlacedToken> = {},
): PlacedToken => {
  return {
    id: `placed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tokenId: token.id,
    sceneId,
    roomCode,
    x: position.x,
    y: position.y,
    rotation: 0,
    scale: 1.0,
    layer: 'tokens',
    visibleToPlayers: true,
    dmNotesOnly: false,
    conditions: [],
    isDead: false,
    isInInitiative: false,
    placedBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...options,
  };
};

// Helper functions to get effective properties (with overrides)
export const getEffectiveTokenName = (
  placedToken: PlacedToken,
  baseToken: Token | undefined,
): string => {
  return placedToken.nameOverride || baseToken?.name || 'Unknown Token';
};

export const getEffectiveTokenSize = (
  placedToken: PlacedToken,
  baseToken: Token | undefined,
): TokenSize => {
  return placedToken.sizeOverride || baseToken?.size || 'medium';
};

export const getEffectiveTokenLightRadius = (
  placedToken: PlacedToken,
  _baseToken: Token | undefined,
): number => {
  return placedToken.lightRadiusOverride ?? 0; // Use 0 as default if no override or base
};

export const getEffectiveTokenAura = (
  placedToken: PlacedToken,
  _baseToken: Token | undefined,
): string => {
  return placedToken.auraOverride || 'None';
};

// Token filtering and search utilities
export const filterTokensByCategory = (
  tokens: Token[],
  category: TokenCategory,
): Token[] => {
  return tokens.filter((token) => token.category === category);
};

export const searchTokens = (tokens: Token[], query: string): Token[] => {
  const lowerQuery = query.toLowerCase();
  return tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(lowerQuery) ||
      token.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
      token.description?.toLowerCase().includes(lowerQuery),
  );
};

export const filterTokensBySize = (
  tokens: Token[],
  size: TokenSize,
): Token[] => {
  return tokens.filter((token) => token.size === size);
};
