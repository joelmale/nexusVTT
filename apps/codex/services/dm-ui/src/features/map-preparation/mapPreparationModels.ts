export interface MapLayerViewModel {
  id: string;
  label: string;
  visible: boolean;
  order?: number;
}

export interface LinkedObjectViewModel {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
}

export interface MapPinViewModel {
  id: string;
  label: string;
  x: number;
  y: number;
  layerIds: string[];
  locationId?: string;
  icon?: string;
  color?: string;
  visibility?: 'dm-only' | 'players';
  notes?: string;
  linkedObjectRefs?: Array<{ target: string; [k: string]: unknown }>;
  linkedObjects?: LinkedObjectViewModel[];
}

export interface LocationViewModel {
  id: string;
  name: string;
  typeLabel: string;
  shortDescription: string;
  description: string[];
  tags: string[];
  notes: string;
  imagePath?: string;
  linkedObjects: LinkedObjectViewModel[];
}

export interface MapPreparationViewModel {
  id: string;
  /** Owning campaign; needed to build valid campaign-object references. */
  campaignId?: string;
  title: string;
  description?: string;
  imagePath: string;
  imageAssetRef?: {
    target?: 'asset';
    assetId?: string;
    kind?: 'campaign-asset' | 'game-asset' | 'user-asset';
    path?: string;
    label?: string;
  };
  dimensions?: { width: number; height: number };
  layers: MapLayerViewModel[];
  pins: MapPinViewModel[];
  locations: LocationViewModel[];
  availableObjects?: LinkedObjectViewModel[];
  selectedPinId: string;
}
