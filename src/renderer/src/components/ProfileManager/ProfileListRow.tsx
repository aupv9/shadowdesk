import React, { useRef, useState } from 'react'
import {
  Play, Square, Loader2, MoreVertical, Pencil, Copy, Cookie, FolderOpen,
  Database, Puzzle, Sparkles, Wand2, Download, Upload, History, Cloud,
  CloudOff, Trash2, Globe, Monitor, Clock,
} from 'lucide-react'
import type { Profile } from '../../types'
import { DropdownMenu } from '../UI/DropdownMenu'

/**
 * Dense list-view row for the Profile Manager.
 *
 * Mirrors the actions available on `ProfileCard` but is optimised for
 * scanning large fleets — users can see dozens of profiles at once
 * without scrolling. Left column carries the primary identity, middle
 * column carries metadata, right column carries the primary CTA plus
 * an overflow menu with the full action set.
 */

interface Props {
  profile: Profile
  isActive: boolean
  isLaunching: boolean
  selected: boolean
  selectionMode: boolean
  onToggleSelect: () => void
  onLaunch: () => void
  onClose: () => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
  onImportCookies: () => void
  onExportCookies: () => void
  onStorage: () => void
  onExportBundle: () => void
  onImportBundle: () => void
  onHistory: () => void
  onExtensions: () => void
  onWarmUp: () => void
  onApplyDrift: () => void
  onToggleSyncExcluded: () => void
}

const PRESET_LABELS: Record<string, string> = {
  'win10-chrome120': 'Win10 · Chrome 120',
  'win11-chrome121': 'Win11 · Chrome 121',
  'mac-ventura-chrome120': 'macOS Ventura · Chrome 120',
  'mac-sonoma-chrome121': 'macOS Sonoma · Chrome 121',
  'linux-ubuntu-chrome120': 'Ubuntu · Chrome 120',
}

const OS_ICON: Record<string, string> = {
  Win32: '🪟',
  MacIntel: '🍎',
  'Linux x86_64': '🐧',
}

export function ProfileListRow({
  profile, isActive, isLaunching, selected, selectionMode, onToggleSelect,
  onLaunch, onClose, onEdit, onClone, onDelete,
  onImportCookies, onExportCookies, onStorage, onExportBundle, onImportBundle,
  onHistory, onExtensions, onWarmUp, onApplyDrift, onToggleSyncExcluded,
}: Props) {
  const fp = profile.fingerprint
  const preset = PRESET_LABELS[fp?.preset] ?? fp?.preset ?? 'Unknown'
  const osIcon = OS_ICON[fp?.os?.platform ?? ''] ?? '💻'
  const syncExcluded = !!profile.sync_excluded
  const warmed = !!profile.warmed_up

  const lastUsed = profile.last_used_at
    ? new Date(profile.last_used_at).toLocaleDateString()
    : 'Never'

  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const menuItem = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      onClick={() => { action(); setMenuOpen(false) }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors rounded-lg
        ${danger ? 'text-red-400 hover:bg-red-600/20' : 'text-slate-300 hover:bg-slate-700'}`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/40 transition-colors ${
        isActive ? 'bg-ghost-600/[0.06]' : ''
      } ${selected ? 'bg-ghost-600/10' : ''}`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="w-4 h-4 accent-indigo-500 cursor-pointer shrink-0"
        />
      )}

      {/* OS icon */}
      <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-lg shrink-0">
        {osIcon}
      </div>

      {/* Name + preset */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate">{profile.name}</h3>
          {isActive && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Running
            </span>
          )}
          {warmed && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              <Sparkles className="w-2.5 h-2.5" />
              Warmed
            </span>
          )}
          {profile.group_name && (
            <span
              className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${profile.group_color ?? '#6366f1'}25`,
                color: profile.group_color ?? '#818cf8',
              }}
            >
              {profile.group_name}
            </span>
          )}
          {syncExcluded && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-600/30 text-slate-400 font-medium"
              title="Excluded from cloud sync"
            >
              <CloudOff className="w-2.5 h-2.5" />
              No sync
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{preset}</p>
      </div>

      {/* Proxy */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 w-40 truncate">
        <Globe className="w-3 h-3 shrink-0" />
        <span className="truncate">{profile.proxy_label || 'No proxy'}</span>
      </div>

      {/* Screen */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 w-24 shrink-0">
        <Monitor className="w-3 h-3" />
        {fp?.screen?.width}×{fp?.screen?.height}
      </div>

      {/* Last used */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 w-28 shrink-0">
        <Clock className="w-3 h-3" />
        {lastUsed}
      </div>

      {/* Primary action */}
      <div className="shrink-0">
        {isActive ? (
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Close
          </button>
        ) : (
          <button
            onClick={onLaunch}
            disabled={isLaunching}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-ghost-600/20 hover:bg-ghost-600/30 text-ghost-400 text-xs font-medium transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLaunching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Launching</>
            ) : (
              <><Play className="w-3.5 h-3.5" />Launch</>
            )}
          </button>
        )}
      </div>

      {/* Overflow menu */}
      <div className="shrink-0">
        <button
          ref={triggerRef}
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu open={menuOpen} triggerRef={triggerRef} onClose={() => setMenuOpen(false)}>
          {menuItem(<Pencil className="w-3.5 h-3.5" />, 'Edit', onEdit)}
          {menuItem(<Copy className="w-3.5 h-3.5" />, 'Clone', onClone)}
          {menuItem(<Cookie className="w-3.5 h-3.5" />, 'Cookies...', onImportCookies)}
          {menuItem(<FolderOpen className="w-3.5 h-3.5" />, 'Export Cookies', onExportCookies)}
          {menuItem(<Database className="w-3.5 h-3.5" />, 'Storage...', onStorage)}
          <div className="border-t border-slate-700 my-1" />
          {menuItem(<Puzzle className="w-3.5 h-3.5" />, 'Extensions...', onExtensions)}
          {menuItem(<Sparkles className="w-3.5 h-3.5" />, 'Warm Up...', onWarmUp)}
          {menuItem(<Wand2 className="w-3.5 h-3.5" />, 'Apply Drift', onApplyDrift)}
          <div className="border-t border-slate-700 my-1" />
          {menuItem(<Download className="w-3.5 h-3.5" />, 'Export Bundle', onExportBundle)}
          {menuItem(<Upload className="w-3.5 h-3.5" />, 'Import Bundle', onImportBundle)}
          {menuItem(<History className="w-3.5 h-3.5" />, 'Version History', onHistory)}
          <div className="border-t border-slate-700 my-1" />
          {menuItem(
            syncExcluded ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />,
            syncExcluded ? 'Include in Cloud Sync' : 'Exclude from Cloud Sync',
            onToggleSyncExcluded,
          )}
          <div className="border-t border-slate-700 my-1" />
          {menuItem(<Trash2 className="w-3.5 h-3.5" />, 'Delete', onDelete, true)}
        </DropdownMenu>
      </div>
    </div>
  )
}
