import React, { useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CharacterCreationProvider } from './CharacterCreationLauncher';
import { useGameStore } from '@/stores/gameStore';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';

/**
 * Shared providers for all pages
 *
 * Wraps the application in necessary providers:
 * - DndProvider: React DnD for drag-and-drop
 * - CharacterCreationProvider: Character creation modal
 * - Session Persistence: Automatic game state save/restore
 */
export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const checkAuth = useGameStore((state) => state.checkAuth);
  const didCheckAuth = useRef(false);

  // Initialize authentication state on app load — run once only.
  // checkAuth is a Zustand action whose reference changes on store mutations,
  // so we guard with a ref rather than depending on the function identity.
  useEffect(() => {
    if (didCheckAuth.current) return;
    didCheckAuth.current = true;
    checkAuth();
  }, [checkAuth]);

  // Enable automatic session persistence (saves game state on changes)
  // Auto-recovery is always enabled - session is cleared when user explicitly leaves
  useSessionPersistence({
    autoSave: true,
    saveInterval: 30000, // Save every 30 seconds
    enableAutoRecovery: true, // Always attempt recovery (session cleared on explicit leave)
  });

  return (
    <DndProvider backend={HTML5Backend}>
      <CharacterCreationProvider>{children}</CharacterCreationProvider>
    </DndProvider>
  );
};
