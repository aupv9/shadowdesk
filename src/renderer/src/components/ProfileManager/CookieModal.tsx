import React, { useEffect, useState } from 'react'
import { X, Upload, Copy, Check } from 'lucide-react'

interface Props {
  profileId: string
  mode: 'import' | 'export'
  onClose: () => void
}

export function CookieModal({ profileId, mode, onClose }: Props) {
  const [format,  setFormat]  = useState<'json' | 'netscape'>('json')
  const [text,    setText]    = useState('')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState('')
  const [count,   setCount]   = useState<number | null>(null)

  // On export mode, load cookies immediately
  useEffect(() => {
    if (mode === 'export') loadExport()
  }, [format])

  const loadExport = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.cookies.export(profileId, format)
      setText(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!text.trim()) { setError('Paste cookie content first'); return }
    setLoading(true)
    setError('')
    try {
      const n = await window.api.cookies.import(profileId, text.trim(), format)
      setCount(n)
      setTimeout(onClose, 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">
            {mode === 'import' ? 'Import Cookies' : 'Export Cookies'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-2 mb-4">
          {(['json', 'netscape'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                format === f
                  ? 'bg-ghost-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'json' ? 'JSON Array' : 'Netscape'}
            </button>
          ))}
        </div>

        <textarea
          className="input resize-none h-52 font-mono text-xs"
          readOnly={mode === 'export'}
          placeholder={
            mode === 'import'
              ? format === 'json'
                ? '[{"name":"session","value":"abc","domain":"example.com","path":"/"}]'
                : '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tsession\tabc'
              : loading ? 'Loading...' : ''
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {count !== null && (
          <p className="text-sm text-green-400 mt-2">✓ {count} cookies imported</p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          {mode === 'export' ? (
            <button onClick={handleCopy} className="btn-primary text-sm flex items-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          ) : (
            <button onClick={handleImport} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {loading ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
