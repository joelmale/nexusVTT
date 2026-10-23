import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignContext,
  type CampaignContextValue,
} from '@/features/campaigns/CampaignContext';
import { MoodPickerModal } from './MoodPickerModal';
import { MoodProvider } from './MoodContext';
import { updateCampaign } from '@/services/campaign-api';

vi.mock('@/services/campaign-api', async () => {
  const actual = await vi.importActual<typeof import('@/services/campaign-api')>(
    '@/services/campaign-api',
  );
  return {
    ...actual,
    updateCampaign: vi.fn().mockResolvedValue(undefined),
  };
});

const mockCampaignContext: CampaignContextValue = {
  activeCampaign: {
    id: 'camp-test-1',
    name: 'Ashes of Veyra',
    description: 'Test Campaign',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    mood: 'parchment',
  },
  campaigns: [],
  error: null,
  isDemoCampaign: false,
  reload: vi.fn(),
  selectCampaign: vi.fn(),
  state: 'ready',
};

describe('MoodPickerModal', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    document.documentElement.removeAttribute('data-mood');
    document.documentElement.style.colorScheme = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderModal(
    props: { isOpen?: boolean; onClose?: () => void } = {},
    contextOverrides: Partial<CampaignContextValue> = {},
  ) {
    const onClose = props.onClose ?? vi.fn();
    const isOpen = props.isOpen ?? true;

    const context = {
      ...mockCampaignContext,
      ...contextOverrides,
    };

    const utils = render(
      <CampaignContext.Provider value={context}>
        <MoodProvider
          campaignId={context.activeCampaign?.id}
          campaignMood={context.activeCampaign?.mood}
          isEditable={!context.isDemoCampaign}
        >
          <MoodPickerModal isOpen={isOpen} onClose={onClose} />
        </MoodProvider>
      </CampaignContext.Provider>,
    );

    return { ...utils, onClose };
  }

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders all 5 campaign mood choices when open', () => {
    renderModal({ isOpen: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Campaign Atmosphere & Mood')).toBeVisible();

    expect(screen.getByRole('button', { name: /Parchment/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Grimdark/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Feywild/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Arcane Night/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Obsidian Dark/ })).toBeVisible();
  });

  it('switches mood and updates document data-mood on click', async () => {
    const user = userEvent.setup();
    renderModal({ isOpen: true });

    const grimdarkBtn = screen.getByRole('button', { name: /Grimdark/ });
    await user.click(grimdarkBtn);

    expect(grimdarkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-mood')).toBe('grimdark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('calls onClose when clicking Done or the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ isOpen: true });

    await user.click(screen.getByRole('button', { name: 'Close mood picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when pressing Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ isOpen: true });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the modal backdrop', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ isOpen: true });

    const backdrop = screen.getByLabelText('Campaign Mood Picker backdrop');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists to campaign when "Save as campaign default" is checked', async () => {
    const user = userEvent.setup();
    vi.mocked(updateCampaign).mockClear();

    renderModal({ isOpen: true });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Save as campaign default for all players',
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const feywildBtn = screen.getByRole('button', { name: /Feywild/ });
    await user.click(feywildBtn);

    expect(updateCampaign).toHaveBeenCalledWith('camp-test-1', { mood: 'feywild' });
  });

  it('does not display campaign default checkbox on demo campaigns', () => {
    renderModal({ isOpen: true }, { isDemoCampaign: true });
    expect(
      screen.queryByRole('checkbox', {
        name: 'Save as campaign default for all players',
      }),
    ).toBeNull();
  });
});
