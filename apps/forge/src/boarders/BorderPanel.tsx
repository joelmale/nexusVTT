import React, { CSSProperties } from 'react';
import {
  Corners,
  Edges,
  Ornaments,
  FramePresets,
  SpecialShapes,
  CornerStyle,
  EdgeStyle,
  OrnamentStyle,
  FramePreset
} from './BorderElements';

// ============================================
// MAIN BORDER PANEL COMPONENT
// ============================================

interface BorderPanelProps {
  children: React.ReactNode;
  variant?: FramePreset;
  cornerStyle?: CornerStyle;
  edgeStyle?: EdgeStyle;
  color?: string;
  backgroundColor?: string;
  width?: string | number;
  height?: string | number;
  padding?: string | number;
  className?: string;
  showOrnament?: boolean;
  ornamentPosition?: 'top' | 'bottom' | 'center';
  ornamentStyle?: OrnamentStyle;
  customStyle?: CSSProperties;
}

export const BorderPanel: React.FC<BorderPanelProps> = ({
  children,
  variant = 'ornate',
  cornerStyle,
  edgeStyle,
  color = '#2c2416',
  backgroundColor = 'rgba(245, 245, 220, 0.1)',
  width = 'auto',
  height = 'auto',
  padding = '20px',
  className = '',
  showOrnament = false,
  ornamentPosition = 'top',
  ornamentStyle = 'flourish',
  customStyle = {}
}) => {
  // Use preset or custom configuration
  const preset = variant ? FramePresets[variant] : null;
  const corners = cornerStyle ? Corners[cornerStyle] : preset?.corners || Corners.ornate;
  const edges = edgeStyle ? Edges[edgeStyle] : preset?.edges || Edges.straight;
  const cornerSize = preset?.cornerSize || 50;
  const edgeWidth = preset?.edgeWidth || 10;

  return (
    <div 
      className={`border-panel border-panel--${variant} ${className}`}
      style={{
        position: 'relative',
        width,
        height,
        minHeight: cornerSize * 2,
        minWidth: cornerSize * 2,
        padding: `${cornerSize}px`,
        color,
        ...customStyle
      }}
    >
      {/* Background */}
      <div
        className="border-panel__background"
        style={{
          position: 'absolute',
          top: cornerSize / 2,
          left: cornerSize / 2,
          right: cornerSize / 2,
          bottom: cornerSize / 2,
          backgroundColor,
          pointerEvents: 'none',
        }}
      />

      {/* Corners */}
      <div className="corner corner--top-left" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: cornerSize,
        height: cornerSize,
        color
      }}>
        {corners.topLeft}
      </div>
      <div className="corner corner--top-right" style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: cornerSize,
        height: cornerSize,
        color
      }}>
        {corners.topRight}
      </div>
      <div className="corner corner--bottom-left" style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: cornerSize,
        height: cornerSize,
        color
      }}>
        {corners.bottomLeft}
      </div>
      <div className="corner corner--bottom-right" style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: cornerSize,
        height: cornerSize,
        color
      }}>
        {corners.bottomRight}
      </div>

      {/* Edges */}
      <div className="edge edge--top" style={{
        position: 'absolute',
        top: cornerSize / 2 - edgeWidth / 2,
        left: cornerSize,
        right: cornerSize,
        height: edgeWidth,
        color
      }}>
        {edges.horizontal}
      </div>
      <div className="edge edge--bottom" style={{
        position: 'absolute',
        bottom: cornerSize / 2 - edgeWidth / 2,
        left: cornerSize,
        right: cornerSize,
        height: edgeWidth,
        color
      }}>
        {edges.horizontal}
      </div>
      <div className="edge edge--left" style={{
        position: 'absolute',
        left: cornerSize / 2 - edgeWidth / 2,
        top: cornerSize,
        bottom: cornerSize,
        width: edgeWidth,
        color
      }}>
        {edges.vertical}
      </div>
      <div className="edge edge--right" style={{
        position: 'absolute',
        right: cornerSize / 2 - edgeWidth / 2,
        top: cornerSize,
        bottom: cornerSize,
        width: edgeWidth,
        color
      }}>
        {edges.vertical}
      </div>

      {/* Ornament */}
      {showOrnament && (
        <div 
          className={`ornament ornament--${ornamentPosition}`}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 60,
            height: 20,
            color,
            ...(ornamentPosition === 'top' && { top: cornerSize / 2 - 10 }),
            ...(ornamentPosition === 'bottom' && { bottom: cornerSize / 2 - 10 }),
            ...(ornamentPosition === 'center' && { top: '50%', transform: 'translate(-50%, -50%)' }),
          }}
        >
          {Ornaments[ornamentStyle]}
        </div>
      )}

      {/* Content */}
      <div 
        className="border-panel__content"
        style={{
          position: 'relative',
          zIndex: 1,
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================
// SPECIALIZED PANEL COMPONENTS
// ============================================

interface StatBlockProps {
  label: string;
  value?: string | number;
  modifier?: string | number;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const StatBlock: React.FC<StatBlockProps> = ({
  label,
  value = '',
  modifier = '',
  size = 'medium',
  className = ''
}) => {
  const sizes = {
    small: { width: 80, height: 100, fontSize: '0.875rem' },
    medium: { width: 100, height: 120, fontSize: '1rem' },
    large: { width: 120, height: 140, fontSize: '1.125rem' }
  };

  const { width, height, fontSize } = sizes[size];

  return (
    <BorderPanel
      variant="simple"
      width={width}
      height={height}
      padding="10px"
      className={`stat-block stat-block--${size} ${className}`}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize
      }}>
        <div style={{ 
          fontWeight: 'bold', 
          marginBottom: '8px',
          textTransform: 'uppercase',
          fontSize: `calc(${fontSize} * 0.8)`
        }}>
          {label}
        </div>
        <div style={{ 
          fontSize: `calc(${fontSize} * 1.5)`,
          fontWeight: 'bold'
        }}>
          {value}
        </div>
        {modifier && (
          <div style={{ 
            marginTop: '4px',
            padding: '2px 8px',
            border: '1px solid currentColor',
            borderRadius: '12px',
            fontSize: `calc(${fontSize} * 0.9)`
          }}>
            {modifier}
          </div>
        )}
      </div>
    </BorderPanel>
  );
};

interface ShieldBlockProps {
  value: string | number;
  label?: string;
  size?: number;
  className?: string;
}

export const ShieldBlock: React.FC<ShieldBlockProps> = ({
  value,
  label = 'ARMOR CLASS',
  size = 100,
  className = ''
}) => {
  return (
    <div 
      className={`shield-block ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size * 1.2,
        color: '#2c2416'
      }}
    >
      {SpecialShapes.shield}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        width: '80%'
      }}>
        {label && (
          <div style={{
            fontSize: `${size * 0.1}px`,
            fontWeight: 'bold',
            marginBottom: '4px',
            textTransform: 'uppercase'
          }}>
            {label}
          </div>
        )}
        <div style={{
          fontSize: `${size * 0.3}px`,
          fontWeight: 'bold'
        }}>
          {value}
        </div>
      </div>
    </div>
  );
};

interface TitledPanelProps {
  title: string;
  children: React.ReactNode;
  variant?: FramePreset;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const TitledPanel: React.FC<TitledPanelProps> = ({
  title,
  children,
  variant = 'ornate',
  width = 'auto',
  height = 'auto',
  className = ''
}) => {
  return (
    <BorderPanel
      variant={variant}
      width={width}
      height={height}
      className={`titled-panel ${className}`}
    >
      <div style={{
        position: 'absolute',
        top: -12,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#f5f5dc',
        padding: '4px 20px',
        border: '2px solid #2c2416',
        borderRadius: '4px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {title}
        </h3>
      </div>
      <div style={{ marginTop: '20px' }}>
        {children}
      </div>
    </BorderPanel>
  );
};

interface ScrollPanelProps {
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const ScrollPanel: React.FC<ScrollPanelProps> = ({
  children,
  width = 300,
  height = 200,
  className = ''
}) => {
  return (
    <div 
      className={`scroll-panel ${className}`}
      style={{
        position: 'relative',
        width,
        height,
        padding: '30px 40px',
        color: '#2c2416'
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
        {SpecialShapes.scroll}
      </div>
      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        overflowY: 'auto'
      }}>
        {children}
      </div>
    </div>
  );
};
