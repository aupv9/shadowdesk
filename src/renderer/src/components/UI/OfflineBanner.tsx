/**
 * Phase 13.E — Offline status banner.
 *
 * Renders a non-blocking top banner when the app loses network
 * connectivity, and dismisses automatically when connectivity is
 * restored. Cloud sync, auth, and license-related actions are
 * disabled in the offline state — this banner surfaces that context.
 */

import React, { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  // Show a brief "back online" confirmation before hiding
  const [showRestored, setShowRestored] = useState(false)
  const [visible, setVisible] = useState(false)
  const [everOffline, setEverOffline] = useState(false)

  useEffect(() => {
    if (!online) {
      setEverOffline(true)
      setVisible(true)
      setShowRestored(false)
    } else if (everOffline) {
      // Connection restored — show brief success then hide
      setShowRestored(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setShowRestored(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [online, everOffline])

  if (!visible) return null

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border-b border-emerald-600/30 text-emerald-400 text-sm animate-fade-in"
      >
        <Wifi className="w-4 h-4 flex-shrink-0" />
        <span>Connection restored — sync and online features are available again.</span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-2 px-4 py-2 bg-amber-600/15 border-b border-amber-600/30 text-amber-400 text-sm"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>
        <strong className="font-semibold">You are offline.</strong>
        {' '}Cloud sync, login, and license validation are unavailable. Local profiles and automation continue to work.
      </span>
    </div>
  )
}
