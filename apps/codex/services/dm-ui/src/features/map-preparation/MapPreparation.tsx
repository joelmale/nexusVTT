import Boxes from 'lucide-react/dist/esm/icons/boxes';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Minus from 'lucide-react/dist/esm/icons/minus';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import X from 'lucide-react/dist/esm/icons/x';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';

import type { CapabilityId } from '@/features/capability-notice';

import type {
  LinkedObjectViewModel,
  LocationViewModel,
  MapPinViewModel,
  MapPreparationViewModel,
} from './mapPreparationModels';
import styles from './MapPreparation.module.css';

interface MapPreparationProps {
  model: MapPreparationViewModel;
  /** `/demo/<slug>` or `/campaigns/<id>`; links are built from it. */
  basePath?: string;
  onCapability: (capabilityId: CapabilityId) => void;
  onSave?: (updatedMap: Record<string, unknown>) => Promise<void> | void;
  onCreateScene?: (
    map: MapPreparationViewModel,
    selectedPin?: MapPinViewModel,
  ) => Promise<void> | void;
  onCreateLocation?: (
    name: string,
  ) => Promise<{ id: string; title: string }> | { id: string; title: string };
  editable?: boolean;
  /** Extra header buttons (e.g. Remove) rendered in the editor header. */
  headerActions?: ReactNode;
}

type InspectorTab = 'details' | 'objects' | 'notes';

const PRESET_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#ef4444',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#f97316',
];

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

/** Delay between the last edit and the autosave. */
const AUTOSAVE_DELAY_MS = 800;

function buildMapPayload(
  model: MapPreparationViewModel,
  pins: MapPinViewModel[],
  visibleLayers: Record<string, boolean>,
): Record<string, unknown> {
  return {
    title: model.title,
    description: model.description,
    imageAssetRef: model.imageAssetRef,
    dimensions: model.dimensions,
    layers: model.layers.map((l) => ({
      id: l.id,
      label: l.label,
      visibleByDefault: visibleLayers[l.id] ?? true,
      order: l.order,
    })),
    pins: pins.map((p, index) => ({
      id: p.id,
      label: p.label,
      x: p.x,
      y: p.y,
      order: index + 1,
      layerIds: p.layerIds,
      locationId: p.locationId,
      icon: p.icon,
      color: p.color,
      visibility: p.visibility ?? 'players',
      notes: p.notes,
      linkedObjectRefs: p.linkedObjectRefs,
      linkedObjectIds: p.linkedObjects?.map((o) => o.id) ?? [],
    })),
  };
}

