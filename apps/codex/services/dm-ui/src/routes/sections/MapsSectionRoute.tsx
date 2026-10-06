import { useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Upload from 'lucide-react/dist/esm/icons/upload';
import { useNavigate } from 'react-router-dom';

import type { CampaignMap } from '@/demo/fixture-registry';
import { MapsIndex } from '@/features/maps/MapsIndex';
import {
  MapPickerModal,
  type MapPickerTab,
  type MapSubmitPayload,
} from '@/features/maps/MapPickerModal';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

import styles from './MapsSectionRoute.module.css';

export function MapsContent() {
  const { bundle, basePath, store } = useSectionBundle();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<MapPickerTab>('library');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Map starts on the asset library; Upload map starts on the upload tab.
  const openModal = (tab: MapPickerTab) => {
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleCreateMap = async (mapData: MapSubmitPayload) => {
    setIsSubmitting(true);
    try {
      const newMapDraft = {
        title: mapData.title,
        description: mapData.description,
        imagePath: mapData.imagePath,
        imageAssetRef: mapData.imageAssetRef,
        dimensions: mapData.dimensions,
        locationIds: [],
        layers: [
          {
            id: crypto.randomUUID(),
            label: 'Landmarks',
            visibleByDefault: true,
            order: 0,
            locationIds: [],
          },
        ],
        pins: [],
      };

      if (!store.editable) {
        const id = `map-${crypto.randomUUID().slice(0, 8)}`;
        const localMap: CampaignMap = {
          id,
          campaignId: bundle.campaign.id,
          title: newMapDraft.title,
          description: newMapDraft.description,
          imagePath: newMapDraft.imagePath,
          imageAssetRef: newMapDraft.imageAssetRef,
          dimensions: newMapDraft.dimensions,
          locationIds: [],
          layers: newMapDraft.layers,
          pins: [],
        };
        bundle.maps.push(localMap);
        setIsModalOpen(false);
        navigate(`${basePath}/maps/${encodeURIComponent(id)}`);
        return;
      }

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
        {bundle.maps.length > 0 ? (
          <button
            className={styles.addButton}
            data-testid="add-map-button"
            onClick={() => openModal('library')}
            type="button"
          >
            <Plus size={16} />
            <span>Add Map</span>
          </button>
        ) : null}
      </div>

      {bundle.maps.length === 0 ? (
        <EmptyState
          action={
            <div className={styles.actions}>
              <button
                className={styles.addButton}
                onClick={() => openModal('upload')}
                type="button"
              >
                <Upload size={16} />
                <span>Upload map</span>
              </button>
              <button
                className={styles.addButton}
                data-testid="add-map-button"
                onClick={() => openModal('library')}
                type="button"
              >
                <Plus size={16} />
                <span>Add Map</span>
              </button>
            </div>
          }
          title="No maps yet."
        />
      ) : (
        <MapsIndex basePath={basePath} bundle={bundle} />
      )}

      <MapPickerModal
        initialTab={modalTab}
        isOpen={isModalOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateMap}
      />
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

