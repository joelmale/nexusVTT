import { useEffect, useMemo, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import X from 'lucide-react/dist/esm/icons/x';
import { useNavigate } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { MapsIndex } from '@/features/maps/MapsIndex';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

import styles from './MapsSectionRoute.module.css';

const SAMPLE_MAP_OPTIONS = [
  {
    label: 'Glass Harbor (Ashes of Veyra)',
    path: '/demo-assets/ashes-of-veyra/maps/glass-harbor.png',
    assetId: 'library:glass-harbor',
  },
  {
    label: 'Sword Coast Regional Map',
    path: '/demo-assets/ashes-of-veyra/maps/sword-coast.png',
    assetId: 'library:sword-coast-regional',
  },
  {
    label: 'Dungeon Crossroads',
    path: '/demo-assets/ashes-of-veyra/maps/dungeon-crossroads.png',
    assetId: 'library:dungeon-crossroads',
  },
  {
    label: 'Custom Image URL / Path...',
    path: '',
    assetId: '',
  },
];

interface LibraryMapOption {
  id: string;
  name: string;
  category?: string;
  path: string;
  thumbnail?: string;
}

export function MapsContent() {
  const { bundle, basePath, store } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSample, setSelectedSample] = useState(SAMPLE_MAP_OPTIONS[0].path);
  const [customPath, setCustomPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [libraryMaps, setLibraryMaps] = useState<LibraryMapOption[]>([]);
  const [mapSearch, setMapSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    fetch('/assets/defaults/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.maps?.items && Array.isArray(data.maps.items)) {
          setLibraryMaps(data.maps.items);
        }
      })
      .catch(() => {
        // Fall back gracefully if manifest is not accessible
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    libraryMaps.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [libraryMaps]);

  const filteredLibraryMaps = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    return libraryMaps.filter((m) => {
      const matchesCategory =
        selectedCategory === 'all' || m.category === selectedCategory;
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [libraryMaps, mapSearch, selectedCategory]);

  const handleOpenModal = () => {
    setTitle('');
    setDescription('');
    setSelectedSample(SAMPLE_MAP_OPTIONS[0].path);
    setCustomPath('');
    setMapSearch('');
    setSelectedCategory('all');
    setIsModalOpen(true);
  };

  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setIsSubmitting(true);
    try {
      const finalPath = selectedSample || customPath.trim() || '/demo-assets/ashes-of-veyra/maps/glass-harbor.png';
      const sampleOption = SAMPLE_MAP_OPTIONS.find((s) => s.path === selectedSample);
      const libraryMap = libraryMaps.find((m) => m.path === selectedSample);
      const assetId = libraryMap?.id || sampleOption?.assetId || `custom-map-${Date.now()}`;

      const newMapDraft = {
        title: trimmedTitle,
        description: description.trim(),
        imagePath: finalPath,
        imageAssetRef: { target: 'asset', assetId },
        dimensions: { width: 1920, height: 1080 },
        layers: [
          {
            id: crypto.randomUUID(),
            label: 'Landmarks',
            visibleByDefault: true,
            order: 0,
          },
        ],
        pins: [],
      };

      const result = await store.addItem('campaign-map', newMapDraft);
      if (result.ok && result.id) {
        setIsModalOpen(false);
        navigate(`${basePath}/maps/${encodeURIComponent(result.id)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1>Maps</h1>
        {store.editable && (
          <button
            className={styles.addButton}
            onClick={handleOpenModal}
            type="button"
          >
            <Plus size={16} />
            <span>Add Map</span>
          </button>
        )}
      </div>

      {bundle.maps.length === 0 ? (
        <EmptyState
          title="No maps yet."
          action={
            <button
              className={styles.addButton}
              onClick={() => {
                if (store.editable) {
                  handleOpenModal();
                } else {
                  notifyCapability('map.asset.replace');
                }
              }}
              type="button"
            >
              <Plus size={16} />
              <span>Upload map</span>
            </button>
          }
        />
      ) : (
        <MapsIndex basePath={basePath} bundle={bundle} />
      )}

      {isModalOpen && (
        <div
          aria-modal="true"
          className={styles.modalOverlay}
          onClick={() => setIsModalOpen(false)}
          role="dialog"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Add Campaign Map</h2>
              <button
                className={styles.closeButton}
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <form className={styles.form} onSubmit={handleCreateMap}>
              <div className={styles.formGroup}>
                <label htmlFor="map-title-input">Map Title</label>
                <input
                  autoFocus
                  className={styles.input}
                  id="map-title-input"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sword Coast Overworld, Catacombs"
                  required
                  type="text"
                  value={title}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="map-desc-input">Description (Optional)</label>
                <textarea
                  className={styles.textarea}
                  id="map-desc-input"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary or region details..."
                  rows={2}
                  value={description}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="map-sample-select">Map Image Source</label>
                {libraryMaps.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      aria-label="Filter library maps"
                      className={styles.input}
                      onChange={(e) => setMapSearch(e.target.value)}
                      placeholder="Filter library maps..."
                      style={{ flex: 1 }}
                      type="text"
                      value={mapSearch}
                    />
                    <select
                      aria-label="Category filter"
                      className={styles.select}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ width: 'auto' }}
                      value={selectedCategory}
                    >
                      <option value="all">All Categories ({libraryMaps.length})</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
                <select
                  className={styles.select}
                  id="map-sample-select"
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSample(val);
                    if (!title.trim() && val) {
                      const found = libraryMaps.find((m) => m.path === val);
                      if (found) setTitle(found.name);
                    }
                  }}
                  value={selectedSample}
                >
                  <optgroup label="Sample & Demo Maps">
                    {SAMPLE_MAP_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.path}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                  {filteredLibraryMaps.length > 0 && (
                    <optgroup label={`Library Battle Maps (${filteredLibraryMaps.length})`}>
                      {filteredLibraryMaps.map((map) => (
                        <option key={map.id} value={map.path}>
                          {map.category ? `[${map.category}] ` : ''}{map.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {!selectedSample && (
                <div className={styles.formGroup}>
                  <label htmlFor="map-custom-path">Custom Image URL or Path</label>
                  <input
                    className={styles.input}
                    id="map-custom-path"
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="/assets/maps/my-map.png or https://..."
                    type="text"
                    value={customPath}
                  />
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelButton}
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.submitButton}
                  disabled={!title.trim() || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Creating...' : 'Create Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export function MapsSectionRoute() {
  return (
    <SectionRoute title="Maps">
      <MapsContent />
    </SectionRoute>
  );
}
