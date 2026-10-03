import React, { useState } from 'react';
import { useIcon } from '@/stores/iconStore';
import styles from './Icon.module.css';

export interface IconProps {
  /**
   * The registered icon identifier (e.g. 'panel:atlas', 'condition:poisoned').
   */
  id: string;

  /**
   * Icon size in pixels (number) or CSS length string (e.g. '1.5rem').
   * @default 20
   */
  size?: number | string;

  /**
   * Optional custom fallback element or string when no image asset is available.
   */
  fallback?: React.ReactNode;

  /**
   * Optional CSS class name for custom styling.
   */
  className?: string;

  /**
   * Tooltip / accessible title for the icon. Defaults to the catalog name.
   */
  title?: string;

  /**
   * Whether to display a tiny indicator dot when a local user override is active.
   * @default false
   */
  showIndicator?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  id,
  size = 20,
  fallback,
  className = '',
  title,
  showIndicator = false,
}) => {
  const icon = useIcon(id);
  const [imageError, setImageError] = useState(false);

  const dimensionStyle =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: size };

  const fontSizeStyle =
    typeof size === 'number'
      ? { fontSize: `${Math.round(size * 0.85)}px` }
      : { fontSize: size };

  const effectiveTitle = title || icon.name;
  const isImageAvailable = !!icon.url && !imageError;

  return (
    <span
      className={`${styles.vttIconWrapper} ${
        showIndicator && icon.isCustomOverride ? styles.hasCustomOverride : ''
      } ${className}`}
      style={dimensionStyle}
      title={effectiveTitle}
      aria-label={!isImageAvailable ? effectiveTitle : undefined}
      role={!isImageAvailable ? 'img' : undefined}
      data-testid="vtt-icon"
    >
      {isImageAvailable ? (
        <img
          src={icon.url}
          alt={icon.name}
          className={styles.vttIconImage}
          style={dimensionStyle}
          onError={() => setImageError(true)}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span className={styles.vttIconFallback} style={fontSizeStyle}>
          {fallback || icon.fallback}
        </span>
      )}
    </span>
  );
};
