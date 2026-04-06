import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Globe,
  MousePointer,
  Type,
  Clock,
  Search,
  Camera,
  FileText,
  ArrowDownToLine,
  List,
  Keyboard,
  Code,
  GitBranch,
  Repeat,
  Hand,
  MousePointerClick,
  PenTool,
  Send
} from 'lucide-react'
import type { AutomationStep, AutomationActionType } from '../../types'

const ACTION_META: Record<AutomationActionType, { icon: React.ElementType; label: string; color: string }> = {
  navigate:        { icon: Globe,              label: 'Navigate',         color: 'text-blue-400' },
  click:           { icon: MousePointer,       label: 'Click',            color: 'text-green-400' },
  type:            { icon: Type,               label: 'Type Text',        color: 'text-purple-400' },
  wait:            { icon: Clock,              label: 'Wait',             color: 'text-yellow-400' },
  waitForSelector: { icon: Search,             label: 'Wait for Element', color: 'text-orange-400' },
  screenshot:      { icon: Camera,             label: 'Screenshot',       color: 'text-pink-400' },
  extractText:     { icon: FileText,           label: 'Extract Text',     color: 'text-cyan-400' },
  scroll:          { icon: ArrowDownToLine,    label: 'Scroll',           color: 'text-indigo-400' },
  select:          { icon: List,               label: 'Select Option',    color: 'text-teal-400' },
  keyPress:        { icon: Keyboard,           label: 'Key Press',        color: 'text-amber-400' },
  evaluate:        { icon: Code,               label: 'Run Script',       color: 'text-red-400' },
  conditional:     { icon: GitBranch,          label: 'Conditional',      color: 'text-emerald-400' },
  loop:            { icon: Repeat,             label: 'Loop',             color: 'text-violet-400' },
  hover:           { icon: Hand,               label: 'Hover',            color: 'text-sky-400' },
  rightClick:      { icon: MousePointerClick,  label: 'Right Click',      color: 'text-rose-400' },
  setAttribute:    { icon: PenTool,            label: 'Set Attribute',    color: 'text-lime-400' },
  httpRequest:     { icon: Send,               label: 'HTTP Request',     color: 'text-fuchsia-400' }
}

const ALL_ACTIONS: AutomationActionType[] = [
  'navigate', 'click', 'type', 'wait', 'waitForSelector',
  'screenshot', 'extractText', 'scroll', 'select', 'keyPress', 'evaluate',
  'hover', 'rightClick', 'setAttribute', 'httpRequest',
  'conditional', 'loop'
]

interface StepEditorProps {
  step: AutomationStep
  index: number
  total: number
  onUpdate: (updates: Partial<AutomationStep>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (direction: 'up' | 'down') => void
}

function getDefaultParams(action: AutomationActionType): Record<string, any> {
  switch (action) {
    case 'navigate': return { url: 'https://example.com', waitUntil: 'networkidle2' }
    case 'click': return { selector: '' }
    case 'type': return { selector: '', text: '', delay: 50 }
    case 'wait': return { ms: 1000 }
    case 'waitForSelector': return { selector: '', visible: true, timeout: 30000 }
    case 'screenshot': return { fullPage: false }
    case 'extractText': return { selector: 'body' }
    case 'scroll': return { y: 500 }
    case 'select': return { selector: '', value: '' }
    case 'keyPress': return { key: 'Enter' }
    case 'evaluate': return { script: '// your code here' }
    case 'hover': return { selector: '' }
    case 'rightClick': return { selector: '' }
    case 'setAttribute': return { selector: '', attribute: '', value: '' }
    case 'httpRequest': return { url: 'https://api.example.com', method: 'GET', headers: {}, body: '' }
    case 'conditional': return { selector: '', thenSteps: [], elseSteps: [] }
    case 'loop': return { times: 3, steps: [] }
    default: return {}
  }
}

export function StepEditor({ step, index, total, onUpdate, onDelete, onDuplicate, onMove }: StepEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = ACTION_META[step.action]

  const handleActionChange = (action: AutomationActionType) => {
    onUpdate({ action, params: getDefaultParams(action), label: ACTION_META[action].label })
  }

  const handleParamChange = (key: string, value: any) => {
    onUpdate({ params: { ...step.params, [key]: value } })
  }

  const Icon = meta.icon

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Step header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-mono text-slate-600 w-5 text-right">{index + 1}</span>
        <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
        <span className="text-sm font-medium text-white flex-1">
          {step.label || meta.label}
        </span>
        <span className="text-xs text-slate-500">{meta.label}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </div>

      {/* Step body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50">
          {/* Actions row */}
          <div className="flex items-center gap-1 mt-3 mb-4">
            <button onClick={() => onMove('up')} disabled={index === 0}
              className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 rounded transition-colors">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onMove('down')} disabled={index === total - 1}
              className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 rounded transition-colors">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDuplicate}
              className="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1" />
            <button onClick={onDelete}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Label */}
          <div className="mb-3">
            <label className="text-xs text-slate-500 mb-1 block">Label</label>
            <input
              type="text"
              value={step.label ?? ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Step label"
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            />
          </div>

          {/* Action type */}
          <div className="mb-3">
            <label className="text-xs text-slate-500 mb-1 block">Action</label>
            <select
              value={step.action}
              onChange={(e) => handleActionChange(e.target.value as AutomationActionType)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_META[a].label}</option>
              ))}
            </select>
          </div>

          {/* Action-specific params */}
          <ParamEditor action={step.action} params={step.params} onChange={handleParamChange} />
        </div>
      )}
    </div>
  )
}

