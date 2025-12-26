import { useMemo } from 'react';

interface BrowserSupportResult {
  isSupported: boolean;
  message: string;
}

function detectBrowser(): {
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isMobile: boolean;
} {
  const ua = navigator.userAgent.toLowerCase();

  const isSafari =
    ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
  const isChrome = ua.includes('chrome') || ua.includes('chromium');
  const isFirefox = ua.includes('firefox');
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);

  return { isSafari, isChrome, isFirefox, isMobile };
}

export function useBrowserSupport(): BrowserSupportResult {
  return useMemo(() => {
    const { isSafari, isChrome, isFirefox, isMobile } = detectBrowser();

    // Check for SharedArrayBuffer support (required for WebContainers)
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';

    if (isMobile) {
      return {
        isSupported: false,
        message:
          'pok interactive requires a desktop browser. Please visit on a desktop computer for the full experience.',
      };
    }

    if (isSafari) {
      return {
        isSupported: false,
        message:
          'Safari is not currently supported due to WebContainer limitations. Please use Chrome or Firefox for the best experience.',
      };
    }

    if (!hasSharedArrayBuffer) {
      return {
        isSupported: false,
        message:
          'Your browser does not support SharedArrayBuffer, which is required for running Node.js in the browser. Please use the latest version of Chrome or Firefox.',
      };
    }

    if (!isChrome && !isFirefox) {
      // Allow other Chromium-based browsers
      return {
        isSupported: true,
        message: '',
      };
    }

    return {
      isSupported: true,
      message: '',
    };
  }, []);
}
