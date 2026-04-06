import React, { useEffect, useState } from 'react'
import { X, Layers, FileCode, Globe, ShoppingCart, Users, TestTube, Cog } from 'lucide-react'
import type { WorkflowTemplate } from '../../types'

const CATEGORY_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  scraping:   { icon: Globe,        label: 'Scraping',    color: 'text-blue-400' },
  testing:    { icon: TestTube,     label: 'Testing',     color: 'text-green-400' },
  social:     { icon: Users,        label: 'Social',      color: 'text-purple-400' },
  ecommerce:  { icon: ShoppingCart, label: 'E-Commerce',  color: 'text-amber-400' },
  general:    { icon: Cog,          label: 'General',     color: 'text-slate-400' }
}

interface TemplatePickerModalProps {
  onClose: () => void
  onCreated: (workflow: any) => void
}

export function TemplatePickerModal({ onClose, onCreated }: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    window.api.templates.list().then((tpls) => {
      setTemplates(tpls)
      setLoading(false)
    })
  }, [])

  const handleUse = async (tpl: WorkflowTemplate) => {
    setCreating(tpl.id)
    try {
      const workflow = await window.api.templates.createFromTemplate(tpl.id)
      onCreated(workflow)
    } catch (err: any) {
      console.error('Failed to create from template:', err)
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-ghost-400" />
            <h2 className="text-lg font-semibold text-white">Workflow Templates</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-sm text-slate-500 text-center py-8">Loading templates...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {templates.map((tpl) => {
                const cat = CATEGORY_META[tpl.category] ?? CATEGORY_META.general
                const CatIcon = cat.icon
                return (
                  <div
                    key={tpl.id}
                    className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-4 hover:border-ghost-500/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${cat.color}`}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white">{tpl.name}</h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-slate-600 ${cat.color}`}>
                            {cat.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{tpl.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {tpl.steps.length} step{tpl.steps.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUse(tpl)}
                        disabled={creating === tpl.id}
                        className="px-3 py-1.5 bg-ghost-600 hover:bg-ghost-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                      >
                        {creating === tpl.id ? 'Creating...' : 'Use Template'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
