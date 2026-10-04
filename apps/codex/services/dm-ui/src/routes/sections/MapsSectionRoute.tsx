import { useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { useNavigate } from 'react-router-dom';

import { useCapabilityNotice } from '@/features/capability-notice';
import { MapsIndex } from '@/features/maps/MapsIndex';
import {
  MapPickerModal,
  type MapSubmitPayload,
} from '@/features/maps/MapPickerModal';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionRoute } from '@/features/section-shell/SectionRoute';

import styles from './MapsSectionRoute.module.css';

export function MapsContent() {
  const { bundle, basePath, store } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = () => {
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
          title="No maps yet."
        />
      ) : (
        <MapsIndex basePath={basePath} bundle={bundle} />
      )}

      <MapPickerModal
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

