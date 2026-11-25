import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { initialCreationData } from '../CharacterCreationWizard/constants/wizard.constants';
import { LiveSheet } from './LiveSheet';

it('labels the change action separately from the sheet summary', () => {
  const onEdit = vi.fn();
  render(
    <LiveSheet
      data={{ ...initialCreationData, name: 'Willow' }}
      canEdit={(section) => section === 'story'}
      onEdit={onEdit}
    />,
  );

  const editHero = screen.getByRole('button', { name: 'Change Hero' });
  expect(editHero).not.toContainElement(screen.getByText('Willow'));
  expect(
    screen.queryByRole('button', { name: 'Change Abilities' }),
  ).not.toBeInTheDocument();

  fireEvent.click(editHero);
  expect(onEdit).toHaveBeenCalledWith('story');
});
