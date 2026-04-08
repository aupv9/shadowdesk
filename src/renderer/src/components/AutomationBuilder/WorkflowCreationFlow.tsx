import React, { useState, useEffect } from 'react'
import {
  X,
  Video,
  Layers,
  Wand2,
  Wrench,
  ChevronRight,
  Sparkles,
  Clock,
  GraduationCap,
  Info,
  HelpCircle
} from 'lucide-react'
import { MethodGuideModal } from './MethodGuideModal'
import { trackWorkflowCreationMethodSelected, trackMethodGuideViewed } from '../../utils/workflowAnalytics'

/**
 * Phase 1 — Guided Entry Point for workflow creation.
 *
 * Replaces the old "New Workflow" modal that dropped users into a blank
 * canvas. Instead, presents 4 clear paths to workflow creation, each
 * tailored to a different user skill level and intent.
 *
 * Design goals:
 *   1. Clear discovery — non-tech users immediately see what's available
 *   2. Progressive disclosure — advanced options are marked clearly
 *   3. Success-oriented — recommended path is highlighted for beginners
 *   4. Forgiving — user can back out and try another method
 */

export type WorkflowCreationMethod = 'record' | 'template' | 'ai' | 'scratch'

interface WorkflowCreationFlowProps {
  onClose: () => void
  onSelectMethod: (method: WorkflowCreationMethod) => void
  /** When true, shows a "first time?" banner at the top. */
  isFirstTime?: boolean
}

interface MethodCard {
  id: WorkflowCreationMethod
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  subtitle: string
  description: string
  bestFor: string
  timeEstimate: string
  difficulty: 'Beginner' | 'Easy' | 'Medium' | 'Advanced'
  recommended?: boolean
}

const METHODS: MethodCard[] = [
  {
    id: 'record',
    icon: Video,
    iconColor: 'text-rose-300',
    iconBg: 'bg-rose-500/15 border-rose-500/30',
    title: 'Record my actions',
    subtitle: 'Do it once, play it back forever',
    description:
      'Open a profile, click "Record", then do the task yourself in the browser. We turn your clicks, typing and scrolling into an automation.',
    bestFor: 'Users with no coding experience who want to automate a task they already know how to do',
    timeEstimate: '2–5 minutes',
    difficulty: 'Beginner',
    recommended: true
  },
  {
    id: 'template',
    icon: Layers,
    iconColor: 'text-sky-300',
    iconBg: 'bg-sky-500/15 border-sky-500/30',
    title: 'Use a template',
    subtitle: '20+ ready-made workflows',
    description:
      'Pick from pre-built workflows for popular sites like Shopee, Lazada, TikTok Shop, Tiki, VNPay and Grab. Just fill in the blanks.',
    bestFor: 'Common tasks on well-known sites (login, search, scrape products, checkout)',
    timeEstimate: '1–3 minutes',
    difficulty: 'Easy'
  },
  {
    id: 'ai',
    icon: Wand2,
    iconColor: 'text-violet-300',
    iconBg: 'bg-violet-500/15 border-violet-500/30',
    title: 'Describe it in plain English',
    subtitle: 'AI builds the workflow for you',
    description:
      'Tell the AI what you want (e.g. "search Shopee for headphones, extract the first 5 titles and prices") and it will generate the steps.',
    bestFor: 'When you know what you want but not how to build it step-by-step',
    timeEstimate: '1–2 minutes',
    difficulty: 'Easy'
  },
  {
    id: 'scratch',
    icon: Wrench,
    iconColor: 'text-amber-300',
    iconBg: 'bg-amber-500/15 border-amber-500/30',
    title: 'Build from scratch',
    subtitle: 'Manual step-by-step builder',
    description:
      'Start with a blank workflow and add each step manually. Full control over actions, selectors, and parameters.',
    bestFor: 'Power users who want fine-grained control or are migrating an existing script',
    timeEstimate: '10+ minutes',
    difficulty: 'Advanced'
  }
]

const DIFFICULTY_COLORS: Record<MethodCard['difficulty'], string> = {
  Beginner: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Easy: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Advanced: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
}

export function WorkflowCreationFlow({
  onClose,
  onSelectMethod,
  isFirstTime = false
}: WorkflowCreationFlowProps) {
  const [hovered, setHovered] = useState<WorkflowCreationMethod | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<WorkflowCreationMethod | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)

  const handleSelect = (method: WorkflowCreationMethod) => {
    trackWorkflowCreationMethodSelected(method, isFirstTime)
    onSelectMethod(method)
  }

  const handleShowGuide = (method: WorkflowCreationMethod) => {
    trackMethodGuideViewed(method)
    setSelectedGuide(method)
  }

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % METHODS.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + METHODS.length) % METHODS.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(METHODS[focusedIndex].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, focusedIndex])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-creation-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700/60">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-ghost-400" />
              <h2
                id="workflow-creation-title"
                className="text-xl font-semibold text-white"
              >
                Create a new workflow
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              Choose how you want to build your automation. Not sure?{' '}
              <span className="text-emerald-400 font-medium">
                We recommend recording
              </span>{' '}
              for first-time users.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* First-time banner */}
        {isFirstTime && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <GraduationCap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="text-emerald-300 font-medium">
                First time here? Welcome!
              </div>
              <div className="text-slate-400 mt-0.5">
                Recording is the easiest way to get started — no coding
                knowledge required. You just do the task once in the browser
                and we&apos;ll remember it.
              </div>
            </div>
          </div>
        )}

        {/* Method cards */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METHODS.map((method, idx) => {
              const Icon = method.icon
              const isHovered = hovered === method.id
              const isFocused = focusedIndex === idx
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleSelect(method.id)}
                  onMouseEnter={() => setHovered(method.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setFocusedIndex(idx)}
                  className={`group relative text-left p-4 rounded-xl border transition-all transform ${
                    isFocused
                      ? 'scale-105 bg-slate-800 border-ghost-500 shadow-lg shadow-ghost-500/20 ring-2 ring-ghost-500/50'
                      : isHovered
                        ? 'bg-slate-800 border-ghost-500/60 shadow-lg shadow-ghost-500/10'
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                  } animate-in fade-in slide-in-from-bottom-2 duration-500`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {method.recommended && (
                    <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-semibold rounded-full shadow-md">
                      <Sparkles className="w-3 h-3" />
                      Recommended
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${method.iconBg}`}
                    >
                      <Icon className={`w-5 h-5 ${method.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {method.title}
                        </h3>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-500 transition-transform ${
                            isHovered ? 'translate-x-0.5 text-ghost-400' : ''
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mb-2">
                        {method.subtitle}
                      </p>

                      <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                        {method.description}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            DIFFICULTY_COLORS[method.difficulty]
                          }`}
                        >
                          {method.difficulty}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {method.timeEstimate}
                        </span>
                      </div>

                      {isHovered && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
                          <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                            <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                            <span>
                              <span className="text-slate-300 font-medium">
                                Best for:
                              </span>{' '}
                              {method.bestFor}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleShowGuide(method.id)
                            }}
                            className="flex items-center gap-1.5 text-[11px] text-ghost-300 hover:text-ghost-200 font-medium transition-colors"
                          >
                            <HelpCircle className="w-3 h-3" />
                            View step-by-step guide
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/60 bg-slate-900/80">
          <p className="text-xs text-slate-500">
            You can always switch methods — nothing is saved until you create
            the workflow.
          </p>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Method guide modal */}
      {selectedGuide && (
        <MethodGuideModal
          method={selectedGuide}
          onClose={() => setSelectedGuide(null)}
        />
      )}
    </div>
  )
}
