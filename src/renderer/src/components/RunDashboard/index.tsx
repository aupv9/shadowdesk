import React, { useState } from 'react'
import { Activity, BarChart3, Calendar, History, Rocket } from 'lucide-react'
import { RunHistoryTab } from './RunHistoryTab'
import { MetricsTab } from './MetricsTab'
import { LiveMonitorTab } from './LiveMonitorTab'
import { BulkExecuteTab } from './BulkExecuteTab'
import { SchedulesTab } from './SchedulesTab'

type Tab = 'live' | 'history' | 'metrics' | 'bulk' | 'schedules'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'live',      label: 'Live Monitor',  icon: Activity },
  { key: 'history',   label: 'Run History',   icon: History },
  { key: 'metrics',   label: 'Metrics',       icon: BarChart3 },
  { key: 'bulk',      label: 'Bulk Execute',  icon: Rocket },
  { key: 'schedules', label: 'Schedules',     icon: Calendar }
]

/**
 * Tier 8 — Run Dashboard
 *
 * Surfaces the existing automation backend (run history, metrics, scheduler,
 * bulk execution, live progress) as a single navigable section. All data is
 * fetched on-demand from existing IPC channels — no new main-process work
 * required for the UI shell itself.
 */
export function RunDashboard() {
  const [tab, setTab] = useState<Tab>('live')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-ghost-400" />
          <h1 className="text-lg font-semibold text-white">Run Dashboard</h1>
          <span className="text-xs text-slate-500">automation observability &amp; control</span>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === key
                ? 'bg-ghost-600/20 text-ghost-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'live'      && <LiveMonitorTab />}
        {tab === 'history'   && <RunHistoryTab />}
        {tab === 'metrics'   && <MetricsTab />}
        {tab === 'bulk'      && <BulkExecuteTab />}
        {tab === 'schedules' && <SchedulesTab />}
      </div>
    </div>
  )
}
