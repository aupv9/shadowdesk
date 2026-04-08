import React, { useState, useMemo } from 'react'
import { X, ChevronRight, Play } from 'lucide-react'
import type { WorkflowCreationMethod } from './WorkflowCreationFlow'
import { GuideRating } from './GuideRating'
import { assignVariant, getVariantConfig } from '../../utils/abTestingEngine'
import {
  trackVideoWatched,
  trackGuideRated,
  trackVariantAssigned
} from '../../utils/workflowAnalytics'

interface MethodGuideModalProps {
  method: WorkflowCreationMethod
  onClose: () => void
  userId?: string
}

interface GuideStep {
  number: number
  title: string
  description: string
  time: string
}

const GUIDES: Record<WorkflowCreationMethod, { title: string; description: string; steps: GuideStep[]; videoUrl?: string }> = {
  record: {
    title: 'Record your actions',
    description: 'Automate tasks by recording yourself doing them. No coding needed.',
    steps: [
      {
        number: 1,
        title: 'Launch a profile',
        description: 'Select a profile from the left sidebar and click the play button to open it in a browser.',
        time: '30s'
      },
      {
        number: 2,
        title: 'Click "Start Recording"',
        description: 'In the recorder panel, click the red record button to begin capturing your actions.',
        time: '10s'
      },
      {
        number: 3,
        title: 'Do the task yourself',
        description: 'Perform the task you want to automate—click, type, scroll, etc. Everything is recorded.',
        time: '2–5m'
      },
      {
        number: 4,
        title: 'Save your workflow',
        description: 'Review the captured steps, make adjustments if needed, then save as a workflow.',
        time: '1m'
      }
    ],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  template: {
    title: 'Use a template',
    description: 'Start with pre-built workflows for popular sites. Just fill in the blanks.',
    steps: [
      {
        number: 1,
        title: 'Pick a template',
        description: 'Browse the template library for common tasks like login, search, scrape, or checkout.',
        time: '30s'
      },
      {
        number: 2,
        title: 'Fill in the details',
        description: 'Enter your specific inputs—username, search term, product name, etc.',
        time: '1–2m'
      },
      {
        number: 3,
        title: 'Preview steps',
        description: 'Review the generated steps to make sure they match your intent.',
        time: '1m'
      },
      {
        number: 4,
        title: 'Save and run',
        description: 'Save the workflow and start automating immediately.',
        time: '30s'
      }
    ]
  },
  ai: {
    title: 'Use AI to build',
    description: 'Describe what you want in plain English. AI generates the workflow for you.',
    steps: [
      {
        number: 1,
        title: 'Describe your task',
        description: 'Write what you want in natural language (e.g., "search Shopee for headphones, get first 5 results").',
        time: '1–2m'
      },
      {
        number: 2,
        title: 'AI generates steps',
        description: 'The AI creates a workflow based on your description, including selectors and parameters.',
        time: '10–30s'
      },
      {
        number: 3,
        title: 'Review and refine',
        description: 'Check each step. Edit selectors or parameters if the AI made mistakes.',
        time: '2–5m'
      },
      {
        number: 4,
        title: 'Save and test',
        description: 'Save the workflow and do a test run to verify it works.',
        time: '1m'
      }
    ]
  },
  scratch: {
    title: 'Build from scratch',
    description: 'Full control. Add each step manually for complex or custom workflows.',
    steps: [
      {
        number: 1,
        title: 'Create blank workflow',
        description: 'Start with an empty workflow. You can add steps as you go.',
        time: '30s'
      },
      {
        number: 2,
        title: 'Add steps one by one',
        description: 'Click "Add Step" and choose from 60+ actions (navigate, click, extract, etc.).',
        time: '5–30m'
      },
      {
        number: 3,
        title: 'Configure each step',
        description: 'Set selectors, parameters, wait conditions, error handling, and more.',
        time: '30s–2m per step'
      },
      {
        number: 4,
        title: 'Test and iterate',
        description: 'Run the workflow, fix issues, and refine until it works perfectly.',
        time: '5–15m'
      }
    ]
  }
}

export function MethodGuideModal({
  method,
  onClose,
  userId = 'default'
}: MethodGuideModalProps) {
  const guide = GUIDES[method]
  const [hasRated, setHasRated] = useState(false)

  // Assign variant for A/B testing
  const variant = useMemo(() => {
    const assigned = assignVariant(userId)
    trackVariantAssigned(method, assigned)
    return assigned
  }, [userId, method])

  const variantConfig = getVariantConfig(variant)

  const handleGuideRated = (isHelpful: boolean) => {
    trackGuideRated(method, isHelpful)
    setHasRated(true)
  }

  const handleVideoWatched = () => {
    trackVideoWatched(method, 0) // timestamp tracked internally
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex-1">
            <h2 id="guide-title" className="text-lg font-semibold text-white">
              {guide.title}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{guide.description}</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-slate-600 mt-1">
                (Variant: {variant})
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Video embed (show based on variant) */}
          {guide.videoUrl && variantConfig.showVideo && (
            <div className="mb-6">
              <div className="aspect-video bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                <iframe
                  src={guide.videoUrl}
                  width="100%"
                  height="100%"
                  title={`${guide.title} tutorial video`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                  onLoad={handleVideoWatched}
                />
              </div>
            </div>
          )}

          {/* Steps */}
          {variantConfig.showSteps && (
            <div className="space-y-3">
              {guide.steps.map((step, idx) => (
                <div
                  key={step.number}
                  className="flex gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                >
                  {/* Step number */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-ghost-500/20 border border-ghost-500/30 flex items-center justify-center">
                    <span className="text-sm font-semibold text-ghost-400">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="text-sm font-medium text-white">
                        {step.title}
                      </h3>
                      {idx < guide.steps.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      {step.description}
                    </p>
                    {variantConfig.showTiming && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Play className="w-3 h-3" />
                        {step.time}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total time */}
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-sm text-emerald-300 font-medium">
              ⏱️ Total time:{' '}
              {method === 'record'
                ? '2–5 minutes'
                : method === 'template'
                  ? '5–10 minutes'
                  : method === 'ai'
                    ? '5–10 minutes'
                    : '15–45 minutes'}
            </p>
          </div>

          {/* Guide rating */}
          {!hasRated && (
            <div className="mt-4">
              <GuideRating method={method} onRate={handleGuideRated} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-900/80 flex items-center justify-between">
          <p className="text-xs text-slate-500">Ready to get started?</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ghost-500 hover:bg-ghost-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start now
          </button>
        </div>
      </div>
    </div>
  )
}
