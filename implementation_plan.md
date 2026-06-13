# Web Worker Offloading for Generators Implementation Plan

## Goal Description

Add a web‑worker based procedural generation pipeline to the NexusVTT project. The new pipeline will run heavy map generation algorithms off the main UI thread using Comlink, providing strict TypeScript typings, a singleton service client, and a React hook for components to trigger generation without UI jank.

## User Review Required

> [!IMPORTANT]
> The implementation introduces a new runtime dependency **comlink**. The project must have this package added to `package.json` and installed.
>
> The worker files rely on Vite's native worker handling (`new Worker(new URL(..., import.meta.url), { type: 'module' })`). Ensure the current Vite configuration does not block worker bundling.
>
> Verify the asset path convention (`/assets/${type}-generator/`) matches the existing static asset layout. If assets are stored elsewhere, adjust the path.

## Open Questions

> [!WARNING]
> 1. **Asset Path** – Are the generator fonts and style assets served from `/assets/` at runtime, or is there a custom CDN/base URL we should use?
> 2. **Dependency Management** – Shall we automatically add `comlink` to `package.json` via `npm install comlink`?
> 3. **Component Integration** – Which component(s) should be updated to use the new `useProceduralGeneration` hook (e.g., `DungeonGenerator.tsx`, `WorldGenerator.tsx`)? Provide file paths if you want us to modify them now.

## Proposed Changes

---
### [NEW] src/types/generatorWorker.ts
```typescript
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
```
---
### [NEW] src/workers/mapGenerator.worker.ts
```typescript
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
```
---
### [NEW] src/services/mapGeneratorServiceClient.ts
```typescript
import * as Comlink from 'comlink';
import type { MapGeneratorWorkerAPI, GeneratorConfig, GeneratedMapPayload, GeneratorType } from '../types/generatorWorker';

class MapGeneratorServiceClient {
  private worker: Worker | null = null;
  private api: Comlink.Remote<MapGeneratorWorkerAPI> | null = null;

  start() {
    if (this.worker) return;
    this.worker = new Worker(new URL('../workers/mapGenerator.worker.ts', import.meta.url), { type: 'module' });
    this.api = Comlink.wrap<MapGeneratorWorkerAPI>(this.worker);
  }

  async processGeneration(type: GeneratorType, config: GeneratorConfig): Promise<GeneratedMapPayload> {
    if (!this.api) this.start();
    if (!this.api) throw new Error('Worker failed to initialise');
    await this.api.initializeGenerator(type, `/assets/${type}-generator/`);
    return await this.api.generateMap(config);
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.api = null;
  }
}

export const mapGeneratorService = new MapGeneratorServiceClient();
```
---
### [NEW] src/hooks/useProceduralGeneration.ts
```typescript
import { useState, useCallback } from 'react';
import { mapGeneratorService } from '../services/mapGeneratorServiceClient';
import type { GeneratorConfig, GeneratedMapPayload, GeneratorType } from '../types/generatorWorker';

interface UseProceduralGenerationResult {
  isGenerating: boolean;
  generatedData: GeneratedMapPayload | null;
  error: string | null;
  triggerGeneration: (type: GeneratorType, config: GeneratorConfig) => Promise<void>;
}

export const useProceduralGeneration = (): UseProceduralGenerationResult => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedMapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerGeneration = useCallback(async (type: GeneratorType, config: GeneratorConfig) => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await mapGeneratorService.processGeneration(type, config);
      setGeneratedData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { isGenerating, generatedData, error, triggerGeneration };
};
```
---
### Package Dependency

Add **comlink** to the project:
```
npm install comlink
```
---
## Verification Plan

**Automated Tests**
- Run `npm run test` after adding the new files to ensure type‑checking passes.
- Write a unit test for `useProceduralGeneration` that mocks the worker proxy and verifies state transitions.

**Manual Verification**
- In a component (e.g., `DungeonGenerator.tsx`) import the hook, trigger a 100 × 100 generation, and confirm the UI remains responsive, loading spinners animate, and the result appears.
- Open the browser devtools → Performance tab to ensure the main thread stays under 16 ms during generation.

**Performance Metric**
- Generation of a 100 × 100 map should report `processingTimeMs` ≤ 200 ms and UI frame rate should stay at 60 fps.

---
**Next Steps**
- Add the files.
- Install the dependency.
- Optionally update a component to use the hook.
- Run verification steps.

Please review the plan, answer the open questions, and approve to proceed.
