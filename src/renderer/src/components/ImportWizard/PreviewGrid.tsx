import { CheckCircle2, AlertTriangle, XCircle, Fingerprint, Cookie } from 'lucide-react'
import type { ImportPreviewRow } from '../../../../shared/types'

interface Props {
  rows: ImportPreviewRow[]
}

export function PreviewGrid({ rows }: Props) {
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500 text-center py-8">No rows to preview</div>
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Preset</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-8" title="Fingerprint">
                <Fingerprint size={14} />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-8" title="Cookies">
                <Cookie size={14} />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t border-slate-700/50 ${
                row.status === 'error' ? 'bg-red-500/5' :
                row.status === 'duplicate' ? 'bg-yellow-500/5' : ''
              }`}>
                <td className="px-3 py-2 text-slate-500">{row.index + 1}</td>
                <td className="px-3 py-2">
                  {row.status === 'ready' && <CheckCircle2 size={16} className="text-green-400" />}
                  {row.status === 'duplicate' && <AlertTriangle size={16} className="text-yellow-400" />}
                  {row.status === 'error' && <XCircle size={16} className="text-red-400" />}
                </td>
                <td className="px-3 py-2 text-slate-200 font-medium max-w-[180px] truncate">{row.name}</td>
                <td className="px-3 py-2 text-slate-400 text-xs font-mono">{row.preset}</td>
                <td className="px-3 py-2">
                  {row.fingerprintProvided ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.cookiesProvided ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs max-w-[200px]">
                  {row.status === 'duplicate' && row.duplicateOf && (
                    <span className="text-yellow-400">
                      Duplicate of &quot;{row.duplicateOf.name}&quot; ({row.duplicateType})
                    </span>
                  )}
                  {row.errors.length > 0 && (
                    <span className="text-red-400">{row.errors[0]}</span>
                  )}
                  {row.status === 'ready' && row.errors.length === 0 && (
                    <span className="text-green-400/70">Ready to import</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
