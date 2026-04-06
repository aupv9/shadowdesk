import type { PluginConfig, OsConfig } from '../../../shared/types'

export function buildPluginScript(config: PluginConfig, os: OsConfig): string {
  if (config.mode === 'real') return ''

  // Linux Chrome has no plugins by default — empty is realistic
  if (config.mode === 'realistic' && os.platform === 'Linux x86_64') {
    return `
(function() {
  'use strict';
  Object.defineProperty(navigator, 'plugins',   { get: () => Object.assign([], { item: () => null, namedItem: () => null, refresh: () => {} }), configurable: true });
  Object.defineProperty(navigator, 'mimeTypes', { get: () => Object.assign([], { item: () => null, namedItem: () => null }), configurable: true });
})();
`
  }

  // Windows and macOS: Chrome PDF Plugin (the only plugin in modern Chrome 120+)
  return `
(function() {
  'use strict';

  // Build fake MimeType-like objects
  const pdfMimes = [
    { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
    { type: 'text/pdf',        suffixes: 'pdf', description: 'Portable Document Format' }
  ];

  // Build fake Plugin-like object
  const pdfPlugin = {
    name: 'PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    length: pdfMimes.length,
    item: (i) => pdfMimes[i] || null,
    namedItem: (t) => pdfMimes.find(m => m.type === t) || null,
    [Symbol.iterator]: function*() { for (const m of pdfMimes) yield m; }
  };
  pdfMimes.forEach((m, i) => {
    pdfPlugin[i] = m;
    pdfPlugin[m.type] = m;
    m.enabledPlugin = pdfPlugin;
  });

  // PluginArray-like
  const fakePlugins = {
    length: 1,
    0: pdfPlugin,
    'PDF Viewer': pdfPlugin,
    item: (i) => i === 0 ? pdfPlugin : null,
    namedItem: (name) => name === 'PDF Viewer' ? pdfPlugin : null,
    refresh: () => {},
    [Symbol.iterator]: function*() { yield pdfPlugin; }
  };

  // MimeTypeArray-like
  const fakeMimes = {
    length: pdfMimes.length,
    item: (i) => pdfMimes[i] || null,
    namedItem: (t) => pdfMimes.find(m => m.type === t) || null,
    [Symbol.iterator]: function*() { for (const m of pdfMimes) yield m; }
  };
  pdfMimes.forEach((m, i) => { fakeMimes[i] = m; fakeMimes[m.type] = m; });

  Object.defineProperty(navigator, 'plugins',   { get: () => fakePlugins, configurable: true });
  Object.defineProperty(navigator, 'mimeTypes', { get: () => fakeMimes,   configurable: true });
})();
`
}
