import React, { useState } from 'react'
import { X, Wrench } from 'lucide-react'

interface WorkflowCreateModalProps {
  onClose: () => void
  onCreate: (name: string, description: string) => Promise<void>
}

/**
 * "Build from scratch" workflow creation modal.
 *
 * Phase 1 UX: This is the final step of the `scratch` path in the Guided
 * Entry Point (WorkflowCreationFlow). It creates an empty workflow with
 * just a name and description, which the user then populates manually in
 * the Step Editor.
 */
export function WorkflowCreateModal({ onClose, onCreate }: WorkflowCreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await onCreate(name.trim(), description.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-lg font-semibold text-white">Build from scratch</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Start with an empty workflow and add steps manually
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Workflow name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Login to Facebook"
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ghost-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Give it a clear name so you can find it later
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ghost-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 bg-ghost-600 hover:bg-ghost-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create empty workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
