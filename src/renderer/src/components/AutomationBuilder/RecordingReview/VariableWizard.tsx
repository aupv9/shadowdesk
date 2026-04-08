import React, { useState } from 'react'
import { Check, X, Edit2, Link, KeyRound, AlignLeft, Hash, Calendar } from 'lucide-react'

interface ExtractedVariable {
  name: string
  value: string
  occurrences: number[]
  type: 'url' | 'text-input' | 'selector-value' | 'credential' | 'numeric' | 'date'
  confidence: number
  autoApply: boolean
}

interface Props {
  variables: ExtractedVariable[]
  accepted: Set<string>
  onAccept: (name: string) => void
  onSkip: (name: string) => void
  onEdit: (name: string, newName: string) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  url: <Link className="w-3 h-3" />,
  credential: <KeyRound className="w-3 h-3" />,
  'text-input': <AlignLeft className="w-3 h-3" />,
  numeric: <Hash className="w-3 h-3" />,
  date: <Calendar className="w-3 h-3" />,
  'selector-value': <AlignLeft className="w-3 h-3" />,
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-red-400',
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.85) return { label: 'high', color: CONFIDENCE_COLOR.high }
  if (c >= 0.65) return { label: 'medium', color: CONFIDENCE_COLOR.medium }
  return { label: 'low', color: CONFIDENCE_COLOR.low }
}

export function VariableWizard({ variables, accepted, onAccept, onSkip, onEdit }: Props) {
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  if (variables.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-2">No variables detected.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700">
            <th className="text-left pb-2 pr-3">Variable</th>
            <th className="text-left pb-2 pr-3">Value</th>
            <th className="text-left pb-2 pr-3">Steps</th>
            <th className="text-left pb-2 pr-3">Type</th>
            <th className="text-left pb-2 pr-3">Confidence</th>
            <th className="text-left pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {variables.map((v) => {
            const isAccepted = accepted.has(v.name)
            const conf = confidenceLabel(v.confidence)
            const isEditing = editingName === v.name

            return (
              <tr key={v.name} className={`transition-colors ${isAccepted ? 'opacity-60' : ''}`}>
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onEdit(v.name, editValue); setEditingName(null) }
                        if (e.key === 'Escape') setEditingName(null)
                      }}
                      className="bg-slate-900 border border-ghost-500 text-ghost-400 font-mono rounded px-2 py-0.5 w-full"
                    />
                  ) : (
                    <code className="text-ghost-400 font-mono">{'{'}{ v.name }{'}'}</code>
                  )}
                </td>
                <td className="py-2 pr-3 max-w-[120px]">
                  <span className="text-slate-300 font-mono truncate block" title={v.value}>
                    {v.type === 'credential' ? '••••••' : v.value.slice(0, 30)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-slate-500">
                  {v.occurrences.map((i) => `#${i + 1}`).join(', ')}
                </td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1 text-slate-400">
                    {TYPE_ICONS[v.type] ?? null}
                    {v.type}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className={conf.color}>{conf.label}</span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1">
                    {isAccepted ? (
                      <span className="text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Applied</span>
                    ) : (
                      <>
                        <button
                          onClick={() => onAccept(v.name)}
                          className="p-1 rounded hover:bg-green-500/10 text-green-400 transition-colors"
                          title="Accept variable"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingName(v.name); setEditValue(v.name) }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
                          title="Rename variable"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSkip(v.name)}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                          title="Skip variable"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
