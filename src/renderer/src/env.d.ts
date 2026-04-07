/// <reference types="vite/client" />

// Derive the renderer-side API type directly from the preload bridge.
// This keeps env.d.ts in lockstep with whatever the preload actually exposes,
// so adding/removing namespaces in src/preload/index.ts auto-updates the
// renderer types — no manual sync needed.
import type { API } from '../../preload/index'

declare global {
  interface Window {
    api: API
  }
}

export {}
