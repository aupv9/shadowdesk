import React from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import type { Toast } from '../../types'

const ICONS: Record<Toast['type'], React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
  error:   <XCircle    className="w-4 h-4 text-red-400    shrink-0" />,
  info:    <Info       className="w-4 h-4 text-blue-400   shrink-0" />
}

const BG: Record<Toast['type'], string> = {
  success: 'border-emerald-500/30 bg-slate-800/80 backdrop-blur-sm',
  error:   'border-red-500/30    bg-slate-800/80 backdrop-blur-sm',
  info:    'border-blue-500/30   bg-slate-800/80 backdrop-blur-sm'
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl shadow-black/50 ${BG[toast.type]} animate-in slide-in-from-right-5 duration-300`}>
      {ICONS[toast.type]}
      <span className="text-sm text-slate-100 flex-1">{toast.message}</span>
      {/* Phase 4.3: Optional action button (e.g. Undo) */}
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick()
            dismiss(toast.id)
          }}
          className="text-xs font-medium text-ghost-300 hover:text-ghost-200 transition-all duration-200 px-2 py-0.5 rounded border border-ghost-500/40 hover:border-ghost-400 hover:bg-ghost-600/20"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-300 transition-all duration-200 ml-1 hover:bg-slate-700/30 rounded p-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
