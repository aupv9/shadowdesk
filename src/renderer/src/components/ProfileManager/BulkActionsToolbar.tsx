import React, { useState } from 'react'
import { Trash2, Copy, Link2, FolderOpen, X, Check, Play, Square } from 'lucide-react'
import { useProxyStore } from '../../stores/proxyStore'
import { useGroupStore } from '../../stores/groupStore'

/**
 * Phase 3: Bulk Actions Toolbar
 *
 * Floating toolbar shown when profiles are selected in selection mode.
 * Provides bulk operations:
 * - Launch (launch selected profiles in parallel)
 * - Close (close selected profiles in parallel)
 * - Delete (uses bulkDelete API with async cleanup)
 * - Clone (iterates individual clones)
 * - Assign Proxy (bulk operation)
 * - Assign Group (bulk operation)
 * - Clear selection
 */

interface BulkActionsToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onSelectAll: () => void
  allSelected: boolean
  onBulkLaunch: () => Promise<void>
  onBulkClose: () => Promise<void>
  onBulkDelete: () => Promise<void>
  onBulkClone: () => Promise<void>
  onBulkAssignProxy: (proxyId: string | null) => Promise<void>
  onBulkAssignGroup: (groupId: string | null) => Promise<void>
}

type SubmenuType = 'proxy' | 'group' | null

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onSelectAll,
  allSelected,
  onBulkLaunch,
  onBulkClose,
  onBulkDelete,
  onBulkClone,
  onBulkAssignProxy,
  onBulkAssignGroup,
}: BulkActionsToolbarProps) {
  const { proxies } = useProxyStore()
  const { groups } = useGroupStore()
  const [submenu, setSubmenu] = useState<SubmenuType>(null)
  const [isActing, setIsActing] = useState(false)

  if (selectedCount === 0) return null

  const handleAction = async (fn: () => Promise<void>) => {
    setIsActing(true)
    try {
      await fn()
    } finally {
      setIsActing(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3
                    bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl">
      {/* Selection indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-300 font-medium">
          {selectedCount} selected
        </span>
        <button
          onClick={onSelectAll}
          className="btn-ghost text-xs px-2 py-1"
          title={allSelected ? 'Deselect all on page' : 'Select all on page'}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="w-px h-4 bg-slate-600" />

      {/* Launch */}
      <button
        onClick={() => handleAction(onBulkLaunch)}
        disabled={isActing}
        className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50 text-green-400 hover:text-green-300"
        title="Launch all selected profiles"
      >
        <Play className="w-3.5 h-3.5" />
        Launch all
      </button>

      {/* Close */}
      <button
        onClick={() => handleAction(onBulkClose)}
        disabled={isActing}
        className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50 text-orange-400 hover:text-orange-300"
        title="Close all selected profiles"
      >
        <Square className="w-3.5 h-3.5" />
        Close all
      </button>

      <div className="w-px h-4 bg-slate-600" />

      {/* Clone */}
      <button
        onClick={() => handleAction(onBulkClone)}
        disabled={isActing}
        className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50"
      >
        <Copy className="w-3.5 h-3.5" />
        Clone all
      </button>

      {/* Assign proxy dropdown */}
      <div className="relative">
        <button
          onClick={() => setSubmenu(submenu === 'proxy' ? null : 'proxy')}
          disabled={isActing}
          className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <Link2 className="w-3.5 h-3.5" />
          Assign proxy
        </button>

        {submenu === 'proxy' && (
          <div className="absolute bottom-full mb-2 left-0 w-56 max-h-64 overflow-y-auto
                          bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1">
            <button
              onClick={async () => {
                setSubmenu(null)
                await handleAction(() => onBulkAssignProxy(null))
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <span className="italic">No proxy (unassign)</span>
            </button>
            {proxies.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 italic">
                No proxies available
              </div>
            ) : (
              proxies.map((proxy) => (
                <button
                  key={proxy.id}
                  onClick={async () => {
                    setSubmenu(null)
                    await handleAction(() => onBulkAssignProxy(proxy.id))
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium">{proxy.name}</div>
                  <div className="text-slate-500 text-[10px]">
                    {proxy.host}:{proxy.port}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Assign group dropdown */}
      <div className="relative">
        <button
          onClick={() => setSubmenu(submenu === 'group' ? null : 'group')}
          disabled={isActing}
          className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Assign group
        </button>

        {submenu === 'group' && (
          <div className="absolute bottom-full mb-2 left-0 w-56 max-h-64 overflow-y-auto
                          bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1">
            <button
              onClick={async () => {
                setSubmenu(null)
                await handleAction(() => onBulkAssignGroup(null))
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <span className="italic">No group (ungroup)</span>
            </button>
            {groups.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 italic">
                No groups available
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  onClick={async () => {
                    setSubmenu(null)
                    await handleAction(() => onBulkAssignGroup(group.id))
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-600" />

      {/* Delete */}
      <button
        onClick={() => handleAction(onBulkDelete)}
        disabled={isActing}
        className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   text-red-400 hover:bg-red-600/20 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete all
      </button>

      {/* Clear */}
      <button
        onClick={onClearSelection}
        className="btn-ghost p-1.5 rounded"
        title="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
