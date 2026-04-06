import React from 'react'
import {
  Monitor,
  Globe,
  Fingerprint,
  Settings,
  Ghost,
  LayoutGrid
} from 'lucide-react'
import type { NavSection } from '../../types'

interface SidebarProps {
  active: NavSection
  onChange: (s: NavSection) => void
  profileCount: number
  activeSessionCount: number
}

const NAV_ITEMS: { key: NavSection; icon: React.ElementType; label: string }[] = [
  { key: 'profiles',    icon: LayoutGrid,   label: 'Profiles' },
  { key: 'proxies',     icon: Globe,        label: 'Proxies' },
  { key: 'fingerprint', icon: Fingerprint,  label: 'Fingerprint' },
  { key: 'settings',   icon: Settings,     label: 'Settings' }
]

export function Sidebar({ active, onChange, profileCount, activeSessionCount }: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-slate-900 border-r border-slate-800 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-ghost-600 flex items-center justify-center">
          <Ghost className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-semibold text-white text-sm leading-none">Ghost Browser</div>
          <div className="text-xs text-slate-500 mt-0.5">Anti-Detect</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 px-3 py-3 border-b border-slate-800">
        <div className="bg-slate-800 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{profileCount}</div>
          <div className="text-xs text-slate-400">Profiles</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-400">{activeSessionCount}</div>
          <div className="text-xs text-slate-400">Active</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
              ${active === key
                ? 'bg-ghost-600/20 text-ghost-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }
            `}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-600">v0.1.0 Beta</div>
      </div>
    </aside>
  )
}
