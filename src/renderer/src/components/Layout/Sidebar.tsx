import React, { useEffect, useMemo, useState } from 'react'
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
  ChevronLeft,
  ChevronDown,
  FileUp,
  Smartphone,
  BarChart3,
  CreditCard,
  LifeBuoy,
  HardDrive
} from 'lucide-react'
import type { NavSection } from '../../types'
import type { User as UserType, LicensePlan } from '../../types'
import { isSectionEnabled } from '../../../../shared/features'

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

interface NavItem {
  key: NavSection
  icon: React.ElementType
  label: string
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

// Grouped navigation — reduces cognitive load from 16 flat items down to 4 logical sections
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    items: [
      { key: 'profiles',       icon: LayoutGrid, label: 'Profiles' },
      { key: 'import-history', icon: FileUp,     label: 'Import History' },
      { key: 'proxies',        icon: Globe,      label: 'Proxies' }
    ]
  },
  {
    key: 'stealth',
    label: 'Stealth',
    items: [
      { key: 'fingerprint', icon: Fingerprint, label: 'Fingerprint' },
      { key: 'behavior',    icon: Sliders,     label: 'Behavior' },
      { key: 'patches',     icon: Cpu,         label: 'Patches' },
      { key: 'detection',   icon: Shield,      label: 'Detection' },
      { key: 'correlation', icon: Radar,       label: 'Correlation' }
    ]
  },
  {
    key: 'automate',
    label: 'Automate',
    items: [
      { key: 'automation',       icon: Bot,        label: 'Automation' },
      { key: 'mobile-workflows', icon: Smartphone, label: 'Mobile Workflows' },
      { key: 'mobile-devices',   icon: Smartphone, label: 'Mobile Devices' },
      { key: 'runs',             icon: Activity,   label: 'Runs' },
      { key: 'ai',               icon: Sparkles,   label: 'AI Assistant' },
      { key: 'smart-warmup',     icon: Flame,      label: 'Warm-Up' }
    ]
  },
  {
    key: 'grow',
    label: 'Grow',
    items: [
      { key: 'sea-platforms', icon: MapPin, label: 'SEA Platforms' },
      { key: 'marketplace',   icon: Store,  label: 'Marketplace' }
    ]
  },
  {
    key: 'business',
    label: 'Business',
    items: [
      { key: 'analytics', icon: BarChart3,  label: 'Analytics' },
      { key: 'billing',   icon: CreditCard, label: 'Billing' },
      { key: 'support',   icon: LifeBuoy,   label: 'Support' }
    ]
  }
]

const FOOTER_ITEMS: NavItem[] = [
  { key: 'team',     icon: Users,    label: 'Team' },
  { key: 'settings', icon: Settings, label: 'Settings' }
]

// Sections whose backend isn't deployed yet are compiled out of the nav rather
// than shown as dead buttons — see src/shared/features.ts.
const VISIBLE_NAV_GROUPS: NavGroup[] = NAV_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((i) => isSectionEnabled(i.key)) }))
  .filter((g) => g.items.length > 0)

const VISIBLE_FOOTER_ITEMS: NavItem[] = FOOTER_ITEMS.filter((i) => isSectionEnabled(i.key))

const ACCOUNT_ENABLED = isSectionEnabled('account')

const SIDEBAR_COLLAPSED_KEY = 'sidebar:collapsed'
const SIDEBAR_GROUPS_KEY = 'sidebar:groups'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Default: all groups expanded
  return Object.fromEntries(VISIBLE_NAV_GROUPS.map((g) => [g.key, true]))
}

