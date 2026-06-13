import * as Comlink from 'comlink';
import type { MapGeneratorWorkerAPI, GeneratorConfig, GeneratedMapPayload, GeneratorType } from '../types/generatorWorker';

class MapGeneratorWorker implements MapGeneratorWorkerAPI {
  private currentType: GeneratorType | null = null;
  private assetRootPath = '';

  async initializeGenerator(type: GeneratorType, assetPath: string): Promise<boolean> {
    this.currentType = type;
    this.assetRootPath = assetPath;
    return true;
  }

  async generateMap(config: GeneratorConfig): Promise<GeneratedMapPayload> {
    const start = performance.now();
    const grid: number[][] = [];
    const rooms: GeneratedMapPayload['rooms'] = [];

    for (let x = 0; x < config.width; x++) {
      grid[x] = [];
      for (let y = 0; y < config.height; y++) {
        const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1);
        grid[x][y] = noise > 0.2 ? 1 : 0;
      }
    }

    if (config.width > 10) {
      rooms.push({
        id: 1,
        x: 2,
        y: 2,
        w: 6,
        h: 5,
        type: config.grammarPreset ?? 'default_chamber',
      });
    }

    const end = performance.now();
    return {
      grid,
      rooms,
      metadata: {
        generatedAt: Date.now(),
        seedUsed: config.seed || 'nexus_default_seed',
        processingTimeMs: Math.round(end - start),
      },
    };
  }
}

Comlink.expose(new MapGeneratorWorker());
