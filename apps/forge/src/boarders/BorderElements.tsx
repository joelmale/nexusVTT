import React from 'react';

// ============================================
// CORNER ELEMENTS
// ============================================

export const Corners = {
  // Classic ornate corner with flourish
  ornate: {
    topLeft: (
      <svg viewBox="0 0 50 50" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          {/* Main corner curve */}
          <path d="M 45,50 L 45,20 Q 45,5 30,5 L 0,5" />
          {/* Inner decorative line */}
          <path d="M 40,50 L 40,22 Q 40,10 28,10 L 0,10" strokeWidth="1" opacity="0.6" />
          {/* Corner ornament */}
          <circle cx="35" cy="15" r="3" fill="currentColor" />
          <circle cx="35" cy="15" r="5" strokeWidth="1" />
        </g>
      </svg>
    ),
    topRight: (
      <svg viewBox="0 0 50 50" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 5,50 L 5,20 Q 5,5 20,5 L 50,5" />
          <path d="M 10,50 L 10,22 Q 10,10 22,10 L 50,10" strokeWidth="1" opacity="0.6" />
          <circle cx="15" cy="15" r="3" fill="currentColor" />
          <circle cx="15" cy="15" r="5" strokeWidth="1" />
        </g>
      </svg>
    ),
    bottomLeft: (
      <svg viewBox="0 0 50 50" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 45,0 L 45,30 Q 45,45 30,45 L 0,45" />
          <path d="M 40,0 L 40,28 Q 40,40 28,40 L 0,40" strokeWidth="1" opacity="0.6" />
          <circle cx="35" cy="35" r="3" fill="currentColor" />
          <circle cx="35" cy="35" r="5" strokeWidth="1" />
        </g>
      </svg>
    ),
    bottomRight: (
      <svg viewBox="0 0 50 50" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 5,0 L 5,30 Q 5,45 20,45 L 50,45" />
          <path d="M 10,0 L 10,28 Q 10,40 22,40 L 50,40" strokeWidth="1" opacity="0.6" />
          <circle cx="15" cy="35" r="3" fill="currentColor" />
          <circle cx="15" cy="35" r="5" strokeWidth="1" />
        </g>
      </svg>
    )
  },

  // Sharp cut corners (like in your screenshot)
  cut: {
    topLeft: (
      <svg viewBox="0 0 40 40" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 0,15 L 15,0 L 40,0 L 40,40" />
          <path d="M 5,15 L 15,5 L 35,5 L 35,40" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    ),
    topRight: (
      <svg viewBox="0 0 40 40" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 40,15 L 25,0 L 0,0 L 0,40" />
          <path d="M 35,15 L 25,5 L 5,5 L 5,40" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    ),
    bottomLeft: (
      <svg viewBox="0 0 40 40" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 0,25 L 15,40 L 40,40 L 40,0" />
          <path d="M 5,25 L 15,35 L 35,35 L 35,0" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    ),
    bottomRight: (
      <svg viewBox="0 0 40 40" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 40,25 L 25,40 L 0,40 L 0,0" />
          <path d="M 35,25 L 25,35 L 5,35 L 5,0" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    )
  },

  // Shield-style corners
  shield: {
    topLeft: (
      <svg viewBox="0 0 60 60" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 55,60 L 55,25 Q 55,15 45,10 L 30,5 Q 20,2 10,5 L 0,8" />
          <path d="M 50,60 L 50,27 Q 50,20 42,16 L 30,12 Q 22,10 14,12 L 0,15" strokeWidth="1" opacity="0.5" />
          {/* Shield emblem */}
          <path d="M 25,20 L 30,15 L 35,20 L 35,25 L 30,30 L 25,25 Z" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    ),
    topRight: (
      <svg viewBox="0 0 60 60" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 5,60 L 5,25 Q 5,15 15,10 L 30,5 Q 40,2 50,5 L 60,8" />
          <path d="M 10,60 L 10,27 Q 10,20 18,16 L 30,12 Q 38,10 46,12 L 60,15" strokeWidth="1" opacity="0.5" />
          <path d="M 25,20 L 30,15 L 35,20 L 35,25 L 30,30 L 25,25 Z" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    ),
    bottomLeft: (
      <svg viewBox="0 0 60 60" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 55,0 L 55,35 Q 55,45 45,50 L 30,55 Q 20,58 10,55 L 0,52" />
          <path d="M 50,0 L 50,33 Q 50,40 42,44 L 30,48 Q 22,50 14,48 L 0,45" strokeWidth="1" opacity="0.5" />
          <path d="M 25,30 L 30,35 L 35,30 L 35,25 L 30,20 L 25,25 Z" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    ),
    bottomRight: (
      <svg viewBox="0 0 60 60" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 5,0 L 5,35 Q 5,45 15,50 L 30,55 Q 40,58 50,55 L 60,52" />
          <path d="M 10,0 L 10,33 Q 10,40 18,44 L 30,48 Q 38,50 46,48 L 60,45" strokeWidth="1" opacity="0.5" />
          <path d="M 25,30 L 30,35 L 35,30 L 35,25 L 30,20 L 25,25 Z" fill="currentColor" opacity="0.3" />
        </g>
      </svg>
    )
  },

  // Rounded simple corners
  rounded: {
    topLeft: (
      <svg viewBox="0 0 30 30" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 30,30 L 30,15 Q 30,0 15,0 L 0,0" />
        </g>
      </svg>
    ),
    topRight: (
      <svg viewBox="0 0 30 30" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 0,30 L 0,15 Q 0,0 15,0 L 30,0" />
        </g>
      </svg>
    ),
    bottomLeft: (
      <svg viewBox="0 0 30 30" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 30,0 L 30,15 Q 30,30 15,30 L 0,30" />
        </g>
      </svg>
    ),
    bottomRight: (
      <svg viewBox="0 0 30 30" className="corner-svg">
        <g stroke="currentColor" fill="none" strokeWidth="2">
          <path d="M 0,0 L 0,15 Q 0,30 15,30 L 30,30" />
        </g>
      </svg>
    )
  }
};