function ParamEditor({
  action,
  params,
  onChange
}: {
  action: AutomationActionType
  params: Record<string, any>
  onChange: (key: string, value: any) => void
}) {
  const field = (key: string, label: string, type: 'text' | 'number' | 'checkbox' | 'textarea' = 'text') => (
    <div className="mb-2" key={key}>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      {type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={params[key] ?? false}
            onChange={(e) => onChange(key, e.target.checked)}
            className="rounded border-slate-600 bg-slate-700"
          />
          {label}
        </label>
      ) : type === 'textarea' ? (
        <textarea
          value={params[key] ?? ''}
          onChange={(e) => onChange(key, e.target.value)}
          rows={4}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500 font-mono text-xs"
        />
      ) : (
        <input
          type={type}
          value={params[key] ?? ''}
          onChange={(e) => onChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
        />
      )}
    </div>
  )

  switch (action) {
    case 'navigate':
      return <>{field('url', 'URL')}{field('timeout', 'Timeout (ms)', 'number')}</>
    case 'click':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}</>
    case 'type':
      return <>{field('selector', 'CSS Selector')}{field('text', 'Text to type')}{field('delay', 'Delay per key (ms)', 'number')}{field('clear', 'Clear field first', 'checkbox')}</>
    case 'wait':
      return <>{field('ms', 'Wait time (ms)', 'number')}</>
    case 'waitForSelector':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}{field('visible', 'Must be visible', 'checkbox')}</>
    case 'screenshot':
      return <>{field('fullPage', 'Full page', 'checkbox')}</>
    case 'extractText':
      return <>{field('selector', 'CSS Selector')}</>
    case 'scroll':
      return <>{field('x', 'Horizontal (px)', 'number')}{field('y', 'Vertical (px)', 'number')}</>
    case 'select':
      return <>{field('selector', 'CSS Selector')}{field('value', 'Option value')}</>
    case 'keyPress':
      return <>{field('key', 'Key (e.g. Enter, Tab, Escape)')}</>
    case 'evaluate':
      return <>{field('script', 'JavaScript code', 'textarea')}</>
    case 'hover':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}</>
    case 'rightClick':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}</>
    case 'setAttribute':
      return <>{field('selector', 'CSS Selector')}{field('attribute', 'Attribute name')}{field('value', 'Attribute value')}</>
    case 'httpRequest':
      return (
        <>
          {field('url', 'URL')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Method</label>
            <select
              value={params.method ?? 'GET'}
              onChange={(e) => onChange('method', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {field('body', 'Request body (JSON)', 'textarea')}
        </>
      )
    case 'conditional':
      return (
        <>
          {field('selector', 'Condition CSS Selector')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            If the selector exists on the page, the "then" branch runs; otherwise the "else" branch runs.
            Configure branch steps in the workflow JSON.
          </div>
        </>
      )
    case 'loop':
      return (
        <>
          {field('times', 'Number of iterations', 'number')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Loop steps are configured as nested steps within this action.
            Use templates or JSON edit to define loop body.
          </div>
        </>
      )
    default:
      return <div className="text-xs text-slate-500">No parameters</div>
  }
}
