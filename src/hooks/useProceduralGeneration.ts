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
