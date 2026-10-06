import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MapPickerModal } from './MapPickerModal';

describe('MapPickerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('BASE_URL', '/codex-dm/');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('shows root-path thumbnails for bundled maps and a placeholder for the demo map', async () => {
    const user = userEvent.setup();
    render(<MapPickerModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
    // The demo map has no thumbnail, so it is never loaded as a 3.9 MB card.
    expect(screen.getByText('Glass Harbor (Ashes of Veyra)')).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Glass Harbor (Ashes of Veyra)' }),
    ).toBeNull();

    await user.type(screen.getByLabelText(/filter library maps/i), 'Canals');
    expect(screen.getByRole('img', { name: '11. Canals' })).toHaveAttribute(
      'src',
      '/assets/defaults/base_maps/thumbnails/11. Canals.thumb.jpg',
    );
  });

  it('never replaces a failed thumbnail with the full-size image and does not fetch a manifest', async () => {
    const user = userEvent.setup();
    render(<MapPickerModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(fetch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/filter library maps/i), 'Canals');
    const thumbnail = screen.getByRole('img', { name: '11. Canals' });
    fireEvent.error(thumbnail);

    // The card falls back to a placeholder; nothing requests the big webp.
    expect(screen.queryByRole('img', { name: '11. Canals' })).toBeNull();
    expect(document.querySelectorAll('img[src$=".webp"]').length).toBe(0);
    expect(screen.getByText('11. Canals')).toBeInTheDocument();
  });

  it('renders the tabs and a first page of maps, with Show more for the rest', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText('Add Campaign Map')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /asset library/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upload map/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Glass Harbor (Ashes of Veyra)'),
    ).toBeInTheDocument();

    // Only one page of cards is in the DOM until the user asks for more.
    const firstPage = screen.getAllByRole('button', { pressed: false }).length;
    const more = screen.getByRole('button', { name: /show more/i });
    await user.click(more);
    expect(
      screen.getAllByRole('button', { pressed: false }).length,
    ).toBeGreaterThan(firstPage);
  });

  it('filters library maps by search query', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    const searchInput = screen.getByLabelText(/filter library maps/i);
    await user.type(searchInput, 'Billabong');

    expect(
      screen.getByText('Australian Billabong, Base Map, Day (23x16)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Glass Harbor (Ashes of Veyra)'),
    ).not.toBeInTheDocument();
  });

  it('filters library maps by category pill', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /^outdoor/i }));

    expect(
      screen.queryByText('Glass Harbor (Ashes of Veyra)'),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/filter library maps/i), 'Billabong');
    expect(
      screen.getByText('Australian Billabong, Base Map, Day (23x16)'),
    ).toBeInTheDocument();
  });

  it('selects a library map and auto-fills title if empty', async () => {
    const user = userEvent.setup();
    render(
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/filter library maps/i), 'Blood Rose');
    await user.click(screen.getByText('12. DoS2 - Blood Rose Cave'));

    const titleInput = screen.getByLabelText('Map Title') as HTMLInputElement;
    expect(titleInput.value).toBe('12. DoS2 - Blood Rose Cave');
  });

  it('saves the picked map with an image URL and its bundled id', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MapPickerModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/filter library maps/i), 'Fort Joy Docks');
    await user.click(screen.getByText('10. DoS2 - Fort Joy Docks'));
    await user.click(screen.getByRole('button', { name: 'Create Map' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '10. DoS2 - Fort Joy Docks',
        imagePath: '/assets/defaults/base_maps/10. DoS2 - Fort Joy Docks.webp',
        imageAssetRef: { target: 'asset', assetId: 'default-map-1' },
      }),
    );
  });

  it('opens on the requested tab', () => {
    const { rerender } = render(
      <MapPickerModal initialTab="upload" isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByLabelText(/filter library maps/i)).toBeNull();
    rerender(
      <MapPickerModal initialTab="library" isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByLabelText(/filter library maps/i)).toBeInTheDocument();
  });

  it('submits selected library map data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    const titleInput = screen.getByLabelText('Map Title');
    await user.type(titleInput, 'Underground Crossroads');

    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'A treacherous intersection of tunnels');

    await user.click(screen.getByRole('button', { name: 'Create Map' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Underground Crossroads',
      description: 'A treacherous intersection of tunnels',
      imagePath: '/demo/ashes-of-veyra/glass-harbor-map.png',
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
      <MapPickerModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
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

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Mock FileReader
    const mockDataUrl = 'data:image/png;base64,mockimagedata';
    vi.spyOn(window, 'FileReader').mockImplementation(function () {
      return {
        readAsDataURL: vi.fn(function (this: FileReader) {
          setTimeout(() => {
            Object.defineProperty(this, 'result', { value: mockDataUrl });
            this.onload?.({
              target: { result: mockDataUrl },
            } as unknown as ProgressEvent<FileReader>);
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
      <MapPickerModal isOpen={true} onClose={onClose} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