export function MapPreparation({
  model,
  basePath = '',
  onCapability,
  onSave,
  onCreateScene,
  onCreateLocation,
  editable = true,
  headerActions,
}: MapPreparationProps) {
  const [pins, setPins] = useState<MapPinViewModel[]>(model.pins);
  const [selectedPinId, setSelectedPinId] = useState(model.selectedPinId);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(model.layers.map((layer) => [layer.id, layer.visible])),
  );
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'select' | 'visibility' | 'add-pin'>('select');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [objectSearch, setObjectSearch] = useState('');
  const [sceneCreatedMessage, setSceneCreatedMessage] = useState<string | null>(null);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isSubmittingLocation, setIsSubmittingLocation] = useState(false);

  const mapTransformRef = useRef<HTMLDivElement>(null);

  // Autosave: edits bump `changeVersion`; `persist` saves until
  // `savedVersion` catches up, never running two onSave calls at once.
  const latest = useRef({ model, pins, visibleLayers, onSave });
  const changeVersion = useRef(0);
  const savedVersion = useRef(0);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = { model, pins, visibleLayers, onSave };
  });

  const persist = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current || !latest.current.onSave) return;
    if (savedVersion.current >= changeVersion.current) return;
    saving.current = true;
    try {
      while (savedVersion.current < changeVersion.current) {
        const version = changeVersion.current;
        const { model: m, pins: p, visibleLayers: v, onSave: save } =
          latest.current;
        setSaveStatus('saving');
        try {
          await save?.(buildMapPayload(m, p, v));
        } catch (err) {
          console.error('Failed to save map', err);
          setSaveStatus('error');
          return;
        }
        savedVersion.current = version;
      }
      setSaveStatus('saved');
    } finally {
      saving.current = false;
    }
  }, []);

  const markDirty = useCallback(() => {
    changeVersion.current += 1;
    setSaveStatus((current) => (current === 'saving' ? current : 'unsaved'));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
  }, [persist]);

  // Flush edits made just before leaving the map.
  useEffect(
    () => () => {
      if (savedVersion.current < changeVersion.current) void persist();
      else if (timer.current) clearTimeout(timer.current);
    },
    [persist],
  );

  useEffect(() => {
    if (saveStatus === 'idle' || saveStatus === 'saved') return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [saveStatus]);

  const selectedPin =
    pins.find((pin) => pin.id === selectedPinId) ?? pins[0];
  const selectedLocation =
    model.locations.find(
      (location) => location.id === selectedPin?.locationId,
    ) ?? model.locations[0];

  const visiblePins = useMemo(
    () =>
      pins.filter((pin) =>
        pin.layerIds.some((layerId) => visibleLayers[layerId]),
      ),
    [pins, visibleLayers],
  );

  function changeZoom(delta: number) {
    setZoom((current) => Math.min(1.8, Math.max(0.8, current + delta)));
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'add-pin' || !editable) return;
    const mapEl = mapTransformRef.current;
    if (!mapEl) return;

    const rect = mapEl.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const x = Math.max(0, Math.min(1, Math.round(rawX * 1000) / 1000));
    const y = Math.max(0, Math.min(1, Math.round(rawY * 1000) / 1000));

    const newPinId = `pin-${Date.now()}`;
    const newPin: MapPinViewModel = {
      id: newPinId,
      label: `Pin ${pins.length + 1}`,
      x,
      y,
      layerIds: [model.layers[0]?.id ?? 'locations'],
      color: '#22c55e',
      visibility: 'players',
      linkedObjects: [],
    };

    setPins((prev) => [...prev, newPin]);
    setSelectedPinId(newPinId);
    setMode('select');
    markDirty();
  }

  function handlePinPointerDown(e: React.PointerEvent, pinId: string) {
    e.stopPropagation();
    setSelectedPinId(pinId);
    if (!editable) return;

    const mapEl = mapTransformRef.current;
    if (!mapEl) return;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = mapEl.getBoundingClientRect();
      const rawX = (moveEvent.clientX - rect.left) / rect.width;
      const rawY = (moveEvent.clientY - rect.top) / rect.height;
      const x = Math.max(0, Math.min(1, Math.round(rawX * 1000) / 1000));
      const y = Math.max(0, Math.min(1, Math.round(rawY * 1000) / 1000));
      setPins((current) =>
        current.map((p) => (p.id === pinId ? { ...p, x, y } : p)),
      );
      markDirty();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function handlePinKeyDown(e: React.KeyboardEvent, pinId: string) {
    if (!editable) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDeletePin(pinId);
      e.preventDefault();
      return;
    } else {
      return;
    }

    e.preventDefault();
    setPins((current) =>
      current.map((p) => {
        if (p.id !== pinId) return p;
        const x = Math.max(0, Math.min(1, Math.round((p.x + dx) * 1000) / 1000));
        const y = Math.max(0, Math.min(1, Math.round((p.y + dy) * 1000) / 1000));
        return { ...p, x, y };
      }),
    );
    markDirty();
  }

  function handleDeletePin(pinId: string) {
    if (!editable) return;
    setPins((current) => current.filter((p) => p.id !== pinId));
    if (selectedPinId === pinId) {
      const remaining = pins.filter((p) => p.id !== pinId);
      setSelectedPinId(remaining[0]?.id ?? '');
    }
    markDirty();
  }

  function updateSelectedPin(patch: Partial<MapPinViewModel>) {
    if (!selectedPin || !editable) return;
    setPins((current) =>
      current.map((p) => (p.id === selectedPin.id ? { ...p, ...patch } : p)),
    );
    markDirty();
  }

  function handleAddLinkedObject(obj: LinkedObjectViewModel) {
    if (!selectedPin || !editable) return;
    const existing = selectedPin.linkedObjects ?? [];
    if (existing.some((item) => item.id === obj.id)) return;

    const updated = [...existing, obj];
    // A campaign-object reference pins the object's revision; the store
    // refreshes it to the current one when the map is saved.
    const updatedRefs = [
      ...(selectedPin.linkedObjectRefs ?? []),
      ...(model.campaignId
        ? [
            {
              target: 'campaign-object',
              campaignId: model.campaignId,
              id: obj.id,
              revision: 1,
            },
          ]
        : []),
    ];
    updateSelectedPin({
      linkedObjects: updated,
      linkedObjectRefs: updatedRefs,
    });
    setIsObjectModalOpen(false);
  }

  function handleRemoveLinkedObject(objectId: string) {
    if (!selectedPin || !editable) return;
    const updated = (selectedPin.linkedObjects ?? []).filter(
      (item) => item.id !== objectId,
    );
    const updatedRefs = (selectedPin.linkedObjectRefs ?? []).filter(
      (ref) => ref.id !== objectId,
    );
    updateSelectedPin({
      linkedObjects: updated,
      linkedObjectRefs: updatedRefs,
    });
  }

  async function handleCreateScene() {
    if (onCreateScene) {
      setIsCreatingScene(true);
      try {
        await onCreateScene(model, selectedPin);
        setSceneCreatedMessage(`Scene created from "${model.title}"!`);
        setTimeout(() => setSceneCreatedMessage(null), 4000);
      } catch (err) {
        console.error('Failed to create scene', err);
      } finally {
        setIsCreatingScene(false);
      }
    } else {
      onCapability('map.scene.create');
    }
  }

  async function handleInlineCreateLocation(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newLocationName.trim();
    if (!trimmed || !onCreateLocation) return;
    setIsSubmittingLocation(true);
    try {
      const created = await onCreateLocation(trimmed);
      const newLinkedItem: LinkedObjectViewModel = {
        id: created.id,
        kind: 'Location',
        title: created.title,
        subtitle: 'landmark',
      };
      handleAddLinkedObject(newLinkedItem);
      setNewLocationName('');
      setIsCreatingLocation(false);
      setIsObjectModalOpen(false);
    } catch (err) {
      console.error('Failed to create location', err);
    } finally {
      setIsSubmittingLocation(false);
    }
  }

  const filteredAvailableObjects = useMemo(() => {
    const list = model.availableObjects ?? [];
    if (!objectSearch.trim()) return list;
    const q = objectSearch.toLowerCase();
    return list.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.kind.toLowerCase().includes(q) ||
        o.subtitle.toLowerCase().includes(q),
    );
  }, [model.availableObjects, objectSearch]);

  return (
    <div className={styles.layout}>
      <aside className={styles.layersPanel}>
        <div className={styles.panelHeader}>
          <div>
            <Link className={styles.backLink} to={`${basePath}/maps`}>
              <ChevronLeft size={14} />
              <span>Back to Maps</span>
            </Link>
            <span className={styles.eyebrow}>
              Map preparation
              {sceneCreatedMessage && (
                <span className={styles.sceneNotice}>{sceneCreatedMessage}</span>
              )}
            </span>
            <h1>{model.title}</h1>
          </div>
          <div className={styles.headerActions}>
            {onSave && saveStatus !== 'idle' ? (
              <span
                className={`${styles.saveStatus} ${saveStatus === 'error' ? styles.saveStatusError : ''}`}
                role="status"
              >
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'unsaved' && 'Unsaved changes'}
                {saveStatus === 'error' && (
                  <>
                    Could not save{' '}
                    <button onClick={() => void persist()} type="button">
                      Retry
                    </button>
                  </>
                )}
              </span>
            ) : null}
            {headerActions}
          </div>
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
                onClick={() => {
                  setVisibleLayers((current) => ({
                    ...current,
                    [layer.id]: !current[layer.id],
                  }));
                  if (editable) markDirty();
                }}
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
            <span>Locations / Pins</span>
            <span>{pins.length}</span>
          </div>
          {pins.map((pin, index) => (
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
            className={`${styles.mapTransform} ${mode === 'add-pin' ? styles.crosshairCursor : ''}`}
            onClick={handleMapClick}
            ref={mapTransformRef}
            style={{ transform: `scale(${zoom})` }}
          >
            {model.imagePath ? (
              <img
                alt={`Top-down illustrated map of ${model.title}`}
                className={styles.mapImage}
                src={model.imagePath}
              />
            ) : (
              <div
                aria-label={`${model.title} has no map image yet`}
                className={styles.mapImage}
                data-testid="map-no-image"
                role="img"
                style={{ background: 'var(--studio-surface-sunken, #2a2a2a)' }}
              />
            )}
            {visiblePins.map((pin, index) => {
              const isSelected = pin.id === selectedPinId;
              const isGmOnly = pin.visibility === 'dm-only';
              return (
                <button
                  aria-label={`Select ${pin.label}`}
                  className={`${styles.mapPin} ${isSelected ? styles.selectedPin : ''} ${isGmOnly ? styles.pinGmOnly : ''}`}
                  key={pin.id}
                  onClick={() => setSelectedPinId(pin.id)}
                  onKeyDown={(e) => handlePinKeyDown(e, pin.id)}
                  onPointerDown={(e) => handlePinPointerDown(e, pin.id)}
                  style={
                    {
                      left: `${pin.x * 100}%`,
                      top: `${pin.y * 100}%`,
                      '--pin-color': pin.color ?? (isSelected ? '#ef4444' : '#22c55e'),
                    } as React.CSSProperties
                  }
                  title={`${pin.label} (${Math.round(pin.x * 100)}%, ${Math.round(pin.y * 100)}%)${isGmOnly ? ' - GM Only' : ''}`}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
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
            {model.imagePath ? (
              <img alt="" aria-hidden="true" src={model.imagePath} />
            ) : null}
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
              className={mode === 'add-pin' ? styles.activeTool : ''}
              onClick={() => {
                onCapability('map.pin.create');
                if (editable) {
                  setMode((m) => (m === 'add-pin' ? 'select' : 'add-pin'));
                }
              }}
              type="button"
            >
              <MapPin size={15} /> <span>{mode === 'add-pin' ? 'Click Map...' : 'Add Pin'}</span>
            </button>
            <button
              onClick={() => {
                onCapability('map.object.link');
                if (editable && selectedPin) {
                  setIsObjectModalOpen(true);
                }
              }}
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
              disabled={isCreatingScene}
              onClick={handleCreateScene}
              type="button"
            >
              <Sparkles size={15} /> <span>{isCreatingScene ? 'Creating Scene...' : 'Create Scene'}</span>
            </button>
          </div>
        </div>
      </main>

      <LocationInspector
        editable={editable}
        fallbackImagePath={model.imagePath}
        location={selectedLocation}
        onCapability={onCapability}
        onDeletePin={() => selectedPin && handleDeletePin(selectedPin.id)}
        onOpenLinkModal={() => setIsObjectModalOpen(true)}
        onRemoveLinkedObject={handleRemoveLinkedObject}
        onTabChange={setInspectorTab}
        onCommitPin={() => void persist()}
        onUpdatePin={updateSelectedPin}
        pin={selectedPin}
        selectedTab={inspectorTab}
      />

      {isObjectModalOpen && (
        <div
          aria-modal="true"
          className={styles.objectModalOverlay}
          onClick={() => setIsObjectModalOpen(false)}
          role="dialog"
        >
          <div
            className={styles.objectModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.objectModalHeader}>
              <h2>Link Object to Pin</h2>
              <button
                className={styles.iconButton}
                onClick={() => setIsObjectModalOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.objectModalSearch}>
              <input
                className={styles.formInput}
                onChange={(e) => setObjectSearch(e.target.value)}
                placeholder="Search campaign objects..."
                type="text"
                value={objectSearch}
              />
            </div>
            {onCreateLocation && (
              <div className={styles.objectModalCreateRow}>
                {isCreatingLocation ? (
                  <form onSubmit={handleInlineCreateLocation} className={styles.inlineCreateForm}>
                    <input
                      autoFocus
                      className={styles.formInput}
                      placeholder="New location name..."
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!newLocationName.trim() || isSubmittingLocation}
                      className={styles.primaryButton}
                    >
                      {isSubmittingLocation ? 'Creating...' : 'Create & Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingLocation(false)}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className={styles.createLocationButton}
                    onClick={() => setIsCreatingLocation(true)}
                  >
                    <Plus size={14} /> <span>Create New Location</span>
                  </button>
                )}
              </div>
            )}
            <div className={styles.objectModalList}>
              {filteredAvailableObjects.length === 0 ? (
                <p style={{ padding: '12px', fontSize: '11px', color: 'var(--studio-text-muted)' }}>
                  No objects found.
                </p>
              ) : (
                filteredAvailableObjects.map((item) => (
                  <button
                    className={styles.linkedObject}
                    key={item.id}
                    onClick={() => handleAddLinkedObject(item)}
                    type="button"
                  >
                    <span className={styles.linkedIcon}>
                      <Boxes size={14} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.kind} · {item.subtitle}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LocationInspectorProps {
  fallbackImagePath: string;
  location?: LocationViewModel;
  pin?: MapPinViewModel;
  editable?: boolean;
  onCapability: (capabilityId: CapabilityId) => void;
  onTabChange: (tab: InspectorTab) => void;
  onUpdatePin: (patch: Partial<MapPinViewModel>) => void;
  /** Save now (text fields call it on blur). */
  onCommitPin: () => void;
  onDeletePin: () => void;
  onOpenLinkModal: () => void;
  onRemoveLinkedObject: (objectId: string) => void;
  selectedTab: InspectorTab;
}

function LocationInspector({
  fallbackImagePath,
  location,
  pin,
  editable,
  onCapability,
  onTabChange,
  onUpdatePin,
  onCommitPin,
  onDeletePin,
  onOpenLinkModal,
  onRemoveLinkedObject,
  selectedTab,
}: LocationInspectorProps) {
  if (!location && !pin) return <aside className={styles.inspector} />;

  const linkedObjects = pin?.linkedObjects ?? location?.linkedObjects ?? [];

  return (
    <aside className={styles.inspector} aria-label="Selected location details">
      <div className={styles.inspectorTabs}>
        {(
          [
            ['details', 'Details'],
            ['objects', `Linked Objects (${linkedObjects.length})`],
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
              {(location?.imagePath ?? fallbackImagePath) ? (
                <img
                  alt={`${location?.name ?? pin?.label} map detail`}
                  src={location?.imagePath ?? fallbackImagePath}
                />
              ) : null}
              <span>{location?.typeLabel ?? 'Marker'}</span>
            </div>

            <h2>{location?.name ?? pin?.label}</h2>
            {location?.shortDescription && (
              <p className={styles.locationLead}>{location.shortDescription}</p>
            )}
            {location?.description?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {pin && editable && (
              <div style={{ marginTop: '14px' }}>
                <div className={styles.formGroup}>
                  <label htmlFor="pin-label-input">Pin Label</label>
                  <input
                    className={styles.formInput}
                    id="pin-label-input"
                    onBlur={onCommitPin}
                    onChange={(e) => onUpdatePin({ label: e.target.value })}
                    type="text"
                    value={pin.label}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Visibility</label>
                  <select
                    className={styles.formSelect}
                    onChange={(e) =>
                      onUpdatePin({
                        visibility: e.target.value as 'players' | 'dm-only',
                      })
                    }
                    value={pin.visibility ?? 'players'}
                  >
                    <option value="players">Players (Visible)</option>
                    <option value="dm-only">GM Only (Hidden)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Marker Color</label>
                  <div className={styles.colorSwatches}>
                    {PRESET_COLORS.map((color) => (
                      <button
                        className={`${styles.colorSwatch} ${pin.color === color ? styles.colorSwatchActive : ''}`}
                        key={color}
                        onClick={() => onUpdatePin({ color })}
                        style={{ background: color }}
                        title={color}
                        type="button"
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Coordinates</label>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--studio-text-muted)' }}>
                    X: {(pin.x * 100).toFixed(1)}% · Y: {(pin.y * 100).toFixed(1)}%
                  </p>
                </div>

                <button
                  className={styles.deleteButton}
                  onClick={onDeletePin}
                  type="button"
                >
                  <Trash2 size={13} />
                  <span>Delete Pin</span>
                </button>
              </div>
            )}

            {location?.notes && (
              <section className={styles.notesCard}>
                <span className={styles.eyebrow}>{location.name} notes</span>
                <p>{location.notes}</p>
              </section>
            )}

            <section className={styles.linkedSection}>
              <h3>Linked objects</h3>
              {linkedObjects.slice(0, 3).map((object) => (
                <div
                  className={styles.linkedObject}
                  key={object.id}
                >
                  <span className={styles.linkedIcon}>
                    <CircleDot size={14} />
                  </span>
                  <span>
                    <strong>{object.title}</strong>
                    <small>{object.subtitle}</small>
                  </span>
                  {editable && (
                    <button
                      aria-label={`Unlink ${object.title}`}
                      className={styles.unlinkButton}
                      onClick={() => onRemoveLinkedObject(object.id)}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className={styles.linkCommand}
                onClick={() => {
                  if (editable) onOpenLinkModal();
                  else onCapability('map.object.link');
                }}
                type="button"
              >
                <Link2 size={14} /> Link Existing Object
              </button>
            </section>

            {location?.tags && location.tags.length > 0 && (
              <div className={styles.tags}>
                {location.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </>
        )}

        {selectedTab === 'objects' && (
          <section className={styles.linkedSection}>
            <h2>Linked objects</h2>
            {linkedObjects.map((object) => (
              <div
                className={styles.linkedObject}
                key={object.id}
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
                {editable && (
                  <button
                    aria-label={`Unlink ${object.title}`}
                    className={styles.unlinkButton}
                    onClick={() => onRemoveLinkedObject(object.id)}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              className={styles.linkCommand}
              onClick={() => {
                if (editable) onOpenLinkModal();
                else onCapability('map.object.link');
              }}
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
              disabled={!editable}
              onBlur={onCommitPin}
              onChange={(e) => onUpdatePin({ notes: e.target.value })}
              rows={10}
              value={pin?.notes ?? location?.notes ?? ''}
            />
          </section>
        )}
      </div>
    </aside>
  );
}
