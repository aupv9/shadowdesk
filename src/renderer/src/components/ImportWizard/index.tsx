import { useState } from 'react'
import { X, Upload, FileText, FileJson, FileArchive, ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { useImportStore } from '../../stores/importStore'
import { useProfileStore } from '../../stores/profileStore'
import { PreviewGrid } from './PreviewGrid'
import type { ImportFormat } from '../../../../shared/types'

export function ImportWizard() {
  const {
    wizardOpen, wizardStep, format, options, preview, result, loading, error,
    setFormat, setFileData, setZipBuffers,
    setDuplicateResolution, setSelectiveFields,
    setAssignProxyId, setAssignGroupId,
    goToStep, runPreview, executeImport, closeWizard
  } = useImportStore()
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles)

  if (!wizardOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    if (format === 'zip') {
      const buffers: { buffer: Buffer; filename: string }[] = []
      for (const file of files) {
        const ab = await file.arrayBuffer()
        buffers.push({ buffer: Buffer.from(ab), filename: file.name })
      }
      setZipBuffers(buffers)
    } else {
      const file = files[0]
      const text = await file.text()
      setFileData({ text, filename: file.name })
    }
    goToStep('options')
  }

  const handleBack = () => {
    if (wizardStep === 'upload') goToStep('format')
    else if (wizardStep === 'options') goToStep('upload')
    else if (wizardStep === 'preview') goToStep('options')
  }

  const handleImportComplete = async () => {
    await fetchProfiles()
    closeWizard()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-[800px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Import Profiles</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {wizardStep === 'format' && 'Choose import format'}
              {wizardStep === 'upload' && 'Upload your file'}
              {wizardStep === 'options' && 'Configure import options'}
              {wizardStep === 'preview' && `Preview: ${preview?.totalRows ?? 0} profiles`}
              {wizardStep === 'importing' && 'Importing profiles...'}
              {wizardStep === 'results' && 'Import complete'}
            </p>
          </div>
          <button onClick={closeWizard} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-700/50">
          {['format', 'upload', 'options', 'preview', 'results'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                wizardStep === step ? 'bg-indigo-500 text-white' :
                ['format', 'upload', 'options', 'preview', 'results'].indexOf(wizardStep) > i ? 'bg-green-600 text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {i + 1}
              </div>
              {i < 4 && <ChevronRight size={14} className="text-slate-600" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Format Selection */}
          {wizardStep === 'format' && (
            <div className="grid grid-cols-3 gap-4">
              {([
                { key: 'csv', icon: FileText, label: 'CSV File', desc: 'name, preset, notes, proxy_id, group_id, fingerprint_json' },
                { key: 'json', icon: FileJson, label: 'JSON File', desc: 'Array of profile objects with all fields' },
                { key: 'zip', icon: FileArchive, label: 'ZIP Bundle', desc: 'ShadowDesk .zip exports (single or multi)' }
              ] as const).map((fmt) => (
                <button
                  key={fmt.key}
                  onClick={() => { setFormat(fmt.key); goToStep('upload') }}
                  className={`p-5 rounded-lg border text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 ${
                    format === fmt.key ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <fmt.icon size={28} className="text-indigo-400 mb-3" />
                  <div className="text-white font-medium">{fmt.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: File Upload */}
          {wizardStep === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Upload size={48} className="text-slate-500 mb-4" />
              <p className="text-slate-300 mb-4">
                {format === 'zip' ? 'Select one or more .zip files' : `Select a .${format} file`}
              </p>
              <label className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer transition-colors font-medium">
                Choose File{format === 'zip' ? 's' : ''}
                <input
                  type="file"
                  className="hidden"
                  accept={format === 'csv' ? '.csv' : format === 'json' ? '.json' : '.zip'}
                  multiple={format === 'zip'}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {/* Step 3: Options */}
          {wizardStep === 'options' && (
            <div className="space-y-6">
              {/* Duplicate handling */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Duplicate Handling</label>
                <div className="flex gap-3">
                  {([
                    { key: 'skip', label: 'Skip', desc: 'Don\'t import duplicates' },
                    { key: 'rename', label: 'Rename', desc: 'Add (2), (3)...' },
                    { key: 'overwrite', label: 'Allow', desc: 'Import anyway' }
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setDuplicateResolution(opt.key)}
                      className={`flex-1 px-4 py-3 rounded-lg border text-left text-sm ${
                        options.duplicateResolution === opt.key
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selective fields */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Fields to Import</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'name', label: 'Profile Name' },
                    { key: 'fingerprint', label: 'Fingerprint Config' },
                    { key: 'cookies', label: 'Cookies Snapshot' },
                    { key: 'notes', label: 'Notes & Metadata' }
                  ] as const).map((field) => (
                    <label key={field.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/30 cursor-pointer hover:bg-slate-700/50">
                      <input
                        type="checkbox"
                        checked={options.selectiveFields[field.key]}
                        onChange={(e) => setSelectiveFields({ [field.key]: e.target.checked })}
                        className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-300">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {wizardStep === 'preview' && preview && (
            <div>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{preview.totalRows}</div>
                  <div className="text-xs text-slate-400">Total</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{preview.validCount}</div>
                  <div className="text-xs text-green-400/70">Ready</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{preview.duplicateCount}</div>
                  <div className="text-xs text-yellow-400/70">Duplicates</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{preview.errorCount}</div>
                  <div className="text-xs text-red-400/70">Errors</div>
                </div>
              </div>

              <PreviewGrid rows={preview.rows} />
            </div>
          )}

          {/* Step 5: Importing */}
          {wizardStep === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={48} className="text-indigo-400 animate-spin mb-4" />
              <p className="text-slate-300">Importing profiles...</p>
            </div>
          )}

          {/* Step 6: Results */}
          {wizardStep === 'results' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 size={24} className="text-green-400" />
                <div>
                  <div className="text-white font-medium">Import completed</div>
                  <div className="text-sm text-green-400/80">
                    {result.successCount} imported, {result.duplicateCount} duplicates skipped, {result.errorCount} errors
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-400">Issues</h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-slate-700/30">
                        {err.status === 'duplicate' ? (
                          <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                        )}
                        <span className="text-slate-300">
                          <span className="font-medium">{err.profile_name}</span>: {err.error_message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <div>
            {['upload', 'options', 'preview'].includes(wizardStep) && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {wizardStep === 'options' && (
              <button
                onClick={runPreview}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Preview Import
              </button>
            )}
            {wizardStep === 'preview' && preview && preview.validCount > 0 && (
              <button
                onClick={executeImport}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Import {preview.validCount} Profile{preview.validCount !== 1 ? 's' : ''}
              </button>
            )}
            {wizardStep === 'results' && (
              <button
                onClick={handleImportComplete}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
