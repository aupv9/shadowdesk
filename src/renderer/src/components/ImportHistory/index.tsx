import { useEffect, useState } from 'react'
import { History, FileUp, ChevronRight, Trash2, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, BarChart3 } from 'lucide-react'
import { useImportStore } from '../../stores/importStore'
import type { ImportRecordEntry } from '../../../../shared/types'

export function ImportHistory() {
  const {
    sessions, selectedSession, selectedRecords, historyLoading, stats,
    fetchSessions, fetchRecords, deleteSession, fetchStats
  } = useImportStore()

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
    fetchStats()
  }, [])

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      deleteSession(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString()
    } catch {
      return d
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 size={14} className="text-green-400" />
      case 'duplicate': return <AlertTriangle size={14} className="text-yellow-400" />
      case 'error': return <XCircle size={14} className="text-red-400" />
      default: return <span className="text-slate-500">—</span>
    }
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {selectedSession ? (
            <button onClick={() => useImportStore.setState({ selectedSession: null, selectedRecords: [] })} className="p-1 rounded hover:bg-slate-700 text-slate-400">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <History size={24} className="text-indigo-400" />
          )}
          <div>
            <h2 className="text-xl font-semibold text-white">
              {selectedSession ? `Session: ${selectedSession.original_filename ?? selectedSession.id.slice(0, 8)}` : 'Import History'}
            </h2>
            <p className="text-sm text-slate-400">
              {selectedSession
                ? `${selectedSession.success_count} imported, ${selectedSession.duplicate_count} duplicates, ${selectedSession.error_count} errors`
                : `${sessions.length} import sessions`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {!selectedSession && stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={16} className="text-indigo-400" />
              <span className="text-xs text-slate-400">Total Sessions</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalSessions}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-xs text-slate-400">Profiles Imported</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.totalImported}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={16} className="text-red-400" />
              <span className="text-xs text-slate-400">Total Errors</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.totalErrors}</div>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {!selectedSession && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {historyLoading && <div className="text-slate-500 text-sm text-center py-8">Loading...</div>}
          {!historyLoading && sessions.length === 0 && (
            <div className="text-center py-16">
              <FileUp size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No import sessions yet</p>
              <p className="text-sm text-slate-500 mt-1">Use the Bulk Import wizard from the Profiles section to get started</p>
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/60 transition-colors cursor-pointer group"
              onClick={() => fetchRecords(session.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <FileUp size={20} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {session.original_filename ?? `Import session`}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                    <span>{formatDate(session.timestamp)}</span>
                    <span className="uppercase text-indigo-400 font-medium">{session.import_source}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-400">{session.success_count} ok</span>
                  {session.duplicate_count > 0 && <span className="text-yellow-400">{session.duplicate_count} dup</span>}
                  {session.error_count > 0 && <span className="text-red-400">{session.error_count} err</span>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title={confirmDelete === session.id ? 'Click again to confirm' : 'Delete session'}
                >
                  <Trash2 size={14} className={confirmDelete === session.id ? 'text-red-400' : ''} />
                </button>
                <ChevronRight size={16} className="text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Records detail view */}
      {selectedSession && (
        <div className="flex-1 overflow-y-auto">
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-8">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Profile Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Details</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {selectedRecords.map((rec) => (
                  <tr key={rec.id} className="border-t border-slate-700/50">
                    <td className="px-3 py-2">{statusIcon(rec.status)}</td>
                    <td className="px-3 py-2 text-slate-200 font-medium">{rec.profile_name}</td>
                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[300px] truncate">
                      {rec.status === 'success' && <span className="text-green-400/70">Imported successfully</span>}
                      {rec.status === 'duplicate' && <span className="text-yellow-400">Duplicate — skipped</span>}
                      {rec.status === 'error' && <span className="text-red-400">{rec.error_message}</span>}
                      {rec.status === 'skipped' && <span className="text-slate-500">Skipped</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDate(rec.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
