import Archive from 'lucide-react/dist/esm/icons/archive';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Boxes from 'lucide-react/dist/esm/icons/boxes';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Minus from 'lucide-react/dist/esm/icons/minus';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2';
import NotebookPen from 'lucide-react/dist/esm/icons/notebook-pen';
import Package from 'lucide-react/dist/esm/icons/package';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { CapabilityId } from '@/features/capability-notice';

import type {
  LocationViewModel,
  MapPreparationViewModel,
} from './mapPreparationModels';
import styles from './MapPreparation.module.css';

interface MapPreparationProps {
  model: MapPreparationViewModel;
  onCapability: (capabilityId: CapabilityId) => void;
}

type InspectorTab = 'details' | 'objects' | 'notes';

const APP_NAV_ITEMS = [
  { icon: BookOpen, label: 'Campaign', target: 'campaign' },
  { icon: MapIcon, label: 'Maps', target: 'maps' },
  { icon: MapPin, label: 'Locations', target: 'locations' },
  { icon: UserRound, label: 'NPCs', target: 'npcs' },
  { icon: Swords, label: 'Encounters', target: 'encounters' },
  { icon: Package, label: 'Items', target: 'items' },
  { icon: Sparkles, label: 'Scenes', target: 'scenes' },
  { icon: FileText, label: 'Notes', target: 'notes' },
  { icon: Archive, label: 'Assets', target: 'assets' },
  { icon: NotebookPen, label: 'Journal', target: 'journal' },
] as const;

