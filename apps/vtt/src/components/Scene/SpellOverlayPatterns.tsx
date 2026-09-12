import React from 'react';
import { ELEMENT_THEMES, type ElementType } from '@/types/drawing';

/**
 * SpellOverlayPatterns Component
 *
 * Provides reusable SVG patterns, gradients, and filters for spell overlay effects.
 * This component returns <defs> elements that can be referenced by spell overlays.
 *
 * Features:
 * - Turbulence patterns for organic textures (one per element type)
 * - Radial gradients for feathered edges
 * - Glow filters for magical effects
 * - Edge shimmer filters for lightning/radiant elements
 */
export const SpellOverlayPatterns: React.FC = () => {
  const elementTypes: ElementType[] = [
    'fire',
    'cold',
    'lightning',
    'poison',
    'acid',
    'necrotic',
    'radiant',
    'psychic',
    'arcane',
    'force',
    'thunder',
  ];

  return (
    <>
      {/* ==================== TURBULENCE PATTERNS ==================== */}
      {/* Create organic noise texture for each element type */}
      {elementTypes.map((element) => {
        const theme = ELEMENT_THEMES[element];

        return (
          <pattern
            key={`pattern-${element}`}
            id={`spell-${element}-texture`}
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            {/* Base color fill */}
            <rect width="100" height="100" fill={theme.baseColor} opacity={theme.opacity * 0.5} />

            {/* Turbulence noise for organic feel */}
            <rect width="100" height="100" fill={theme.baseColor} filter={`url(#${element}-noise)`} />
          </pattern>
        );
      })}

      {/* ==================== NOISE FILTERS ==================== */}
      {/* Turbulence filters for organic texture - one per element */}
      {elementTypes.map((element) => {
        const theme = ELEMENT_THEMES[element];

        // Vary turbulence parameters per element type for unique looks
        const baseFrequency =
          element === 'fire' || element === 'lightning'
            ? '0.04' // More turbulent for fire/lightning
            : element === 'cold' || element === 'radiant'
              ? '0.02' // Smoother for cold/radiant
              : '0.03'; // Medium for others

        const numOctaves = element === 'necrotic' || element === 'psychic' ? 4 : 3;

        return (
          <filter key={`noise-${element}`} id={`${element}-noise`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={numOctaves}
              seed={element.charCodeAt(0)} // Unique seed per element
              result="noise"
            />
            <feColorMatrix in="noise" type="saturate" values="0.4" result="saturatedNoise" />
            <feBlend in="SourceGraphic" in2="saturatedNoise" mode="multiply" result="blended" />
            <feComponentTransfer in="blended">
              <feFuncA type="linear" slope={theme.opacity * 2} />
            </feComponentTransfer>
          </filter>
        );
      })}

      {/* ==================== RADIAL GRADIENTS ==================== */}
      {/* Feathered edge gradients for each element type */}
      {elementTypes.map((element) => {
        const theme = ELEMENT_THEMES[element];

        return (
          <radialGradient key={`gradient-${element}`} id={`spell-edge-${element}`}>
            {/* Center: full opacity of base color */}
            <stop offset="0%" stopColor={theme.baseColor} stopOpacity={theme.opacity} />

            {/* Mid: slightly faded */}
            <stop offset="60%" stopColor={theme.baseColor} stopOpacity={theme.opacity * 0.8} />

            {/* Outer glow transition */}
            <stop offset="80%" stopColor={theme.edgeGlow} stopOpacity={theme.opacity * 0.5} />

            {/* Edge: bright glow fading to transparent */}
            <stop offset="95%" stopColor={theme.edgeGlow} stopOpacity={theme.opacity * 0.2} />

            {/* Completely transparent at edge */}
            <stop offset="100%" stopColor={theme.edgeGlow} stopOpacity="0" />
          </radialGradient>
        );
      })}

      {/* ==================== GLOW FILTERS ==================== */}
      {/* Standard magical glow filter (used by most spells) */}
      <filter id="spell-glow" filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />

        {/* Intensify the glow */}
        <feColorMatrix
          in="blur1"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"
          result="glow1"
        />
        <feColorMatrix
          in="blur2"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.2 0"
          result="glow2"
        />

        {/* Merge glows with source */}
        <feMerge>
          <feMergeNode in="glow1" />
          <feMergeNode in="glow2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Intense glow for lightning and radiant */}
      <filter id="spell-glow-intense" filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur3" />

        {/* Intensify the glow more */}
        <feColorMatrix
          in="blur1"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"
          result="glow1"
        />
        <feColorMatrix
          in="blur2"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"
          result="glow2"
        />
        <feColorMatrix
          in="blur3"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.2 0"
          result="glow3"
        />

        {/* Merge glows with source */}
        <feMerge>
          <feMergeNode in="glow1" />
          <feMergeNode in="glow2" />
          <feMergeNode in="glow3" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Subtle glow for necrotic and poison */}
      <filter id="spell-glow-subtle" filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />

        {/* Moderate glow intensification */}
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.3 0"
          result="glow"
        />

        {/* Merge glow with source */}
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ==================== EDGE FEATHERING FILTER ==================== */}
      {/* Creates soft, organic edges */}
      <filter id="spell-edge-feather">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
        <feComponentTransfer in="blur" result="softenedAlpha">
          <feFuncA type="linear" slope="0.7" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="softenedAlpha" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ==================== DISPLACEMENT FILTERS ==================== */}
      {/* For animated distortion effects (fire flicker, cold shimmer) */}
      <filter id="spell-fire-distort">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.02 0.05"
          numOctaves="2"
          seed="1"
          result="noise"
        />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <filter id="spell-cold-shimmer">
        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="1" seed="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* ==================== COMPOSITE FILTER DEFINITIONS ==================== */}
      {/* Element-specific filter combinations */}

      {/* Fire: glow + subtle distortion */}
      <filter id="spell-filter-fire">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.6 0"
          result="glow"
        />
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="noise" />
        <feDisplacementMap in="glow" in2="noise" scale="2" result="distorted" />
        <feMerge>
          <feMergeNode in="distorted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Cold: subtle glow + minimal shimmer */}
      <filter id="spell-filter-cold">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.3 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Lightning: intense glow */}
      <filter id="spell-filter-lightning">
        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
        <feColorMatrix
          in="blur1"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2.5 0"
          result="glow1"
        />
        <feColorMatrix
          in="blur2"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.8 0"
          result="glow2"
        />
        <feMerge>
          <feMergeNode in="glow1" />
          <feMergeNode in="glow2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Necrotic: dark, subtle glow */}
      <filter id="spell-filter-necrotic">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="0.8 0 0 0 0  0 0.8 0 0 0  0 0 0.8 0 0  0 0 0 1.4 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Radiant: bright, intense glow */}
      <filter id="spell-filter-radiant">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
        <feColorMatrix
          in="blur1"
          type="matrix"
          values="1.2 0 0 0 0  0 1.2 0 0 0  0 0 1.2 0 0  0 0 0 2 0"
          result="glow1"
        />
        <feColorMatrix
          in="blur2"
          type="matrix"
          values="1.1 0 0 0 0  0 1.1 0 0 0  0 0 1.1 0 0  0 0 0 1.5 0"
          result="glow2"
        />
        <feMerge>
          <feMergeNode in="glow1" />
          <feMergeNode in="glow2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </>
  );
};
