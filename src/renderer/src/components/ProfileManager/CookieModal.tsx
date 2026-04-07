import React, { useEffect, useState } from 'react'
import { X, Upload, Copy, Check, Camera, Plus, Pencil, Trash2, Save, RefreshCw } from 'lucide-react'

interface Props {
  profileId: string
  /** Initial tab to focus when the modal opens. */
  mode: 'browse' | 'import' | 'export'
  isActive?: boolean
  onClose: () => void
}

interface CookieRow {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | string
  // any extras the engine returned (size, session, sourceScheme…) — preserved on save
  [k: string]: any
}

type Tab = 'browse' | 'import' | 'export'

export function CookieModal({ profileId, mode, isActive, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(mode)

  // Browse tab state
  const [cookies, setCookies] = useState<CookieRow[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState('')
  const [search, setSearch] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<CookieRow | null>(null)
  const [browseDirty, setBrowseDirty] = useState(false)
  const [savingBrowse, setSavingBrowse] = useState(false)
  const [browseSavedMsg, setBrowseSavedMsg] = useState('')

  // Import / export shared state
  const [format,  setFormat]  = useState<'json' | 'netscape'>('json')
  const [text,    setText]    = useState('')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState('')
  const [count,   setCount]   = useState<number | null>(null)

  // ── Effects ─────────────────────────────────────────────────────────────

  // On export tab, load formatted text whenever the format changes.
  useEffect(() => {
    if (tab === 'export') loadExport()
  }, [format, tab])

  // On browse tab, load the cookie list.
  useEffect(() => {
    if (tab === 'browse') loadBrowse()
  }, [tab])

  // ── Browse tab ──────────────────────────────────────────────────────────

  const loadBrowse = async () => {
    setBrowseLoading(true)
    setBrowseError('')
    try {
      const list = await window.api.cookies.list(profileId)
      setCookies(list as CookieRow[])
      setBrowseDirty(false)
      setBrowseSavedMsg('')
    } catch (e: any) {
      setBrowseError(e.message ?? 'Failed to load cookies')
    } finally {
      setBrowseLoading(false)
    }
  }

  const startEdit = (i: number) => {
    setEditingIndex(i)
    setDraft({ ...cookies[i] })
  }

  const startCreate = () => {
    setEditingIndex(-1)
    setDraft({ name: '', value: '', domain: '', path: '/' })
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setDraft(null)
  }

  const commitEdit = () => {
    if (!draft) return
    if (!draft.name || !draft.domain) {
      setBrowseError('Name and domain are required')
      return
    }
    setBrowseError('')
    const next = [...cookies]
    if (editingIndex === -1) {
      next.push(draft)
    } else if (editingIndex !== null) {
      next[editingIndex] = draft
    }
    setCookies(next)
    setBrowseDirty(true)
    setEditingIndex(null)
    setDraft(null)
  }

  const deleteRow = (i: number) => {
    const next = cookies.filter((_, idx) => idx !== i)
    setCookies(next)
    setBrowseDirty(true)
    if (editingIndex === i) cancelEdit()
  }

  const saveBrowse = async () => {
    setSavingBrowse(true)
    setBrowseError('')
    try {
      const n = await window.api.cookies.save(profileId, cookies)
      setBrowseDirty(false)
      setBrowseSavedMsg(`✓ Saved ${n} cookies${isActive ? ' (live session updated)' : ''}`)
      setTimeout(() => setBrowseSavedMsg(''), 2500)
    } catch (e: any) {
      setBrowseError(e.message ?? 'Save failed')
    } finally {
      setSavingBrowse(false)
    }
  }

  const captureLive = async () => {
    setBrowseLoading(true)
    setBrowseError('')
    try {
      const list = await window.api.cookies.capture(profileId)
      setCookies(list as CookieRow[])
      setBrowseDirty(false)
      setBrowseSavedMsg(`✓ Captured ${list.length} cookies from live session`)
      setTimeout(() => setBrowseSavedMsg(''), 2500)
    } catch (e: any) {
      setBrowseError(e.message ?? 'Capture failed')
    } finally {
      setBrowseLoading(false)
    }
  }

  const filteredIndexes = cookies
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.name?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.value?.toLowerCase().includes(q)
      )
    })

  // ── Import / export ─────────────────────────────────────────────────────

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

  const handleCapture = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await window.api.cookies.capture(profileId)
      setText(JSON.stringify(list, null, 2))
      setFormat('json')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-white">Cookies</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 border-b border-slate-700">
          {(['browse', 'import', 'export'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'text-white border-ghost-500'
                  : 'text-slate-500 hover:text-slate-300 border-transparent'
              }`}
            >
              {t === 'browse' ? 'Browse / Edit' : t === 'import' ? 'Import' : 'Export'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── Browse tab ───────────────────────────────────────── */}
          {tab === 'browse' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, domain, value…"
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={loadBrowse}
                  disabled={browseLoading}
                  className="btn-ghost p-2 rounded-lg"
                  title="Reload from DB"
                >
                  <RefreshCw className={`w-4 h-4 ${browseLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={startCreate}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {browseError && (
                <div className="mb-3 text-sm text-red-400">{browseError}</div>
              )}
              {browseSavedMsg && (
                <div className="mb-3 text-sm text-emerald-400">{browseSavedMsg}</div>
              )}

              {/* Edit row form */}
              {draft && (
                <div className="mb-4 p-3 rounded-lg border border-ghost-600/40 bg-slate-900/50">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {['name', 'domain'].map((k) => (
                      <div key={k}>
                        <label className="text-[10px] uppercase tracking-wider text-slate-500">{k}</label>
                        <input
                          type="text"
                          value={(draft as any)[k] ?? ''}
                          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                          className="input w-full text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500">value</label>
                    <input
                      type="text"
                      value={draft.value ?? ''}
                      onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                      className="input w-full text-sm font-mono text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">path</label>
                      <input
                        type="text"
                        value={draft.path ?? '/'}
                        onChange={(e) => setDraft({ ...draft, path: e.target.value })}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">expires (unix)</label>
                      <input
                        type="number"
                        value={draft.expires ?? ''}
                        onChange={(e) => setDraft({ ...draft, expires: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="input w-full text-sm"
                        placeholder="(session)"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">sameSite</label>
                      <select
                        value={draft.sameSite ?? 'Lax'}
                        onChange={(e) => setDraft({ ...draft, sameSite: e.target.value })}
                        className="input w-full text-sm"
                      >
                        <option value="Lax">Lax</option>
                        <option value="Strict">Strict</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mb-3 text-xs text-slate-300">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!!draft.httpOnly}
                        onChange={(e) => setDraft({ ...draft, httpOnly: e.target.checked })}
                      />
                      HttpOnly
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!!draft.secure}
                        onChange={(e) => setDraft({ ...draft, secure: e.target.checked })}
                      />
                      Secure
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={cancelEdit} className="btn-ghost text-xs">Cancel</button>
                    <button onClick={commitEdit} className="btn-primary text-xs">
                      {editingIndex === -1 ? 'Add cookie' : 'Update cookie'}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Domain</th>
                      <th className="text-left px-3 py-2 font-medium">Value</th>
                      <th className="text-left px-3 py-2 font-medium">Flags</th>
                      <th className="text-right px-3 py-2 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndexes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          {browseLoading ? 'Loading…' : 'No cookies'}
                        </td>
                      </tr>
                    )}
                    {filteredIndexes.map(({ c, i }) => (
                      <tr key={`${c.domain}-${c.name}-${i}`} className="border-t border-slate-700/60 hover:bg-slate-700/30">
                        <td className="px-3 py-1.5 text-slate-200 font-mono">{c.name}</td>
                        <td className="px-3 py-1.5 text-slate-400">{c.domain}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono truncate max-w-[200px]" title={c.value}>{c.value}</td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {c.httpOnly && <span className="mr-1.5">HttpOnly</span>}
                          {c.secure && <span className="mr-1.5">Secure</span>}
                          {c.sameSite && <span className="mr-1.5">{c.sameSite}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => startEdit(i)}
                            className="btn-ghost p-1 text-slate-400 hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteRow(i)}
                            className="btn-ghost p-1 text-slate-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between mt-4">
                {isActive && (
                  <button
                    onClick={captureLive}
                    disabled={browseLoading}
                    className="btn-ghost text-sm flex items-center gap-2 text-violet-400 hover:text-violet-300"
                  >
                    <Camera className="w-4 h-4" />
                    Capture from live browser
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={saveBrowse}
                    disabled={!browseDirty || savingBrowse}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingBrowse ? 'Saving…' : browseDirty ? 'Save changes' : 'Saved'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Import / Export tabs ─────────────────────────────── */}
          {tab !== 'browse' && (
            <div>
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
                className="input resize-none h-52 font-mono text-xs w-full"
                readOnly={tab === 'export'}
                placeholder={
                  tab === 'import'
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

              <div className="flex justify-between gap-3 mt-5">
                <div>
                  {isActive && (
                    <button
                      onClick={handleCapture}
                      disabled={loading}
                      className="btn-ghost text-sm flex items-center gap-2 text-violet-400 hover:text-violet-300"
                      title="Capture cookies from the live browser session"
                    >
                      <Camera className="w-4 h-4" />
                      Capture from browser
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
                  {tab === 'export' ? (
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
          )}
        </div>
      </div>
    </div>
  )
}
