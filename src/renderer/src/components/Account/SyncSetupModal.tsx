import React, { useMemo, useState } from 'react'
import { X, Lock, AlertTriangle, ShieldCheck, Eye, EyeOff } from 'lucide-react'

const STORAGE_KEY = 'ghostbrowser.sync.setupCompleted'

export function isSyncSetupCompleted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

export function markSyncSetupCompleted(): void {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
}

/**
 * C2 — First-time sync wizard.
 *
 * Two-step modal: confirm-password (typed twice with strength meter) +
 * zero-knowledge warning. Shown on the user's first Push or Pull. After
 * successful confirmation a localStorage flag suppresses it on subsequent
 * sessions.
 *
 * The wizard does NOT perform the sync itself — it only validates that the
 * user has typed a strong password twice and acknowledges the
 * unrecoverability warning. The caller receives the confirmed password
 * via `onConfirm` and runs push/pull as normal.
 */
export function SyncSetupModal({
  intent,
  onConfirm,
  onClose
}: {
  intent: 'push' | 'pull'
  onConfirm: (password: string) => void
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: 'empty', color: 'bg-slate-700' }
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (password.length >= 16) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (score <= 2) return { score, label: 'weak',     color: 'bg-red-500' }
    if (score <= 4) return { score, label: 'okay',     color: 'bg-amber-500' }
    if (score <= 5) return { score, label: 'strong',   color: 'bg-green-500' }
    return                  { score, label: 'excellent', color: 'bg-green-400' }
  }, [password])

  const passwordsMatch = password.length > 0 && password === confirm
  const meetsMinLength = password.length >= 8
  const canProceed = passwordsMatch && meetsMinLength && acknowledged

  const handleSubmit = (): void => {
    if (!canProceed) return
    markSyncSetupCompleted()
    onConfirm(password)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-ghost-400" />
            Set Up Cloud Sync
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Zero-knowledge warning */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300/90 leading-relaxed">
                <strong className="text-amber-300">Zero-knowledge encryption</strong> means
                we cannot recover your password. If you forget it, your cloud-stored
                profiles become permanently unreadable. Save it somewhere safe before
                proceeding.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Encryption password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input w-full pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength meter */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1 capitalize">
                  Strength: <span className="text-slate-300">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className={`input w-full ${
                confirm && !passwordsMatch ? 'border-red-500/50' : ''
              }`}
            />
            {confirm && !passwordsMatch && (
              <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
            )}
            {confirm && passwordsMatch && (
              <p className="text-xs text-green-400 mt-1">Passwords match</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-ghost-600"
            />
            <span>
              I understand that if I forget this password, my cloud-stored profiles
              are <strong className="text-amber-300">permanently unrecoverable</strong>.
            </span>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canProceed}
            className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-40"
          >
            <Lock className="w-4 h-4" />
            {intent === 'push' ? 'Set up & Push' : 'Set up & Pull'}
          </button>
        </div>
      </div>
    </div>
  )
}
