import { useEffect, useMemo, useRef, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import Image from 'lucide-react/dist/esm/icons/image';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Search from 'lucide-react/dist/esm/icons/search';
import Upload from 'lucide-react/dist/esm/icons/upload';
import X from 'lucide-react/dist/esm/icons/x';

import { resolvePublicAsset } from '@/features/map-preparation/buildMapPreparationModel';

import styles from './MapPickerModal.module.css';

export interface LibraryMapItem {
  id: string;
  name: string;
  category?: string;
  path: string;
  thumbnail?: string;
}

export interface MapSubmitPayload {
  title: string;
  description: string;
  imagePath: string;
  imageAssetRef: { target: 'asset'; assetId: string };
  dimensions: { width: number; height: number };
}

export interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MapSubmitPayload) => Promise<void>;
  isSubmitting?: boolean;
}

const DEFAULT_SAMPLE_MAPS: LibraryMapItem[] = [
  {
    id: 'library:glass-harbor',
    name: 'Glass Harbor (Ashes of Veyra)',
    category: 'urban',
    path: '/demo-assets/ashes-of-veyra/maps/glass-harbor.png',
  },
  {
    id: 'library:sword-coast-regional',
    name: 'Sword Coast Regional Map',
    category: 'outdoor',
    path: '/demo-assets/ashes-of-veyra/maps/sword-coast.png',
  },
  {
    id: 'library:dungeon-crossroads',
    name: 'Dungeon Crossroads',
    category: 'dungeon',
    path: '/demo-assets/ashes-of-veyra/maps/dungeon-crossroads.png',
  },
];

