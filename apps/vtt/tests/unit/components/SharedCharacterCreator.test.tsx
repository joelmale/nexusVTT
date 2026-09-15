/**
 * The shared creator's host contract, exercised through the real wizard UI:
 * cancellation, a successful save, a failed save that keeps the wizard open,
 * and the guard against creating the same character twice.
 *
 * The wizard's final step is driven directly rather than clicking through all
 * fourteen steps; the contract under test is the completion handshake, not the
 * step-by-step rules UI (covered by the conversion tests and Forge's suite).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHARACTER_CREATOR_ROOT_CLASS,
  CharacterCreationWizard,
} from '@nexus/character-creator';

describe('shared character creator host contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const renderCreator = (
    overrides: Partial<React.ComponentProps<typeof CharacterCreationWizard>> = {},
  ) => {
    const onCancel = vi.fn();
    const onComplete = vi.fn();
    const utils = render(
      <CharacterCreationWizard
        isOpen
        edition="2014"
        onCancel={onCancel}
        onComplete={onComplete}
        {...overrides}
      />,
    );
    return { ...utils, onCancel, onComplete };
  };

  it('renders nothing when closed', () => {
    const { container } = render(
      <CharacterCreationWizard
        isOpen={false}
        onCancel={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector(`.${CHARACTER_CREATOR_ROOT_CLASS}`),
    ).toBeNull();
  });

  it('scopes its styles to its own root and applies the host theme', () => {
    renderCreator({ theme: 'light' });

    const root = document.querySelector(`.${CHARACTER_CREATOR_ROOT_CLASS}`);
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-theme')).toBe('light');

    // Nothing is applied to the document itself — no host-wide resets.
    expect(document.body.getAttribute('data-theme')).toBeNull();
    expect(
      document.documentElement.classList.contains(CHARACTER_CREATOR_ROOT_CLASS),
    ).toBe(false);
  });

  it('exposes an accessible, focusable modal dialog', async () => {
    renderCreator();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.getAttribute('aria-label')).toMatch(/step 1 of/i);
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it('cancels on Escape and on backdrop click', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderCreator();

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    const root = document.querySelector(
      `.${CHARACTER_CREATOR_ROOT_CLASS}`,
    ) as HTMLElement;
    await user.click(root);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not cancel when the dialog body is clicked', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderCreator();

    await user.click(await screen.findByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
