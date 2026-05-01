/**
 * Phase 13.C — Global keyboard shortcuts for the app.
 *
 * Listens for key combos at the window level and dispatches navigation
 * or action callbacks. Ignores events from input/textarea/contenteditable
 * to avoid conflicts with typing.
 */

import { useEffect } from 'react'
import type { NavSection } from '../types'

interface GlobalShortcutOptions {
  onNavigate: (section: NavSection) => void
  onNewProfile?: () => void
  onSearch?: () => void
  onRefresh?: () => void
}

function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

export function useGlobalShortcuts({
  onNavigate,
  onNewProfile,
  onSearch,
  onRefresh,
}: GlobalShortcutOptions): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isEditable(e.target)) return

      const mod = e.ctrlKey || e.metaKey

      // Ctrl/Cmd+N — New profile
      if (mod && e.key === 'n') {
        e.preventDefault()
        onNewProfile?.()
        return
      }

      // Ctrl/Cmd+F or / — Focus search
      if ((mod && e.key === 'f') || (!mod && e.key === '/')) {
        e.preventDefault()
        onSearch?.()
        return
      }

      // Ctrl/Cmd+R — Refresh
      if (mod && e.key === 'r') {
        e.preventDefault()
        onRefresh?.()
        return
      }

      // Ctrl/Cmd+, — Settings
      if (mod && e.key === ',') {
        e.preventDefault()
        onNavigate('settings')
        return
      }

      // Single-key navigation (without modifier, not in input)
      if (!mod && !e.altKey && !e.shiftKey) {
        switch (e.key) {
          case '1': onNavigate('profiles');   break
          case '2': onNavigate('proxies');    break
          case '3': onNavigate('fingerprint'); break
          case '4': onNavigate('automation'); break
          case '5': onNavigate('detection');  break
          case '?': onNavigate('settings');   break
          default: return
        }
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNavigate, onNewProfile, onSearch, onRefresh])
}
