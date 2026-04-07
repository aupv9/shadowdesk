import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Variable, Info } from 'lucide-react'
import type { AutomationWorkflow } from '../../types'

interface Props {
  workflow: AutomationWorkflow
  onSave: (variables: Record<string, string>) => Promise<void> | void
}

interface Row {
  key: string
  value: string
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Phase 12.B.4 — Workflow variables editor.
 *
 * Variables are referenced in step params via `{key}` placeholders. The
 * automation engine interpolates them at run time, merging stored variables
 * with any per-run overrides. This editor saves the workflow-level defaults.
 *
 * Keys must be valid identifiers ([A-Za-z_][A-Za-z0-9_]*) so the placeholder
 * regex in [automation.ts](src/main/automation.ts#L21) matches them.
 */
export function VariablesEditor({ workflow, onSave }: Props) {
  const initialRows = useMemo<Row[]>(
    () => Object.entries(workflow.variables ?? {}).map(([key, value]) => ({ key, value })),
    [workflow.id, workflow.variables]
  )

  const [rows, setRows] = useState<Row[]>(initialRows)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Reset rows when switching workflows
  useEffect(() => {
    setRows(initialRows)
    setError(null)
    setSavedAt(null)
  }, [workflow.id])

  // Detect placeholders that are referenced in steps but not yet defined
  const referenced = useMemo(() => {
    const keys = new Set<string>()
    const stepsJson = JSON.stringify(workflow.steps)
    for (const m of stepsJson.matchAll(/\{(\w+)\}/g)) keys.add(m[1])
    return keys
  }, [workflow.steps])

  const definedKeys = new Set(rows.map((r) => r.key).filter(Boolean))
  const undefinedRefs = Array.from(referenced).filter((k) => !definedKeys.has(k))

  const addRow = () => setRows((r) => [...r, { key: '', value: '' }])
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx))
  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)))

  const dirty = useMemo(() => {
    if (rows.length !== initialRows.length) return true
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].key !== initialRows[i].key) return true
      if (rows[i].value !== initialRows[i].value) return true
    }
    return false
  }, [rows, initialRows])

  const handleSave = async () => {
    // Validate
    const seen = new Set<string>()
    for (const r of rows) {
      const k = r.key.trim()
      if (!k) continue
      if (!KEY_RE.test(k)) {
        setError(`Invalid key "${k}" — must start with a letter or underscore and contain only letters, digits, underscores`)
        return
      }
      if (seen.has(k)) {
        setError(`Duplicate key "${k}"`)
        return
      }
      seen.add(k)
    }
    setError(null)
    setSaving(true)
    try {
      const variables: Record<string, string> = {}
      for (const r of rows) {
        const k = r.key.trim()
        if (!k) continue
        variables[k] = r.value
      }
      await onSave(variables)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 1500)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save variables')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Variable className="w-4 h-4 text-ghost-400" />
          <h3 className="text-sm font-semibold text-white">Variables</h3>
          <span className="text-xs text-slate-500">
            referenced as <code className="px-1 py-0.5 rounded bg-slate-700 text-slate-300">{'{key}'}</code> inside step params
          </span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-green-400">Saved</span>}
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {undefinedRefs.length > 0 && (
        <div className="flex items-start gap-2 mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Steps reference {undefinedRefs.length} undefined variable
            {undefinedRefs.length !== 1 ? 's' : ''}:{' '}
            {undefinedRefs.map((k) => (
              <code key={k} className="px-1 py-0.5 mx-0.5 rounded bg-yellow-500/20">{k}</code>
            ))}
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded">
          No variables defined. Click <span className="text-slate-300">Add</span> to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={row.key}
                onChange={(e) => updateRow(idx, { key: e.target.value })}
                placeholder="key"
                className="w-40 bg-slate-900/60 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-ghost-500"
              />
              <span className="text-slate-600">=</span>
              <input
                value={row.value}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
                placeholder="value"
                className="flex-1 bg-slate-900/60 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-ghost-500"
              />
              <button
                onClick={() => removeRow(idx)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {dirty && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-ghost-600 hover:bg-ghost-700 disabled:opacity-50 text-white rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save variables'}
          </button>
        </div>
      )}
    </div>
  )
}
