import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterResource } from '@nexus/character-contracts';
import { ClassResourceControls } from './ClassResourceControls';

const resource: CharacterResource = {
  id: 'second-wind',
  name: 'Second Wind',
  description: 'Recover hit points.',
  maxUses: 2,
  currentUses: 1,
  rechargeType: 'long-rest',
};

describe('class resource persistence feedback', () => {
  it('waits for host persistence, prevents duplicate use and leaves the balance with the host', async () => {
    let finish!: () => void;
    const onConsume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ClassResourceControls resources={[resource]} onConsume={onConsume} />,
    );
    const button = screen.getByRole('button', { name: 'Use Second Wind' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConsume).toHaveBeenCalledExactlyOnceWith('second-wind', 1);
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving resource use');
    finish();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('use saved'),
    );
    expect(screen.getByText('1 / 2 remaining')).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('reports a failed save and allows a host-controlled retry', async () => {
    const onConsume = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(
      <ClassResourceControls resources={[resource]} onConsume={onConsume} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Second Wind' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'could not be saved',
      ),
    );
    expect(screen.getByText('1 / 2 remaining')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use Second Wind' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('use saved'),
    );
    expect(onConsume).toHaveBeenCalledTimes(2);
  });

  it('disables unknown, empty, unlimited and read-only counters and hides retired ones', () => {
    const onConsume = vi.fn();
    const resources = [
      { ...resource, id: 'unknown', name: 'Unknown', currentUses: undefined },
      { ...resource, id: 'empty', name: 'Empty', currentUses: 0 },
      { ...resource, id: 'unlimited', name: 'Unlimited', unlimited: true },
      { ...resource, id: 'retired', name: 'Retired', active: false },
    ];
    const { rerender } = render(
      <ClassResourceControls resources={resources} onConsume={onConsume} />,
    );
    expect(screen.getByText('Remaining uses not recorded')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button'))
      expect(button).toBeDisabled();
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();
    rerender(
      <ClassResourceControls
        resources={[resource]}
        onConsume={onConsume}
        disabled
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(onConsume).not.toHaveBeenCalled();
    rerender(<ClassResourceControls resources={[]} onConsume={onConsume} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
