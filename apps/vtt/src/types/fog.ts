// Paintable fog of war types (A9). Net-new model per ADR-0009 — NOT a
// drawing subtype. The older `fog-of-war` drawing type is legacy mask UI
// state and is separate from this reveal-shape model.
//
// Model: conceal-all + reveal shapes (Owlbear's model), not freeform paint.
// A scene's fog is either off, or on with the whole scene concealed except
// for the union of `shapes`. This keeps sync deterministic and small: every
// mutation ships the complete `SceneFog` object (small arrays), so a late
// joiner or reconnecting client can just overwrite local state with the
// latest broadcast — no incremental replay required.

export interface FogShape {
  id: string;
  kind: 'reveal';
  shape: 'rect' | 'brush';
  /** rect: exactly 2 corner points; brush: polyline of stroke points. */
  points: Array<{ x: number; y: number }>;
  /** Brush stroke width (world units); only meaningful when shape === 'brush'. */
  brushSize?: number;
  createdAt: number;
}

export interface SceneFog {
  enabled: boolean;
  shapes: FogShape[];
}
