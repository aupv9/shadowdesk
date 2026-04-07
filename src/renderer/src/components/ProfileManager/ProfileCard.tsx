import React, { useRef, useState, useEffect } from 'react'
import {
  Play, Square, Trash2, Monitor, Globe,
  Clock, Loader2, MoreVertical, Pencil, Copy,
  Cookie, FolderOpen, Download, Upload, History,
  Puzzle, Sparkles, Wand2, Database, CloudOff, Cloud
} from 'lucide-react'
import type { Profile } from '../../types'

interface Props {
  profile:     Profile
  isActive:    boolean
  isLaunching: boolean
  onLaunch:    () => void
  onClose:     () => void
  onEdit:      () => void
  onClone:     () => void
  onDelete:    () => void
  onImportCookies: () => void
  onExportCookies: () => void
  onStorage:       () => void
  onExportBundle:  () => void
  onImportBundle:  () => void
  onHistory:       () => void
  onExtensions:    () => void
  onWarmUp:        () => void
  onApplyDrift:    () => void
  onToggleSyncExcluded: () => void
}

const PRESET_LABELS: Record<string, string> = {
  'win10-chrome120':         'Win10 / Chrome 120',
  'win11-chrome121':         'Win11 / Chrome 121',
  'mac-ventura-chrome120':   'macOS Ventura / Chrome 120',
  'mac-sonoma-chrome121':    'macOS Sonoma / Chrome 121',
  'linux-ubuntu-chrome120':  'Ubuntu / Chrome 120'
}

const OS_ICON: Record<string, string> = {
  Win32:          '🪟',
  MacIntel:       '🍎',
  'Linux x86_64': '🐧'
}

export function ProfileCard({
  profile, isActive, isLaunching,
  onLaunch, onClose, onEdit, onClone, onDelete,
  onImportCookies, onExportCookies, onStorage, onExportBundle, onImportBundle, onHistory,
  onExtensions, onWarmUp, onApplyDrift, onToggleSyncExcluded
}: Props) {
  const syncExcluded = !!profile.sync_excluded
  const fp     = profile.fingerprint
  const preset = PRESET_LABELS[fp?.preset] ?? fp?.preset ?? 'Unknown'
  const osIcon = OS_ICON[fp?.os?.platform ?? ''] ?? '💻'

  const lastUsed = profile.last_used_at
    ? new Date(profile.last_used_at).toLocaleDateString()
    : 'Never'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const menuItem = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      onClick={() => { action(); setMenuOpen(false) }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors rounded-lg
        ${danger
          ? 'text-red-400 hover:bg-red-600/20'
          : 'text-slate-300 hover:bg-slate-700'
        }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className={`card group relative hover:border-slate-600 transition-all ${isActive ? 'border-ghost-600/50' : ''}`}>
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-3 right-10 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-green-400 font-medium">Running</span>
        </div>
      )}

      {/* Overflow menu */}
      <div className="absolute top-2.5 right-2.5" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1">
            {menuItem(<Pencil    className="w-3.5 h-3.5" />, 'Edit',           onEdit)}
            {menuItem(<Copy      className="w-3.5 h-3.5" />, 'Clone',          onClone)}
            {menuItem(<Cookie    className="w-3.5 h-3.5" />, 'Cookies...',     onImportCookies)}
            {menuItem(<FolderOpen className="w-3.5 h-3.5" />, 'Export Cookies', onExportCookies)}
            {menuItem(<Database  className="w-3.5 h-3.5" />, 'Storage...',     onStorage)}
            <div className="border-t border-slate-700 my-1" />
            {menuItem(<Puzzle    className="w-3.5 h-3.5" />, 'Extensions...',  onExtensions)}
            {menuItem(<Sparkles  className="w-3.5 h-3.5" />, 'Warm Up...',     onWarmUp)}
            {menuItem(<Wand2     className="w-3.5 h-3.5" />, 'Apply Drift',    onApplyDrift)}
            <div className="border-t border-slate-700 my-1" />
            {menuItem(<Download  className="w-3.5 h-3.5" />, 'Export Bundle',  onExportBundle)}
            {menuItem(<Upload    className="w-3.5 h-3.5" />, 'Import Bundle',  onImportBundle)}
            {menuItem(<History   className="w-3.5 h-3.5" />, 'Version History', onHistory)}
            <div className="border-t border-slate-700 my-1" />
            {menuItem(
              syncExcluded
                ? <Cloud    className="w-3.5 h-3.5" />
                : <CloudOff className="w-3.5 h-3.5" />,
              syncExcluded ? 'Include in Cloud Sync' : 'Exclude from Cloud Sync',
              onToggleSyncExcluded
            )}
            <div className="border-t border-slate-700 my-1" />
            {menuItem(<Trash2    className="w-3.5 h-3.5" />, 'Delete',         onDelete, true)}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
          {osIcon}
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h3 className="text-sm font-semibold text-white truncate">{profile.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{preset}</p>
        </div>
      </div>

      {/* Group badge + warm-up indicator + sync excluded */}
      {(profile.group_name || profile.warmed_up || syncExcluded) && (
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          {profile.group_name && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${profile.group_color ?? '#6366f1'}25`, color: profile.group_color ?? '#818cf8' }}
            >
              {profile.group_name}
            </span>
          )}
          {profile.warmed_up ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              <Sparkles className="w-2.5 h-2.5" />
              Warmed up
            </span>
          ) : null}
          {syncExcluded && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 font-medium"
              title="Excluded from cloud sync"
            >
              <CloudOff className="w-2.5 h-2.5" />
              No sync
            </span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 flex-wrap">
        {profile.proxy_label && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {profile.proxy_label}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Monitor className="w-3 h-3" />
          {fp?.screen?.width}×{fp?.screen?.height}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {lastUsed}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isActive ? (
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                       bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Close
          </button>
        ) : (
          <button
            onClick={onLaunch}
            disabled={isLaunching}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                       bg-ghost-600/20 hover:bg-ghost-600/30 text-ghost-400 text-xs font-medium transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLaunching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Launching...</>
            ) : (
              <><Play className="w-3.5 h-3.5" />Launch</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