export function MapPreparation({ model, onCapability }: MapPreparationProps) {
  const [selectedPinId, setSelectedPinId] = useState(model.selectedPinId);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(model.layers.map((layer) => [layer.id, layer.visible])),
  );
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'select' | 'visibility'>('select');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details');

  const selectedPin =
    model.pins.find((pin) => pin.id === selectedPinId) ?? model.pins[0];
  const selectedLocation =
    model.locations.find(
      (location) => location.id === selectedPin?.locationId,
    ) ?? model.locations[0];
  const visiblePins = useMemo(
    () =>
      model.pins.filter((pin) =>
        pin.layerIds.some((layerId) => visibleLayers[layerId]),
      ),
    [model.pins, visibleLayers],
  );

  function changeZoom(delta: number) {
    setZoom((current) => Math.min(1.8, Math.max(0.8, current + delta)));
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.appRail} aria-label="Campaign Studio tools">
        <div className={styles.appRailScroll}>
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.target === 'maps';
            if (item.target === 'campaign') {
              return (
                <Link
                  className={styles.appRailItem}
                  key={item.target}
                  to="/campaigns/ashes-of-veyra/overview"
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            }
            return (
              <button
                aria-current={active ? 'page' : undefined}
                className={`${styles.appRailItem} ${active ? styles.activeRailItem : ''}`}
                key={item.target}
                onClick={() => !active && onCapability('campaign.section.open')}
                type="button"
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.appRailFooter}>
          <button
            className={styles.appRailItem}
            onClick={() => onCapability('campaign.settings.open')}
            type="button"
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <button className={styles.appRailItem} type="button">
            <ChevronLeft size={17} />
            <span>Collapse</span>
          </button>
        </div>
      </nav>

      <aside className={styles.layersPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.eyebrow}>Map preparation</span>
            <h1>{model.title}</h1>
          </div>
          <button
            aria-label="Map options"
            className={styles.iconButton}
            onClick={() => onCapability('map.options.open')}
            title="Map options"
            type="button"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>

        <section className={styles.layersSection}>
          <div className={styles.sectionHeading}>
            <span>Layers</span>
            <span>{model.layers.length}</span>
          </div>
          {model.layers.map((layer) => {
            const visible = visibleLayers[layer.id];
            return (
              <button
                aria-pressed={visible}
                className={styles.layerRow}
                key={layer.id}
                onClick={() =>
                  setVisibleLayers((current) => ({
                    ...current,
                    [layer.id]: !current[layer.id],
                  }))
                }
                type="button"
              >
                <span className={styles.layerSwatch} />
                <span>{layer.label}</span>
                {visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            );
          })}
        </section>

        <section className={styles.locationsSection}>
          <div className={styles.sectionHeading}>
            <span>Locations</span>
            <span>{model.pins.length}</span>
          </div>
          {model.pins.map((pin, index) => (
            <button
              aria-label={`Open ${pin.label} details`}
              className={`${styles.locationRow} ${pin.id === selectedPinId ? styles.selectedLocation : ''}`}
              key={pin.id}
              onClick={() => setSelectedPinId(pin.id)}
              type="button"
            >
              <span className={styles.pinIndex}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{pin.label}</span>
              <MoreHorizontal size={14} />
            </button>
          ))}
        </section>
      </aside>

      <main className={styles.mapWorkspace} aria-label={`${model.title} map`}>
        <div className={styles.mapViewport}>
          <div
            className={styles.mapTransform}
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              alt="Top-down illustrated map of Glass Harbor"
              className={styles.mapImage}
              src={model.imagePath}
            />
            {visiblePins.map((pin, index) => (
              <button
                aria-label={`Select ${pin.label}`}
                className={`${styles.mapPin} ${pin.id === selectedPinId ? styles.selectedPin : ''}`}
                key={pin.id}
                onClick={() => setSelectedPinId(pin.id)}
                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                title={pin.label}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </div>

          <div className={styles.compass} aria-label="Map compass">
            <Compass size={21} />
            <span>N</span>
          </div>
          <div className={styles.zoomControls}>
            <button
              aria-label="Zoom in"
              onClick={() => changeZoom(0.1)}
              title="Zoom in"
              type="button"
            >
              <Plus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom out"
              onClick={() => changeZoom(-0.1)}
              title="Zoom out"
              type="button"
            >
              <Minus size={16} />
            </button>
            <button
              aria-label="Recenter map"
              onClick={() => setZoom(1)}
              title="Recenter map"
              type="button"
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className={styles.scale}>
            <span />
            100 ft
          </div>
          <div className={styles.minimap}>
            <img alt="" aria-hidden="true" src={model.imagePath} />
            <span style={{ height: `${44 / zoom}%`, width: `${62 / zoom}%` }} />
          </div>

          <div className={styles.mapToolbar}>
            <button
              className={mode === 'select' ? styles.activeTool : ''}
              onClick={() => setMode('select')}
              type="button"
            >
              <MousePointer2 size={15} /> <span>Select</span>
            </button>
            <button
              onClick={() => onCapability('map.pin.create')}
              type="button"
            >
              <MapPin size={15} /> <span>Add Pin</span>
            </button>
            <button
              onClick={() => onCapability('map.object.link')}
              type="button"
            >
              <Link2 size={15} /> <span>Link Object</span>
            </button>
            <button
              className={mode === 'visibility' ? styles.activeTool : ''}
              onClick={() => setMode('visibility')}
              type="button"
            >
              <Eye size={15} /> <span>Visibility</span>
            </button>
            <button
              onClick={() => onCapability('map.scene.create')}
              type="button"
            >
              <Sparkles size={15} /> <span>Create Scene</span>
            </button>
          </div>
        </div>
      </main>

      <LocationInspector
        fallbackImagePath={model.imagePath}
        location={selectedLocation}
        onCapability={onCapability}
        onTabChange={setInspectorTab}
        selectedTab={inspectorTab}
      />
    </div>
  );
}

interface LocationInspectorProps {
  fallbackImagePath: string;
  location?: LocationViewModel;
  onCapability: (capabilityId: CapabilityId) => void;
  onTabChange: (tab: InspectorTab) => void;
  selectedTab: InspectorTab;
}

function LocationInspector({
  fallbackImagePath,
  location,
  onCapability,
  onTabChange,
  selectedTab,
}: LocationInspectorProps) {
  if (!location) return <aside className={styles.inspector} />;
  return (
    <aside className={styles.inspector} aria-label="Selected location details">
      <div className={styles.inspectorTabs}>
        {(
          [
            ['details', 'Details'],
            ['objects', `Linked Objects (${location.linkedObjects.length})`],
            ['notes', 'Map Notes'],
          ] as Array<[InspectorTab, string]>
        ).map(([tab, label]) => (
          <button
            aria-selected={selectedTab === tab}
            className={selectedTab === tab ? styles.activeInspectorTab : ''}
            key={tab}
            onClick={() => onTabChange(tab)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.inspectorScroll}>
        {selectedTab === 'details' && (
          <>
            <div className={styles.locationImage}>
              <img
                alt={`${location.name} map detail`}
                src={location.imagePath ?? fallbackImagePath}
              />
              <span>{location.typeLabel}</span>
            </div>
            <h2>{location.name}</h2>
            <p className={styles.locationLead}>{location.shortDescription}</p>
            {location.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <section className={styles.notesCard}>
              <span className={styles.eyebrow}>{location.name} notes</span>
              <p>{location.notes}</p>
            </section>
            <section className={styles.linkedSection}>
              <h3>Linked objects</h3>
              {location.linkedObjects.slice(0, 3).map((object) => (
                <button
                  className={styles.linkedObject}
                  key={object.id}
                  type="button"
                >
                  <span className={styles.linkedIcon}>
                    <CircleDot size={14} />
                  </span>
                  <span>
                    <strong>{object.title}</strong>
                    <small>{object.subtitle}</small>
                  </span>
                </button>
              ))}
              <button
                className={styles.linkCommand}
                onClick={() => onCapability('map.object.link')}
                type="button"
              >
                <Link2 size={14} /> Link Existing Object
              </button>
            </section>
            <div className={styles.tags}>
              {location.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </>
        )}

        {selectedTab === 'objects' && (
          <section className={styles.linkedSection}>
            <h2>Linked objects</h2>
            {location.linkedObjects.map((object) => (
              <button
                className={styles.linkedObject}
                key={object.id}
                type="button"
              >
                <span className={styles.linkedIcon}>
                  <Boxes size={14} />
                </span>
                <span>
                  <strong>{object.title}</strong>
                  <small>
                    {object.kind} · {object.subtitle}
                  </small>
                </span>
              </button>
            ))}
            <button
              className={styles.linkCommand}
              onClick={() => onCapability('map.object.link')}
              type="button"
            >
              <Link2 size={14} /> Link Existing Object
            </button>
          </section>
        )}

        {selectedTab === 'notes' && (
          <section className={styles.mapNotes}>
            <h2>Map Notes</h2>
            <textarea
              aria-label="Map notes"
              defaultValue={location.notes}
              rows={10}
            />
          </section>
        )}
      </div>
    </aside>
  );
}
