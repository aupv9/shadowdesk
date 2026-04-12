import React, { useEffect, useState, useCallback } from 'react'
import {
  FlaskConical,
  Play,
  Square,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Brain,
  Link2,
  Wifi,
  WifiOff,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Plus
} from 'lucide-react'
import { Header } from '../Layout/Header'
import { useBatchTestStore } from '../../stores/batchTestStore'
import { useProfileStore } from '../../stores/profileStore'
import type {
  BatchTestRun,
  NetworkCondition,
  CrossProfileSyncGroup
} from '../../types'

/**
 * Phase 19 — Batch Testing + ML Optimization Dashboard
 *
 * Four tabs:
 *   1. Batch Tests — Create, monitor, and review batch detection test runs
 *   2. ML Optimizer — View gesture optimization recommendations
 *   3. Profile Sync — Manage cross-profile behavior sync groups
 *   4. Network Sim — Apply network condition presets to profiles
 */

type Tab = 'batch' | 'ml' | 'sync' | 'network'

const TAB_ITEMS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'batch',   label: 'Batch Tests', icon: FlaskConical },
  { key: 'ml',      label: 'ML Optimizer', icon: Brain },
  { key: 'sync',    label: 'Profile Sync', icon: Link2 },
  { key: 'network', label: 'Network Sim',  icon: Wifi }
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

const STATUS_STYLE: Record<string, string> = {
  queued:    'bg-slate-700 text-slate-300',
  running:   'bg-blue-900/40 text-blue-300',
  completed: 'bg-green-900/40 text-green-300',
  failed:    'bg-red-900/40 text-red-300',
  cancelled: 'bg-amber-900/40 text-amber-300'
}

export function BatchTestDashboard() {
  const [tab, setTab] = useState<Tab>('batch')

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Batch Testing & ML"
        subtitle="Phase 19 — Batch detection, ML optimization, profile sync, network simulation"
      />

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-slate-700/50">
        {TAB_ITEMS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-800 text-white border border-b-0 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'batch'   && <BatchTestTab />}
        {tab === 'ml'      && <MLOptimizerTab />}
        {tab === 'sync'    && <ProfileSyncTab />}
        {tab === 'network' && <NetworkSimTab />}
      </div>
    </div>
  )
}

// ── Batch Test Tab ───────────────────────────────────────────────────────────

function BatchTestTab() {
  const { batches, fetchBatches, createBatch, cancelBatch, deleteBatch, refreshBatch, loading } = useBatchTestStore()
  const { profiles, fetchProfiles } = useProfileStore()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchBatches()
    fetchProfiles()
  }, [])

  // Poll running batches
  useEffect(() => {
    const running = batches.filter((b) => b.status === 'running' || b.status === 'queued')
    if (running.length === 0) return
    const timer = setInterval(() => {
      running.forEach((b) => refreshBatch(b.id))
    }, 3000)
    return () => clearInterval(timer)
  }, [batches])

  const handleCreate = useCallback(async () => {
    if (selectedIds.length === 0) return
    await createBatch(name || 'Batch Test', selectedIds, 'detection')
    setShowCreate(false)
    setName('')
    setSelectedIds([])
  }, [name, selectedIds, createBatch])

  const toggleProfile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Batch Detection Tests</h3>
        <div className="flex gap-2">
          <button
            onClick={() => fetchBatches()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
          >
            <Plus size={14} /> New Batch
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Batch name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500"
          />
          <div className="text-sm text-slate-400 mb-1">
            Select profiles ({selectedIds.length} selected):
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-900/50 rounded p-2">
            {profiles.length === 0 && (
              <p className="text-sm text-slate-500">No profiles found</p>
            )}
            <button
              onClick={() => setSelectedIds(
                selectedIds.length === profiles.length ? [] : profiles.map((p) => p.id)
              )}
              className="text-xs text-indigo-400 hover:text-indigo-300 mb-1"
            >
              {selectedIds.length === profiles.length ? 'Deselect all' : 'Select all'}
            </button>
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleProfile(p.id)}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-200">{p.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Batch Test
            </button>
          </div>
        </div>
      )}

      {/* Batch list */}
      {loading && batches.length === 0 && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={16} /> Loading...
        </div>
      )}

      {!loading && batches.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FlaskConical size={48} className="mx-auto mb-3 opacity-50" />
          <p>No batch tests yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            expanded={expandedId === batch.id}
            onToggle={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
            onCancel={() => cancelBatch(batch.id)}
            onDelete={() => deleteBatch(batch.id)}
          />
        ))}
      </div>
    </div>
  )
}

