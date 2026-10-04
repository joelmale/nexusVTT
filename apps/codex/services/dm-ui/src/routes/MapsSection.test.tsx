import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { buildMapPreparationModel } from '@/features/map-preparation/buildMapPreparationModel';
import { renderSection } from '@/features/section-shell/testUtils';

const SLUGS = [
  'ashes-of-veyra',
  'crown-of-cinders',
  'lanterns-of-mourningfen',
  'stars-below-kharad',
];

describe('Maps section', () => {
  it.each(SLUGS)('renders an index for %s', (slug) => {
    renderSection(`/demo/${slug}/maps`);
    expect(
      screen.getByRole('heading', { name: 'Maps', level: 1 }),
    ).toBeVisible();
    const bundle = getFixtureBundle(slug)!;
    if (bundle.maps.length === 0) {
      expect(screen.getByText('No maps yet.')).toBeVisible();
    } else {
      const link = screen.getByRole('link', {
        name: new RegExp(bundle.maps[0]!.title),
      });
      expect(link).toHaveAttribute(
        'href',
        `/demo/${slug}/maps/${bundle.maps[0]!.id}`,
      );
    }
  });

  it('links cards to the prep workspace and shows counts', () => {
    renderSection('/demo/ashes-of-veyra/maps');
    const link = screen.getByRole('link', { name: /Glass Harbor/ });
    expect(link).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/maps/map-glass-harbor',
    );
    expect(link).toHaveTextContent(/pinned locations? · \d+ layers?/);
  });

  it('renders a real-campaign empty index', () => {
    renderSection('/campaigns/campaign-blank/maps');
    expect(screen.getByText('No maps yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload map' })).toBeVisible();
  });

  it('renders the prep workspace with a back link', () => {
    renderSection('/demo/ashes-of-veyra/maps/map-glass-harbor');
    expect(screen.getByRole('link', { name: /Back to Maps/ })).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/maps',
    );
  });

  it('shows not-found for an unknown map', () => {
    renderSection('/demo/ashes-of-veyra/maps/nope');
    expect(screen.getByText('Map not found')).toBeVisible();
  });

  it('?pin= selects the pin', () => {
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    const pins = bundle.pins.filter((p) => p.mapId === 'map-glass-harbor');
    const other = pins.find((p) => !p.selectedByDefault)!;
    const model = buildMapPreparationModel(
      bundle,
      'map-glass-harbor',
      other.id,
    )!;
    expect(model.selectedPinId).toBe(other.id);
    renderSection(`/demo/ashes-of-veyra/maps/map-glass-harbor?pin=${other.id}`);
    const location = bundle.locations.find((l) => l.id === other.locationId)!;
    expect(screen.getByRole('heading', { name: location.name })).toBeVisible();
  });

  it('takes scene titles from sceneTemplates', () => {
    const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);
    bundle.sceneTemplates = [{ id: 'scene-x', title: 'Custom Scene Title' }];
    const pin = bundle.pins.find((p) => p.mapId === 'map-glass-harbor')!;
    pin.linkedObjectIds = ['scene-x'];
    const model = buildMapPreparationModel(bundle, 'map-glass-harbor', pin.id)!;
    const titles = model.locations.flatMap((l) =>
      l.linkedObjects.map((o) => o.title),
    );
    expect(titles).toContain('Custom Scene Title');
  });

  it('builds a no-image model and renders the placeholder', async () => {
    const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);
    delete bundle.maps[0]!.imagePath;
    const model = buildMapPreparationModel(bundle, bundle.maps[0]!.id)!;
    expect(model.imagePath).toBe('');
    const { render } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { MapPreparation } =
      await import('@/features/map-preparation/MapPreparation');
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('map-no-image')).toBeInTheDocument();
  });

  it('renders the card placeholder when a map has no image', async () => {
    const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);
    delete bundle.maps[0]!.imagePath;
    const { render } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { MapsIndex } = await import('@/features/maps/MapsIndex');
    render(
      <MemoryRouter>
        <MapsIndex basePath="/demo/x" bundle={bundle} />
      </MemoryRouter>,
    );
    expect(
      screen.getAllByTestId('map-card-placeholder')[0],
    ).toBeInTheDocument();
  });

  it('opens add map modal and creates a new map', async () => {
    const userEvent = (await import('@testing-library/user-event')).default.setup();
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'map-new-123' });
    const { render } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { CapabilityNoticeProvider } = await import(
      '@/features/capability-notice'
    );
    const { SectionContext } = await import(
      '@/features/section-shell/SectionContext'
    );
    const { MapsContent } = await import(
      '@/routes/sections/MapsSectionRoute'
    );
    const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);

    render(
      <MemoryRouter>
        <CapabilityNoticeProvider>
          <SectionContext.Provider
            value={{
              bundle,
              basePath: '/campaigns/test',
              store: {
                bundle,
                status: 'ready',
                editable: true,
                reload: vi.fn(),
                updateItem: vi.fn(),
                addItem,
                reorderNotes: vi.fn(),
              },
            }}
          >
            <MapsContent />
          </SectionContext.Provider>
        </CapabilityNoticeProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /add map/i }));
    expect(screen.getByText('Add Campaign Map')).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Map Title');
    await userEvent.type(titleInput, 'Dungeon of the Dead Three');

    await userEvent.click(screen.getByRole('button', { name: 'Create Map' }));

    expect(addItem).toHaveBeenCalledWith(
      'campaign-map',
      expect.objectContaining({
        title: 'Dungeon of the Dead Three',
        dimensions: { width: 1920, height: 1080 },
      }),
    );
  });

  it('renders Add Map button on demo fixture route and opens modal', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    renderSection('/demo/ashes-of-veyra/maps');
    const addButton = screen.getByRole('button', { name: /add map/i });
    expect(addButton).toBeVisible();
    await userEvent.click(addButton);
    expect(screen.getByText('Add Campaign Map')).toBeInTheDocument();
  });

  it('opens map picker modal from empty state upload button', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    renderSection('/campaigns/campaign-blank/maps');
    const uploadButton = screen.getByRole('button', { name: /upload map/i });
    expect(uploadButton).toBeVisible();
    await userEvent.click(uploadButton);
    expect(screen.getByText('Add Campaign Map')).toBeInTheDocument();
  });
});
