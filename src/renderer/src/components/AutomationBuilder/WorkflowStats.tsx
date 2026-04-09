import React, { useMemo } from 'react'
import {
  Layers,
  Variable,
  ShieldCheck,
  AlertTriangle,
  History,
  TrendingUp
} from 'lucide-react'
import type { AutomationWorkflow } from '../../types'
import { validateStep } from './stepValidator'

interface WorkflowStatsProps {
  workflow: AutomationWorkflow
  runHistory: any[]
}

/**
 * Compact stats strip at the top of the workflow editor.
 *
 * Shows at-a-glance metrics: step count, variable count, validation health,
 * and success rate across recent runs. Helps the user gauge the workflow's
 * complexity and reliability without scrolling through the full step list.
 */
export function WorkflowStats({ workflow, runHistory }: WorkflowStatsProps) {
  const stats = useMemo(() => {
    const stepCount = workflow.steps.length
    const variableCount = Object.keys(workflow.variables ?? {}).length

    let validCount = 0
    let incompleteCount = 0
    let invalidCount = 0
    for (const step of workflow.steps) {
      const result = validateStep(step)
      if (result.level === 'valid') validCount++
      else if (result.level === 'incomplete') incompleteCount++
      else invalidCount++
    }

    const recentRuns = runHistory.slice(0, 20)
    const totalRuns = recentRuns.length
    const successRuns = recentRuns.filter((r) => r.status === 'completed').length
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null

    return {
      stepCount,
      variableCount,
      validCount,
      incompleteCount,
      invalidCount,
      totalRuns,
      successRate
    }
  }, [workflow.steps, workflow.variables, runHistory])

  const healthColor =
    stats.invalidCount > 0
      ? 'text-red-400'
      : stats.incompleteCount > 0
        ? 'text-amber-400'
        : 'text-green-400'

  const healthIcon = stats.invalidCount > 0 ? AlertTriangle : ShieldCheck
  const HealthIcon = healthIcon

  const successColor =
    stats.successRate === null
      ? 'text-slate-500'
      : stats.successRate >= 80
        ? 'text-green-400'
        : stats.successRate >= 50
          ? 'text-amber-400'
          : 'text-red-400'

  return (
    <div className="mb-4 grid grid-cols-4 gap-2">
      <StatCard
        icon={<Layers className="w-3.5 h-3.5 text-ghost-400" />}
        label="Steps"
        value={String(stats.stepCount)}
        sub={stats.stepCount === 0 ? 'empty' : stats.stepCount < 5 ? 'small' : stats.stepCount < 15 ? 'medium' : 'large'}
      />
      <StatCard
        icon={<Variable className="w-3.5 h-3.5 text-sky-400" />}
        label="Variables"
        value={String(stats.variableCount)}
        sub={stats.variableCount > 0 ? 'parameterised' : 'static'}
      />
      <StatCard
        icon={<HealthIcon className={`w-3.5 h-3.5 ${healthColor}`} />}
        label="Health"
        value={
          stats.invalidCount > 0
            ? `${stats.invalidCount} error${stats.invalidCount === 1 ? '' : 's'}`
            : stats.incompleteCount > 0
              ? `${stats.incompleteCount} warn`
              : 'All valid'
        }
        valueClass={healthColor}
        sub={`${stats.validCount} / ${stats.stepCount || 0} ok`}
      />
      <StatCard
        icon={<TrendingUp className={`w-3.5 h-3.5 ${successColor}`} />}
        label="Success"
        value={stats.successRate === null ? '—' : `${stats.successRate}%`}
        valueClass={successColor}
        sub={
          stats.totalRuns === 0 ? (
            <span className="flex items-center gap-1">
              <History className="w-2.5 h-2.5" />
              no runs
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <History className="w-2.5 h-2.5" />
              {stats.totalRuns} run{stats.totalRuns === 1 ? '' : 's'}
            </span>
          )
        }
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
  sub
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold ${valueClass ?? 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
