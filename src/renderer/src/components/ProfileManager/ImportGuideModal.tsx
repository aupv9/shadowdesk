import React, { useState } from 'react'
import { X, Upload, FileArchive, Info, Check, AlertTriangle } from 'lucide-react'

interface Props {
  onConfirm: () => void
  onClose: () => void
}

/**
 * Pre-import guide modal. Explains the `.ghost.zip` bundle format, lists what
 * is and isn't included, and surfaces multi-select usage. The "Don't show this
 * again" choice persists in localStorage; when set, ProfileManager skips the
 * modal and opens the file picker directly.
 */
export function ImportGuideModal({ onConfirm, onClose }: Props) {
  const [skipNext, setSkipNext] = useState(false)

  const handleConfirm = () => {
    if (skipNext) {
      try {
        localStorage.setItem('ghostbrowser.importGuideDismissed', '1')
      } catch {
        // localStorage may be disabled in some environments — non-fatal
      }
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-ghost-400" />
            <h2 className="text-base font-semibold text-white">Import Profiles</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Format */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FileArchive className="w-4 h-4 text-ghost-400" />
              <h3 className="text-sm font-semibold text-white">Expected format</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              ShadowDesk profile bundles use the <code className="px-1 py-0.5 rounded bg-slate-900 text-ghost-300">.ghost.zip</code> extension
              (any <code className="px-1 py-0.5 rounded bg-slate-900 text-ghost-300">.zip</code> with the right contents will also work).
              Bundles are produced by <span className="text-slate-300">Profile menu → Export Bundle</span> in any ShadowDesk
              installation. They are not compatible with bundles from other anti-detect tools.
            </p>
          </div>

          {/* What's inside */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Info className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">What gets imported</h3>
            </div>
            <ul className="text-xs text-slate-400 space-y-1 ml-1">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><span className="text-slate-300">Profile name &amp; notes</span> (name will be suffixed with <code className="px-1 rounded bg-slate-900 text-ghost-300">(Imported)</code> to avoid collisions)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><span className="text-slate-300">Fingerprint config</span> — preset, OS, hardware, screen, fonts, noise seeds, behavior</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><span className="text-slate-300">Cookies</span> snapshot at the time of export</span>
              </li>
            </ul>
          </div>

          {/* What's NOT imported */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Not included in the bundle</h3>
            </div>
            <ul className="text-xs text-slate-400 space-y-1 ml-1">
              <li className="flex items-start gap-2">
                <span className="text-slate-600 shrink-0">•</span>
                <span><span className="text-slate-300">Proxy assignment</span> — re-attach a proxy after import from the profile's Edit menu</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-600 shrink-0">•</span>
                <span><span className="text-slate-300">Group membership</span> — drop the imported profile into a group manually</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-600 shrink-0">•</span>
                <span><span className="text-slate-300">Browser user-data</span> (history, localStorage, IndexedDB, cache) — a fresh user-data dir is created on first launch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-600 shrink-0">•</span>
                <span><span className="text-slate-300">Extensions</span> — re-attach from the Extensions modal after import</span>
              </li>
            </ul>
          </div>

          {/* Multi-select tip */}
          <div className="rounded-lg bg-ghost-600/10 border border-ghost-600/30 px-3 py-2.5">
            <p className="text-xs text-slate-300">
              <span className="font-semibold text-ghost-300">Tip:</span> Hold <kbd className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] font-mono border border-slate-700">Ctrl</kbd>
              {' '}or{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] font-mono border border-slate-700">Shift</kbd>
              {' '}in the file picker to select multiple bundles at once. Each file is imported sequentially, and a failed bundle won't abort the rest.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 p-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipNext}
              onChange={(e) => setSkipNext(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-ghost-500 focus:ring-ghost-500 focus:ring-offset-0"
            />
            Don't show this again
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-ghost text-sm px-3 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="btn-primary text-sm flex items-center gap-2 px-3 py-2"
            >
              <Upload className="w-4 h-4" />
              Choose files…
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
