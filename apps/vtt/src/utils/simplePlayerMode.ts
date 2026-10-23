/**
 * Shared helpers for Simple Player Mode: the persisted UI-mode preference and
 * the invite link the DM shares with phone and tablet players.
 */

export type PlayerUiMode = 'simple' | 'full';

export const UI_MODE_STORAGE_KEY = 'nexus_vtt_ui_mode';

export function isPlayerUiMode(value: unknown): value is PlayerUiMode {
  return value === 'simple' || value === 'full';
}

/** Reads the stored preference. Private Safari can throw on storage access. */
export function readStoredUiMode(): PlayerUiMode | null {
  try {
    const value = localStorage.getItem(UI_MODE_STORAGE_KEY);
    return isPlayerUiMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredUiMode(mode: PlayerUiMode): void {
  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable: the mode still applies for this page load.
  }
}

/** `${origin}${base}play/CODE`, honouring the router basename. */
export function buildSimpleInviteUrl(
  roomCode: string,
  origin: string = window.location.origin,
  baseUrl: string = import.meta.env.BASE_URL ?? '/',
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${origin}${base}play/${encodeURIComponent(roomCode.toUpperCase())}`;
}
