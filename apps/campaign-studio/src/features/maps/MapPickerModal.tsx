import { useEffect, useMemo, useRef, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import Image from 'lucide-react/dist/esm/icons/image';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Search from 'lucide-react/dist/esm/icons/search';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Upload from 'lucide-react/dist/esm/icons/upload';
import X from 'lucide-react/dist/esm/icons/x';

import { DEFAULT_MAPS } from '@/data/defaultMaps';
import { resolvePublicAsset } from '@/features/map-preparation/buildMapPreparationModel';
import {
  AuthenticationRequiredError,
  mapImageProblem,
  uploadMapImage,
} from '@/services/campaign-prep-api';
import {
  GENERATORS,
  GeneratorAuthRequiredError,
  GeneratorExportError,
  generatorLabel,
  getGeneratorUrl,
  getHubOrigin,
  isBlankImage,
  measureImage,
  requestGeneratorExport,
  uploadGeneratedMap,
  type GeneratorKind,
} from '@/services/generatorHub';

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

export type MapPickerTab = 'library' | 'upload' | 'generate';

export interface MapPickerModalProps {
  isOpen: boolean;
  /** Which source tab to show when the modal opens. Defaults to the library. */
  initialTab?: MapPickerTab;
  onClose: () => void;
  onSubmit: (data: MapSubmitPayload) => Promise<void>;
  isSubmitting?: boolean;
}

const PAGE_SIZE = 48;

/** A demo map with no thumbnail: shown as a placeholder, never as a 3.9 MB card. */
const DEMO_MAPS: LibraryMapItem[] = [
  {
    id: 'library:glass-harbor',
    name: 'Glass Harbor (Ashes of Veyra)',
    category: 'urban',
    path: '/demo/ashes-of-veyra/glass-harbor-map.png',
  },
];

/** The VTT's bundled battle maps, from the generated index (no network fetch). */
const BUNDLED_MAPS: LibraryMapItem[] = DEFAULT_MAPS.map((map) => ({
  id: map.id,
  name: map.name,
  category: map.category,
  path: map.path,
  thumbnail: map.thumbnail,
}));

const LIBRARY_MAPS: LibraryMapItem[] = [...DEMO_MAPS, ...BUNDLED_MAPS];

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
  initialTab = 'library',
  onClose,
  onSubmit,
  isSubmitting = false,
}: MapPickerModalProps) {
  const [tab, setTab] = useState<MapPickerTab>(initialTab);
  const libraryMaps = LIBRARY_MAPS;
  const [selectedMap, setSelectedMap] = useState<LibraryMapItem>(
    LIBRARY_MAPS[0],
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Thumbnails that failed to load show a placeholder. They are never swapped
  // for the full-size image, which is far larger.
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  // The data URL is only a local preview. The file itself is uploaded on submit
  // and the saved map keeps the real asset id and URL, never the data.
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [isUploading, setUploadingState] = useState(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    name: string;
    size: number;
    dimensions: { width: number; height: number };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate state: the generator hub runs in an iframe and exports on request.
  const [generator, setGenerator] = useState<GeneratorKind>('dungeon');
  const [hubReady, setHubReady] = useState(false);
  const [generateError, setGenerateError] = useState<string>();
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hubOrigin = useMemo(() => getHubOrigin(), []);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setGenerateError(undefined);
    // Opening straight onto Generate still starts with a usable title.
    if (initialTab === 'generate') {
      setTitle((current) =>
        current.trim() ? current : `Generated ${generatorLabel('dungeon').toLowerCase()}`,
      );
    }
  }, [isOpen, initialTab]);

  // The hub says it is ready once the generator has loaded.
  useEffect(() => {
    if (!isOpen || tab !== 'generate') return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== hubOrigin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: string } | null)?.type === 'generator/ready') {
        setHubReady(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isOpen, tab, hubOrigin, generator]);

  const chooseGenerator = (next: GeneratorKind) => {
    setGenerator(next);
    setHubReady(false);
    setGenerateError(undefined);
    if (!titleManuallyEdited || !title.trim()) {
      setTitle(`Generated ${generatorLabel(next).toLowerCase()}`);
    }
  };

  const chooseTab = (next: MapPickerTab) => {
    setTab(next);
    setGenerateError(undefined);
    if (next === 'generate') {
      setHubReady(false);
      if (!titleManuallyEdited || !title.trim()) {
        setTitle(`Generated ${generatorLabel(generator).toLowerCase()}`);
      }
    }
  };

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

  // A new search or category starts again from the first page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory]);

  const handleSelectLibraryMap = (map: LibraryMapItem) => {
    setSelectedMap(map);
    if (!titleManuallyEdited || !title.trim()) {
      setTitle(map.name);
    }
  };

  const handleFileChange = (file: File) => {
    const problem = mapImageProblem(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(undefined);
    setUploadedFile(file);

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
    } else if (tab === 'generate') {
      const frame = frameRef.current?.contentWindow;
      if (!frame) {
        setGenerateError('The generator has not loaded yet.');
        return;
      }
      setGenerateError(undefined);
      setIsSavingGenerated(true);
      try {
        const exported = await requestGeneratorExport(frame, hubOrigin);
        // A generator asked before it has drawn exports one flat color. Do not
        // save that as a map.
        if (await isBlankImage(exported.blob)) {
          throw new GeneratorExportError(
            'The generator has not drawn a map yet. Wait for it to finish, or reroll, then try again.',
          );
        }
        const size =
          exported.width && exported.height
            ? { width: exported.width, height: exported.height }
            : ((await measureImage(exported.blob)) ?? { width: 2000, height: 2000 });
        const stored = await uploadGeneratedMap({
          blob: exported.blob,
          mimeType: exported.mimeType,
          name: trimmedTitle,
          generator,
          width: size.width,
          height: size.height,
        });
        await onSubmit({
          title: trimmedTitle,
          description: description.trim(),
          imagePath: stored.sceneUrl,
          imageAssetRef: { target: 'asset', assetId: stored.assetId },
          dimensions: { width: stored.width, height: stored.height },
        });
      } catch (error) {
        setGenerateError(
          error instanceof GeneratorAuthRequiredError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not create the generated map.',
        );
      } finally {
        setIsSavingGenerated(false);
      }
    } else {
      if (!uploadedFile || !uploadedFileInfo) return;
      setUploadError(undefined);
      setUploadingState(true);
      try {
        const stored = await uploadMapImage(uploadedFile, trimmedTitle);
        await onSubmit({
          title: trimmedTitle,
          description: description.trim(),
          imagePath: stored.url,
          imageAssetRef: { target: 'asset', assetId: stored.assetId },
          dimensions: uploadedFileInfo.dimensions,
        });
      } catch (error) {
        setUploadError(
          error instanceof AuthenticationRequiredError
            ? 'Sign in to Nexus VTT to upload maps.'
            : error instanceof Error
              ? error.message
              : 'Could not upload the image.',
        );
      } finally {
        setUploadingState(false);
      }
    }
  };

  if (!isOpen) return null;

  const isSubmitDisabled =
    !title.trim() ||
    isSubmitting ||
    (tab === 'upload' && (!uploadedFile || isUploading)) ||
    (tab === 'generate' && (!hubReady || isSavingGenerated));

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
            onClick={() => chooseTab('library')}
            type="button"
          >
            <Image size={15} />
            <span>Asset Library ({libraryMaps.length})</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'upload' ? styles.activeTab : ''}`}
            onClick={() => chooseTab('upload')}
            type="button"
          >
            <Upload size={15} />
            <span>Upload Map</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'generate' ? styles.activeTab : ''}`}
            onClick={() => chooseTab('generate')}
            type="button"
          >
            <Sparkles size={15} />
            <span>Generate</span>
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
                  {filteredMaps.slice(0, visibleCount).map((map) => {
                    const isSelected = selectedMap.id === map.id;
                    const thumbUrl =
                      map.thumbnail && !failedThumbs.has(map.id)
                        ? resolvePublicAsset(map.thumbnail)
                        : '';
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
                              onError={() =>
                                setFailedThumbs((current) =>
                                  new Set(current).add(map.id),
                                )
                              }
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
              {filteredMaps.length > visibleCount ? (
                <button
                  className={styles.showMore}
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  type="button"
                >
                  Show more ({filteredMaps.length - visibleCount} left)
                </button>
              ) : null}
            </div>
          )}

          {tab === 'upload' && (
            <div className={styles.uploadContainer}>
              <input
                accept="image/png,image/jpeg,image/webp"
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
                      PNG, JPEG or WebP, up to 5 MB
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
              {uploadError ? (
                <p className={styles.generateError} role="alert">
                  {uploadError}
                </p>
              ) : null}
            </div>
          )}

          {tab === 'generate' && (
            <div className={styles.generateContainer}>
              <div
                aria-label="Generator type"
                className={styles.generatorChoices}
                role="group"
              >
                {GENERATORS.map((option) => (
                  <button
                    aria-pressed={option.id === generator}
                    className={`${styles.generatorChoice} ${option.id === generator ? styles.generatorChoiceActive : ''}`}
                    key={option.id}
                    onClick={() => chooseGenerator(option.id)}
                    type="button"
                  >
                    <span className={styles.generatorName}>{option.label}</span>
                    <span className={styles.generatorBlurb}>{option.blurb}</span>
                  </button>
                ))}
              </div>
              <iframe
                className={styles.generatorFrame}
                key={generator}
                ref={frameRef}
                sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
                src={getGeneratorUrl(generator)}
                title={`${generatorLabel(generator)} generator`}
              />
              <p className={styles.generatorHint}>
                {hubReady
                  ? "Use the generator's own controls to reroll until you like the map, then choose Use this map."
                  : 'Loading the generator…'}
              </p>
              {generateError ? (
                <p className={styles.generateError} role="alert">
                  {generateError}
                </p>
              ) : null}
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
              {isSubmitting || isSavingGenerated || isUploading
                ? tab === 'generate' || isUploading
                  ? 'Saving map...'
                  : 'Creating...'
                : tab === 'generate'
                  ? 'Use this map'
                  : 'Create Map'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
