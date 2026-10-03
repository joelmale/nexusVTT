import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { IconStudioPanel } from '@/components/Panels/IconStudio/IconStudioPanel';
import { useIconStore } from '@/stores/iconStore';
import * as imageOptimizer from '@/utils/imageOptimizer';

describe('IconStudioPanel', () => {
  beforeEach(() => {
    useIconStore.setState({
      globalCampaignPackId: 'nexus-vector-gold',
      localUserOverrides: {},
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders header, pack controller, category tabs, and icon cards', () => {
    render(<IconStudioPanel />);

    expect(screen.getByRole('heading', { name: /Icon Studio/i })).toBeInTheDocument();
    expect(screen.getByTestId('campaign-pack-select')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();

    // Category tabs
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Panels' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conditions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();

    // Check presence of some core icons
    expect(screen.getByText('Atlas Studio')).toBeInTheDocument();
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });

  it('filters icons by category tabs', () => {
    render(<IconStudioPanel />);

    // Click "Conditions"
    fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expect(screen.queryByText('Atlas Studio')).not.toBeInTheDocument();

    // Click "Tools"
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByText('Select Tool')).toBeInTheDocument();
    expect(screen.queryByText('Poisoned')).not.toBeInTheDocument();

    // Click "Panels"
    fireEvent.click(screen.getByRole('button', { name: 'Panels' }));
    expect(screen.getByText('Atlas Studio')).toBeInTheDocument();
    expect(screen.queryByText('Select Tool')).not.toBeInTheDocument();
  });

  it('filters icons by search input query', () => {
    render(<IconStudioPanel />);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    fireEvent.change(searchInput, { target: { value: 'poison' } });

    expect(screen.getByText('Poisoned')).toBeInTheDocument();
    expect(screen.queryByText('Atlas Studio')).not.toBeInTheDocument();
  });

  it('switches global campaign theme pack', () => {
    render(<IconStudioPanel />);

    const select = screen.getByTestId('campaign-pack-select') as HTMLSelectElement;
    expect(select.value).toBe('nexus-vector-gold');

    fireEvent.change(select, { target: { value: 'default-emoji' } });

    expect(useIconStore.getState().globalCampaignPackId).toBe('default-emoji');
  });

  it('handles drag-over and drag-and-drop file upload to set local override', async () => {
    vi.spyOn(imageOptimizer, 'optimizeIconImage').mockResolvedValue(
      'data:image/png;base64,customIconDataUrl',
    );

    render(<IconStudioPanel />);

    const card = screen.getByTestId('icon-card-condition:poisoned');

    // Drag over
    fireEvent.dragOver(card);
    expect(card.className).toContain('dragOver');

    // Drag leave
    fireEvent.dragLeave(card);
    expect(card.className).not.toContain('dragOver');

    // Drop file
    const fakeFile = new File(['dummy'], 'custom-poison.png', {
      type: 'image/png',
    });
    fireEvent.drop(card, {
      dataTransfer: {
        files: [fakeFile],
      },
    });

    await waitFor(() => {
      expect(
        useIconStore.getState().localUserOverrides['condition:poisoned'],
      ).toBe('data:image/png;base64,customIconDataUrl');
    });

    expect(screen.getByText(/Updated condition:poisoned with custom override/i)).toBeInTheDocument();
  });

  it('handles hidden file input upload and displays error when optimization fails', async () => {
    vi.spyOn(imageOptimizer, 'optimizeIconImage').mockRejectedValue(
      new Error('File exceeds 5MB limit.'),
    );

    render(<IconStudioPanel />);

    const input = screen.getByTestId('file-input-condition:poisoned');
    const fakeFile = new File(['dummy'], 'huge-icon.png', {
      type: 'image/png',
    });

    fireEvent.change(input, {
      target: { files: [fakeFile] },
    });

    await waitFor(() => {
      expect(screen.getByText('File exceeds 5MB limit.')).toBeInTheDocument();
    });
  });

  it('resets a local override when clicking Reset button', async () => {
    useIconStore.setState({
      localUserOverrides: {
        'condition:poisoned': 'data:image/png;base64,override',
      },
    });

    render(<IconStudioPanel />);

    // Should show "Local Override" badge
    expect(screen.getByText('Local Override')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /^Reset$/i });
    fireEvent.click(resetBtn);

    expect(
      useIconStore.getState().localUserOverrides['condition:poisoned'],
    ).toBeUndefined();
    expect(screen.getByText(/Reverted condition:poisoned to theme default/i)).toBeInTheDocument();
  });

  it('clears all local overrides when clicking Reset All button', () => {
    useIconStore.setState({
      localUserOverrides: {
        'condition:poisoned': 'data:image/png;base64,poison',
        'panel:atlas': 'data:image/png;base64,atlas',
      },
    });

    render(<IconStudioPanel />);

    const resetAllBtn = screen.getByRole('button', {
      name: /Reset All \(2\)/i,
    });
    fireEvent.click(resetAllBtn);

    expect(useIconStore.getState().localUserOverrides).toEqual({});
    expect(screen.getByText(/Cleared all local icon overrides/i)).toBeInTheDocument();
  });

  it('copies ComfyUI prompt to clipboard on button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<IconStudioPanel />);

    const copyBtns = screen.getAllByRole('button', { name: /Copy Prompt/i });
    fireEvent.click(copyBtns[0]);

    expect(writeTextMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('exports and imports custom icon pack JSON', async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    useIconStore.setState({
      localUserOverrides: {
        'condition:charmed': 'data:image/png;base64,charmed',
      },
    });

    render(<IconStudioPanel />);

    // Export test
    const exportBtn = screen.getByRole('button', { name: /Export/i });
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(screen.getByText(/Exported 1 icon overrides to JSON/i)).toBeInTheDocument();

    // Import test
    const importInput = screen.getByTestId('import-pack-input');
    const validPackJson = JSON.stringify({
      id: 'custom-pack',
      name: 'Imported Pack',
      icons: {
        'condition:dead': 'data:image/png;base64,dead',
      },
    });

    const file = new File([validPackJson], 'pack.json', {
      type: 'application/json',
    });

    // Mock FileReader for import
    const originalFileReader = global.FileReader;
    class MockFileReader {
      result = validPackJson;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mock FileReader
    global.FileReader = MockFileReader;

    try {
      fireEvent.change(importInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getByText('Successfully imported custom icon pack!'),
        ).toBeInTheDocument();
      });

      expect(
        useIconStore.getState().localUserOverrides['condition:dead'],
      ).toBe('data:image/png;base64,dead');
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('displays error message when importing invalid pack JSON', async () => {
    render(<IconStudioPanel />);
    const importInput = screen.getByTestId('import-pack-input');
    const invalidJson = 'not valid json';
    const file = new File([invalidJson], 'bad.json', {
      type: 'application/json',
    });

    const originalFileReader = global.FileReader;
    class MockFileReader {
      result = invalidJson;
      onload: (() => void) | null = null;
      readAsText() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mock FileReader
    global.FileReader = MockFileReader;

    try {
      fireEvent.change(importInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getByText('Invalid icon pack JSON format.'),
        ).toBeInTheDocument();
      });
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('displays error message when import file reading fails', async () => {
    render(<IconStudioPanel />);
    const importInput = screen.getByTestId('import-pack-input');
    const file = new File([''], 'error.json', { type: 'application/json' });

    const originalFileReader = global.FileReader;
    class MockErrorFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    // @ts-expect-error Mock FileReader
    global.FileReader = MockErrorFileReader;

    try {
      fireEvent.change(importInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getByText('Failed to read import file.'),
        ).toBeInTheDocument();
      });
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('handles keyboard navigation (Enter and Space) on drop zones', () => {
    render(<IconStudioPanel />);
    const card = screen.getByTestId('icon-card-condition:poisoned');
    const dropZone = card.querySelector('[role="button"]');
    expect(dropZone).not.toBeNull();

    if (dropZone) {
      fireEvent.keyDown(dropZone, { key: 'Enter' });
      fireEvent.keyDown(dropZone, { key: ' ' });
      fireEvent.keyDown(dropZone, { key: 'Tab' });
    }
  });

  it('filters by icon ID or prompt keywords', () => {
    render(<IconStudioPanel />);
    const searchInput = screen.getByPlaceholderText('Search icons...');

    // Search by ID
    fireEvent.change(searchInput, { target: { value: 'tool:pencil' } });
    expect(screen.getByText('Freehand Draw')).toBeInTheDocument();

    // Search by prompt keyword
    fireEvent.change(searchInput, { target: { value: 'quill' } });
    expect(screen.getByText('Freehand Draw')).toBeInTheDocument();
  });

  it('toggles tight-crop and background removal options in control bar', () => {
    render(<IconStudioPanel />);

    const tightCropToggle = screen.getByTestId('tight-crop-toggle') as HTMLInputElement;
    const removeBgToggle = screen.getByTestId('remove-bg-toggle') as HTMLInputElement;

    expect(tightCropToggle.checked).toBe(true);
    expect(removeBgToggle.checked).toBe(false);

    fireEvent.click(tightCropToggle);
    expect(tightCropToggle.checked).toBe(false);

    fireEvent.click(removeBgToggle);
    expect(removeBgToggle.checked).toBe(true);
  });

  it('crops an overridden icon card tightly when clicking Fit button', async () => {
    useIconStore.setState({
      localUserOverrides: {
        'condition:poisoned': 'data:image/png;base64,initialPoisonOverride',
      },
    });

    vi.spyOn(imageOptimizer, 'optimizeIconDataUrl').mockResolvedValue(
      'data:image/png;base64,fittedPoisonOverride',
    );

    render(<IconStudioPanel />);

    const fitBtn = screen.getByTestId('fit-btn-condition:poisoned');
    expect(fitBtn).toBeInTheDocument();

    fireEvent.click(fitBtn);

    await waitFor(() => {
      expect(
        useIconStore.getState().localUserOverrides['condition:poisoned'],
      ).toBe('data:image/png;base64,fittedPoisonOverride');
    });

    expect(
      screen.getByText(/Cropped condition:poisoned tightly to fit frame/i),
    ).toBeInTheDocument();
  });

  it('crops all overridden icons tightly when clicking Fit All button', async () => {
    useIconStore.setState({
      localUserOverrides: {
        'condition:poisoned': 'data:image/png;base64,poisonData',
        'condition:blinded': 'data:image/png;base64,blindedData',
      },
    });

    vi.spyOn(imageOptimizer, 'optimizeIconDataUrl').mockResolvedValue(
      'data:image/png;base64,allCropped',
    );

    render(<IconStudioPanel />);

    const fitAllBtn = screen.getByTestId('fit-all-btn');
    expect(fitAllBtn).toBeInTheDocument();
    expect(fitAllBtn).toHaveTextContent('Fit All (2)');

    fireEvent.click(fitAllBtn);

    await waitFor(() => {
      expect(
        useIconStore.getState().localUserOverrides['condition:poisoned'],
      ).toBe('data:image/png;base64,allCropped');
      expect(
        useIconStore.getState().localUserOverrides['condition:blinded'],
      ).toBe('data:image/png;base64,allCropped');
      expect(
        screen.getByText(/Tight-cropped 2 icon\(s\) to fit their frames/i),
      ).toBeInTheDocument();
    });
  });
});
