import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { RunSheetExportModal } from './RunSheetExportModal';

const baseBundle = getFixtureBundle('ashes-of-veyra')!;
const session = baseBundle.sessions[0]!;

describe('RunSheetExportModal', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        session={session}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: /Session Run Sheet Export/i }),
    ).toBeVisible();
    expect(screen.getByTestId('rendered-preview')).toBeVisible();
  });

  it('switches between Rendered preview and Markdown tabs', async () => {
    const user = userEvent.setup();
    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        session={session}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Markdown' }));
    expect(screen.getByTestId('markdown-preview')).toBeVisible();
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent(
      `Session ${session.number}: ${session.title}`,
    );

    await user.click(screen.getByRole('button', { name: 'Print Preview' }));
    expect(screen.getByTestId('rendered-preview')).toBeVisible();
  });

  it('copies markdown to clipboard', async () => {
    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        session={session}
      />,
    );

    const copyBtn = screen.getByRole('button', { name: /Copy Markdown/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining(`Session ${session.number}: ${session.title}`),
    );
    expect(await screen.findByText('Copied!')).toBeVisible();
  });

  it('triggers download when Download .md is clicked', async () => {
    const user = userEvent.setup();
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        session={session}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Download \.md/i }));
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it('triggers print when Print / PDF is clicked', async () => {
    const user = userEvent.setup();
    const printWindowMock = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindowMock as unknown as Window);

    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        session={session}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Print \/ PDF/i }));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(printWindowMock.document.write).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked or Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <RunSheetExportModal
        bundle={baseBundle}
        isOpen={true}
        onClose={onClose}
        session={session}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Close export modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
