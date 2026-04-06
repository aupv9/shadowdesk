/**
 * Network Information API spoofing — overrides navigator.connection
 * to return realistic values. Detection scripts use connection type
 * and downlink to identify headless/automated environments.
 */
export function buildNetworkScript(connectionType: string = '4g'): string {
  const profiles: Record<string, { downlink: number; rtt: number; effectiveType: string; type: string }> = {
    '4g':   { downlink: 10,    rtt: 50,  effectiveType: '4g',  type: 'wifi' },
    '3g':   { downlink: 1.5,   rtt: 300, effectiveType: '3g',  type: 'cellular' },
    'wifi': { downlink: 30,    rtt: 25,  effectiveType: '4g',  type: 'wifi' },
    'slow': { downlink: 0.4,   rtt: 800, effectiveType: '2g',  type: 'cellular' }
  }

  const conn = profiles[connectionType] || profiles['4g']

  return `
(function() {
  'use strict';

  // navigator.connection (Network Information API)
  const connectionData = {
    downlink: ${conn.downlink},
    effectiveType: ${JSON.stringify(conn.effectiveType)},
    rtt: ${conn.rtt},
    saveData: false,
    type: ${JSON.stringify(conn.type)},
    onchange: null,
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; }
  };

  if ('connection' in navigator) {
    Object.defineProperty(navigator, 'connection', {
      get: () => connectionData,
      configurable: true,
      enumerable: true
    });
  }

  // Also handle mozConnection and webkitConnection
  Object.defineProperty(navigator, 'mozConnection', {
    get: () => undefined,
    configurable: true
  });
  Object.defineProperty(navigator, 'webkitConnection', {
    get: () => undefined,
    configurable: true
  });

  if (window.__ghostRegisterNative) {
    window.__ghostRegisterNative(connectionData.addEventListener);
  }
})();
`
}
