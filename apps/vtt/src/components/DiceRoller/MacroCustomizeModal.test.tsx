import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MacroCustomizeModal } from './MacroCustomizeModal';
import { CATALOG_MACROS } from './macros';

const setup = (enabledIds: string[] = ['attack']) => {
  const props = {
    macros: CATALOG_MACROS,
    enabledIds,
    onToggle: vi.fn(),
    onAddCustom: vi.fn(),
    onClose: vi.fn(),
  };
  render(<MacroCustomizeModal {...props} />);
  return props;
};

describe('MacroCustomizeModal', () => {
  it('lists every macro with its checked state', () => {
    setup(['attack']);
    expect(screen.getAllByRole('checkbox')).toHaveLength(CATALOG_MACROS.length);
    expect(screen.getByLabelText('Toggle Melee Attack')).toBeChecked();
    expect(screen.getByLabelText('Toggle Fireball')).not.toBeChecked();
  });

  it('calls onToggle with the macro id', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Toggle Fireball'));
    expect(props.onToggle).toHaveBeenCalledWith('fireball');
  });

  it('keeps Add disabled until name and formula are both filled', () => {
    setup();
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('New macro action name'), {
      target: { value: 'Smite' },
    });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('New macro formula'), {
      target: { value: '2d8+4' },
    });
    expect(add).toBeEnabled();
  });

  it('submits a trimmed custom macro and clears the form', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('New macro action name'), {
      target: { value: '  Smite ' },
    });
    fireEvent.change(screen.getByLabelText('New macro formula'), {
      target: { value: ' 2d8+4 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(props.onAddCustom).toHaveBeenCalledWith('Smite', '2d8+4');
    expect(screen.getByLabelText('New macro action name')).toHaveValue('');
    expect(screen.getByLabelText('New macro formula')).toHaveValue('');
  });

  it('closes from the Done and close buttons', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close macro modal' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
