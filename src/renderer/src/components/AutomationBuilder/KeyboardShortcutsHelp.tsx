import React, { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Workflow',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Create a new workflow' },
      { keys: ['Ctrl', 'K'], description: 'Focus the workflow search box' },
      { keys: ['Ctrl', 'T'], description: 'Browse templates' },
      { keys: ['Ctrl', 'I'], description: 'Import workflow JSON' },
      { keys: ['Ctrl', 'E'], description: 'Export current workflow as JSON' }
    ]
  },
  {
    title: 'Run controls',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: 'Run the selected workflow' },
      { keys: ['Ctrl', '.'], description: 'Stop the current run' }
    ]
  },
  {
    title: 'Step editing',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'A'], description: 'Add a new step at the end' },
      { keys: ['Ctrl', 'Shift', 'E'], description: 'Expand all steps' },
      { keys: ['Ctrl', 'Shift', 'C'], description: 'Collapse all steps' }
    ]
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show this shortcut cheatsheet' },
      { keys: ['Esc'], description: 'Close modal / dismiss dialog' }
    ]
  }
]

/**
 * Keyboard shortcut cheatsheet modal.
 *
 * Rendered when the user presses "?" or clicks the keyboard icon in the
 * header. Lists the shortcuts wired up in the Automation Builder so users
 * can discover them without rummaging through docs.
 */
export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-ghost-400" />
            <h2 className="text-lg font-semibold text-white">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded bg-slate-800/40 border border-slate-700/30"
                  >
                    <span className="text-sm text-slate-300">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && (
                            <span className="text-slate-600 text-xs">+</span>
                          )}
                          <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-900 border border-slate-700 text-slate-200 rounded shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
            Shortcuts are disabled while typing in a text field to avoid
            conflicting with normal editing.
          </p>
        </div>
      </div>
    </div>
  )
}
