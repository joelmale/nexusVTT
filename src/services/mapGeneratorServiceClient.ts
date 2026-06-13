import * as Comlink from 'comlink';
import type { MapGeneratorWorkerAPI, GeneratorConfig, GeneratedMapPayload, GeneratorType } from '../types/generatorWorker';

class MapGeneratorServiceClient {
  private worker: Worker | null = null;
  private api: Comlink.Remote<MapGeneratorWorkerAPI> | null = null;

  /** Start the worker if not already started */
  private start() {
    if (this.worker) return;
    this.worker = new Worker(new URL('../workers/mapGenerator.worker.ts', import.meta.url), { type: 'module' });
    this.api = Comlink.wrap<MapGeneratorWorkerAPI>(this.worker);
  }

  /** Process a generation request */
  async processGeneration(type: GeneratorType, config: GeneratorConfig): Promise<GeneratedMapPayload> {
    if (!this.api) this.start();
    if (!this.api) throw new Error('Map Generator Worker failed to initialise');
    await this.api.initializeGenerator(type, `/assets/${type}-generator/`);
    return await this.api.generateMap(config);
  }

  /** Terminate the worker when no longer needed */
  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.api = null;
  }
}

export const mapGeneratorService = new MapGeneratorServiceClient();
