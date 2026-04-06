/**
 * Performance API sanitization — removes or normalizes timing entries
 * that can reveal automation frameworks or headless execution.
 * Detection scripts analyze performance.getEntries() for unusual patterns.
 */
export function buildPerformanceScript(): string {
  return `
(function() {
  'use strict';

  // ── PerformanceObserver hardening ──────────────────────────────────
  // Automation frameworks leave traces in resource timing entries
  // (e.g., DevTools resources, puppeteer evaluation scripts)

  const origGetEntries = Performance.prototype.getEntries;
  const origGetEntriesByType = Performance.prototype.getEntriesByType;
  const origGetEntriesByName = Performance.prototype.getEntriesByName;

  const BLOCKED_PATTERNS = [
    '__puppeteer',
    '__playwright',
    'pptr:',
    'devtools://',
    'chrome-extension://',
    '__selenium',
    'webdriver'
  ];

  function isClean(entry) {
    const name = entry.name || '';
    return !BLOCKED_PATTERNS.some(p => name.includes(p));
  }

  Performance.prototype.getEntries = function() {
    return origGetEntries.call(this).filter(isClean);
  };

  Performance.prototype.getEntriesByType = function(type) {
    return origGetEntriesByType.call(this, type).filter(isClean);
  };

  Performance.prototype.getEntriesByName = function(name, type) {
    return origGetEntriesByName.call(this, name, type).filter(isClean);
  };

  // ── Performance.now() precision reduction ─────────────────────────
  // Reduce timer precision to match Chrome's default (100μs)
  // This prevents high-resolution timing attacks and looks more natural
  const origNow = Performance.prototype.now;
  Performance.prototype.now = function() {
    const t = origNow.call(this);
    // Round to 100μs precision (Chrome default with Site Isolation)
    return Math.round(t * 10) / 10;
  };

  // ── Clean up PerformanceObserver ──────────────────────────────────
  const OrigObserver = window.PerformanceObserver;
  if (OrigObserver) {
    window.PerformanceObserver = function(callback) {
      const wrappedCallback = function(list, observer) {
        const entries = list.getEntries().filter(isClean);
        if (entries.length > 0) {
          const wrappedList = {
            getEntries: () => entries,
            getEntriesByType: (type) => entries.filter(e => e.entryType === type),
            getEntriesByName: (name, type) => entries.filter(e =>
              e.name === name && (!type || e.entryType === type)
            )
          };
          callback(wrappedList, observer);
        }
      };
      return new OrigObserver(wrappedCallback);
    };
    window.PerformanceObserver.supportedEntryTypes = OrigObserver.supportedEntryTypes;
    window.PerformanceObserver.prototype = OrigObserver.prototype;
  }

  if (window.__ghostRegisterNative) {
    window.__ghostRegisterNative(Performance.prototype.getEntries);
    window.__ghostRegisterNative(Performance.prototype.now);
  }
})();
`
}
