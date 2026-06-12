import React, { useMemo, useState, useEffect } from 'react';
import { useActiveScene } from '@/stores/gameStore';
import type { Drawing, BaseDrawing } from '@/types/drawing';
import { ELEMENT_THEMES } from '@/types/drawing';
import type { Camera } from '@/types/game';

interface DrawingRendererProps {
  sceneId: string;
  camera: Camera;
  isHost: boolean;
  activeTool?: string;
  selectedObjectIds?: string[];
  onDrawingClick?: (drawingId: string, event: React.MouseEvent) => void;
}

const PingDrawing: React.FC<{
  drawing: Drawing & { type: 'ping' };
  camera: Camera;
  commonProps: React.SVGAttributes<SVGElement>;
}> = ({ drawing, camera, commonProps }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const updateFrame = () => {
      setElapsed(Date.now() - drawing.timestamp);
      requestAnimationFrame(updateFrame);
    };

    const frameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(frameId);
  }, [drawing.timestamp]);

  const progress = Math.min(elapsed / drawing.duration, 1);

  if (progress >= 1) {
    return null;
  }

  const opacity = 1 - progress;
  const scale = 1 + progress * 0.5;

  return (
    <g key={drawing.id} opacity={opacity}>
      <circle
        cx={drawing.position.x}
        cy={drawing.position.y}
        r={(20 / camera.zoom) * scale}
        fill="none"
        stroke="#00bcd4"
        strokeWidth={3 / camera.zoom}
        className={commonProps.className}
      />
      <circle
        cx={drawing.position.x}
        cy={drawing.position.y}
        r={10 / camera.zoom}
        fill="#00bcd4"
        opacity={0.6}
        className={commonProps.className}
      />
      <text
        x={drawing.position.x}
        y={drawing.position.y - 30 / camera.zoom}
        fontSize={14 / camera.zoom}
        fontWeight="bold"
        fill="#00bcd4"
        textAnchor="middle"
        className={commonProps.className}
        style={{
          textShadow: '0 0 4px rgba(0,0,0,0.8)',
        }}
      >
        {drawing.playerName}
      </text>
    </g>
  );
};

