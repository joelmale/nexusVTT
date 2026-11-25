import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Recovery = {
  phase: 'loading' | 'ready' | 'conflict';
  initialDraft?: { edition: '2014' | '2024' };
  initialPresentation?: undefined;
  recovery?: undefined;
  error?: undefined;
};

const recoveryState = vi.hoisted(() => ({
  current: { phase: 'ready' } as Recovery,
}));

vi.mock('@nexus/character-creator', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@nexus/character-creator')>();
  return {
    resolveRequestedEdition: actual.resolveRequestedEdition,
    createdCharacterToNexus: vi.fn(),
    useCreatorRecovery: () => ({
      ...recoveryState.current,
      flush: vi.fn(),
      discard: vi.fn(),
      reload: vi.fn(),
      resume: vi.fn(),
      exportDraft: vi.fn(),
      freezeCompletion: vi.fn(),
      onDraftChange: vi.fn(),
      onPresentationChange: vi.fn(),
    }),
    CharacterCreator: ({ edition }: { edition?: string }) => (
      <div data-testid="creator" data-edition={edition} />
    ),
  };
});
vi.mock('@nexus/character-creator/styles.css', () => ({}));
vi.mock('@/services/characterHandoff', () => ({
  handoffSavedCharacter: vi.fn(),
}));
vi.mock('@/services/rulesCatalogClient', () => ({
  getRulesCatalogVersion: vi.fn(),
}));
vi.mock('@/services/storageWorkerClient', () => ({
  storageWorkerClient: {
    getCreatorDraft: vi.fn(),
    saveCreatorDraft: vi.fn(),
    deleteCreatorDraft: vi.fn(),
  },
}));
vi.mock('@/stores/characterStore', () => ({
  useCharacterStore: { getState: vi.fn() },
}));
vi.mock('@/stores/gameStore', () => ({
  useGameStore: (selector: (state: unknown) => unknown) =>
    selector({ session: null }),
  useTheme: () => 'dark',
}));
vi.mock('@/utils/notifications', () => ({ toast: { success: vi.fn() } }));

import { SharedCharacterCreator } from './SharedCharacterCreator';

const renderCreator = () =>
  render(
    <SharedCharacterCreator
      playerId="player-1"
      onComplete={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe('SharedCharacterCreator edition', () => {
  beforeEach(() => {
    recoveryState.current = { phase: 'ready' };
    // jsdom does not implement the dialog API.
    HTMLDialogElement.prototype.showModal ??= function showModal() {
      this.setAttribute('open', '');
    };
  });
  afterEach(() => window.history.pushState({}, '', '/'));

  it('goes straight to 2024 rules with no edition choice', () => {
    renderCreator();

    expect(screen.getByTestId('creator')).toHaveAttribute(
      'data-edition',
      '2024',
    );
    expect(screen.queryByText(/Use 2014 rules/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Use 2024 rules/)).not.toBeInTheDocument();
  });

  it('opens 2014 rules when ?edition=2014 is present', () => {
    window.history.pushState({}, '', '/?edition=2014');
    renderCreator();

    expect(screen.getByTestId('creator')).toHaveAttribute(
      'data-edition',
      '2014',
    );
  });

  it('lets a saved draft edition win over the query parameter', () => {
    window.history.pushState({}, '', '/?edition=2014');
    recoveryState.current = {
      phase: 'ready',
      initialDraft: { edition: '2024' },
    };
    renderCreator();

    expect(screen.getByTestId('creator')).toHaveAttribute(
      'data-edition',
      '2024',
    );
  });

  it('resumes an existing 2014 draft as 2014 without the query parameter', () => {
    recoveryState.current = {
      phase: 'ready',
      initialDraft: { edition: '2014' },
    };
    renderCreator();

    expect(screen.getByTestId('creator')).toHaveAttribute(
      'data-edition',
      '2014',
    );
  });

  it('still shows the recovery dialog while a stored draft needs a decision', () => {
    recoveryState.current = { phase: 'conflict' };
    renderCreator();

    expect(screen.queryByTestId('creator')).not.toBeInTheDocument();
    expect(
      screen.getByText('Export recovery copy', { selector: 'button' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Discard draft and start new', { selector: 'button' }),
    ).toBeInTheDocument();
  });
});
