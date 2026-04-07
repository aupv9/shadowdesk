/**
 * Phase 16.A — Natural Language Workflow Builder
 *
 * Lets the user describe a task in plain English and generates
 * a ready-to-use AutomationStep[] via the Anthropic API (main process).
 */

import React, { useState } from 'react'
import {
  Wand2,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Wrench,
  Copy
} from 'lucide-react'
import type { AiWorkflowResult, AutomationStep } from '../../types'

interface Props {
  onImport: (steps: AutomationStep[], name: string) => void
}

const EXAMPLE_PROMPTS = [
  'Log into Facebook with my credentials, scroll the feed for 30 seconds, then like the first 3 posts',
  'Navigate to Amazon, search for "wireless headphones", extract the name and price of the first 5 results',
  'Fill out a contact form at /contact with name "John Doe", email "john@example.com", message "Hello"',
  'Go to Shopee, add the first product to cart, then take a screenshot'
]

export function WorkflowGenerator({ onImport }: Props) {
  const [prompt, setPrompt]           = useState('')
  const [generating, setGenerating]   = useState(false)
  const [result, setResult]           = useState<AiWorkflowResult | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [explaining, setExplaining]   = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [workflowName, setWorkflowName] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setResult(null)
    setError(null)
    setExplanations({})
    try {
      const res = await (window.api as any).ai.generateWorkflow(prompt)
      setResult(res)
      // Derive a sensible default name from the prompt
      setWorkflowName(prompt.slice(0, 40).trim() || 'AI Generated Workflow')
    } catch (e: any) {
      setError(e.message ?? 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleExplainStep = async (step: AutomationStep) => {
    if (explaining === step.id) return
    setExplaining(step.id)
    try {
      const explanation = await (window.api as any).ai.explainStep(step)
      setExplanations((prev) => ({ ...prev, [step.id]: explanation }))
    } catch {
      setExplanations((prev) => ({ ...prev, [step.id]: 'Could not generate explanation.' }))
    } finally {
      setExplaining(null)
    }
  }

  const handleImport = () => {
    if (!result) return
    onImport(result.steps, workflowName || 'AI Generated Workflow')
    setResult(null)
    setPrompt('')
  }

  return (
    <div className="space-y-5">
      {/* Prompt input */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Describe what you want to automate
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Log into my account, scroll the feed, and like the first 3 posts..."
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-ghost-500 focus:ring-1 focus:ring-ghost-500/40"
        />
      </div>

      {/* Example prompts */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <Lightbulb className="w-3.5 h-3.5" />
          Example prompts
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex)}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors text-left"
            >
              {ex.slice(0, 50)}…
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || generating}
        className="flex items-center gap-2 px-4 py-2 bg-ghost-600 hover:bg-ghost-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          : <><Wand2 className="w-4 h-4" /> Generate Workflow</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-start gap-2 p-3 bg-ghost-500/10 border border-ghost-500/20 rounded-lg">
            <CheckCircle className="w-4 h-4 text-ghost-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-white">{result.summary}</div>
              {result.notes && (
                <div className="text-xs text-slate-400 mt-1">{result.notes}</div>
              )}
            </div>
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {result.steps.map((step, idx) => (
              <div key={step.id} className="border border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <span className="w-5 h-5 rounded bg-slate-700 text-xs text-slate-400 flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-300 flex-1">{step.label ?? step.action}</span>
                  <span className="text-xs text-slate-500 font-mono">{step.action}</span>
                  {expandedStep === step.id
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  }
                </button>

                {expandedStep === step.id && (
                  <div className="px-3 pb-3 border-t border-slate-700/50 bg-slate-900/30">
                    {/* Params */}
                    <pre className="text-xs text-slate-400 mt-2 whitespace-pre-wrap break-all">
                      {JSON.stringify(step.params, null, 2)}
                    </pre>

                    {/* Explain / explanation */}
                    {explanations[step.id] ? (
                      <div className="mt-2 text-xs text-ghost-300 bg-ghost-500/10 rounded px-2 py-1.5">
                        {explanations[step.id]}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleExplainStep(step)}
                        disabled={explaining === step.id}
                        className="mt-2 flex items-center gap-1.5 text-xs text-ghost-400 hover:text-ghost-300"
                      >
                        {explaining === step.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Explaining...</>
                          : <><Lightbulb className="w-3 h-3" /> Explain this step</>
                        }
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Import controls */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ghost-500"
            />
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              <Copy className="w-4 h-4" />
              Import to Builder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
