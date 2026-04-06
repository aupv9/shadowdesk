/**
 * Permissions API spoofing — ensures navigator.permissions.query()
 * returns consistent results that match a real user's browser.
 * Detection scripts use permission inconsistencies to flag automation.
 */
export function buildPermissionsScript(os: string): string {
  // macOS Safari doesn't support all permission types that Chrome does
  const isMac = os === 'MacIntel'

  return `
(function() {
  'use strict';

  if (!navigator.permissions || !navigator.permissions.query) return;

  const origQuery = navigator.permissions.query.bind(navigator.permissions);

  navigator.permissions.query = function(descriptor) {
    const name = descriptor && descriptor.name;

    // Return realistic permission states based on OS
    const permMap = {
      'geolocation': 'prompt',
      'notifications': ${isMac ? "'denied'" : "'prompt'"},
      'push': 'prompt',
      'midi': 'granted',
      'camera': 'prompt',
      'microphone': 'prompt',
      'background-fetch': 'granted',
      'background-sync': 'granted',
      'persistent-storage': 'prompt',
      'accelerometer': 'granted',
      'gyroscope': 'granted',
      'magnetometer': 'granted',
      'screen-wake-lock': 'granted',
      'clipboard-read': 'prompt',
      'clipboard-write': 'granted'
    };

    if (name && permMap[name] !== undefined) {
      return Promise.resolve(Object.create(PermissionStatus.prototype, {
        state:    { value: permMap[name], writable: false, enumerable: true },
        onchange: { value: null, writable: true, enumerable: true }
      }));
    }

    return origQuery(descriptor).catch(() => {
      // Unknown permission — return prompt rather than throwing
      return Object.create(PermissionStatus.prototype, {
        state:    { value: 'prompt', writable: false, enumerable: true },
        onchange: { value: null, writable: true, enumerable: true }
      });
    });
  };

  // Ensure toString looks native
  if (window.__ghostRegisterNative) {
    window.__ghostRegisterNative(navigator.permissions.query);
  }
})();
`
}
