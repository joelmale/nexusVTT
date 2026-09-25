import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpellbookPanel } from '../../../../src/components/Panels/SpellbookPanel';
import { commandClient } from '../../../../src/services/commandClient';
import type { ObjectLink } from '../../../../src/services/panelRegistry';

vi.mock('../../../../src/services/commandClient', () => ({
  commandClient: {
    applyPreparationPlan: vi.fn().mockResolvedValue({ success: true }),
    castSpell: vi.fn().mockResolvedValue({ success: true }),
    endConcentration: vi.fn().mockResolvedValue({ success: true }),
    restActor: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('SpellbookPanel', () => {
  const mockLink: ObjectLink = {
    kind: 'spellbook',
    id: 'actor-wizard-1',
    campaignId: 'camp-1',
    title: 'Gale of Waterdeep',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (commandClient.applyPreparationPlan as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (commandClient.castSpell as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (commandClient.endConcentration as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (commandClient.restActor as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  it('renders spellbook title, profile attributes, and slot grid', () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.getByTestId('spellbook-panel')).toBeInTheDocument();
    expect(screen.getByText('Gale of Waterdeep')).toBeInTheDocument();
    expect(screen.getByText('INT')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // Save DC
    expect(screen.getByText('+7')).toBeInTheDocument(); // Attack bonus
    expect(screen.getByTestId('slots-grid')).toBeInTheDocument();
    expect(screen.getByTestId('slot-card-1')).toHaveTextContent('4 / 4');
  });

  it('toggles preparation and dispatches applyPreparationPlan', async () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Toggle Detect Magic (initially unprepared)
    const detectMagicCheckbox = screen.getByTestId('prepare-checkbox-detect-magic');
    expect(detectMagicCheckbox).not.toBeChecked();

    fireEvent.click(detectMagicCheckbox);
    expect(detectMagicCheckbox).toBeChecked();

    // Click Apply Plan
    const applyBtn = screen.getByTestId('apply-plan-btn');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(commandClient.applyPreparationPlan).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        'primary-profile',
        expect.arrayContaining(['detect-magic']),
      );
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent(
        'Preparation plan applied successfully.',
      );
    });
  });

  it('casts a cantrip without deducting spell slots', async () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    const castFireBoltBtn = screen.getByTestId('cast-btn-fire-bolt');
    fireEvent.click(castFireBoltBtn);

    await waitFor(() => {
      expect(commandClient.castSpell).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        expect.objectContaining({ kind: 'spell' }),
        'primary-profile',
        0,
      );
      expect(screen.getByTestId('slot-card-1')).toHaveTextContent('4 / 4');
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent('Cast Fire Bolt!');
    });
  });

  it('casts a leveled spell, decrements slots, and shows status', async () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    const castMagicMissileBtn = screen.getByTestId('cast-btn-magic-missile');
    fireEvent.click(castMagicMissileBtn);

    await waitFor(() => {
      expect(commandClient.castSpell).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        expect.objectContaining({ kind: 'spell' }),
        'primary-profile',
        1,
      );
      expect(screen.getByTestId('slot-card-1')).toHaveTextContent('3 / 4');
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent('Cast Magic Missile at level 1!');
    });
  });

  it('shows concentration banner and allows ending concentration', async () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.queryByTestId('concentration-banner')).not.toBeInTheDocument();

    // Cast Hold Person (concentration)
    const castHoldPersonBtn = screen.getByTestId('cast-btn-hold-person');
    fireEvent.click(castHoldPersonBtn);

    await waitFor(() => {
      expect(screen.getByTestId('concentration-banner')).toBeInTheDocument();
      expect(screen.getByText(/Concentrating on/)).toHaveTextContent('hold-person');
    });

    // End Concentration
    const endBtn = screen.getByTestId('end-concentration-btn');
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(commandClient.endConcentration).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        expect.any(String),
      );
      expect(screen.queryByTestId('concentration-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent('Concentration ended.');
    });
  });

  it('triggers short and long rests', async () => {
    render(
      <SpellbookPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Spend a slot first
    fireEvent.click(screen.getByTestId('cast-btn-magic-missile'));
    await waitFor(() => {
      expect(screen.getByTestId('slot-card-1')).toHaveTextContent('3 / 4');
    });

    // Short rest
    fireEvent.click(screen.getByTestId('short-rest-btn'));
    await waitFor(() => {
      expect(commandClient.restActor).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        'short',
      );
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent('Short rest completed.');
    });

    // Long rest (restores all slots)
    fireEvent.click(screen.getByTestId('long-rest-btn'));
    await waitFor(() => {
      expect(commandClient.restActor).toHaveBeenCalledWith(
        'camp-1',
        'actor-wizard-1',
        'long',
      );
      expect(screen.getByTestId('slot-card-1')).toHaveTextContent('4 / 4');
      expect(screen.getByTestId('spellbook-status')).toHaveTextContent('Long rest completed.');
    });
  });
});
