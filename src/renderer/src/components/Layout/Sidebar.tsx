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
  Radar,
  ChevronLeft
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
  const [collapsed, setCollapsed] = useState(false)

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
    <aside className={`flex flex-col min-h-screen bg-slate-900 border-r border-slate-800 select-none transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-ghost-600 flex items-center justify-center shrink-0">
            <Ghost className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm leading-none truncate">Ghost Browser</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">Anti-Detect</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 px-3 py-3 border-b border-slate-800">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center hover:bg-slate-800 transition-colors">
            <div className="text-lg font-bold text-white">{profileCount}</div>
            <div className="text-xs text-slate-400">Profiles</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center hover:bg-slate-800 transition-colors">
            <div className="text-lg font-bold text-green-400">{activeSessionCount}</div>
            <div className="text-xs text-slate-400">Active</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className={`flex-1 ${collapsed ? 'px-1.5 py-3 space-y-0.5' : 'px-2 py-3 space-y-1'}`} aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={collapsed ? label : undefined}
            aria-current={active === key ? 'page' : undefined}
            className={`
              w-full flex items-center gap-3 ${collapsed ? 'px-2.5 py-2' : 'px-3 py-2.5'} rounded-lg text-sm font-medium transition-all duration-200 text-left
              focus:outline-none focus:ring-2 focus:ring-ghost-500/50 focus:ring-offset-1 focus:ring-offset-slate-900
              ${active === key
                ? 'bg-ghost-600/20 text-ghost-400 shadow-lg'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }
            `}
          >
            <Icon className={`shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Update banner */}
      {update && (update.status === 'available' || update.status === 'downloading' || update.status === 'ready') && (
        <div className={collapsed ? 'mx-1.5 mb-2' : 'mx-2 mb-2'}>
          <button
            onClick={handleUpdateAction}
            disabled={update.status === 'downloading'}
            title={collapsed ? 'Update available' : undefined}
            className={`w-full flex items-center gap-2 rounded-lg text-xs font-medium transition-colors bg-ghost-600/20 text-ghost-400 hover:bg-ghost-600/30 disabled:opacity-60 ${collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2'}`}
          >
            {update.status === 'available' && (
              <>
                <Download className="w-3.5 h-3.5 shrink-0" />
                {!collapsed && `Update ${update.version}`}
              </>
            )}
            {update.status === 'downloading' && (
              <>
                <Download className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                {!collapsed && `${update.percent}%`}
              </>
            )}
            {update.status === 'ready' && (
              <>
                <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                {!collapsed && 'Restart'}
              </>
            )}
          </button>
        </div>
      )}

      {/* User / Plan footer */}
      <div className={`border-t border-slate-800 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {user ? (
          <button
            onClick={() => onChange('account')}
            className={`w-full flex items-center gap-2.5 rounded-lg hover:bg-slate-800 transition-colors ${collapsed ? 'px-1.5 py-2 justify-center' : 'px-2 py-1.5'}`}
          >
            <div className="w-7 h-7 rounded-full bg-ghost-600/20 flex items-center justify-center text-xs font-medium text-ghost-400 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-medium text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${badge.color}`}>
                  {badge.label}
                </span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => onChange('account')}
            className={`w-full flex items-center gap-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ${collapsed ? 'px-2 py-2 justify-center' : 'px-2 py-1.5'}`}
          >
            <User className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign in'}
          </button>
        )}
        {!collapsed && <div className="text-[10px] text-slate-600 mt-1.5 px-2">v0.5.0 Beta</div>}
      </div>
    </aside>
  )
}
