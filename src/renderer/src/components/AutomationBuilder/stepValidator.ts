/**
 * Step-level validation utility
 * Computes the overall validation state for an AutomationStep based on the
 * action it performs and the params that have (or have not) been filled in.
 *
 * This powers the Phase 3 Visual Helpers: inline step badges, summary
 * indicators, and guidance about what still needs to be configured before a
 * step can run.
 */
import type { AutomationStep, AutomationActionType } from '../../types'
import { validateCSSSelector } from './selectorValidator'

export type StepValidationLevel = 'valid' | 'incomplete' | 'invalid'

export interface StepValidationResult {
  level: StepValidationLevel
  /** Short label for the badge, e.g. "Ready", "Needs selector", "Invalid URL" */
  label: string
  /** All messages (used to render the list of issues in tooltips) */
  messages: string[]
  /** Keys of params that are missing required values */
  missingRequired: string[]
  /** Keys of params that have invalid values (e.g. bad selector syntax) */
  invalidFields: string[]
}

/**
 * Required params per action type. Only the keys that MUST be filled are
 * listed here. Fields with sensible defaults (timeout, waitUntil, etc.)
 * are intentionally omitted so an unchanged default still counts as valid.
 */
const REQUIRED_PARAMS: Partial<Record<AutomationActionType, string[]>> = {
  navigate: ['url'],
  click: ['selector'],
  doubleClick: ['selector'],
  type: ['selector', 'text'],
  waitForSelector: ['selector'],
  extractText: ['selector'],
  select: ['selector', 'value'],
  keyPress: ['key'],
  evaluate: ['script'],
  hover: ['selector'],
  rightClick: ['selector'],
  setAttribute: ['selector', 'attribute'],
  httpRequest: ['url'],
  upload: ['selector', 'filePath'],
  download: ['url', 'savePath'],
  solveCaptcha: ['type'],
  injectCaptchaToken: ['selector'],
  useCredential: [],
  callWorkflow: ['workflowId'],
  jumpToStep: ['targetStepId'],
  interceptRequest: ['urlPattern'],
  setCookies: ['name', 'value'],
  assert: ['assertType'],
  openTab: ['url'],
  clickByText: ['text'],
  setStorage: ['key'],
  forEachRow: ['filePath'],
  readFile: ['filePath'],
  writeFile: ['filePath'],
  waitForDownload: [],
  dragAndDrop: ['selector', 'targetSelector'],
  keyCombo: ['keys'],
  selectContextMenu: ['selector', 'menuItemText'],
  setRangeInput: ['selector'],
  scrollIntoView: ['selector'],
  switchFrame: [],
  extractJson: ['selector'],
  forEachElement: ['selector'],
  whileLoop: [],
  waitForRequest: ['urlPattern'],
  waitForResponse: ['urlPattern'],
  paginate: ['selector']
}

/**
 * Actions that don't have parameter validation (containers / no-args).
 * These are always considered "valid" regardless of contents.
 */
const STRUCTURAL_ACTIONS: AutomationActionType[] = [
  'conditional',
  'loop',
  'parallelSteps',
  'tryCatch',
  'wait',
  'scroll',
  'screenshot',
  'clearIntercepts',
  'getCookies',
  'deleteCookies',
  'closeTab',
  'getTabs',
  'switchTab',
  'switchProxy',
  'getStorage',
  'clearStorage',
  'queryIndexedDB',
  'waitForNavigation'
]

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function humanizeParamKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

/**
 * Validate an entire step. Returns level, a short label for badges,
 * and lists of missing / invalid fields.
 */
export function validateStep(step: AutomationStep): StepValidationResult {
  const required = REQUIRED_PARAMS[step.action] ?? []
  const structural = STRUCTURAL_ACTIONS.includes(step.action)
  const params = step.params ?? {}

  const missingRequired: string[] = []
  const invalidFields: string[] = []
  const messages: string[] = []

  // 1. Required params must be filled
  for (const key of required) {
    if (isEmpty(params[key])) {
      missingRequired.push(key)
      messages.push(`Missing ${humanizeParamKey(key)}`)
    }
  }

  // 2. Validate any non-empty selector fields syntactically
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' || value.trim() === '') continue
    const isSelectorKey = key === 'selector' || key.toLowerCase().endsWith('selector')
    if (isSelectorKey) {
      const result = validateCSSSelector(value)
      if (!result.isValid) {
        invalidFields.push(key)
        messages.push(`Invalid ${humanizeParamKey(key)}`)
      }
    }

    if (key === 'url' && !value.startsWith('http://') && !value.startsWith('https://')) {
      invalidFields.push(key)
      messages.push('URL is missing http:// or https://')
    }

    if (key === 'urlPattern' && value.trim().length < 1) {
      missingRequired.push(key)
    }

    // Timeouts should be a sane number if present
    if ((key === 'timeout' || key === 'timeoutMs') && !isEmpty(value)) {
      const num = Number(value)
      if (Number.isNaN(num) || num <= 0) {
        invalidFields.push(key)
        messages.push(`${humanizeParamKey(key)} must be a positive number`)
      }
    }
  }

  // Determine the overall level
  if (invalidFields.length > 0) {
    return {
      level: 'invalid',
      label:
        invalidFields.length === 1
          ? `Invalid ${humanizeParamKey(invalidFields[0])}`
          : `${invalidFields.length} invalid fields`,
      messages,
      missingRequired,
      invalidFields
    }
  }

  if (missingRequired.length > 0) {
    return {
      level: 'incomplete',
      label:
        missingRequired.length === 1
          ? `Needs ${humanizeParamKey(missingRequired[0]).toLowerCase()}`
          : `${missingRequired.length} fields to fill`,
      messages,
      missingRequired,
      invalidFields
    }
  }

  if (structural) {
    return {
      level: 'valid',
      label: 'Ready',
      messages: [],
      missingRequired: [],
      invalidFields: []
    }
  }

  return {
    level: 'valid',
    label: 'Ready',
    messages: [],
    missingRequired: [],
    invalidFields: []
  }
}

/**
 * Aggregate validation across all steps in a workflow.
 */
export function summarizeWorkflowValidation(steps: AutomationStep[]): {
  total: number
  ready: number
  incomplete: number
  invalid: number
} {
  let ready = 0
  let incomplete = 0
  let invalid = 0
  for (const step of steps) {
    const result = validateStep(step)
    if (result.level === 'valid') ready++
    else if (result.level === 'incomplete') incomplete++
    else invalid++
  }
  return { total: steps.length, ready, incomplete, invalid }
}
