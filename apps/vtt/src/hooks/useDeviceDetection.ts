import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  screenSize: ScreenSize;
  viewport: {
    width: number;
    height: number;
  };
}

const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const;

const detectDevice = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const width = window.innerWidth;
  const height = window.innerHeight;

  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  let screenSize: ScreenSize = 'xs';
  if (width >= BREAKPOINTS.xl) screenSize = 'xl';
  else if (width >= BREAKPOINTS.lg) screenSize = 'lg';
  else if (width >= BREAKPOINTS.md) screenSize = 'md';
  else if (width >= BREAKPOINTS.sm) screenSize = 'sm';

  const type: DeviceType =
    isIOS || isAndroid || (hasTouch && width < BREAKPOINTS.lg)
      ? width < BREAKPOINTS.md
        ? 'mobile'
        : 'tablet'
      : width < BREAKPOINTS.sm
        ? 'mobile'
        : 'desktop';

  return {
    type,
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    hasTouch,
    screenSize,
    viewport: { width, height },
  };
};

export const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        type: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        hasTouch: false,
        screenSize: 'lg',
        viewport: { width: 1024, height: 768 },
      };
    }
    return detectDevice();
  });

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(detectDevice());
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        setDeviceInfo(detectDevice());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
};

export const useTokenInterfaceStrategy = () => {
  const deviceInfo = useDeviceDetection();

  const shouldUseModal = deviceInfo.isMobile || deviceInfo.isTablet;
  const shouldUseFloatingWindow = deviceInfo.isDesktop && !deviceInfo.hasTouch;
  const shouldUseSidebar = deviceInfo.isDesktop && deviceInfo.hasTouch;

  return {
    deviceInfo,
    strategy: shouldUseModal
      ? 'modal'
      : shouldUseFloatingWindow
        ? 'floating'
        : 'sidebar',
    shouldUseModal,
    shouldUseFloatingWindow,
    shouldUseSidebar,

    interfaceConfig: {
      tokenGridColumns: deviceInfo.isMobile ? 3 : deviceInfo.isTablet ? 4 : 6,
      tokenSize: (deviceInfo.isMobile ? 'small' : 'medium') as
        'small' | 'medium',
      showThumbnails: !deviceInfo.isMobile,
      enableSearch: true,
      enableFilters: !deviceInfo.isMobile,
      maxVisibleCategories: deviceInfo.isMobile ? 3 : 6,
    },
  };
};

export const canUseFloatingWindows = (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const testWindow = window.open(
        '',
        '_blank',
        'width=1,height=1,left=-1000,top=-1000',
      );

      if (testWindow) {
        testWindow.close();
        resolve(true);
      } else {
        resolve(false);
      }
    } catch {
      resolve(false);
    }
  });
};