export function Sidebar({ active, onChange, profileCount, activeSessionCount, user, plan = 'free' }: SidebarProps) {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed())
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => loadGroupState())

  useEffect(() => {
    const cleanup = window.api.updater.onStatus(setUpdate)
    return cleanup
  }, [])

  // Persist sidebar collapsed state
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  // Persist group expansion state
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(groupOpen)) } catch {}
  }, [groupOpen])

  // Auto-expand the group that contains the active section
  const activeGroupKey = useMemo(() => {
    return VISIBLE_NAV_GROUPS.find((g) => g.items.some((i) => i.key === active))?.key
  }, [active])

  useEffect(() => {
    if (activeGroupKey && !groupOpen[activeGroupKey]) {
      setGroupOpen((s) => ({ ...s, [activeGroupKey]: true }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupKey])

  const handleUpdateAction = () => {
    if (!update) return
    if (update.status === 'available') window.api.updater.download()
    if (update.status === 'ready') window.api.updater.install()
  }

  const toggleGroup = (key: string) => {
    setGroupOpen((s) => ({ ...s, [key]: !s[key] }))
  }

  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.free

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const isActive = active === item.key
    return (
      <button
        key={item.key}
        onClick={() => onChange(item.key)}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`
          group relative w-full flex items-center gap-3 ${collapsed ? 'px-2.5 py-2 justify-center' : 'px-3 py-2'} rounded-lg text-sm font-medium transition-all duration-150 text-left
          focus:outline-none focus:ring-2 focus:ring-ghost-500/50 focus:ring-offset-1 focus:ring-offset-slate-900
          ${isActive
            ? 'bg-ghost-600/20 text-ghost-400'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
          }
        `}
      >
        {/* Active indicator bar */}
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-ghost-400" />
        )}
        <Icon className={`shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    )
  }

  return (
    <aside className={`flex flex-col min-h-screen bg-slate-900 border-r border-slate-800 select-none transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-ghost-600 flex items-center justify-center shrink-0">
            <Ghost className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm leading-none truncate">ShadowDesk</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">Anti-Detect</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 px-3 py-3 border-b border-slate-800">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center hover:bg-slate-800 transition-colors">
            <div className="text-lg font-bold text-white">{profileCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Profiles</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center hover:bg-slate-800 transition-colors">
            <div className="text-lg font-bold text-green-400">{activeSessionCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Active</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav
        className={`flex-1 overflow-y-auto ${collapsed ? 'px-1.5 py-3' : 'px-2 py-3'}`}
        aria-label="Main navigation"
      >
        {VISIBLE_NAV_GROUPS.map((group, gIdx) => {
          const isOpen = collapsed ? true : groupOpen[group.key] !== false
          return (
            <div key={group.key} className={gIdx > 0 ? (collapsed ? 'mt-2 pt-2 border-t border-slate-800/60' : 'mt-3') : ''}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>
              )}
              {isOpen && (
                <div className={`space-y-0.5 ${collapsed ? '' : 'mt-1'}`}>
                  {group.items.map(renderNavItem)}
                </div>
              )}
            </div>
          )
        })}

        {/* Footer items (Team, Settings) — separated from main groups */}
        <div className={collapsed ? 'mt-2 pt-2 border-t border-slate-800/60 space-y-0.5' : 'mt-4 pt-3 border-t border-slate-800/60 space-y-0.5'}>
          {VISIBLE_FOOTER_ITEMS.map(renderNavItem)}
        </div>
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
        {!ACCOUNT_ENABLED ? (
          // Desktop-only build: no sign-in, no plan gating — say so plainly
          // instead of leaving a button that opens an unreachable backend.
          !collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-slate-500">
              <HardDrive className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-400 leading-none">Local workspace</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Unlimited profiles</div>
              </div>
            </div>
          )
        ) : user ? (
          <button
            onClick={() => onChange('account')}
            title={collapsed ? `${user.name} — ${badge.label}` : undefined}
            aria-current={active === 'account' ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 rounded-lg hover:bg-slate-800 transition-colors ${collapsed ? 'px-1.5 py-2 justify-center' : 'px-2 py-1.5'} ${active === 'account' ? 'bg-slate-800' : ''}`}
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
            title={collapsed ? 'Sign in' : undefined}
            className={`w-full flex items-center gap-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ${collapsed ? 'px-2 py-2 justify-center' : 'px-2 py-1.5'}`}
          >
            <User className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign in'}
          </button>
        )}
        {!collapsed && (
          <div className="flex items-center justify-between mt-1.5 px-2">
            <div className="text-[10px] text-slate-600">v{__APP_VERSION__}</div>
          </div>
        )}
        {/* Expand button when collapsed — moved here so it's reachable in collapsed mode */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full mt-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors flex items-center justify-center"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </aside>
  )
}
