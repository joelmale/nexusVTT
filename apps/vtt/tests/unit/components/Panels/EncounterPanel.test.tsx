import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EncounterPanel } from '../../../../src/components/Panels/EncounterPanel';
import { commandClient } from '../../../../src/services/commandClient';
import type { ObjectLink } from '../../../../src/services/panelRegistry';

vi.mock('../../../../src/services/commandClient', () => ({
  commandClient: {
    startEncounter: vi.fn().mockResolvedValue({ success: true }),
    advanceCombatTurn: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('EncounterPanel', () => {
  const mockLink: ObjectLink = {
    kind: 'encounter',
    id: 'run-enc-1',
    campaignId: 'camp-1',
    title: 'Goblin Ambush',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders encounter details and participants list', () => {
    render(
      <EncounterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.getByTestId('encounter-panel')).toBeInTheDocument();
    expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
    expect(screen.getByTestId('encounter-stage')).toHaveTextContent('deployed');
    expect(screen.getByTestId('encounter-round')).toHaveTextContent('1');
    expect(screen.getByText('Astarion')).toBeInTheDocument();
    expect(screen.getByText('Goblin #1')).toBeInTheDocument();
  });

  it('starts combat and activates round tracking', async () => {
    render(
      <EncounterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    const startBtn = screen.getByTestId('start-combat-btn');
    fireEvent.click(startBtn);

    expect(commandClient.startEncounter).toHaveBeenCalledWith('camp-1', 'run-enc-1');
    expect(screen.getByTestId('encounter-stage')).toHaveTextContent('active');
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('1');
    expect(screen.getByTestId('encounter-active-participant')).toHaveTextContent('Astarion');
    expect(screen.getByTestId('next-turn-btn')).toBeInTheDocument();
  });

  it('advances turn and increments round on wrap-around', async () => {
    render(
      <EncounterPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Start combat first
    fireEvent.click(screen.getByTestId('start-combat-btn'));
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('1');

    // Turn 2
    fireEvent.click(screen.getByTestId('next-turn-btn'));
    expect(commandClient.advanceCombatTurn).toHaveBeenCalledWith('camp-1', 'run-enc-1');
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('2');
    expect(screen.getByTestId('encounter-active-participant')).toHaveTextContent('Goblin #1');

    // Turn 3
    fireEvent.click(screen.getByTestId('next-turn-btn'));
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('3');

    // Turn 4
    fireEvent.click(screen.getByTestId('next-turn-btn'));
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('4');

    // Wrap around to Round 2, Turn 1
    fireEvent.click(screen.getByTestId('next-turn-btn'));
    expect(screen.getByTestId('encounter-round')).toHaveTextContent('2');
    expect(screen.getByTestId('encounter-turn')).toHaveTextContent('1');
    expect(screen.getByTestId('encounter-active-participant')).toHaveTextContent('Astarion');
  });
});
