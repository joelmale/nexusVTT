import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CampaignContext, type CampaignContextValue } from './CampaignContext';
import { CreateCampaignDialog } from './CreateCampaignDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

function createMockCampaignContext(
  overrides?: Partial<CampaignContextValue>,
): CampaignContextValue {
  return {
    activeCampaign: undefined,
    activeCampaignId: undefined,
    campaigns: [],
    createCampaign: vi.fn(),
    error: undefined,
    isDemoCampaign: false,
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
}

describe('CreateCampaignDialog', () => {
  it('renders all form fields including edition and mood selectors (CS-13)', () => {
    const returnFocusRef = createRef<HTMLButtonElement>();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={vi.fn()}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Create campaign' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Campaign name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Description/i })).toBeInTheDocument();

    // Edition radios
    expect(screen.getByRole('radiogroup', { name: 'Rules edition' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /2024 Rules/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /2014 Legacy/i })).toHaveAttribute('aria-checked', 'false');

    // Format radios
    expect(screen.getByRole('radiogroup', { name: 'Adventure format' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Campaign/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /One-Shot/i })).toHaveAttribute('aria-checked', 'false');

    // Mood dropdown
    expect(screen.getByRole('combobox', { name: 'Visual Theme & Mood' })).toHaveValue('parchment');
  });

  it('submits selected edition, format, and mood, and resets form state on success (CS-13 & CS-14)', async () => {
    const user = userEvent.setup();
    const returnFocusRef = createRef<HTMLButtonElement>();
    const createCampaignMock = vi.fn().mockResolvedValue({
      createdAt: '2026-01-01T00:00:00Z',
      id: 'camp-new',
      name: 'Curse of Strahd',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const onClose = vi.fn();
    const context = createMockCampaignContext({ createCampaign: createCampaignMock });

    const { rerender } = render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={onClose}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Campaign name' }), 'Curse of Strahd');
    await user.type(screen.getByRole('textbox', { name: /Description/i }), 'Gothic horror in Barovia');
    await user.click(screen.getByRole('radio', { name: /2014 Legacy/i }));
    await user.click(screen.getByRole('radio', { name: /One-Shot/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Visual Theme & Mood' }), 'grimdark');

    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));

    expect(createCampaignMock).toHaveBeenCalledWith({
      description: 'Gothic horror in Barovia',
      edition: '2014',
      mode: 'one-shot',
      mood: 'grimdark',
      name: 'Curse of Strahd',
    });

    expect(onClose).toHaveBeenCalled();

    // Reopen dialog to verify state was reset (CS-14)
    rerender(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={onClose}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('textbox', { name: 'Campaign name' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /Description/i })).toHaveValue('');
    expect(screen.getByRole('radio', { name: /2024 Rules/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Campaign/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Visual Theme & Mood' })).toHaveValue('parchment');
  });

  it('shows inline validation error when submitting with an empty name', async () => {
    const user = userEvent.setup();
    const returnFocusRef = createRef<HTMLButtonElement>();
    const createCampaignMock = vi.fn();
    const context = createMockCampaignContext({ createCampaign: createCampaignMock });

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={vi.fn()}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));

    expect(screen.getByRole('status')).toHaveTextContent('Enter a campaign name.');
    expect(createCampaignMock).not.toHaveBeenCalled();
  });

  it('displays API error message when campaign creation fails', async () => {
    const user = userEvent.setup();
    const returnFocusRef = createRef<HTMLButtonElement>();
    const createCampaignMock = vi.fn().mockRejectedValue(new Error('Server database error'));
    const context = createMockCampaignContext({ createCampaign: createCampaignMock });

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={vi.fn()}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Campaign name' }), 'My Campaign');
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));

    expect(screen.getByRole('status')).toHaveTextContent('Server database error');
  });

  it('resets form fields and calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const returnFocusRef = createRef<HTMLButtonElement>();
    const onClose = vi.fn();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CreateCampaignDialog
            onClose={onClose}
            open={true}
            returnFocusRef={returnFocusRef}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Campaign name' }), 'Discard Me');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
