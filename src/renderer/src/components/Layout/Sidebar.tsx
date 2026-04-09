import React, { useEffect, useState } from 'react'
import {
  Globe,
  Fingerprint,
  Settings,
  Ghost,
  LayoutGrid,
  Download,
  ArrowUpCircle,
  Users,
  User,
  Crown,
  Bot,
  Shield,
  Cpu,
  Store,
  Sparkles,
  Activity,
  MapPin,
  Sliders,
  Flame,
  Radar
} from 'lucide-react'
import type { NavSection } from '../../types'
import type { User as UserType, LicensePlan } from '../../types'

interface UpdateStatus {
  status: string
  version?: string
  percent?: number
  message?: string
}

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  free:         { label: 'Free',  color: 'bg-slate-700 text-slate-400' },
  starter:      { label: 'Starter', color: 'bg-blue-500/20 text-blue-400' },
  professional: { label: 'Pro',  color: 'bg-purple-500/20 text-purple-400' },
  enterprise:   { label: 'Ent',  color: 'bg-amber-500/20 text-amber-400' }
}

interface SidebarProps {
  active: NavSection
  onChange: (s: NavSection) => void
  profileCount: number
  activeSessionCount: number
  user?: UserType | null
  plan?: LicensePlan
}

const NAV_ITEMS: { key: NavSection; icon: React.ElementType; label: string }[] = [
  { key: 'profiles',      icon: LayoutGrid,   label: 'Profiles' },
  { key: 'proxies',       icon: Globe,        label: 'Proxies' },
  { key: 'fingerprint',   icon: Fingerprint,  label: 'Fingerprint' },
  { key: 'behavior',      icon: Sliders,      label: 'Behavior' },
  { key: 'correlation',   icon: Radar,        label: 'Correlation' },
  { key: 'detection',     icon: Shield,       label: 'Detection' },
  { key: 'patches',       icon: Cpu,          label: 'Patches' },
  { key: 'automation',    icon: Bot,          label: 'Automation' },
  { key: 'runs',          icon: Activity,     label: 'Run Dashboard' },
  { key: 'ai',            icon: Sparkles,     label: 'AI Assistant' },
  { key: 'sea-platforms', icon: MapPin,       label: 'SEA Platforms' },
  { key: 'smart-warmup',  icon: Flame,        label: 'Warm-Up' },
  { key: 'marketplace',   icon: Store,        label: 'Marketplace' },
  { key: 'team',          icon: Users,        label: 'Team' },
  { key: 'account',       icon: User,         label: 'Account' },
  { key: 'settings',      icon: Settings,     label: 'Settings' }
]

export function Sidebar({ active, onChange, profileCount, activeSessionCount, user, plan = 'free' }: SidebarProps) {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const cleanup = window.api.updater.onStatus(setUpdate)
    return cleanup
  }, [])

  const handleUpdateAction = () => {
    if (!update) return
    if (update.status === 'available') window.api.updater.download()
    if (update.status === 'ready') window.api.updater.install()
  }

  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.free

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

      {/* Update banner */}
      {update && (update.status === 'available' || update.status === 'downloading' || update.status === 'ready') && (
        <div className="mx-2 mb-2">
          <button
            onClick={handleUpdateAction}
            disabled={update.status === 'downloading'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-ghost-600/20 text-ghost-400 hover:bg-ghost-600/30"
          >
            {update.status === 'available' && (
              <>
                <Download className="w-3.5 h-3.5" />
                Update {update.version} available
              </>
            )}
            {update.status === 'downloading' && (
              <>
                <Download className="w-3.5 h-3.5 animate-bounce" />
                Downloading... {update.percent}%
              </>
            )}
            {update.status === 'ready' && (
              <>
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Restart to update
              </>
            )}
          </button>
        </div>
      )}

      {/* User / Plan footer */}
      <div className="px-3 py-3 border-t border-slate-800">
        {user ? (
          <button
            onClick={() => onChange('account')}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-ghost-600/20 flex items-center justify-center text-xs font-medium text-ghost-400">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-medium text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </button>
        ) : (
          <button
            onClick={() => onChange('account')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <User className="w-4 h-4" />
            Sign in
          </button>
        )}
        <div className="text-[10px] text-slate-600 mt-1.5 px-2">v0.5.0 Beta</div>
      </div>
    </aside>
  )
}
