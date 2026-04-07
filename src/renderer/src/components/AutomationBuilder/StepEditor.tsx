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
  Send,
  Upload,
  Download,
  ShieldCheck,
  KeyRound,
  Lock,
  Navigation,
  RefreshCw,
  Workflow,
  Layers,
  CornerDownRight,
  ShieldOff,
  Cookie,
  CheckCircle,
  Plus,
  ArrowLeftRight,
  X,
  LayoutList,
  Shuffle,
  ScanText,
  Database
} from 'lucide-react'
import type { AutomationStep, AutomationActionType } from '../../types'

const ACTION_META: Record<AutomationActionType, { icon: React.ElementType; label: string; color: string }> = {
  navigate:           { icon: Globe,              label: 'Navigate',             color: 'text-blue-400' },
  click:              { icon: MousePointer,       label: 'Click',                color: 'text-green-400' },
  doubleClick:        { icon: MousePointerClick,  label: 'Double Click',         color: 'text-green-300' },
  type:               { icon: Type,               label: 'Type Text',            color: 'text-purple-400' },
  wait:               { icon: Clock,              label: 'Wait',                 color: 'text-yellow-400' },
  waitForSelector:    { icon: Search,             label: 'Wait for Element',     color: 'text-orange-400' },
  waitForNavigation:  { icon: Navigation,         label: 'Wait for Navigation',  color: 'text-blue-300' },
  screenshot:         { icon: Camera,             label: 'Screenshot',           color: 'text-pink-400' },
  extractText:        { icon: FileText,           label: 'Extract Text',         color: 'text-cyan-400' },
  scroll:             { icon: ArrowDownToLine,    label: 'Scroll',               color: 'text-indigo-400' },
  select:             { icon: List,               label: 'Select Option',        color: 'text-teal-400' },
  keyPress:           { icon: Keyboard,           label: 'Key Press',            color: 'text-amber-400' },
  evaluate:           { icon: Code,               label: 'Run Script',           color: 'text-red-400' },
  conditional:        { icon: GitBranch,          label: 'Conditional',          color: 'text-emerald-400' },
  loop:               { icon: Repeat,             label: 'Loop',                 color: 'text-violet-400' },
  hover:              { icon: Hand,               label: 'Hover',                color: 'text-sky-400' },
  rightClick:         { icon: MousePointerClick,  label: 'Right Click',          color: 'text-rose-400' },
  setAttribute:       { icon: PenTool,            label: 'Set Attribute',        color: 'text-lime-400' },
  httpRequest:        { icon: Send,               label: 'HTTP Request',         color: 'text-fuchsia-400' },
  upload:             { icon: Upload,             label: 'Upload File',          color: 'text-sky-300' },
  download:           { icon: Download,           label: 'Download File',        color: 'text-emerald-300' },
  solveCaptcha:       { icon: ShieldCheck,        label: 'Solve Captcha',        color: 'text-yellow-300' },
  injectCaptchaToken: { icon: KeyRound,           label: 'Inject Captcha Token', color: 'text-amber-300' },
  useCredential:      { icon: Lock,               label: 'Use Credential',       color: 'text-emerald-400' },
  // Tier 1 RPA additions
  callWorkflow:       { icon: Workflow,           label: 'Call Workflow',        color: 'text-indigo-300' },
  parallelSteps:      { icon: Layers,             label: 'Parallel Steps',       color: 'text-violet-300' },
  jumpToStep:         { icon: CornerDownRight,    label: 'Jump to Step',         color: 'text-amber-300' },
  interceptRequest:   { icon: ShieldCheck,        label: 'Intercept Request',    color: 'text-rose-300' },
  clearIntercepts:    { icon: ShieldOff,          label: 'Clear Intercepts',     color: 'text-rose-200' },
  getCookies:         { icon: Cookie,             label: 'Get Cookies',          color: 'text-amber-200' },
  setCookies:         { icon: Cookie,             label: 'Set Cookies',          color: 'text-amber-300' },
  deleteCookies:      { icon: Cookie,             label: 'Delete Cookies',       color: 'text-amber-400' },
  // Tier 3 RPA — assertions
  assert:             { icon: CheckCircle,        label: 'Assert',               color: 'text-green-300' },
  // Tier 4 RPA — multi-tab
  openTab:            { icon: Plus,               label: 'Open Tab',             color: 'text-blue-300' },
  switchTab:          { icon: ArrowLeftRight,     label: 'Switch Tab',           color: 'text-blue-400' },
  closeTab:           { icon: X,                  label: 'Close Tab',            color: 'text-blue-200' },
  getTabs:            { icon: LayoutList,         label: 'Get Tabs',             color: 'text-sky-300' },
  // Tier 4 RPA — proxy rotation
  switchProxy:        { icon: Shuffle,            label: 'Switch Proxy',         color: 'text-orange-300' },
  // Tier 4 RPA — text click
  clickByText:        { icon: ScanText,           label: 'Click by Text',        color: 'text-teal-300' },
  // Tier 5 RPA — storage inspection
  getStorage:         { icon: Database,           label: 'Get Storage',          color: 'text-cyan-400' },
  setStorage:         { icon: Database,           label: 'Set Storage',          color: 'text-cyan-500' },
  clearStorage:       { icon: Trash2,             label: 'Clear Storage',        color: 'text-red-400' },
  queryIndexedDB:     { icon: Database,           label: 'Query IndexedDB',      color: 'text-indigo-400' },
  // Tier 6 RPA — data-driven automation & file handling
  forEachRow:         { icon: Repeat,             label: 'For Each Row',         color: 'text-emerald-400' },
  readFile:           { icon: FileText,           label: 'Read File',            color: 'text-sky-400' },
  writeFile:          { icon: FileText,           label: 'Write File',           color: 'text-sky-500' },
  waitForDownload:    { icon: Download,           label: 'Wait For Download',    color: 'text-amber-300' },
  // Tier 7 RPA — error recovery & resilience
  tryCatch:           { icon: ShieldCheck,        label: 'Try / Catch',          color: 'text-pink-400' }
}

