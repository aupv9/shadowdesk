import React from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import {
  validateCSSSelector,
  validateXPath,
  analyzeSelectorComplexity,
  getSelectorComplexityExplanation,
  getSelectorGuidance
} from './selectorValidator'

interface ValidationFeedback {
  type: 'error' | 'warning' | 'success' | 'info'
  message: string
  icon: React.ElementType
  suggestions?: string[]
  examples?: string[]
}

interface ParameterValidatorProps {
  paramKey: string
  value: string
  paramType?: 'selector' | 'xpath' | 'url' | 'number' | 'text'
  hint?: string
  examples?: string[]
}

export function ParameterValidator({
  paramKey,
  value,
  paramType = 'text',
  hint,
  examples: examplesProp
}: ParameterValidatorProps) {
  if (!value) {
    return (
      <div className="mt-1 flex items-start gap-1.5 text-[10px] text-slate-500">
        <HelpCircle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>{hint || `Enter a ${paramType}`}</span>
      </div>
    )
  }

  const feedback = getFeedback(paramKey, value, paramType)
  if (!feedback) return null

  const Icon = feedback.icon
  const bgColor =
    feedback.type === 'error' ? 'bg-red-500/10'
    : feedback.type === 'warning' ? 'bg-amber-500/10'
    : feedback.type === 'success' ? 'bg-emerald-500/10'
    : 'bg-blue-500/10'

  const textColor =
    feedback.type === 'error' ? 'text-red-400'
    : feedback.type === 'warning' ? 'text-amber-400'
    : feedback.type === 'success' ? 'text-emerald-400'
    : 'text-blue-400'

  const borderColor =
    feedback.type === 'error' ? 'border-red-500/30'
    : feedback.type === 'warning' ? 'border-amber-500/30'
    : feedback.type === 'success' ? 'border-emerald-500/30'
    : 'border-blue-500/30'

  return (
    <div className={`mt-2 p-2 rounded border ${bgColor} ${borderColor}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${textColor}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] ${textColor} font-medium`}>
            {feedback.message}
          </p>

          {/* Suggestions */}
          {feedback.suggestions && feedback.suggestions.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[9px] text-slate-400 font-medium mb-1">Try:</p>
              <div className="space-y-0.5">
                {feedback.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="text-[9px] text-slate-400 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50 truncate">
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {(feedback.examples || examplesProp) && (
            <div className="mt-1.5">
              <p className="text-[9px] text-slate-400 font-medium mb-1">Examples:</p>
              <div className="space-y-0.5">
                {(feedback.examples || examplesProp)?.slice(0, 3).map((example, idx) => (
                  <div key={idx} className="text-[9px] text-slate-400 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50 truncate">
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getFeedback(
  paramKey: string,
  value: string,
  paramType: string
): ValidationFeedback | null {
  // Validate CSS selectors
  if (paramType === 'selector' || paramKey === 'selector') {
    const validation = validateCSSSelector(value)

    if (!validation.isValid) {
      return {
        type: 'error',
        message: validation.error || 'Invalid CSS selector',
        icon: AlertCircle,
        suggestions: validation.suggestions,
        examples: validation.examples
      }
    }

    if (validation.warning) {
      return {
        type: 'warning',
        message: validation.warning,
        icon: AlertTriangle,
        suggestions: validation.suggestions,
        examples: validation.examples
      }
    }

    const complexity = analyzeSelectorComplexity(value)
    const guidance = getSelectorGuidance(value)
    const complexityExplanation = getSelectorComplexityExplanation(complexity)

    return {
      type: 'success',
      message: `${guidance} — ${complexityExplanation}`,
      icon: CheckCircle,
      examples: validation.examples
    }
  }

  // Validate XPath
  if (paramType === 'xpath' || paramKey.includes('xpath')) {
    if (!value.startsWith('/') && !value.startsWith('(')) {
      return {
        type: 'warning',
        message: 'XPath should start with "/" or "("',
        icon: AlertTriangle,
        examples: ['//button[@type="submit"]', '//*[@id="login"]']
      }
    }

    const validation = validateXPath(value)

    if (!validation.isValid) {
      return {
        type: 'error',
        message: validation.error || 'Invalid XPath',
        icon: AlertCircle,
        examples: validation.examples
      }
    }

    return {
      type: 'success',
      message: '✓ Valid XPath expression',
      icon: CheckCircle,
      examples: validation.examples
    }
  }

  // Validate URLs
  if (paramType === 'url' || paramKey === 'url') {
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      return {
        type: 'warning',
        message: 'URL should start with http:// or https://',
        icon: AlertTriangle,
        examples: ['https://example.com', 'https://api.example.com/data']
      }
    }

    try {
      new URL(value)
      return {
        type: 'success',
        message: '✓ Valid URL',
        icon: CheckCircle
      }
    } catch (e) {
      return {
        type: 'error',
        message: 'Invalid URL format',
        icon: AlertCircle,
        examples: ['https://example.com', 'https://example.com/path?param=value']
      }
    }
  }

  // Validate numbers
  if (paramType === 'number' || paramKey.includes('timeout') || paramKey.includes('ms') || paramKey.includes('delay')) {
    const num = Number(value)

    if (isNaN(num)) {
      return {
        type: 'error',
        message: 'Must be a valid number',
        icon: AlertCircle,
        examples: ['1000', '5000', '30000']
      }
    }

    if (paramKey.includes('timeout') && (num < 100 || num > 120000)) {
      return {
        type: 'warning',
        message: `Timeout ${num}ms may be too ${num < 100 ? 'short' : 'long'}. Typical: 5000-30000ms`,
        icon: AlertTriangle,
        examples: ['5000', '10000', '30000']
      }
    }

    if (paramKey.includes('delay') && (num < 10 || num > 500)) {
      return {
        type: 'warning',
        message: `Delay ${num}ms may be too ${num < 10 ? 'fast' : 'slow'}. Human typing: 30-100ms`,
        icon: AlertTriangle,
        examples: ['30', '50', '100']
      }
    }

    return {
      type: 'success',
      message: `✓ ${num}${paramKey.includes('ms') ? 'ms' : ''}`,
      icon: CheckCircle
    }
  }

  return null
}
