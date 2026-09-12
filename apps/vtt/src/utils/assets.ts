import React from 'react';

// Asset paths helper for direct access
export const AssetPaths = {
  logos: {
    default: '/assets/logos/nexus-logo.svg',
    light: '/assets/logos/nexus-logo-light.svg',
    dark: '/assets/logos/nexus-logo-dark.svg',
    wordmark: '/assets/logos/nexus-wordmark.svg',
    symbol: '/assets/logos/nexus-symbol.svg',
  },
  icons: {
    svg: '/assets/icons/nexus-icon.svg',
    png192: '/assets/icons/nexus-icon-192.png',
    png512: '/assets/icons/nexus-icon-512.png',
    favicon: '/assets/icons/nexus-favicon.ico',
  },
  images: {
    ogImage: '/assets/images/og-image.png',
    hero: '/assets/images/hero-background.jpg',
  },
} as const;

// Hook for checking if assets exist
export const useAssetExists = (assetPath: string) => {
  const [exists, setExists] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setExists(true);
    img.onerror = () => setExists(false);
    img.src = assetPath;
  }, [assetPath]);

  return exists;
};
