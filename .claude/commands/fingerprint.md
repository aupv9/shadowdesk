Add or improve fingerprint spoofing vectors for Ghost Browser's anti-detect engine.

## Fingerprint Engine Overview

Layer 1 (current MVP): CDP + JavaScript injection via `page.evaluateOnNewDocument()`
Layer 2 (Phase 4): Custom Chromium C++ patches — undetectable by JS introspection

### Injection Order (matters!)
```
1. page.evaluateOnNewDocument(combinedScript)  ← JS overrides, run before page JS
2. page.setExtraHTTPHeaders({ 'Accept-Language': ... })
3. CDP Emulation.setUserAgentOverride
4. CDP Emulation.setTimezoneOverride
5. CDP Emulation.setGeolocationOverride
```

### Consistency Rule
All noise values MUST use the **same deterministic seed** derived from profileId:
```typescript
function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}
// seed is set in presets.ts via hashCode(profileId)
// Same profile → same fingerprint across ALL sessions
```

---

## Current Vector Status

| Vector | File | Status |
|--------|------|--------|
| User-Agent / UA-CH | scripts/navigator.ts | ✅ MVP |
| Platform / OS | scripts/navigator.ts | ✅ MVP |
| Canvas noise | scripts/canvas.ts | ✅ MVP |
| WebGL vendor/renderer | scripts/webgl.ts | ✅ MVP |
| WebGL readPixels noise | scripts/webgl.ts | ✅ MVP |
| AudioContext noise | scripts/audio.ts | ✅ MVP |
| Screen resolution | scripts/navigator.ts | ✅ MVP |
| Device memory | scripts/navigator.ts | ✅ MVP |
| Hardware concurrency | scripts/navigator.ts | ✅ MVP |
| Max touch points | scripts/navigator.ts | ✅ MVP |
| WebRTC (disabled) | browser-manager.ts | ✅ MVP (via Chrome flag) |
| Timezone | injector.ts | ✅ MVP (via CDP) |
| Language / Accept-Language | injector.ts + navigator.ts | ✅ MVP |
| Geolocation (disabled) | injector.ts | ✅ MVP (via CDP) |
| Font whitelist | scripts/fonts.ts | ✅ MVP |
| Font metrics noise | scripts/fonts.ts | ✅ MVP |
| Battery API (mocked) | scripts/navigator.ts | ✅ MVP |
| Media devices spoof | scripts/navigator.ts | ✅ MVP |
| ClientRects noise | — | 📋 Planned Phase 2 |
| Speech synthesis voices | — | 📋 Planned Phase 2 |
| Bluetooth/USB block | — | 📋 Planned Phase 2 |

---

## Adding a New Vector — Step by Step

### Step 1: Add config type to `src/shared/types.ts`
```typescript
export interface FingerprintConfig {
  // ... existing fields
  clientRects: ClientRectsConfig   // ← add new field
}

export interface ClientRectsConfig {
  mode: 'noise' | 'real'
  noiseSeed: number
}
```

### Step 2: Create `src/main/fingerprint/scripts/clientrects.ts`
```typescript
import type { ClientRectsConfig } from '../../../shared/types'

export function buildClientRectsScript(config: ClientRectsConfig): string {
  if (config.mode !== 'noise') return ''

  return `
(function() {
  'use strict';

  function seededRng(seed) {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff
    }
  }
  const rng = seededRng(${config.noiseSeed})

  // Override getBoundingClientRect
  const origGetBCR = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function() {
    const rect = origGetBCR.call(this)
    const noise = (rng() - 0.5) * 0.02  // sub-pixel noise
    return new DOMRect(
      rect.x + noise, rect.y + noise,
      rect.width, rect.height
    )
  }

  // Override getClientRects
  const origGetCR = Element.prototype.getClientRects
  Element.prototype.getClientRects = function() {
    const rects = origGetCR.call(this)
    return Array.from(rects).map(r => {
      const noise = (rng() - 0.5) * 0.02
      return new DOMRect(r.x + noise, r.y + noise, r.width, r.height)
    })
  }
})();
`
}
```

### Step 3: Add to `src/main/fingerprint/injector.ts`
```typescript
import { buildClientRectsScript } from './scripts/clientrects'

// In injectAll():
const scripts = [
  buildNavigatorScript(...),
  buildCanvasScript(fp.canvas),
  buildWebGlScript(fp.webgl),
  buildAudioScript(fp.audio),
  buildFontsScript(fp.fonts),
  buildClientRectsScript(fp.clientRects),  // ← add here
].filter(Boolean)
```

### Step 4: Add default to each preset in `src/main/fingerprint/presets.ts`
```typescript
// In FINGERPRINT_PRESETS['win10-chrome120']:
clientRects: { mode: 'noise', noiseSeed: 0 },  // seed assigned by resolveFingerprint()
```

### Step 5: Update `resolveFingerprint()` in `presets.ts` if new vector uses seed
```typescript
clone.clientRects.noiseSeed = seed  // same seed for consistency
```

### Step 6: Update FingerprintEditor dashboard in `src/renderer/src/components/FingerprintEditor/index.tsx`
```typescript
const VECTORS = [
  // ... existing
  { category: 'DOM', name: 'ClientRects noise', risk: 'medium', status: 'spoofed' },  // ← update from 'planned'
]
```

---

## Detection Testing Checklist

After adding a new vector, verify with:
- **creepjs**: https://abrahamjuliot.github.io/creepjs/
- **browserleaks**: https://browserleaks.com/
- **pixelscan**: https://pixelscan.net/

Target scores:
- Month 3: >85% undetectability
- Month 6: >92%
- Month 12: >97%

## Consistency Rules (must not violate)

- Windows UA → must have Windows fonts (Segoe UI, Calibri, Consolas)
- macOS UA → Apple WebGL renderers (ANGLE Metal) + Retina pixelRatio ≥ 2
- Mobile UA → maxTouchPoints > 0, screen width ≤ 430, deviceMemory ≤ 8
- Timezone → should match proxy's GeoIP country (Phase 2: auto-resolve via MaxMind)
- Language → must align with timezone region
- Canvas + WebGL + Audio seeds → ALL must equal the same deterministic seed per profile
