export type GeneratorType = 'cave' | 'city' | 'dwelling' | 'world';

export interface GeneratorConfig {
  seed: string;
  width: number;
  height: number;
  grammarPreset?: string;
  themeStyle?: string;
}

export interface GeneratedMapPayload {
  grid: number[][];
  rooms: Array<{ id: number; x: number; y: number; w: number; h: number; type: string }>;
  metadata: {
    generatedAt: number;
    seedUsed: string;
    processingTimeMs: number;
  };
}

export interface MapGeneratorWorkerAPI {
  initializeGenerator(type: GeneratorType, assetPath: string): Promise<boolean>;
  generateMap(config: GeneratorConfig): Promise<GeneratedMapPayload>;
}
