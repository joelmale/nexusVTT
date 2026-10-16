import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hub from '@/services/generatorHub';

import { MapPickerModal } from './MapPickerModal';

vi.mock('@/services/generatorHub', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/generatorHub')>();
  return {
    ...actual,
    requestGeneratorExport: vi.fn(),
    uploadGeneratedMap: vi.fn(),
    measureImage: vi.fn(),
    isBlankImage: vi.fn(),
  };
});

const requestExport = vi.mocked(hub.requestGeneratorExport);
const upload = vi.mocked(hub.uploadGeneratedMap);
const measure = vi.mocked(hub.measureImage);
const blank = vi.mocked(hub.isBlankImage);

const EXPORT = {
  blob: new Blob(['x'], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 2000,
  height: 1500,
  source: 'cave',
};

function frame(): HTMLIFrameElement {
  return screen.getByTitle(/generator$/i) as HTMLIFrameElement;
}

/** The hub tells the host it has finished loading. */
function hubSays(type: string, init: { origin?: string } = {}) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type },
        origin: init.origin ?? hub.getHubOrigin(),
        source: frame().contentWindow,
      }),
    );
  });
}

function openGenerate(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MapPickerModal initialTab="generate" isOpen onClose={vi.fn()} onSubmit={onSubmit} />,
  );
  return onSubmit;
}

describe('MapPickerModal Generate tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    requestExport.mockResolvedValue(EXPORT);
    upload.mockResolvedValue({
      importId: 'i1',
      assetId: 'asset-9',
      sceneUrl: '/users/u1/generated/asset-9.webp',
      width: 2000,
      height: 1500,
    });
    measure.mockResolvedValue({ width: 800, height: 600 });
    blank.mockResolvedValue(false);
  });

  it('offers all five generators and embeds the chosen one', () => {
    openGenerate();
    const group = screen.getByRole('group', { name: 'Generator type' });
    const names = within(group)
      .getAllByRole('button')
      .map((button) => button.querySelector('span')?.textContent);
    expect(names).toEqual(['Dungeon', 'Cave', 'City', 'World', 'Dwelling']);
    expect(within(group).getByRole('button', { name: /Dungeon/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const src = new URL(frame().getAttribute('src')!);
    expect(src.searchParams.get('generator')).toBe('dungeon');
    expect(src.searchParams.get('rasterize')).toBe('true');
    expect(frame().getAttribute('sandbox')).toContain('allow-scripts');
    expect((screen.getByLabelText('Map Title') as HTMLInputElement).value).toBe(
      'Generated dungeon',
    );
  });

  it('switches generator, reloads the frame and renames an untouched title', async () => {
    const user = userEvent.setup();
    openGenerate();
    await user.click(screen.getByRole('button', { name: /Cave/ }));
    expect(new URL(frame().getAttribute('src')!).searchParams.get('generator')).toBe('cave');
    expect((screen.getByLabelText('Map Title') as HTMLInputElement).value).toBe('Generated cave');
    expect(screen.getByRole('button', { name: /Cave/ })).toHaveAttribute('aria-pressed', 'true');

    // A title the DM typed is left alone.
    await user.clear(screen.getByLabelText('Map Title'));
    await user.type(screen.getByLabelText('Map Title'), 'Mourningfen Caves');
    await user.click(screen.getByRole('button', { name: /City/ }));
    expect((screen.getByLabelText('Map Title') as HTMLInputElement).value).toBe(
      'Mourningfen Caves',
    );
  });

  it('keeps Use this map disabled until the hub reports ready, and ignores other origins', () => {
    openGenerate();
    const submit = screen.getByRole('button', { name: 'Use this map' });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Loading the generator…')).toBeVisible();

    hubSays('generator/ready', { origin: 'https://evil.example.com' });
    expect(submit).toBeDisabled();

    hubSays('generator/ready');
    expect(submit).toBeEnabled();
    expect(screen.getByText(/reroll until you like the map/)).toBeVisible();
  });

  it('exports, saves the image as an asset, and creates the map with its real id and URL', async () => {
    const user = userEvent.setup();
    const onSubmit = openGenerate();
    await user.click(screen.getByRole('button', { name: /Cave/ }));
    hubSays('generator/ready');
    await user.type(screen.getByLabelText(/description/i), 'Where the lanterns go');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(requestExport).toHaveBeenCalledWith(frame().contentWindow, hub.getHubOrigin());
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: EXPORT.blob,
        name: 'Generated cave',
        generator: 'cave',
        width: 2000,
        height: 1500,
      }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Generated cave',
      description: 'Where the lanterns go',
      imagePath: '/users/u1/generated/asset-9.webp',
      imageAssetRef: { target: 'asset', assetId: 'asset-9' },
      dimensions: { width: 2000, height: 1500 },
    });
    // Never an inline image.
    expect(JSON.stringify(onSubmit.mock.calls[0][0])).not.toContain('data:');
  });

  it('measures the image when the hub does not report its size', async () => {
    const user = userEvent.setup();
    requestExport.mockResolvedValue({ ...EXPORT, width: undefined, height: undefined });
    upload.mockImplementation(async (input) => ({
      importId: 'i',
      assetId: 'a',
      sceneUrl: '/users/u/generated/a.webp',
      width: input.width,
      height: input.height,
    }));
    const onSubmit = openGenerate();
    hubSays('generator/ready');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(measure).toHaveBeenCalledWith(EXPORT.blob);
    expect(onSubmit.mock.calls[0][0].dimensions).toEqual({ width: 800, height: 600 });
  });

  it('tells a signed-out user to sign in and creates nothing', async () => {
    const user = userEvent.setup();
    upload.mockRejectedValue(new hub.GeneratorAuthRequiredError());
    const onSubmit = openGenerate();
    hubSays('generator/ready');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign in to Nexus VTT to save generated maps.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
    // The DM can try again.
    expect(screen.getByRole('button', { name: 'Use this map' })).toBeEnabled();
  });

  it('refuses to save a blank export, so an undrawn generator never becomes a map', async () => {
    const user = userEvent.setup();
    blank.mockResolvedValue(true);
    const onSubmit = openGenerate();
    hubSays('generator/ready');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'has not drawn a map yet',
    );
    expect(blank).toHaveBeenCalledWith(EXPORT.blob);
    expect(upload).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    // Try again once it has drawn.
    blank.mockResolvedValue(false);
    await user.click(screen.getByRole('button', { name: 'Use this map' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('shows the hub timeout and does not upload', async () => {
    const user = userEvent.setup();
    requestExport.mockRejectedValue(new hub.GeneratorExportError('The generator did not respond.'));
    const onSubmit = openGenerate();
    hubSays('generator/ready');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('did not respond');
    expect(upload).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a save failure and keeps the dialog open', async () => {
    const user = userEvent.setup();
    upload.mockRejectedValue(new Error('Could not save the generated map (status 500).'));
    openGenerate();
    hubSays('generator/ready');
    await user.click(screen.getByRole('button', { name: 'Use this map' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('status 500');
    expect(screen.getByText('Add Campaign Map')).toBeVisible();
  });

  it('is reachable from the tab bar and shows no generator content on other tabs', async () => {
    const user = userEvent.setup();
    render(<MapPickerModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByTitle(/generator$/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /generate/i }));
    expect(frame()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /asset library/i }));
    expect(screen.queryByTitle(/generator$/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(frame()).toBeInTheDocument();
  });
});
