import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MonsterPanel } from '../../../../src/components/Panels/MonsterPanel';
import { commandClient } from '../../../../src/services/commandClient';
import type { ObjectLink } from '../../../../src/services/panelRegistry';

vi.mock('../../../../src/services/commandClient', () => ({
  commandClient: {
    applyDamage: vi.fn().mockResolvedValue({ success: true }),
    healActor: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('MonsterPanel', () => {
  const mockLink: ObjectLink = {
    kind: 'monster',
    id: 'actor-goblin-1',
    campaignId: 'camp-1',
    title: 'Goblin Scout',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders monster stat block information', () => {
    render(
      <MonsterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.getByTestId('monster-panel')).toBeInTheDocument();
    expect(screen.getByText('Goblin Scout')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // Armor Class
    expect(screen.getByTestId('monster-hp-display')).toHaveTextContent('18 / 18');
    expect(screen.getByText('30 ft.')).toBeInTheDocument(); // Speed
    expect(screen.getByText('STR')).toBeInTheDocument();
    expect(screen.getByText('DEX')).toBeInTheDocument();
    expect(screen.getByText('Multiattack.')).toBeInTheDocument();
  });

  it('applies damage and updates local HP display', async () => {
    render(
      <MonsterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    const input = screen.getByTestId('monster-hp-input');
    fireEvent.change(input, { target: { value: '6' } });

    const damageBtn = screen.getByTestId('monster-damage-btn');
    fireEvent.click(damageBtn);

    expect(commandClient.applyDamage).toHaveBeenCalledWith(
      'camp-1',
      'actor-goblin-1',
      6,
    );
    expect(screen.getByTestId('monster-hp-display')).toHaveTextContent('12 / 18');
  });

  it('heals monster and updates local HP display', async () => {
    render(
      <MonsterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Apply damage first
    const input = screen.getByTestId('monster-hp-input');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('monster-damage-btn'));
    expect(screen.getByTestId('monster-hp-display')).toHaveTextContent('8 / 18');

    // Now heal 5 HP
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('monster-heal-btn'));

    expect(commandClient.healActor).toHaveBeenCalledWith(
      'camp-1',
      'actor-goblin-1',
      5,
    );
    expect(screen.getByTestId('monster-hp-display')).toHaveTextContent('13 / 18');
  });
});
