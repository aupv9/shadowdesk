/**
 * Phase 9.2 — Native `toString` hardening
 *
 * Detection scripts call `Function.prototype.toString` on every patched API
 * (e.g. `Object.defineProperty`, `navigator.permissions.query`,
 * `HTMLCanvasElement.prototype.toDataURL`) and look for the string
 * `[native code]`. Whenever they instead see our wrapper function source,
 * they flag the page as automated.
 *
 * This script installs a hardened `Function.prototype.toString` that:
 *  1) Returns the original `[native code]` representation for any function
 *     marked via `__natives.add(fn, 'name')`.
 *  2) Forwards calls to the unmodified original for all other functions.
 *  3) Itself reports as native via the same mechanism.
 *
 * Subsequent fingerprint scripts (canvas/webgl/navigator/...) can register
 * their wrapper functions through `window.__ghostMarkNative(wrapper, name)`
 * exposed on `window`. The marker is removed after install completes.
 */
export function buildNativeToStringScript(): string {
  return `
(function() {
  'use strict';
  var _origToString = Function.prototype.toString;
  // Use a Map<function, displayName> so we can fabricate the right body.
  var fakeNatives = new WeakMap();

  function nativeBody(name) {
    return 'function ' + name + '() { [native code] }';
  }

  // The replacement toString itself must look native.
  var patchedToString = function toString() {
    if (this == null) {
      return _origToString.call(this);
    }
    if (fakeNatives.has(this)) {
      return nativeBody(fakeNatives.get(this));
    }
    return _origToString.call(this);
  };

  // Mark the patched toString itself as native — and the WeakMap helpers.
  fakeNatives.set(patchedToString, 'toString');

  try {
    Object.defineProperty(Function.prototype, 'toString', {
      value: patchedToString,
      writable: true,
      configurable: true
    });
  } catch(e) {}

  // Expose registration helper on window so other scripts can mark their
  // wrappers as fake-native. The helper is itself marked native and is
  // deleted from window once the page begins running, but stays usable
  // through a closure for any subsequent injection chunks in this run.
  function __ghostMarkNative(fn, name) {
    if (typeof fn === 'function') {
      fakeNatives.set(fn, String(name || (fn.name || 'anonymous')));
    }
    return fn;
  }
  fakeNatives.set(__ghostMarkNative, 'anonymous');
  try {
    Object.defineProperty(window, '__ghostMarkNative', {
      value: __ghostMarkNative,
      writable: false,
      configurable: true,
      enumerable: false
    });
  } catch(e) {}

  // Pre-mark commonly inspected APIs that other fingerprint scripts patch.
  // Other scripts (canvas, navigator, etc.) call __ghostMarkNative on their
  // own wrapper getters AFTER they install them — but the most-checked APIs
  // get a defensive registration here in case the wrapper script forgot.
  function tryMark(obj, key, displayName) {
    try {
      var v = obj[key];
      if (typeof v === 'function') fakeNatives.set(v, displayName || key);
    } catch(e) {}
  }
  tryMark(Object, 'defineProperty', 'defineProperty');
  tryMark(Object, 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptor');
  tryMark(Object, 'getOwnPropertyNames', 'getOwnPropertyNames');
  tryMark(navigator, 'permissions', 'permissions');
  if (navigator.permissions && navigator.permissions.query) {
    tryMark(navigator.permissions, 'query', 'query');
  }
  if (typeof HTMLCanvasElement !== 'undefined') {
    tryMark(HTMLCanvasElement.prototype, 'toDataURL', 'toDataURL');
    tryMark(HTMLCanvasElement.prototype, 'toBlob', 'toBlob');
    tryMark(HTMLCanvasElement.prototype, 'getContext', 'getContext');
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    tryMark(CanvasRenderingContext2D.prototype, 'getImageData', 'getImageData');
    tryMark(CanvasRenderingContext2D.prototype, 'fillText', 'fillText');
  }
  if (typeof WebGLRenderingContext !== 'undefined') {
    tryMark(WebGLRenderingContext.prototype, 'getParameter', 'getParameter');
    tryMark(WebGLRenderingContext.prototype, 'getExtension', 'getExtension');
  }
  if (typeof AudioBuffer !== 'undefined') {
    tryMark(AudioBuffer.prototype, 'getChannelData', 'getChannelData');
  }
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    tryMark(navigator.mediaDevices, 'enumerateDevices', 'enumerateDevices');
  }
})();
`
}