const ALL_ACTIONS: AutomationActionType[] = [
  'navigate', 'click', 'doubleClick', 'type', 'wait', 'waitForSelector', 'waitForNavigation',
  'screenshot', 'extractText', 'scroll', 'select', 'keyPress', 'evaluate',
  'hover', 'rightClick', 'setAttribute', 'httpRequest',
  'upload', 'download',
  'solveCaptcha', 'injectCaptchaToken',
  'useCredential',
  'conditional', 'loop',
  // Tier 1 RPA additions
  'callWorkflow', 'parallelSteps', 'jumpToStep',
  'interceptRequest', 'clearIntercepts',
  'getCookies', 'setCookies', 'deleteCookies',
  'assert',
  // Tier 4 RPA
  'openTab', 'switchTab', 'closeTab', 'getTabs',
  'switchProxy',
  'clickByText',
  // Tier 5 RPA
  'getStorage', 'setStorage', 'clearStorage', 'queryIndexedDB',
  // Tier 6 RPA
  'forEachRow', 'readFile', 'writeFile', 'waitForDownload',
  // Tier 7 RPA
  'tryCatch'
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
    case 'navigate':           return { url: 'https://example.com', waitUntil: 'networkidle2' }
    case 'click':              return { selector: '' }
    case 'doubleClick':        return { selector: '' }
    case 'waitForNavigation':  return { waitUntil: 'networkidle2', timeout: 30000 }
    case 'type':               return { selector: '', text: '', delay: 50 }
    case 'wait':               return { ms: 1000 }
    case 'waitForSelector':    return { selector: '', visible: true, timeout: 30000 }
    case 'screenshot':         return { fullPage: false }
    case 'extractText':        return { selector: 'body', saveAs: '' }
    case 'scroll':             return { y: 500 }
    case 'select':             return { selector: '', value: '' }
    case 'keyPress':           return { key: 'Enter' }
    case 'evaluate':           return { script: '// your code here', saveAs: '' }
    case 'hover':              return { selector: '' }
    case 'rightClick':         return { selector: '' }
    case 'setAttribute':       return { selector: '', attribute: '', value: '' }
    case 'httpRequest':        return { url: 'https://api.example.com', method: 'GET', headers: {}, body: '', saveAs: '' }
    case 'upload':             return { selector: 'input[type="file"]', filePath: '', timeout: 10000 }
    case 'download':           return { url: '', savePath: '', timeout: 60000 }
    case 'solveCaptcha':       return { type: 'recaptcha-v2', siteKey: '', pageUrl: '', saveAs: 'captchaToken' }
    case 'injectCaptchaToken': return { selector: '#g-recaptcha-response', token: '{captchaToken}' }
    case 'useCredential':      return { label: '', prefix: 'cred' }
    case 'conditional':        return { conditionType: 'selector-exists', selector: '', expected: '', script: '', thenSteps: [], elseSteps: [] }
    case 'loop':               return { times: 3, steps: [] }
    case 'callWorkflow':       return { workflowId: '', inputVars: {}, outputPrefix: '' }
    case 'parallelSteps':      return { steps: [], failFast: true }
    case 'jumpToStep':         return { conditionType: 'var-equals', variable: '', expected: '', targetStepId: '' }
    case 'interceptRequest':   return { urlPattern: '*', action: 'block', status: 200, contentType: 'application/json', body: '', headers: {}, replace: false }
    case 'clearIntercepts':    return {}
    case 'getCookies':         return { url: '', saveAs: '' }
    case 'setCookies':         return { name: '', value: '', domain: '', path: '/' }
    case 'deleteCookies':      return { name: '', all: false }
    case 'assert':             return { assertType: 'element-exists', selector: '', expected: '', variable: '', operator: 'eq', script: '', onFail: 'stop' }
    case 'openTab':            return { url: '', waitUntil: 'networkidle2', saveAs: '' }
    case 'switchTab':          return { index: 0, urlPattern: '', titlePattern: '', saveAs: '' }
    case 'closeTab':           return { index: undefined }
    case 'getTabs':            return { saveAs: 'tabs' }
    case 'switchProxy':        return { strategy: 'round-robin', proxyId: '', prefix: 'proxy', persistToProfile: true }
    case 'clickByText':        return { text: '', exact: false, visible: true, clickCount: 1, button: 'left', timeout: 10000, saveAs: '' }
    case 'getStorage':         return { type: 'localStorage', saveAs: 'storage' }
    case 'setStorage':         return { type: 'localStorage', key: '', value: '' }
    case 'clearStorage':       return { type: 'all' }
    case 'queryIndexedDB':     return { saveAs: 'idb' }
    case 'forEachRow':         return { filePath: 'data.csv', prefix: 'row', steps: [], failFast: true, limit: 0 }
    case 'readFile':           return { filePath: '', encoding: 'utf-8', saveAs: 'fileContent' }
    case 'writeFile':          return { filePath: '', content: '', append: false, encoding: 'utf-8' }
    case 'waitForDownload':    return { directory: '', pattern: '', filePath: '', timeout: 60000, pollInterval: 500, saveAs: 'downloadedFile' }
    case 'tryCatch':           return { tryBlock: [], catchBlock: [], finallyBlock: [], errorPrefix: 'error' }
    default:                   return {}
  }
}