export const DrawingRenderer: React.FC<DrawingRendererProps> = ({
  sceneId,
  camera,
  isHost,
  activeTool = '',
  selectedObjectIds = [],
  onDrawingClick,
}) => {
  const activeScene = useActiveScene();
  const drawings = useMemo(() => {
    if (!activeScene || activeScene.id !== sceneId) return [];
    return activeScene.drawings || [];
  }, [activeScene, sceneId]);

  const visibleDrawings = useMemo(() => {
    return drawings.filter((drawing) => {
      if (isHost) return true;
      if (drawing.layer === 'dm-only') return false;
      if (drawing.style.dmNotesOnly) return false;
      if (drawing.style.visibleToPlayers === false) return false;
      return true;
    });
  }, [drawings, isHost]);

  const renderDrawing = (drawing: Drawing) => {
    const { style } = drawing;
    const strokeWidth = style.strokeWidth / camera.zoom;
    const isSelected = selectedObjectIds.includes(drawing.id);

    // Make drawings interactive only during select tool
    const isInteractive = activeTool === 'select' && !!onDrawingClick;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDrawingClick) {
        onDrawingClick(drawing.id, e);
      }
    };

    const commonProps = {
      fill: style.fillColor,
      fillOpacity: style.fillOpacity,
      stroke: style.strokeColor,
      strokeWidth: strokeWidth,
      strokeDasharray: style.strokeDashArray,
      className: `drawing drawing-${drawing.type} ${drawing.layer}${isSelected ? ' selected' : ''}`,
      'data-drawing-id': drawing.id,
      'data-created-by': drawing.createdBy,
      onClick: isInteractive ? handleClick : undefined,
      style: {
        pointerEvents: isInteractive ? ('auto' as const) : ('none' as const),
        cursor: isInteractive ? 'pointer' : 'default',
      },
    };

    switch (drawing.type) {
      case 'line':
        return (
          <line
            key={drawing.id}
            x1={drawing.start.x}
            y1={drawing.start.y}
            x2={drawing.end.x}
            y2={drawing.end.y}
            {...commonProps}
            fill="none"
          />
        );

      case 'rectangle':
        return (
          <rect
            key={drawing.id}
            x={drawing.x}
            y={drawing.y}
            width={drawing.width}
            height={drawing.height}
            {...commonProps}
          />
        );

      case 'circle':
        return (
          <circle
            key={drawing.id}
            cx={drawing.center.x}
            cy={drawing.center.y}
            r={drawing.radius}
            {...commonProps}
          />
        );

      case 'polygon': {
        if (drawing.points.length < 3) return null;
        const pathData = `M ${drawing.points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;
        return <path key={drawing.id} d={pathData} {...commonProps} />;
      }

      case 'pencil': {
        if (drawing.points.length < 2) return null;
        const pencilPath = `M ${drawing.points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
        return (
          <path
            key={drawing.id}
            d={pencilPath}
            {...commonProps}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }

      case 'cone':
        return renderCone(drawing, commonProps);

      case 'aoe-sphere':
        return (
          <circle
            key={drawing.id}
            cx={drawing.center.x}
            cy={drawing.center.y}
            r={drawing.radius}
            {...commonProps}
            className={`${commonProps.className} aoe-effect`}
          />
        );

      case 'aoe-cube':
        return (
          <rect
            key={drawing.id}
            x={drawing.origin.x - drawing.size / 2}
            y={drawing.origin.y - drawing.size / 2}
            width={drawing.size}
            height={drawing.size}
            {...commonProps}
            className={`${commonProps.className} aoe-effect`}
          />
        );

      case 'aoe-cylinder':
        return (
          <g key={drawing.id} className={`${commonProps.className} aoe-effect`}>
            <circle
              cx={drawing.center.x}
              cy={drawing.center.y}
              r={drawing.radius}
              {...commonProps}
            />
            <text
              x={drawing.center.x}
              y={drawing.center.y}
              fill={style.strokeColor}
              fontSize={12 / camera.zoom}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {drawing.height}ft
            </text>
          </g>
        );

      case 'aoe-line':
        return renderLineAoE(drawing, commonProps);

      case 'text':
        return (
          <text
            key={drawing.id}
            x={drawing.position.x}
            y={drawing.position.y}
            fontSize={drawing.fontSize / camera.zoom}
            fontFamily={drawing.fontFamily}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={0.5 / camera.zoom}
            textAnchor="middle"
            dominantBaseline="middle"
            pointerEvents="all"
            className={commonProps.className}
            style={{
              paintOrder: 'stroke fill',
            }}
          >
            {drawing.text}
          </text>
        );

      case 'ping':
        return (
          <PingDrawing
            key={drawing.id}
            drawing={drawing}
            camera={camera}
            commonProps={commonProps}
          />
        );

      // Spell overlay effects
      case 'spell-circle': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            {/* Feathered edge gradient */}
            <circle
              cx={drawing.center.x}
              cy={drawing.center.y}
              r={drawing.radius}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            {/* Texture overlay */}
            <circle
              cx={drawing.center.x}
              cy={drawing.center.y}
              r={drawing.radius}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {/* Round counter badge */}
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={drawing.center.x}
                  cy={drawing.center.y}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={drawing.center.x}
                  y={drawing.center.y}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {/* Spell name label */}
            {spellName && (
              <text
                x={drawing.center.x}
                y={drawing.center.y - drawing.radius - 10}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'spell-ring': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;
        const pathData = createRingPath(
          drawing.center,
          drawing.outerRadius,
          drawing.innerRadius,
        );

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            <path
              d={pathData}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            <path
              d={pathData}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={drawing.center.x}
                  cy={drawing.center.y}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={drawing.center.x}
                  y={drawing.center.y}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {spellName && (
              <text
                x={drawing.center.x}
                y={drawing.center.y - drawing.outerRadius - 10}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'spell-cone': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;
        const conePath = calculateConePath(
          drawing.origin,
          drawing.direction,
          drawing.length,
          drawing.angle,
        );

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            <path
              d={conePath}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            <path
              d={conePath}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={drawing.origin.x}
                  cy={drawing.origin.y}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={drawing.origin.x}
                  y={drawing.origin.y}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {spellName && (
              <text
                x={drawing.origin.x}
                y={drawing.origin.y - 35}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'spell-line': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;
        const rectPath = createLineRectangle(drawing.start, drawing.end, drawing.width);
        const midX = (drawing.start.x + drawing.end.x) / 2;
        const midY = (drawing.start.y + drawing.end.y) / 2;

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            <path
              d={rectPath}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            <path
              d={rectPath}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={midX}
                  cy={midY}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={midX}
                  y={midY}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {spellName && (
              <text
                x={midX}
                y={midY - 35}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'spell-square': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;
        const halfSize = drawing.size / 2;
        const rotation = drawing.rotation || 0;

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            <rect
              x={drawing.origin.x - halfSize}
              y={drawing.origin.y - halfSize}
              width={drawing.size}
              height={drawing.size}
              transform={`rotate(${rotation} ${drawing.origin.x} ${drawing.origin.y})`}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            <rect
              x={drawing.origin.x - halfSize}
              y={drawing.origin.y - halfSize}
              width={drawing.size}
              height={drawing.size}
              transform={`rotate(${rotation} ${drawing.origin.x} ${drawing.origin.y})`}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={drawing.origin.x}
                  cy={drawing.origin.y}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={drawing.origin.x}
                  y={drawing.origin.y}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {spellName && (
              <text
                x={drawing.origin.x}
                y={drawing.origin.y - halfSize - 10}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'spell-triangle': {
        const elementType = drawing.style.elementType;
        const theme = ELEMENT_THEMES[elementType];
        const animationsEnabled = drawing.style.animationsEnabled !== false;
        const animationClass = animationsEnabled
          ? `spell-overlay element-${elementType} pulse-${theme.animationSpeed}`
          : `spell-overlay element-${elementType}`;
        const roundCounter = drawing.style.roundCounter ?? 0;
        const spellName = drawing.style.spellName ?? '';
        const blendStyle = theme.blendMode === 'additive' ? 'screen' : theme.blendMode;
        const trianglePath = calculateTrianglePath(
          drawing.origin,
          drawing.direction,
          drawing.length,
          drawing.width,
        );

        return (
          <g key={drawing.id} className={animationClass} style={{ mixBlendMode: blendStyle as React.CSSProperties['mixBlendMode'] }}>
            <path
              d={trianglePath}
              fill={`url(#spell-edge-${elementType})`}
              filter={`url(#spell-filter-${elementType})`}
              stroke={style.strokeColor}
              strokeWidth={strokeWidth}
              className={commonProps.className}
              onClick={commonProps.onClick}
              style={commonProps.style}
            />
            <path
              d={trianglePath}
              fill={`url(#spell-${elementType}-texture)`}
              opacity={theme.opacity}
              pointerEvents="none"
            />
            {roundCounter > 0 && (
              <g className="spell-round-counter">
                <circle
                  cx={drawing.origin.x}
                  cy={drawing.origin.y}
                  r={20}
                  fill="rgba(0, 0, 0, 0.8)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={drawing.origin.x}
                  y={drawing.origin.y}
                  fill="white"
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                >
                  {roundCounter}
                </text>
              </g>
            )}
            {spellName && (
              <text
                x={drawing.origin.x}
                y={drawing.origin.y - 35}
                fill="white"
                fontSize={14}
                fontWeight="600"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                {spellName}
              </text>
            )}
          </g>
        );
      }

      case 'fog-of-war': {
        if (drawing.area.length < 3) return null;
        const pathData = `M ${drawing.area.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;

        const fogOpacity = drawing.revealed ? 0 : drawing.density;

        return (
          <g key={drawing.id} className="fog-of-war-layer">
            <path
              d={pathData}
              fill="#000000"
              fillOpacity={fogOpacity}
              stroke="#666666"
              strokeWidth={strokeWidth}
              strokeDasharray={isHost && !drawing.revealed ? '5,5' : undefined}
              className={commonProps.className}
            />
            {isHost && drawing.revealed && (
              <text
                x={drawing.area[0].x}
                y={drawing.area[0].y - 10 / camera.zoom}
                fill="#00ff00"
                fontSize={12 / camera.zoom}
                opacity={0.6}
              >
                ✓ Revealed
              </text>
            )}
          </g>
        );
      }

      default:
        console.warn(`Unknown drawing type: ${(drawing as BaseDrawing).type}`);
        return null;
    }
  };

  const renderCone = (
    drawing: Drawing & { type: 'cone' },
    props: React.SVGAttributes<SVGPathElement>,
  ) => {
    const { origin, direction, length, angle } = drawing;
    const angleRad = (direction * Math.PI) / 180;
    const coneAngleRad = (angle * Math.PI) / 180;

    const leftX = origin.x + Math.cos(angleRad - coneAngleRad / 2) * length;
    const leftY = origin.y + Math.sin(angleRad - coneAngleRad / 2) * length;

    const rightX = origin.x + Math.cos(angleRad + coneAngleRad / 2) * length;
    const rightY = origin.y + Math.sin(angleRad + coneAngleRad / 2) * length;

    const pathData = `M ${origin.x} ${origin.y} L ${leftX} ${leftY} A ${length} ${length} 0 0 1 ${rightX} ${rightY} Z`;

    return (
      <path
        key={drawing.id}
        d={pathData}
        {...props}
        className={`${props.className} aoe-effect`}
      />
    );
  };

  const renderLineAoE = (
    drawing: Drawing & { type: 'aoe-line' },
    props: React.SVGAttributes<SVGPathElement>,
  ) => {
    const { start, end, width } = drawing;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    const halfWidth = width / 2;
    const cos = Math.cos(angle + Math.PI / 2);
    const sin = Math.sin(angle + Math.PI / 2);

    const p1 = { x: start.x + cos * halfWidth, y: start.y + sin * halfWidth };
    const p2 = { x: start.x - cos * halfWidth, y: start.y - sin * halfWidth };
    const p3 = { x: end.x - cos * halfWidth, y: end.y - sin * halfWidth };
    const p4 = { x: end.x + cos * halfWidth, y: end.y + sin * halfWidth };

    const pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;

    return (
      <path
        key={drawing.id}
        d={pathData}
        {...props}
        className={`${props.className} aoe-effect`}
      />
    );
  };

  // Helper functions for spell overlay path calculations

  const createRingPath = (
    center: { x: number; y: number },
    outerRadius: number,
    innerRadius: number,
  ): string => {
    // Create a donut shape using SVG path with arc commands
    // Outer circle (clockwise) then inner circle (counter-clockwise) for hole
    return `
      M ${center.x - outerRadius} ${center.y}
      A ${outerRadius} ${outerRadius} 0 1 1 ${center.x + outerRadius} ${center.y}
      A ${outerRadius} ${outerRadius} 0 1 1 ${center.x - outerRadius} ${center.y}
      M ${center.x - innerRadius} ${center.y}
      A ${innerRadius} ${innerRadius} 0 1 0 ${center.x + innerRadius} ${center.y}
      A ${innerRadius} ${innerRadius} 0 1 0 ${center.x - innerRadius} ${center.y}
      Z
    `;
  };

  const calculateConePath = (
    origin: { x: number; y: number },
    direction: number,
    length: number,
    angle: number,
  ): string => {
    // Calculate cone path similar to existing cone rendering
    const angleRad = (direction * Math.PI) / 180;
    const coneAngleRad = (angle * Math.PI) / 180;

    const leftX = origin.x + Math.cos(angleRad - coneAngleRad / 2) * length;
    const leftY = origin.y + Math.sin(angleRad - coneAngleRad / 2) * length;

    const rightX = origin.x + Math.cos(angleRad + coneAngleRad / 2) * length;
    const rightY = origin.y + Math.sin(angleRad + coneAngleRad / 2) * length;

    // Create arc at the end of the cone for smooth edge
    return `M ${origin.x} ${origin.y} L ${leftX} ${leftY} A ${length} ${length} 0 0 1 ${rightX} ${rightY} Z`;
  };

  const createLineRectangle = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    width: number,
  ): string => {
    // Calculate angle and perpendicular offset for width
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const halfWidth = width / 2;
    const cos = Math.cos(angle + Math.PI / 2);
    const sin = Math.sin(angle + Math.PI / 2);

    // Calculate four corners of the rectangle
    const p1 = { x: start.x + cos * halfWidth, y: start.y + sin * halfWidth };
    const p2 = { x: start.x - cos * halfWidth, y: start.y - sin * halfWidth };
    const p3 = { x: end.x - cos * halfWidth, y: end.y - sin * halfWidth };
    const p4 = { x: end.x + cos * halfWidth, y: end.y + sin * halfWidth };

    // Create rectangle path
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
  };

  const calculateTrianglePath = (
    origin: { x: number; y: number },
    direction: number,
    length: number,
    width: number,
  ): string => {
    // Convert direction to radians
    const angleRad = (direction * Math.PI) / 180;

    // Calculate apex (origin is the apex)
    const apex = origin;

    // Calculate base center point
    const baseCenterX = origin.x + Math.cos(angleRad) * length;
    const baseCenterY = origin.y + Math.sin(angleRad) * length;

    // Calculate base left and right points (perpendicular to direction)
    const halfWidth = width / 2;
    const perpAngle = angleRad + Math.PI / 2;
    const cos = Math.cos(perpAngle);
    const sin = Math.sin(perpAngle);

    const baseLeft = {
      x: baseCenterX + cos * halfWidth,
      y: baseCenterY + sin * halfWidth,
    };

    const baseRight = {
      x: baseCenterX - cos * halfWidth,
      y: baseCenterY - sin * halfWidth,
    };

    // Create triangle path
    return `M ${apex.x} ${apex.y} L ${baseLeft.x} ${baseLeft.y} L ${baseRight.x} ${baseRight.y} Z`;
  };

  if (visibleDrawings.length === 0) {
    return null;
  }

  return (
    <g className="drawings-layer">
      <g className="background-drawings">
        {visibleDrawings
          .filter((d) => d.layer === 'background')
          .map(renderDrawing)}
      </g>

      <g className="effects-drawings">
        {visibleDrawings
          .filter((d) => d.layer === 'effects')
          .map(renderDrawing)}
      </g>

      {isHost && (
        <g className="dm-only-drawings" opacity="0.7">
          {visibleDrawings
            .filter((d) => d.layer === 'dm-only')
            .map(renderDrawing)}
        </g>
      )}

      <g className="overlay-drawings">
        {visibleDrawings
          .filter((d) => d.layer === 'overlay')
          .map(renderDrawing)}
      </g>
    </g>
  );
};
