import React from 'react';
import { render } from '@testing-library/react';
import { DrawingTools } from '../../../../src/components/Scene/DrawingTools';
import { describe, it, expect } from 'vitest';

describe('DrawingTools', () => {
  it('should render without crashing', () => {
    // A5: DrawingTools self-subscribes to the token/prop arrays via
    // usePlacedTokensSlice/usePlacedPropsSlice(sceneId) instead of
    // receiving them as props.
    const { container } = render(
      <svg>
        <DrawingTools
          activeTool="select"
          drawingStyle={{
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: '#ffffff',
            fillOpacity: 0.5,
            dmNotesOnly: false,
            visibleToPlayers: true,
          }}
          camera={{ x: 0, y: 0, zoom: 1 }}
          _gridSize={50}
          svgRef={{ current: null }}
          snapToGrid={false}
          selectedObjectIds={[]}
          setSelection={() => {}}
          clearSelection={() => {}}
          sceneId="test-scene"
          spellElementType="arcane"
          spellGridSnap={true}
        />
      </svg>,
    );
    expect(container).toBeDefined();
  });
});
