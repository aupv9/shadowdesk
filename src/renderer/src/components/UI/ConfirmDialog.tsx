/**
 * Phase 13.C — Reusable confirmation dialog.
 *
 * Replaces browser-native `confirm()` calls with a styled modal that
 * fits the app's dark theme and supports:
 *  - Custom title, message, and button labels
 *  - Destructive (danger) variant for irreversible actions
 *  - Keyboard support: Enter → confirm, Escape → cancel
 *
 * Usage (imperative, via useConfirm hook):
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({
 *     title: 'Delete Profile',
 *     message: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     destructive: true,
 *   })
 *   if (ok) deleteProfile(id)
 */

import React, { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { create } from 'zustand'

// ── Internal state managed by Zustand ────────────────────────────────────────

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions | null
  resolve: ((value: boolean) => void) | null
  show: (opts: ConfirmOptions) => Promise<boolean>
  _confirm: () => void
  _cancel: () => void
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,

  show: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({ open: true, options: opts, resolve })
    })
  },

  _confirm: () => {
    get().resolve?.(true)
    set({ open: false, options: null, resolve: null })
  },

  _cancel: () => {
    get().resolve?.(false)
    set({ open: false, options: null, resolve: null })
  },
}))

// ── Public hook ───────────────────────────────────────────────────────────────

/**
 * Returns an async function that opens the confirmation dialog.
 * Returns `true` if the user confirmed, `false` if they cancelled.
 */
export function useConfirm() {
  return useConfirmStore((s) => s.show)
}

// ── Dialog component — mount once near the top of the React tree ─────────────

export function ConfirmDialog() {
  const { open, options, _confirm, _cancel } = useConfirmStore()
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Focus confirm button on open (or cancel button for destructive)
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard: Enter → confirm, Escape → cancel
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); _cancel() }
      if (e.key === 'Enter')  { e.preventDefault(); _confirm() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, _confirm, _cancel])

  if (!open || !options) return null

  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    destructive  = false,
  } = options

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={_cancel}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              destructive ? 'bg-red-500/15' : 'bg-amber-500/15'
            }`}
          >
            {destructive ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <HelpCircle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <h3 id="confirm-title" className="text-white font-semibold text-base">
              {title}
            </h3>
            <p id="confirm-message" className="text-slate-400 text-sm mt-1">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-1">
          <button
            onClick={_cancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={_confirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
