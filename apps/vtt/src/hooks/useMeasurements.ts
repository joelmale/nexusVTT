import { useState, useCallback } from 'react';
import type { Measurement } from '@/types/drawing';

export const useMeasurements = () => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const addMeasurement = useCallback((measurement: Measurement) => {
    setMeasurements((prev) => [...prev, measurement]);
    console.log(
      `📏 Measured: ${measurement.distance} feet (${measurement.gridDistance} squares)`,
    );
  }, []);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
  }, []);

  const removeMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    measurements,
    addMeasurement,
    clearMeasurements,
    removeMeasurement,
  };
};
