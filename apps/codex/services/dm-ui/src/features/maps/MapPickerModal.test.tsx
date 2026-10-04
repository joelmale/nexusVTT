import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapPickerModal } from './MapPickerModal';

describe('MapPickerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <MapPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText('Add Campaign Map')).not.toBeInTheDocument();
  });

  it('renders modal with Asset Library tab and default sample maps', async () => {
    render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Add Campaign Map')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /asset library/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upload map/i }),
    ).toBeInTheDocument();

    // Default sample maps are visible
    expect(screen.getByText('Glass Harbor (Ashes of Veyra)')).toBeInTheDocument();
    expect(screen.getByText('Sword Coast Regional Map')).toBeInTheDocument();
  });

  it('filters library maps by search query', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const searchInput = screen.getByLabelText(/filter library maps/i);
    await user.type(searchInput, 'Sword Coast');

    expect(screen.getByText('Sword Coast Regional Map')).toBeInTheDocument();
    expect(
      screen.queryByText('Glass Harbor (Ashes of Veyra)'),
    ).not.toBeInTheDocument();
  });

  it('filters library maps by category pill', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    // Click outdoor category pill
    const outdoorPill = screen.getByRole('button', { name: /^outdoor/i });
    await user.click(outdoorPill);

    expect(screen.getByText('Sword Coast Regional Map')).toBeInTheDocument();
    expect(
      screen.queryByText('Glass Harbor (Ashes of Veyra)'),
    ).not.toBeInTheDocument();
  });

  it('selects a library map and auto-fills title if empty', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const dungeonCard = screen.getByText('Dungeon Crossroads');
    await user.click(dungeonCard);

    const titleInput = screen.getByLabelText('Map Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Dungeon Crossroads');
  });

  it('submits selected library map data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByLabelText('Map Title');
    await user.type(titleInput, 'Underground Crossroads');

    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'A treacherous intersection of tunnels');

    await user.click(screen.getByRole('button', { name: 'Create Map' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Underground Crossroads',
      description: 'A treacherous intersection of tunnels',
      imagePath: '/demo-assets/ashes-of-veyra/maps/glass-harbor.png',
      imageAssetRef: {
        target: 'asset',
        assetId: 'library:glass-harbor',
      },
      dimensions: { width: 1920, height: 1080 },
    });
  });

  it('switches to Upload Map tab, handles file selection, and submits uploaded map', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MapPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    // Switch to upload tab
    await user.click(screen.getByRole('button', { name: /upload map/i }));
    expect(
      screen.getByText(/click to browse or drag and drop a map image/i),
    ).toBeInTheDocument();

    // Create a mock file and simulate selection
    const file = new File(['fake-image-bytes'], 'haunted_graveyard.png', {
      type: 'image/png',
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Mock FileReader
    const mockDataUrl = 'data:image/png;base64,mockimagedata';
    vi.spyOn(window, 'FileReader').mockImplementation(function () {
      return {
        readAsDataURL: vi.fn(function (this: FileReader) {
          setTimeout(() => {
            Object.defineProperty(this, 'result', { value: mockDataUrl });
            this.onload?.({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
          }, 0);
        }),
      } as unknown as FileReader;
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Title should be auto-filled
    await waitFor(() => {
      const titleInput = screen.getByLabelText('Map Title') as HTMLInputElement;
      expect(titleInput.value).toBe('haunted graveyard');
    });

    expect(screen.getByText('haunted_graveyard.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Map' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'haunted graveyard',
        imagePath: mockDataUrl,
      }),
    );
  });

  it('calls onClose when close or cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MapPickerModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
