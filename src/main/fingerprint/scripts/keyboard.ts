/**
 * Keyboard layout spoofing — patches navigator.keyboard.getLayoutMap()
 * to return a layout consistent with the profile's locale, preventing
 * mismatches between reported locale and keyboard layout.
 */

// Minimal key maps per locale group (physical key → character)
const LAYOUT_MAPS: Record<string, Record<string, string>> = {
  // Latin QWERTY (default, en-US, vi-VN uses QWERTY)
  qwerty: {
    KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e',
    KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j',
    KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n', KeyO: 'o',
    KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't',
    KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y',
    KeyZ: 'z',
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
    Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
    Space: ' ', Enter: '\r', Backspace: '\x08',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/'
  }
}

function localeToLayout(lang: string): string {
  // All SEA locales (vi-VN, th-TH, id-ID) + en use QWERTY physical layout
  return 'qwerty'
}

export function buildKeyboardScript(language: string): string {
  const layoutKey = localeToLayout(language)
  const layout = LAYOUT_MAPS[layoutKey] ?? LAYOUT_MAPS['qwerty']
  const entries = JSON.stringify(layout)

  return `
(function() {
  'use strict';
  if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return;

  const _getLayoutMap = navigator.keyboard.getLayoutMap.bind(navigator.keyboard);
  navigator.keyboard.getLayoutMap = function() {
    const layoutData = ${entries};
    // Return a Map-like object matching KeyboardLayoutMap interface
    const map = new Map(Object.entries(layoutData));
    // Make it look like a real KeyboardLayoutMap
    Object.setPrototypeOf(map, Map.prototype);
    return Promise.resolve(map);
  };
})();
`
}