function BatchCard({
  batch,
  expanded,
  onToggle,
  onCancel,
  onDelete
}: {
  batch: BatchTestRun
  expanded: boolean
  onToggle: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const pct = batch.total_profiles > 0
    ? Math.round((batch.completed_count / batch.total_profiles) * 100)
    : 0
  const isRunning = batch.status === 'running' || batch.status === 'queued'
  const summary = batch.results_summary

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800" onClick={onToggle}>
        {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{batch.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[batch.status] || 'bg-slate-700 text-slate-400'}`}>
              {batch.status}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {batch.completed_count}/{batch.total_profiles} profiles
            {batch.avg_score > 0 && ` · avg ${batch.avg_score}%`}
            {' · '}{formatDate(batch.started_at)}
          </div>
        </div>

        {/* Progress bar for running */}
        {isRunning && (
          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Score badge */}
        {batch.status === 'completed' && batch.avg_score > 0 && (
          <div className={`text-sm font-mono font-bold ${
            batch.avg_score >= 90 ? 'text-green-400' : batch.avg_score >= 70 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {batch.avg_score}%
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {isRunning && (
            <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-amber-400" title="Cancel">
              <Square size={14} />
            </button>
          )}
          {!isRunning && (
            <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-400" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && summary && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatBox icon={CheckCircle2} label="Passed" value={summary.passedCount} color="text-green-400" />
            <StatBox icon={AlertTriangle} label="Warning" value={summary.warningCount} color="text-amber-400" />
            <StatBox icon={XCircle} label="Failed" value={summary.failedCount} color="text-red-400" />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-slate-900/50 rounded p-2 text-center">
              <div className="text-xs text-slate-500">Min Score</div>
              <div className="text-sm font-mono text-white">{summary.minScore}%</div>
            </div>
            <div className="bg-slate-900/50 rounded p-2 text-center">
              <div className="text-xs text-slate-500">Avg Score</div>
              <div className="text-sm font-mono text-white">{summary.avgScore}%</div>
            </div>
            <div className="bg-slate-900/50 rounded p-2 text-center">
              <div className="text-xs text-slate-500">Max Score</div>
              <div className="text-sm font-mono text-white">{summary.maxScore}%</div>
            </div>
          </div>

          {summary.topFailingVectors.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Top Failing Vectors:</div>
              <div className="flex flex-wrap gap-1">
                {summary.topFailingVectors.map((v) => (
                  <span key={v} className="text-xs px-2 py-0.5 bg-red-900/30 text-red-300 rounded">
                    {v} ({Math.round((summary.vectorFailRates[v] || 0) * 100)}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatBox({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-slate-900/50 rounded p-2 flex items-center gap-2">
      <Icon size={16} className={color} />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-sm font-bold ${color}`}>{value}</div>
      </div>
    </div>
  )
}

// ── ML Optimizer Tab ─────────────────────────────────────────────────────────

function MLOptimizerTab() {
  const { optimizationResults, mlStats, runOptimization, fetchMLStats, loading } = useBatchTestStore()

  useEffect(() => {
    fetchMLStats()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">ML Gesture Optimizer</h3>
        <button
          onClick={() => runOptimization()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          Run Optimization
        </button>
      </div>

      {/* Stats */}
      {mlStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Training Data Points</div>
            <div className="text-xl font-bold text-white">{mlStats.trainingDataPoints}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Last Trained</div>
            <div className="text-sm text-white">{formatDate(mlStats.lastTrainedAt)}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Prediction Accuracy</div>
            <div className="text-xl font-bold text-white">{Math.round(mlStats.avgPredictionAccuracy * 100)}%</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Feature Count</div>
            <div className="text-xl font-bold text-white">{Object.keys(mlStats.featureImportance).length}</div>
          </div>
        </div>
      )}

      {/* Feature importance */}
      {mlStats && Object.keys(mlStats.featureImportance).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Feature Importance</h4>
          <div className="space-y-2">
            {Object.entries(mlStats.featureImportance)
              .sort(([, a], [, b]) => b - a)
              .map(([feat, importance]) => (
                <div key={feat} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-40 truncate">{feat}</span>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.round(importance * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-12 text-right">
                    {(importance * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Optimization results */}
      {optimizationResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Optimization Results</h4>
          {optimizationResults.map((result) => (
            <div key={result.profileId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Profile: {result.profileId.slice(0, 8)}...</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Current: {result.currentScore}%</span>
                  <span className="text-xs text-green-400">Predicted: {result.predictedScore}%</span>
                </div>
              </div>
              {result.recommendations.map((rec) => (
                <div key={rec.id} className="ml-2 mt-1 text-xs">
                  <span className="text-amber-400">{rec.vector_name}</span>
                  <span className="text-slate-400"> — {rec.fix}</span>
                  <span className="text-slate-500 ml-1">({Math.round(rec.confidence * 100)}% confidence)</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {optimizationResults.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-500">
          <Brain size={48} className="mx-auto mb-3 opacity-50" />
          <p>Run optimization to generate gesture recommendations.</p>
          <p className="text-xs mt-1">Requires detection test data from batch tests.</p>
        </div>
      )}
    </div>
  )
}

// ── Profile Sync Tab ─────────────────────────────────────────────────────────

function ProfileSyncTab() {
  const { syncGroups, fetchSyncGroups, createSyncGroup, syncGroup, deleteSyncGroup } = useBatchTestStore()
  const { profiles, fetchProfiles } = useProfileStore()
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [strategy, setStrategy] = useState<string>('detection_share')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    fetchSyncGroups()
    fetchProfiles()
  }, [])

  const handleCreate = async () => {
    if (selectedIds.length < 2) return
    await createSyncGroup(groupName || 'Sync Group', selectedIds, strategy)
    setShowCreate(false)
    setGroupName('')
    setSelectedIds([])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Cross-Profile Sync</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded"
        >
          <Plus size={14} /> New Group
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500"
          />
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
          >
            <option value="detection_share">Detection Insight Sharing</option>
            <option value="behavior_mirror">Behavior Mirroring</option>
            <option value="cookie_share">Cookie Sharing</option>
          </select>
          <div className="text-sm text-slate-400">Select profiles (min 2):</div>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-900/50 rounded p-2">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => setSelectedIds((prev) =>
                    prev.includes(p.id) ? prev.filter((i) => i !== p.id) : [...prev, p.id]
                  )}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-200">{p.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-slate-400">Cancel</button>
            <button onClick={handleCreate} disabled={selectedIds.length < 2} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded disabled:opacity-50">
              Create Group
            </button>
          </div>
        </div>
      )}

      {syncGroups.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Link2 size={48} className="mx-auto mb-3 opacity-50" />
          <p>No sync groups yet. Create one to share behavior across profiles.</p>
        </div>
      )}

      <div className="space-y-2">
        {syncGroups.map((group) => (
          <div key={group.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-white">{group.name}</span>
                <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                  {group.strategy.replace('_', ' ')}
                </span>
                {!group.enabled && (
                  <span className="ml-1 text-xs px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded">disabled</span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (group.profile_ids.length > 0) syncGroup(group.id, group.profile_ids[0])
                  }}
                  className="p-1.5 text-slate-400 hover:text-green-400"
                  title="Sync now"
                >
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => deleteSyncGroup(group.id)} className="p-1.5 text-slate-400 hover:text-red-400" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {group.profile_ids.length} profiles · Last synced: {formatDate(group.last_synced_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Network Sim Tab ──────────────────────────────────────────────────────────

function NetworkSimTab() {
  const {
    networkPresets, activeSimulations,
    fetchNetworkPresets, fetchActiveSimulations,
    applyNetwork, clearNetwork
  } = useBatchTestStore()
  const { profiles, fetchProfiles } = useProfileStore()
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')

  useEffect(() => {
    fetchNetworkPresets()
    fetchActiveSimulations()
    fetchProfiles()
  }, [])

  const handleApply = async () => {
    if (!selectedProfile || !selectedPreset) return
    await applyNetwork(selectedProfile, selectedPreset)
    setSelectedProfile('')
    setSelectedPreset('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Network Condition Simulation</h3>
      </div>

      {/* Apply form */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Profile</label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
            >
              <option value="">Select profile...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Network Condition</label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white"
            >
              <option value="">Select preset...</option>
              {networkPresets.map((p) => (
                <option key={p.preset} value={p.preset}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleApply}
          disabled={!selectedProfile || !selectedPreset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
        >
          <Wifi size={14} /> Apply
        </button>
      </div>

      {/* Presets grid */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Available Presets</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {networkPresets.filter((p) => p.preset !== 'custom').map((p) => (
            <div key={p.preset} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
              <div className="text-sm font-medium text-white">{p.label}</div>
              <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                <div>Latency: {p.latency}ms</div>
                <div>Down: {(p.downloadThroughput / 125_000).toFixed(1)} Mbps</div>
                <div>Packet loss: {p.packetLoss}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active simulations */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">
          Active Simulations ({activeSimulations.length})
        </h4>
        {activeSimulations.length === 0 ? (
          <p className="text-sm text-slate-500">No active network simulations.</p>
        ) : (
          <div className="space-y-2">
            {activeSimulations.map((sim) => (
              <div key={sim.profileId} className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
                <div>
                  <span className="text-sm text-white">{sim.profileId.slice(0, 8)}...</span>
                  <span className="ml-2 text-xs text-indigo-400">{sim.condition.label}</span>
                </div>
                <button
                  onClick={() => clearNetwork(sim.profileId)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-red-400"
                >
                  <WifiOff size={12} /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
