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
  success: 'border-emerald-500/40 bg-slate-800',
  error:   'border-red-500/40    bg-slate-800',
  info:    'border-blue-500/40   bg-slate-800'
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl ${BG[toast.type]} animate-in slide-in-from-right-5 duration-200`}>
      {ICONS[toast.type]}
      <span className="text-sm text-slate-200 flex-1">{toast.message}</span>
      <button onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-300 transition-colors ml-1">
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
