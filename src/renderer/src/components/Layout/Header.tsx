import React from 'react'
import { Search, ChevronRight } from 'lucide-react'

interface Breadcrumb {
  label: string
  href?: string
  onClick?: () => void
}

interface HeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  search?: string
  onSearchChange?: (v: string) => void
  actions?: React.ReactNode
}

export function Header({ title, subtitle, breadcrumbs, search, onSearchChange, actions }: HeaderProps) {
  return (
    <div className="flex flex-col border-b border-slate-800 shrink-0 bg-slate-900/50">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 text-xs">
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="text-slate-400 hover:text-slate-200 transition-colors hover:underline"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={idx === breadcrumbs.length - 1 ? 'text-slate-300 font-medium' : 'text-slate-500'}>
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Title & Search */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="input pl-9 w-56 focus:ring-2"
                aria-label="Search"
              />
            </div>
          )}
          {actions}
        </div>
      </div>
    </div>
  )
}