// ============================================
// EDGE ELEMENTS
// ============================================

export const Edges = {
  // Simple straight edge
  straight: {
    horizontal: (
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="edge-svg">
        <line x1="0" y1="5" x2="100" y2="5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    vertical: (
      <svg viewBox="0 0 10 100" preserveAspectRatio="none" className="edge-svg">
        <line x1="5" y1="0" x2="5" y2="100" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  },

  // Double line edge
  double: {
    horizontal: (
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="edge-svg">
        <line x1="0" y1="3" x2="100" y2="3" stroke="currentColor" strokeWidth="2" />
        <line x1="0" y1="7" x2="100" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
    vertical: (
      <svg viewBox="0 0 10 100" preserveAspectRatio="none" className="edge-svg">
        <line x1="3" y1="0" x2="3" y2="100" stroke="currentColor" strokeWidth="2" />
        <line x1="7" y1="0" x2="7" y2="100" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </svg>
    )
  },

  // Decorative edge with pattern
  decorative: {
    horizontal: (
      <svg viewBox="0 0 100 15" preserveAspectRatio="none" className="edge-svg">
        <line x1="0" y1="7.5" x2="100" y2="7.5" stroke="currentColor" strokeWidth="2" />
        <pattern id="dots" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="7.5" r="2" fill="currentColor" />
        </pattern>
        <rect x="0" y="0" width="100" height="15" fill="url(#dots)" opacity="0.5" />
      </svg>
    ),
    vertical: (
      <svg viewBox="0 0 15 100" preserveAspectRatio="none" className="edge-svg">
        <line x1="7.5" y1="0" x2="7.5" y2="100" stroke="currentColor" strokeWidth="2" />
        <pattern id="dotsV" x="0" y="0" width="15" height="20" patternUnits="userSpaceOnUse">
          <circle cx="7.5" cy="10" r="2" fill="currentColor" />
        </pattern>
        <rect x="0" y="0" width="15" height="100" fill="url(#dotsV)" opacity="0.5" />
      </svg>
    )
  }
};

// ============================================
// ORNAMENTAL ELEMENTS
// ============================================

export const Ornaments = {
  // Diamond separator
  diamond: (
    <svg viewBox="0 0 40 20" className="ornament-svg">
      <g stroke="currentColor" fill="currentColor" strokeWidth="1">
        <path d="M 20,2 L 35,10 L 20,18 L 5,10 Z" opacity="0.2" />
        <path d="M 20,5 L 30,10 L 20,15 L 10,10 Z" opacity="0.4" />
        <path d="M 20,7 L 25,10 L 20,13 L 15,10 Z" />
      </g>
    </svg>
  ),

  // Flourish
  flourish: (
    <svg viewBox="0 0 60 20" className="ornament-svg">
      <g stroke="currentColor" fill="none" strokeWidth="1.5">
        <path d="M 10,10 Q 20,5 30,10 T 50,10" />
        <circle cx="30" cy="10" r="3" fill="currentColor" />
        <circle cx="15" cy="10" r="1.5" fill="currentColor" />
        <circle cx="45" cy="10" r="1.5" fill="currentColor" />
      </g>
    </svg>
  ),

  // Star
  star: (
    <svg viewBox="0 0 30 30" className="ornament-svg">
      <g fill="currentColor">
        <path d="M 15,5 L 18,12 L 25,12 L 19,17 L 22,24 L 15,19 L 8,24 L 11,17 L 5,12 L 12,12 Z" />
      </g>
    </svg>
  ),

  // Dots pattern
  dots: (
    <svg viewBox="0 0 50 10" className="ornament-svg">
      <g fill="currentColor">
        <circle cx="10" cy="5" r="2" opacity="0.6" />
        <circle cx="25" cy="5" r="3" />
        <circle cx="40" cy="5" r="2" opacity="0.6" />
      </g>
    </svg>
  ),

  // Celtic knot
  celtic: (
    <svg viewBox="0 0 40 40" className="ornament-svg">
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M 10,20 Q 10,10 20,10 T 30,20 Q 30,30 20,30 T 10,20" />
        <path d="M 20,10 Q 30,10 30,20 T 20,30 Q 10,30 10,20 T 20,10" />
      </g>
    </svg>
  )
};

// ============================================
// COMPLETE FRAME PRESETS
// ============================================

export const FramePresets = {
  // Ornate frame with all elements
  ornate: {
    corners: Corners.ornate,
    edges: Edges.double,
    cornerSize: 50,
    edgeWidth: 10
  },
  
  // Shield-style frame
  shield: {
    corners: Corners.shield,
    edges: Edges.straight,
    cornerSize: 60,
    edgeWidth: 10
  },
  
  // Simple cut corners
  simple: {
    corners: Corners.cut,
    edges: Edges.straight,
    cornerSize: 40,
    edgeWidth: 10
  },
  
  // Rounded frame
  rounded: {
    corners: Corners.rounded,
    edges: Edges.straight,
    cornerSize: 30,
    edgeWidth: 10
  },
  
  // Decorative frame
  decorative: {
    corners: Corners.ornate,
    edges: Edges.decorative,
    cornerSize: 50,
    edgeWidth: 15
  }
};

// ============================================
// SPECIAL SHAPES
// ============================================

export const SpecialShapes = {
  // Shield shape (for AC, etc.)
  shield: (
    <svg viewBox="0 0 100 120" className="shape-svg">
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M 50,10 L 85,25 L 85,70 L 50,110 L 15,70 L 15,25 Z" />
        <path d="M 50,20 L 75,30 L 75,65 L 50,95 L 25,65 L 25,30 Z" strokeWidth="1" opacity="0.5" />
      </g>
    </svg>
  ),

  // Hexagon (for stats)
  hexagon: (
    <svg viewBox="0 0 100 100" className="shape-svg">
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M 30,10 L 70,10 L 90,50 L 70,90 L 30,90 L 10,50 Z" />
      </g>
    </svg>
  ),

  // Banner
  banner: (
    <svg viewBox="0 0 150 50" className="shape-svg">
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M 10,10 L 140,10 L 140,35 L 130,35 L 125,40 L 120,35 L 30,35 L 25,40 L 20,35 L 10,35 Z" />
      </g>
    </svg>
  ),

  // Scroll
  scroll: (
    <svg viewBox="0 0 200 100" className="shape-svg">
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M 20,20 Q 10,20 10,30 L 10,70 Q 10,80 20,80 L 180,80 Q 190,80 190,70 L 190,30 Q 190,20 180,20 L 20,20" />
        {/* Scroll ends */}
        <circle cx="20" cy="50" r="15" strokeWidth="1" opacity="0.3" />
        <circle cx="180" cy="50" r="15" strokeWidth="1" opacity="0.3" />
      </g>
    </svg>
  )
};

// ============================================
// UTILITY TYPES
// ============================================

export interface BorderElementProps {
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export type CornerStyle = keyof typeof Corners;
export type EdgeStyle = keyof typeof Edges;
export type OrnamentStyle = keyof typeof Ornaments;
export type FramePreset = keyof typeof FramePresets;
export type SpecialShape = keyof typeof SpecialShapes;
