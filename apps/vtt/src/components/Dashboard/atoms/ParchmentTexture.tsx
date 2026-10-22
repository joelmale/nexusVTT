import React from 'react';

/**
 * Shared noise textures for the dashboard. Previously the same data URI was
 * pasted into five components; keep them here so the grain stays consistent.
 */

/** Fine fractal grain, blended over parchment or slate surfaces. */
export const GRAIN_TEXTURE_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

/** Low-frequency, very faint paper mottling used as a panel background. */
export const PAPER_TEXTURE_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paperNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.015 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paperNoise)'/%3E%3C/svg%3E")`;

interface ParchmentTextureProps {
  /** Overlay strength, 0 to 1. Defaults to a subtle 0.04. */
  opacity?: number;
  className?: string;
}

/** Absolutely positioned grain overlay; place inside a `relative` parent. */
export const ParchmentTexture: React.FC<ParchmentTextureProps> = ({
  opacity = 0.04,
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`absolute inset-0 pointer-events-none mix-blend-overlay ${className}`}
    style={{ backgroundImage: GRAIN_TEXTURE_URL, opacity }}
  />
);
