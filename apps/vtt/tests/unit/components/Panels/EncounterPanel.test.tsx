import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EncounterPanel } from '@/components/Panels/EncounterPanel';
import {
  loadEncounterRun,
  type EncounterRunView,
} from '@/services/encounterRunClient';
import { commandClient } from '@/services/commandClient';
vi.mock('@/services/encounterRunClient', () => ({ loadEncounterRun: vi.fn() }));
vi.mock('@/services/commandClient', () => ({
  commandClient: { startEncounter: vi.fn(), advanceCombatTurn: vi.fn() },
}));
const deployed: EncounterRunView = {
  run: {
    id: 'run',
    stage: 'deployed',
    currentRound: 1,
    currentTurnIndex: 0,
    participants: [{ actorId: 'goblin', initiativeRoll: 14 }],
  },
  actors: [{ id: 'goblin', name: 'Saved goblin', currentHp: 7, maxHp: 7 }],
};
const show = () =>
  render(
    <EncounterPanel
      link={{
        kind: 'encounter',
        id: 'run',
        campaignId: 'campaign',
        title: 'Real encounter',
      }}
      onClose={vi.fn()}
      isPopout={false}
    />,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadEncounterRun).mockResolvedValue(structuredClone(deployed));
  vi.mocked(commandClient.startEncounter).mockResolvedValue({ success: true });
  vi.mocked(commandClient.advanceCombatTurn).mockResolvedValue({
    success: true,
  });
});
describe('committed encounter panel', () => {
  it('loads actual participants and never invents demo actors', async () => {
    show();
    expect(await screen.findByText('Saved goblin')).toBeInTheDocument();
    expect(screen.queryByText('Astarion')).not.toBeInTheDocument();
    expect(loadEncounterRun).toHaveBeenCalledWith('campaign', 'run');
  });
  it('shows the server round and active participant after starting and advancing', async () => {
    show();
    const start = await screen.findByRole('button', { name: /Start Combat/ });
    vi.mocked(loadEncounterRun).mockResolvedValue({
      ...deployed,
      run: { ...deployed.run, stage: 'active', currentRound: 3 },
    });
    fireEvent.click(start);
    expect(
      await screen.findByRole('button', { name: /Next Turn/ }),
    ).toBeEnabled();
    expect(screen.getByTestId('encounter-round')).toHaveTextContent('3');
    expect(commandClient.startEncounter).toHaveBeenCalledWith(
      'campaign',
      'run',
    );
    vi.mocked(loadEncounterRun).mockResolvedValue({
      ...deployed,
      run: { ...deployed.run, stage: 'active', currentRound: 4 },
    });
    fireEvent.click(screen.getByRole('button', { name: /Next Turn/ }));
    await waitFor(() =>
      expect(screen.getByTestId('encounter-round')).toHaveTextContent('4'),
    );
    expect(commandClient.advanceCombatTurn).toHaveBeenCalledWith(
      'campaign',
      'run',
    );
  });
  it('preserves committed state after rejection and permits explicit refresh', async () => {
    vi.mocked(commandClient.startEncounter).mockResolvedValue({
      success: false,
      error: 'Conflict',
    });
    show();
    fireEvent.click(
      await screen.findByRole('button', { name: /Start Combat/ }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Conflict');
    expect(screen.getByRole('button', { name: /Start Combat/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh encounter' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Start Combat/ }),
      ).toBeEnabled(),
    );
  });
  it('reports a failed load without showing fictional participants', async () => {
    vi.mocked(loadEncounterRun).mockRejectedValue(new Error('Offline'));
    show();
    expect(await screen.findByText('Offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next Turn/ })).toBeDisabled();
  });
});
