import React, { useMemo } from 'react';
import { buildQrPath } from './qrPath';
import styles from './QrCode.module.css';

export interface QrCodeProps {
  value: string;
  /** Rendered size in CSS pixels. */
  size?: number;
  label: string;
}

/**
 * A scannable QR code. Always dark-on-light regardless of theme, because
 * phone cameras read inverted codes poorly.
 */
export const QrCode: React.FC<QrCodeProps> = ({ value, size = 160, label }) => {
  const { path, modules } = useMemo(() => buildQrPath(value), [value]);
  return (
    <svg
      className={styles.qr}
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
    >
      <rect className={styles.background} width={modules} height={modules} />
      <path className={styles.modules} d={path} />
    </svg>
  );
};
