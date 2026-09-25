export interface MapLayerViewModel {
  id: string;
  label: string;
  visible: boolean;
}

export interface MapPinViewModel {
  id: string;
  label: string;
  x: number;
  y: number;
  layerIds: string[];
  locationId: string;
}

export interface LinkedObjectViewModel {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
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
  title: string;
  imagePath: string;
  layers: MapLayerViewModel[];
  pins: MapPinViewModel[];
  locations: LocationViewModel[];
  selectedPinId: string;
}
