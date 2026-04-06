import React from 'react'
import { Search } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  search?: string
  onSearchChange?: (v: string) => void
  actions?: React.ReactNode
}

export function Header({ title, subtitle, search, onSearchChange, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input pl-9 w-56"
            />
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}
