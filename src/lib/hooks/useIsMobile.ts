'use client';

import { useEffect, useState } from 'react';

const MD_BREAKPOINT = 768;
const SM_BREAKPOINT = 480;

export type DeviceType = 'phone' | 'tablet' | 'desktop';

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
    navigator.msMaxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

function getDeviceType(width: number): DeviceType {
  // Use screen width as primary indicator - touch capability doesn't determine device type
  // Many desktops have touchscreens, many tablets have keyboards
  if (width < SM_BREAKPOINT) return 'phone';
  if (width < MD_BREAKPOINT) return 'tablet';
  return 'desktop';
}

function detectPerformanceTier(deviceType: DeviceType): 'high' | 'medium' | 'low' {
  if (typeof window === 'undefined') return 'medium';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'low';
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  const isTouch = isTouchDevice();

  // Phones always use low/medium tier for battery and performance
  if (deviceType === 'phone') {
    return cores >= 6 && memory >= 4 ? 'medium' : 'low';
  }

  // Tablets use medium tier by default
  if (deviceType === 'tablet') {
    if (cores >= 6 && memory >= 4) return 'high';
    if (cores <= 2 || memory <= 2) return 'low';
    return 'medium';
  }

  // Desktop
  if (!isTouch && cores >= 4) {
    return 'high';
  }

  if (cores <= 2 || memory <= 2) {
    return 'low';
  }

  return 'medium';
}

export function useIsMobile() {
  const [state, setState] = useState({
    isMobile: false,
    isCompact: false,
    deviceType: 'desktop' as DeviceType,
    screenWidth: 1024,
    screenHeight: 768,
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const device = getDeviceType(width);

      setState({
        isMobile: isTouchDevice(),
        isCompact: width < MD_BREAKPOINT,
        deviceType: device,
        screenWidth: width,
        screenHeight: height,
      });
    };

    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return {
    ...state,
    isDesktop: !state.isMobile,
  };
}

export function usePerformanceTier(): 'high' | 'medium' | 'low' {
  const [tier, setTier] = useState<'high' | 'medium' | 'low'>('medium');
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const device = getDeviceType(width);
      setDeviceType(device);
      setTier(detectPerformanceTier(device));
    };

    update();

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => setTier(detectPerformanceTier(deviceType));

    window.addEventListener('resize', update);
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.removeEventListener('resize', update);
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, [deviceType]);

  return tier;
}