function cleanFileName(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt
    .replace(/[_\s-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MapPickerModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: MapPickerModalProps) {
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [libraryMaps, setLibraryMaps] =
    useState<LibraryMapItem[]>(DEFAULT_SAMPLE_MAPS);
  const [selectedMap, setSelectedMap] = useState<LibraryMapItem>(
    DEFAULT_SAMPLE_MAPS[0],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    name: string;
    size: number;
    dimensions: { width: number; height: number };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch default asset manifest for base maps
  useEffect(() => {
    let isMounted = true;
    fetch('/assets/defaults/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.maps?.items && Array.isArray(data.maps.items)) {
          const manifestItems: LibraryMapItem[] = data.maps.items.map(
            (item: Record<string, unknown>) => ({
              id: String(item.id || item.name),
              name: String(item.name),
              category: item.category ? String(item.category) : 'outdoor',
              path: String(item.path),
              thumbnail: item.thumbnail ? String(item.thumbnail) : undefined,
            }),
          );
          setLibraryMaps([...DEFAULT_SAMPLE_MAPS, ...manifestItems]);
        }
      })
      .catch(() => {
        // Fall back gracefully to DEFAULT_SAMPLE_MAPS
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute categories
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    libraryMaps.forEach((m) => {
      const cat = m.category || 'other';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [libraryMaps]);

  // Filtered library maps
  const filteredMaps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return libraryMaps.filter((m) => {
      const matchesCategory =
        selectedCategory === 'all' || m.category === selectedCategory;
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [libraryMaps, searchQuery, selectedCategory]);

  const handleSelectLibraryMap = (map: LibraryMapItem) => {
    setSelectedMap(map);
    if (!titleManuallyEdited || !title.trim()) {
      setTitle(map.name);
    }
  };

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedDataUrl(dataUrl);

      setUploadedFileInfo({
        name: file.name,
        size: file.size,
        dimensions: { width: 1920, height: 1080 },
      });

      if (!titleManuallyEdited || !title.trim()) {
        setTitle(cleanFileName(file.name));
      }

      const img = new window.Image();
      img.onload = () => {
        const width = img.naturalWidth || 1920;
        const height = img.naturalHeight || 1080;
        setUploadedFileInfo({
          name: file.name,
          size: file.size,
          dimensions: { width, height },
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    if (tab === 'library') {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        imagePath: selectedMap.path,
        imageAssetRef: {
          target: 'asset',
          assetId: selectedMap.id || `map-${Date.now()}`,
        },
        dimensions: { width: 1920, height: 1080 },
      });
    } else {
      if (!uploadedDataUrl || !uploadedFileInfo) return;
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        imagePath: uploadedDataUrl,
        imageAssetRef: {
          target: 'asset',
          assetId: `custom-map-${Date.now()}`,
        },
        dimensions: uploadedFileInfo.dimensions,
      });
    }
  };

  if (!isOpen) return null;

  const isSubmitDisabled =
    !title.trim() ||
    isSubmitting ||
    (tab === 'upload' && !uploadedDataUrl);

  return (
    <div
      aria-modal="true"
      className={styles.modalOverlay}
      onClick={onClose}
      role="dialog"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add Campaign Map</h2>
          <button
            aria-label="Close"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Map source tabs" className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'library' ? styles.activeTab : ''}`}
            onClick={() => setTab('library')}
            type="button"
          >
            <Image size={15} />
            <span>Asset Library ({libraryMaps.length})</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'upload' ? styles.activeTab : ''}`}
            onClick={() => setTab('upload')}
            type="button"
          >
            <Upload size={15} />
            <span>Upload Map</span>
          </button>
        </nav>

        <form className={styles.body} onSubmit={handleSubmit}>
          {tab === 'library' && (
            <div className={styles.libraryControls}>
              <div className={styles.searchBar}>
                <Search className={styles.searchIcon} size={15} />
                <input
                  aria-label="Filter library maps"
                  className={styles.searchInput}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search battle maps by name or category..."
                  type="text"
                  value={searchQuery}
                />
                {searchQuery && (
                  <button
                    aria-label="Clear search"
                    className={styles.closeButton}
                    onClick={() => setSearchQuery('')}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className={styles.categoryPills}>
                <button
                  className={`${styles.categoryPill} ${selectedCategory === 'all' ? styles.activePill : ''}`}
                  onClick={() => setSelectedCategory('all')}
                  type="button"
                >
                  All ({libraryMaps.length})
                </button>
                {categories.map(([cat, count]) => (
                  <button
                    className={`${styles.categoryPill} ${selectedCategory === cat ? styles.activePill : ''}`}
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    type="button"
                  >
                    {cat} ({count})
                  </button>
                ))}
              </div>

              {filteredMaps.length === 0 ? (
                <div className={styles.emptySearch}>
                  <p>No maps found matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {filteredMaps.map((map) => {
                    const isSelected = selectedMap.id === map.id;
                    const thumbUrl = resolvePublicAsset(
                      map.thumbnail || map.path,
                    );
                    return (
                      <div
                        aria-pressed={isSelected}
                        className={`${styles.mapCard} ${isSelected ? styles.selectedCard : ''}`}
                        key={map.id}
                        onClick={() => handleSelectLibraryMap(map)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectLibraryMap(map);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.cardThumb}>
                          {thumbUrl ? (
                            <img
                              alt={map.name}
                              loading="lazy"
                              src={thumbUrl}
                            />
                          ) : (
                            <span className={styles.cardPlaceholder}>
                              <MapPin size={24} />
                            </span>
                          )}
                          {isSelected && (
                            <span className={styles.checkBadge}>
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className={styles.cardBody}>
                          <span className={styles.cardTitle} title={map.name}>
                            {map.name}
                          </span>
                          {map.category && (
                            <span className={styles.cardCategory}>
                              {map.category}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <div className={styles.uploadContainer}>
              <input
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className={styles.fileInputHidden}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
                ref={fileInputRef}
                type="file"
              />

              {!uploadedDataUrl ? (
                <div
                  className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.uploadIconWrap}>
                    <Upload size={24} />
                  </div>
                  <div>
                    <span className={styles.dropzoneText}>
                      Click to browse or drag and drop a map image
                    </span>
                    <p className={styles.dropzoneSubtext}>
                      Supports PNG, JPEG, WebP, or SVG battle maps
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.uploadPreview}>
                  <div className={styles.previewImageWrap}>
                    <img alt="Map preview" src={uploadedDataUrl} />
                  </div>
                  <div className={styles.previewDetails}>
                    <span className={styles.previewFilename}>
                      {uploadedFileInfo?.name}
                    </span>
                    <span className={styles.previewMeta}>
                      {uploadedFileInfo && formatBytes(uploadedFileInfo.size)} ·{' '}
                      {uploadedFileInfo &&
                        `${uploadedFileInfo.dimensions.width} × ${uploadedFileInfo.dimensions.height} px`}
                    </span>
                    <button
                      className={styles.changeFileButton}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Choose different image
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={styles.formSection}>
            <div className={styles.formGroup}>
              <label htmlFor="map-title-input">Map Title</label>
              <input
                autoFocus
                className={styles.input}
                id="map-title-input"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleManuallyEdited(true);
                }}
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
                placeholder="Summary, region details, or GM notes..."
                rows={2}
                value={description}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.submitButton}
              disabled={isSubmitDisabled}
              type="submit"
            >
              {isSubmitting ? 'Creating...' : 'Create Map'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
