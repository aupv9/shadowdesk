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
  Database,
  GripVertical,
  Frame,
  Sliders,
  FocusIcon,
  Brackets,
  IterationCcw,
  Network,
  SkipForward
} from 'lucide-react'
import type { AutomationStep, AutomationActionType } from '../../types'
import { ActionBrowser } from './ActionBrowser'
import { ACTION_META } from './actionMetadata'


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
    case 'dragAndDrop':        return { selector: '', targetSelector: '', steps: 20, offsetX: 0, offsetY: 0 }
    case 'keyCombo':           return { keys: 'Control+a' }
    case 'selectContextMenu':  return { selector: '', menuItemText: '', exact: true, menuDelay: 300 }
    case 'setRangeInput':      return { selector: '', value: 50, saveAs: '' }
    case 'scrollIntoView':     return { selector: '', behavior: 'smooth', timeout: 30000 }
    case 'switchFrame':        return { selector: '', index: undefined, urlPattern: '', exit: false, saveAs: '' }
    case 'extractJson':        return { selector: '', path: '', saveAs: 'json' }
    case 'forEachElement':     return { selector: '', prefix: 'element', steps: [] }
    case 'whileLoop':          return { conditionType: 'var-truthy', variable: '', maxIterations: 0, steps: [] }
    case 'waitForRequest':     return { urlPattern: '', timeout: 30000, saveAs: 'requestUrl' }
    case 'waitForResponse':    return { urlPattern: '', timeout: 30000, saveAs: 'responseBody' }
    case 'paginate':           return { selector: '', maxPages: 0, delayMs: 1000, collectSelector: '' }
    default:                   return {}
  }
}

