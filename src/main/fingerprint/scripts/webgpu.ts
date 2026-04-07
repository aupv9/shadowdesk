import type { WebGlConfig } from '../../../../shared/types'

/**
 * Phase 8 — WebGPU fingerprint defense.
 *
 * Provides a minimal navigator.gpu stub whose adapter info mirrors the WebGL
 * vendor/renderer string already set in webgl.ts.  This prevents correlation
 * attacks that compare WebGL vs WebGPU adapter strings.
 *
 * Full C++ patch: would patch the Chromium GPU process to return the spoofed
 * adapter description at the GpuInit layer, making it immune to native-level
 * GPU info queries.  The JS shim here covers the JS-accessible surface.
 */
export function buildWebGPUScript(webgl: WebGlConfig): string {
  // Extract GPU vendor/description from WebGL renderer string
  // e.g. "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 ...)" → "NVIDIA GeForce RTX 3070"
  const extractDescription = (renderer: string): string => {
    const match = renderer.match(/ANGLE \([^,]+,\s*([^,]+)/)
    return match ? match[1].trim() : renderer.replace(/^ANGLE \(/, '').replace(/\)$/, '')
  }

  const description = JSON.stringify(extractDescription(webgl.renderer))
  const vendor      = JSON.stringify(
    webgl.vendor.replace('Google Inc. (', '').replace(')', '').split(' ')[0] || 'NVIDIA'
  )

  return `
(function() {
  'use strict';

  // If WebGPU is already present (Chrome 113+), patch the adapter info
  if (!('gpu' in navigator)) {
    // Provide a minimal stub for environments where WebGPU is not enabled
    Object.defineProperty(navigator, 'gpu', {
      get: function() {
        return {
          requestAdapter: function(options) {
            return Promise.resolve({
              name: ${description},
              requestDevice: function(descriptor) {
                return Promise.resolve({
                  label: '',
                  limits: {},
                  features: new Set(),
                  queue: { submit: function() {}, label: '' },
                  destroy: function() {},
                  createBuffer: function() { return null; },
                  lost: Promise.resolve({ reason: 'destroyed', message: '' })
                });
              },
              features: new Set(['texture-compression-bc']),
              limits: {},
              isFallbackAdapter: false,
              requestAdapterInfo: function() {
                return Promise.resolve({
                  vendor: ${vendor},
                  architecture: '',
                  device: ${description},
                  description: ${description}
                });
              }
            });
          },
          getPreferredCanvasFormat: function() { return 'bgra8unorm'; },
          wgslLanguageFeatures: new Set()
        };
      },
      configurable: true,
      enumerable: true
    });
  } else {
    // WebGPU is present — patch requestAdapterInfo to match our WebGL strings
    var _origGPU = navigator.gpu;
    var _origRequestAdapter = _origGPU.requestAdapter.bind(_origGPU);

    Object.defineProperty(navigator, 'gpu', {
      get: function() {
        var patchedGPU = Object.create(_origGPU);
        patchedGPU.requestAdapter = function(options) {
          return _origRequestAdapter(options).then(function(adapter) {
            if (!adapter) return adapter;
            var _origInfo = adapter.requestAdapterInfo.bind(adapter);
            adapter.requestAdapterInfo = function() {
              return _origInfo().then(function(info) {
                return {
                  vendor: ${vendor},
                  architecture: info.architecture || '',
                  device: ${description},
                  description: ${description}
                };
              });
            };
            return adapter;
          });
        };
        return patchedGPU;
      },
      configurable: true,
      enumerable: true
    });
  }
})();
`
}