export function StepEditor({ step, index, total, onUpdate, onDelete, onDuplicate, onMove }: StepEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const [showRetry, setShowRetry] = useState(false)
  const meta = ACTION_META[step.action]

  const handleActionChange = (action: AutomationActionType) => {
    onUpdate({ action, params: getDefaultParams(action), label: ACTION_META[action].label })
  }

  const handleParamChange = (key: string, value: any) => {
    onUpdate({ params: { ...step.params, [key]: value } })
  }

  const Icon = meta.icon
  const hasRetry = (step.retries ?? 0) > 0

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
        {hasRetry && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            <RefreshCw className="w-2.5 h-2.5" />
            ×{step.retries}
          </span>
        )}
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

          {/* Retry policy (collapsible) */}
          <div className="mt-3 border-t border-slate-700/40 pt-3">
            <button
              onClick={() => setShowRetry(!showRetry)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry policy
              {hasRetry && <span className="text-amber-400">({step.retries} retries, {step.retryDelay ?? 1000}ms delay)</span>}
              {showRetry ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showRetry && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">Retries (0 = no retry)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={step.retries ?? 0}
                    onChange={(e) => onUpdate({ retries: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">Retry delay (ms)</label>
                  <input
                    type="number"
                    min={100}
                    step={500}
                    value={step.retryDelay ?? 1000}
                    onChange={(e) => onUpdate({ retryDelay: Math.max(100, parseInt(e.target.value || '1000', 10)) })}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                  />
                </div>
              </div>
            )}
          </div>
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
  const field = (key: string, label: string, type: 'text' | 'number' | 'checkbox' | 'textarea' = 'text', placeholder?: string) => (
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
          placeholder={placeholder}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500 font-mono text-xs"
        />
      ) : (
        <input
          type={type}
          value={params[key] ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
        />
      )}
    </div>
  )

  const saveAsField = (hint: string) => (
    <div className="mb-2">
      <label className="text-xs text-slate-500 mb-1 block">Save result as variable (optional)</label>
      <input
        type="text"
        value={params.saveAs ?? ''}
        onChange={(e) => onChange('saveAs', e.target.value)}
        placeholder={`e.g. ${hint}`}
        className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500 font-mono"
      />
      {params.saveAs && (
        <p className="text-[10px] text-slate-500 mt-0.5">Use <code className="text-ghost-400">{`{${params.saveAs}}`}</code> in later steps</p>
      )}
    </div>
  )

  switch (action) {
    case 'navigate':
      return (
        <>
          {field('url', 'URL')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Wait until</label>
            <select value={params.waitUntil ?? 'networkidle2'} onChange={(e) => onChange('waitUntil', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="load">load</option>
              <option value="domcontentloaded">domcontentloaded</option>
              <option value="networkidle0">networkidle0</option>
              <option value="networkidle2">networkidle2</option>
            </select>
          </div>
          {field('timeout', 'Timeout (ms)', 'number')}
        </>
      )
    case 'click':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}</>
    case 'doubleClick':
      return (
        <>
          {field('selector', 'CSS Selector')}
          {field('timeout', 'Timeout (ms)', 'number')}
          <div className="mt-1 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Double-clicks the element. Useful for text selection or triggering dblclick event handlers.
          </div>
        </>
      )
    case 'waitForNavigation':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Wait until</label>
            <select value={params.waitUntil ?? 'networkidle2'} onChange={(e) => onChange('waitUntil', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="load">load</option>
              <option value="domcontentloaded">domcontentloaded</option>
              <option value="networkidle0">networkidle0</option>
              <option value="networkidle2">networkidle2</option>
            </select>
          </div>
          {field('timeout', 'Timeout (ms)', 'number')}
          <div className="mt-1 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Waits for a page navigation to complete. Place this after a <strong>click</strong> or
            <strong> keyPress</strong> that triggers a navigation (form submit, link click, etc.).
          </div>
        </>
      )
    case 'type':
      return <>{field('selector', 'CSS Selector')}{field('text', 'Text to type')}{field('delay', 'Delay per key (ms)', 'number')}{field('clear', 'Clear field first', 'checkbox')}</>
    case 'wait':
      return <>{field('ms', 'Wait time (ms)', 'number')}</>
    case 'waitForSelector':
      return <>{field('selector', 'CSS Selector')}{field('timeout', 'Timeout (ms)', 'number')}{field('visible', 'Must be visible', 'checkbox')}</>
    case 'screenshot':
      return <>{field('fullPage', 'Full page', 'checkbox')}</>
    case 'extractText':
      return (
        <>
          {field('selector', 'CSS Selector')}
          {saveAsField('pageTitle')}
        </>
      )
    case 'scroll':
      return <>{field('x', 'Horizontal (px)', 'number')}{field('y', 'Vertical (px)', 'number')}</>
    case 'select':
      return <>{field('selector', 'CSS Selector')}{field('value', 'Option value')}</>
    case 'keyPress':
      return <>{field('key', 'Key (e.g. Enter, Tab, Escape)')}</>
    case 'evaluate':
      return (
        <>
          {field('script', 'JavaScript code', 'textarea')}
          {saveAsField('scriptResult')}
        </>
      )
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
          {saveAsField('responseBody')}
        </>
      )
    case 'upload':
      return (
        <>
          {field('selector', 'File input CSS selector')}
          {field('filePath', 'Local file path')}
          {field('timeout', 'Timeout (ms)', 'number')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Targets an <code className="text-slate-300">&lt;input type=&quot;file&quot;&gt;</code> element and uploads
            the local file from the host machine. Supports <code className="text-slate-300">{'{var}'}</code> placeholders
            in the file path.
          </div>
        </>
      )
    case 'download':
      return (
        <>
          {field('url', 'File URL')}
          {field('savePath', 'Save to (local file path)')}
          {field('timeout', 'Timeout (ms)', 'number')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Streams the URL to disk using the active page's cookies. Parent directories
            are created automatically. Up to 5 redirects are followed.
          </div>
        </>
      )
    case 'solveCaptcha':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Captcha type</label>
            <select
              value={params.type ?? 'recaptcha-v2'}
              onChange={(e) => onChange('type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            >
              <option value="recaptcha-v2">reCAPTCHA v2</option>
              <option value="recaptcha-v3">reCAPTCHA v3</option>
              <option value="hcaptcha">hCaptcha</option>
              <option value="image">Image (text-in-image)</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Provider (optional)</label>
            <select
              value={params.provider ?? ''}
              onChange={(e) => onChange('provider', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            >
              <option value="">Use default from Settings</option>
              <option value="2captcha">2Captcha</option>
              <option value="anticaptcha">Anti-Captcha</option>
              <option value="capmonster">CapMonster</option>
            </select>
          </div>
          {params.type !== 'image' && field('siteKey', 'Site key (data-sitekey)')}
          {params.type !== 'image' && field('pageUrl', 'Page URL (defaults to current)')}
          {params.type === 'recaptcha-v3' && field('action', 'reCAPTCHA v3 action name')}
          {params.type === 'recaptcha-v3' && field('minScore', 'Min score (0–1)', 'number')}
          {params.type === 'recaptcha-v2' && field('invisible', 'Invisible reCAPTCHA', 'checkbox')}
          {params.type === 'image' && field('imageBase64', 'Image base64 data', 'textarea')}
          {field('saveAs', 'Save token as variable (default: captchaToken)')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Solves the captcha via the configured provider. The resulting token is
            saved into the workflow variable named in <code className="text-slate-300">saveAs</code>,
            so a later step can use <code className="text-slate-300">{'{captchaToken}'}</code>.
          </div>
        </>
      )
    case 'injectCaptchaToken':
      return (
        <>
          {field('selector', 'Target CSS selector (default: #g-recaptcha-response)')}
          {field('token', 'Token (use {captchaToken})')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Sets the value of a hidden reCAPTCHA / hCaptcha textarea and dispatches
            input/change events. Pair with <code className="text-slate-300">solveCaptcha</code>.
          </div>
        </>
      )
    case 'useCredential':
      return (
        <>
          {field('label', 'Credential label (lookup by name)')}
          {field('id', 'Or credential ID (overrides label)')}
          {field('prefix', 'Variable prefix (default: cred)')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Loads a credential from the encrypted vault into workflow variables.
            Use <code className="text-slate-300">{'{cred.username}'}</code>, <code className="text-slate-300">{'{cred.password}'}</code>,
            and <code className="text-slate-300">{'{cred.<field>}'}</code> in later steps.
            The vault must be unlocked from Settings before the workflow runs.
          </div>
        </>
      )
    case 'conditional':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Condition type</label>
            <select
              value={params.conditionType ?? 'selector-exists'}
              onChange={(e) => onChange('conditionType', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
            >
              <option value="selector-exists">Element exists (selector present)</option>
              <option value="text-equals">Element text equals value</option>
              <option value="text-contains">Element text contains value</option>
              <option value="js-truthy">JavaScript expression is truthy</option>
            </select>
          </div>
          {(params.conditionType === 'selector-exists' || params.conditionType === 'text-equals' || params.conditionType === 'text-contains' || !params.conditionType) && (
            field('selector', 'CSS Selector')
          )}
          {(params.conditionType === 'text-equals' || params.conditionType === 'text-contains') && (
            field('expected', 'Expected text value')
          )}
          {params.conditionType === 'js-truthy' && (
            field('script', 'JavaScript expression (must return truthy/falsy)', 'textarea', 'e.g. document.title.includes("Success")')
          )}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            If the condition matches, the <strong>then</strong> branch runs; otherwise the <strong>else</strong> branch runs.
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