export function StepEditor({ step, index, total, onUpdate, onDelete, onDuplicate, onMove }: StepEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const [showRetry, setShowRetry] = useState(false)
  const [showActionBrowser, setShowActionBrowser] = useState(false)
  const meta = ACTION_META[step.action]

  const handleActionChange = (action: AutomationActionType) => {
    onUpdate({ action, params: getDefaultParams(action), label: ACTION_META[action].label })
    setShowActionBrowser(false)
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
            <button
              onClick={() => setShowActionBrowser(true)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-slate-700 border border-slate-600 text-white text-sm rounded hover:bg-slate-600 transition-colors text-left"
            >
              <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{meta.label}</div>
                {meta.description && (
                  <div className="text-xs text-slate-400 truncate">{meta.description}</div>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          </div>

          {/* Action browser modal */}
          {showActionBrowser && (
            <ActionBrowser
              onSelect={handleActionChange}
              onClose={() => setShowActionBrowser(false)}
            />
          )}

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
    case 'callWorkflow':
      return (
        <>
          {field('workflowId', 'Workflow ID')}
          {field('inputVars', 'Input variables (JSON)', 'textarea', '{}')}
          {field('outputPrefix', 'Output variable prefix (optional)')}
        </>
      )
    case 'parallelSteps':
      return (
        <>
          {field('failFast', 'Fail fast on error', 'checkbox')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Parallel steps are configured as nested steps. All steps run concurrently.
          </div>
        </>
      )
    case 'jumpToStep':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Condition type</label>
            <select value={params.conditionType ?? 'var-equals'} onChange={(e) => onChange('conditionType', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="var-equals">Variable equals value</option>
              <option value="var-contains">Variable contains text</option>
              <option value="always">Always (unconditional)</option>
            </select>
          </div>
          {params.conditionType !== 'always' && field('variable', 'Variable name')}
          {params.conditionType !== 'always' && field('expected', 'Expected value')}
          {field('targetStepId', 'Target step ID (or label)')}
        </>
      )
    case 'interceptRequest':
      return (
        <>
          {field('urlPattern', 'URL pattern (wildcard: *)')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Action</label>
            <select value={params.action ?? 'block'} onChange={(e) => onChange('action', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="block">Block</option>
              <option value="respond">Respond with custom</option>
              <option value="continue">Continue (modify)</option>
            </select>
          </div>
          {(params.action === 'respond' || params.action === 'continue') && field('status', 'HTTP Status', 'number')}
          {(params.action === 'respond' || params.action === 'continue') && field('contentType', 'Content-Type')}
          {(params.action === 'respond' || params.action === 'continue') && field('body', 'Response body (JSON)', 'textarea')}
        </>
      )
    case 'clearIntercepts':
      return (
        <div className="text-xs text-slate-400">Clears all request intercepts. No parameters.</div>
      )
    case 'getCookies':
      return (
        <>
          {field('url', 'URL (optional, defaults to current page)')}
          {saveAsField('cookies')}
        </>
      )
    case 'setCookies':
      return (
        <>
          {field('name', 'Cookie name')}
          {field('value', 'Cookie value')}
          {field('domain', 'Domain (optional)')}
          {field('path', 'Path (default: /)')}
          {field('expires', 'Expires (Unix timestamp, optional)', 'number')}
          {field('httpOnly', 'HTTP-only', 'checkbox')}
        </>
      )
    case 'deleteCookies':
      return (
        <>
          <div className="mb-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={params.all ?? false} onChange={(e) => onChange('all', e.target.checked)} className="rounded border-slate-600 bg-slate-700" />
              Delete all cookies
            </label>
          </div>
          {!params.all && field('name', 'Cookie name')}
          {!params.all && field('domain', 'Domain (optional)')}
        </>
      )
    case 'assert':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Assert type</label>
            <select value={params.assertType ?? 'element-exists'} onChange={(e) => onChange('assertType', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="element-exists">Element exists</option>
              <option value="element-text">Element text equals</option>
              <option value="variable-equals">Variable equals</option>
              <option value="expression">JavaScript expression</option>
            </select>
          </div>
          {(params.assertType === 'element-exists' || params.assertType === 'element-text') && field('selector', 'CSS Selector')}
          {params.assertType === 'element-text' && field('expected', 'Expected text')}
          {params.assertType === 'variable-equals' && field('variable', 'Variable name')}
          {params.assertType === 'variable-equals' && field('expected', 'Expected value')}
          {params.assertType === 'expression' && field('script', 'JavaScript expression', 'textarea')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">On failure</label>
            <select value={params.onFail ?? 'stop'} onChange={(e) => onChange('onFail', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="stop">Stop workflow</option>
              <option value="log">Log warning</option>
              <option value="continue">Continue</option>
            </select>
          </div>
        </>
      )
    case 'openTab':
      return (
        <>
          {field('url', 'URL to open')}
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
          {saveAsField('tab')}
        </>
      )
    case 'switchTab':
      return (
        <>
          {field('index', 'Tab index (0-based, or empty to match pattern)', 'number')}
          {field('urlPattern', 'Or match by URL pattern (regex or wildcard)')}
          {field('titlePattern', 'Or match by title pattern')}
          {saveAsField('tab')}
        </>
      )
    case 'closeTab':
      return (
        <>
          {field('index', 'Tab index to close (0-based)', 'number')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Closes the tab at the specified index. If not specified, closes the current tab.
          </div>
        </>
      )
    case 'getTabs':
      return (
        <>
          {saveAsField('tabs')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Returns an array of all open tabs. Use {'{tabs}'} in later steps.
          </div>
        </>
      )
    case 'switchProxy':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Strategy</label>
            <select value={params.strategy ?? 'round-robin'} onChange={(e) => onChange('strategy', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="round-robin">Round-robin</option>
              <option value="random">Random</option>
              <option value="specific">Specific proxy ID</option>
            </select>
          </div>
          {params.strategy === 'specific' && field('proxyId', 'Proxy ID')}
          {field('prefix', 'Variable prefix for proxy info')}
          {field('persistToProfile', 'Persist to profile', 'checkbox')}
        </>
      )
    case 'clickByText':
      return (
        <>
          {field('text', 'Text to find (exact or partial)')}
          {field('exact', 'Exact match (vs. contains)', 'checkbox')}
          {field('visible', 'Element must be visible', 'checkbox')}
          {field('clickCount', 'Click count', 'number')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Button</label>
            <select value={params.button ?? 'left'} onChange={(e) => onChange('button', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="middle">Middle</option>
            </select>
          </div>
          {field('timeout', 'Timeout (ms)', 'number')}
          {saveAsField('foundElement')}
        </>
      )
    case 'getStorage':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Storage type</label>
            <select value={params.type ?? 'localStorage'} onChange={(e) => onChange('type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="localStorage">localStorage</option>
              <option value="sessionStorage">sessionStorage</option>
            </select>
          </div>
          {saveAsField('storage')}
        </>
      )
    case 'setStorage':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Storage type</label>
            <select value={params.type ?? 'localStorage'} onChange={(e) => onChange('type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="localStorage">localStorage</option>
              <option value="sessionStorage">sessionStorage</option>
            </select>
          </div>
          {field('key', 'Key name')}
          {field('value', 'Value (JSON or string)')}
        </>
      )
    case 'clearStorage':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Clear</label>
            <select value={params.type ?? 'all'} onChange={(e) => onChange('type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="all">All storage (localStorage + sessionStorage)</option>
              <option value="localStorage">localStorage only</option>
              <option value="sessionStorage">sessionStorage only</option>
            </select>
          </div>
        </>
      )
    case 'queryIndexedDB':
      return (
        <>
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Queries all IndexedDB databases and stores. Configure via JSON edit for complex queries.
          </div>
          {saveAsField('idbData')}
        </>
      )
    case 'forEachRow':
      return (
        <>
          {field('filePath', 'CSV file path (relative to profile)')}
          {field('prefix', 'Variable prefix (e.g. row)')}
          {field('limit', 'Max rows (0 = all)', 'number')}
          {field('failFast', 'Fail fast on error', 'checkbox')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Nested steps run for each row. Use {'{row.columnName}'} to access CSV columns.
          </div>
        </>
      )
    case 'readFile':
      return (
        <>
          {field('filePath', 'File path (relative to profile)')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Encoding</label>
            <select value={params.encoding ?? 'utf-8'} onChange={(e) => onChange('encoding', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="utf-8">UTF-8</option>
              <option value="binary">Binary (base64)</option>
            </select>
          </div>
          {saveAsField('fileContent')}
        </>
      )
    case 'writeFile':
      return (
        <>
          {field('filePath', 'File path (relative to profile)')}
          {field('content', 'Content to write', 'textarea')}
          {field('append', 'Append to file (vs. overwrite)', 'checkbox')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Encoding</label>
            <select value={params.encoding ?? 'utf-8'} onChange={(e) => onChange('encoding', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="utf-8">UTF-8</option>
              <option value="binary">Binary (base64)</option>
            </select>
          </div>
        </>
      )
    case 'waitForDownload':
      return (
        <>
          {field('directory', 'Download directory to monitor')}
          {field('pattern', 'File name pattern (wildcard or regex)')}
          {field('timeout', 'Timeout (ms)', 'number')}
          {field('pollInterval', 'Poll interval (ms)', 'number')}
          {saveAsField('downloadedFile')}
        </>
      )
    case 'tryCatch':
      return (
        <>
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Try/Catch blocks are configured as nested steps (tryBlock, catchBlock, finallyBlock).
            Use JSON edit to define nested steps.
          </div>
          {field('errorPrefix', 'Error variable prefix')}
        </>
      )
    case 'dragAndDrop':
      return (
        <>
          {field('selector', 'Element to drag (CSS selector)')}
          {field('targetSelector', 'Target element (CSS selector)')}
          {field('steps', 'Number of drag steps', 'number')}
          {field('offsetX', 'Offset X (px)', 'number')}
          {field('offsetY', 'Offset Y (px)', 'number')}
        </>
      )
    case 'keyCombo':
      return (
        <>
          {field('keys', 'Key combination (e.g. Control+a, Command+v)')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Supported modifiers: Control, Shift, Alt, Meta. Separate keys with +.
          </div>
        </>
      )
    case 'selectContextMenu':
      return (
        <>
          {field('selector', 'CSS selector to right-click')}
          {field('menuItemText', 'Menu item text to click')}
          {field('exact', 'Exact text match (vs. contains)', 'checkbox')}
          {field('menuDelay', 'Delay before clicking menu item (ms)', 'number')}
        </>
      )
    case 'setRangeInput':
      return (
        <>
          {field('selector', 'CSS selector (input[type=range])')}
          {field('value', 'Value to set', 'number')}
          {saveAsField('rangeValue')}
        </>
      )
    case 'scrollIntoView':
      return (
        <>
          {field('selector', 'CSS selector to scroll into view')}
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Behavior</label>
            <select value={params.behavior ?? 'smooth'} onChange={(e) => onChange('behavior', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="smooth">Smooth</option>
              <option value="auto">Auto (instant)</option>
            </select>
          </div>
          {field('timeout', 'Timeout (ms)', 'number')}
        </>
      )
    case 'switchFrame':
      return (
        <>
          {field('selector', 'Frame selector (iframe CSS selector)')}
          {field('index', 'Or frame index (0-based)', 'number')}
          {field('urlPattern', 'Or match by URL pattern')}
          {field('exit', 'Exit current frame (return to parent)', 'checkbox')}
          {saveAsField('frameHandle')}
        </>
      )
    case 'extractJson':
      return (
        <>
          {field('selector', 'CSS selector containing JSON (or empty for page text)')}
          {field('path', 'JSONPath query (optional, e.g. $.data[0].name)')}
          {saveAsField('extractedJson')}
        </>
      )
    case 'forEachElement':
      return (
        <>
          {field('selector', 'CSS selector to iterate')}
          {field('prefix', 'Variable prefix for element')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Iterates over matching elements. Use {'{elementIndex}'} and {'{elementText}'} in nested steps.
          </div>
        </>
      )
    case 'whileLoop':
      return (
        <>
          <div className="mb-2">
            <label className="text-xs text-slate-500 mb-1 block">Condition</label>
            <select value={params.conditionType ?? 'var-truthy'} onChange={(e) => onChange('conditionType', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500">
              <option value="var-truthy">Variable is truthy</option>
              <option value="selector-exists">Selector exists</option>
              <option value="expression">JavaScript expression</option>
            </select>
          </div>
          {field('variable', 'Variable name')}
          {field('maxIterations', 'Max iterations (0 = unlimited)', 'number')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Nested steps run while condition is true.
          </div>
        </>
      )
    case 'waitForRequest':
      return (
        <>
          {field('urlPattern', 'URL pattern to match (wildcard or regex)')}
          {field('timeout', 'Timeout (ms)', 'number')}
          {saveAsField('requestUrl')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Waits for an XHR/fetch request matching the pattern. Useful before extracting response data.
          </div>
        </>
      )
    case 'waitForResponse':
      return (
        <>
          {field('urlPattern', 'URL pattern to match (wildcard or regex)')}
          {field('timeout', 'Timeout (ms)', 'number')}
          {saveAsField('responseBody')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Waits for a response and captures the response body (JSON/text).
          </div>
        </>
      )
    case 'paginate':
      return (
        <>
          {field('selector', 'Next button CSS selector')}
          {field('maxPages', 'Max pages to visit (0 = unlimited)', 'number')}
          {field('delayMs', 'Delay between pages (ms)', 'number')}
          {field('collectSelector', 'Optional: selector to collect data from (use with extractText)')}
          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400">
            Clicks the next button and waits for page load, repeating until button disappears or max pages reached.
          </div>
        </>
      )
    default:
      return <div className="text-xs text-slate-500">No parameters</div>
  }
}
