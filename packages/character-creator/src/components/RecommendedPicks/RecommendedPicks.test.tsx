import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecommendedPicks } from './RecommendedPicks';
import { initialCreationData } from '../CharacterCreationWizard/constants/wizard.constants';
import type { CharacterCreationData } from '../../types/dnd';

const data2024 = { ...initialCreationData, edition: '2024' } as CharacterCreationData;

describe('RecommendedPicks', () => {
  afterEach(cleanup);

  it('keeps Use disabled until a class is chosen, then applies a legal draft', () => {
    const onApply = vi.fn();
    const onApplied = vi.fn();
    render(<RecommendedPicks data={data2024} onApply={onApply} onApplied={onApplied} />);

    const use = screen.getByRole('button', { name: 'Use recommended picks' });
    expect((use as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^Fighter/ }));
    expect(screen.getByRole('status').textContent).toContain('Soldier');
    fireEvent.click(use);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].creationData.classSlug).toBe('fighter');
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('offers no Artificer, which has no authored kit', () => {
    render(<RecommendedPicks data={data2024} onApply={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Artificer/ })).toBeNull();
  });

  it('is hidden for 2014, where no kits are authored', () => {
    const { container } = render(
      <RecommendedPicks
        data={{ ...data2024, edition: '2014' } as CharacterCreationData}
        onApply={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
