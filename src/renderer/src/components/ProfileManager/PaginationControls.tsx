import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * Phase 3: Pagination Controls for ProfileManager
 *
 * Displays page navigation with:
 * - First / Previous / Next / Last buttons
 * - Current page indicator
 * - Total items count
 * - Page size selector
 */

interface PaginationControlsProps {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function PaginationControls({
  total,
  limit,
  offset,
  hasMore,
  onPageChange,
  onLimitChange,
}: PaginationControlsProps) {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startItem = total === 0 ? 0 : offset + 1
  const endItem = Math.min(offset + limit, total)

  const canGoBack = currentPage > 1
  const canGoForward = hasMore || currentPage < totalPages

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-800/50 border-t border-slate-700">
      {/* Item count */}
      <div className="text-xs text-slate-400">
        Showing <span className="text-white font-medium">{startItem}-{endItem}</span> of{' '}
        <span className="text-white font-medium">{total}</span> profiles
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={!canGoBack}
          className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoBack}
          className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-3 text-xs text-slate-300">
          Page <span className="text-white font-medium">{currentPage}</span> of{' '}
          <span className="text-white font-medium">{totalPages}</span>
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoForward}
          className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoForward}
          className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>Per page:</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs cursor-pointer hover:bg-slate-600 transition-colors"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
