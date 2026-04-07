/**
 * Phase 15.C — Outbound Webhooks & Telegram Alerts
 *
 * Allows users to configure:
 *   1. HTTP POST webhooks triggered by profile/detection/schedule events
 *   2. A Telegram bot that sends alert messages for chosen events
 */

import React, { useEffect, useState } from 'react'
import { Webhook, Plus, Trash2, Send, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { useWebhookStore } from '../../stores/webhookStore'
import type { WebhookEvent, TelegramConfig } from '../../types'

const ALL_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'profile.created',    label: 'Profile created' },
  { value: 'profile.launched',   label: 'Profile launched' },
  { value: 'profile.closed',     label: 'Profile closed' },
  { value: 'detection.completed',label: 'Detection test completed' },
  { value: 'schedule.completed', label: 'Schedule completed' },
  { value: 'license.expiring',   label: 'License expiring' }
]

function EventCheckboxes({
  selected,
  onChange
}: {
  selected: WebhookEvent[]
  onChange: (evts: WebhookEvent[]) => void
}) {
  const toggle = (evt: WebhookEvent) =>
    onChange(selected.includes(evt) ? selected.filter((e) => e !== evt) : [...selected, evt])
  return (
    <div className="grid grid-cols-2 gap-1">
      {ALL_EVENTS.map((e) => (
        <label key={e.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            className="w-3 h-3 accent-indigo-500"
            checked={selected.includes(e.value)}
            onChange={() => toggle(e.value)}
          />
          {e.label}
        </label>
      ))}
    </div>
  )
}

// ── Webhook row ───────────────────────────────────────────────────────────────

function WebhookRow({ hook, onRemove, onToggle }: {
  hook: { id: string; name: string; url: string; events: WebhookEvent[]; enabled: boolean; lastStatus?: number; lastTriggeredAt?: string }
  onRemove: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const statusColor = hook.lastStatus
    ? hook.lastStatus >= 200 && hook.lastStatus < 300 ? 'text-emerald-400' : 'text-red-400'
    : 'text-slate-500'

  return (
    <div className="p-3 bg-slate-800/60 rounded-lg">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 text-left">
          <p className="text-sm font-medium text-white">{hook.name}</p>
          <p className="text-xs text-slate-500 truncate">{hook.url}</p>
        </button>
        <span className={`text-xs ${statusColor}`}>
          {hook.lastStatus ? `${hook.lastStatus}` : '—'}
        </span>
        <button onClick={() => onToggle(hook.id, !hook.enabled)} className="text-slate-400 hover:text-white">
          {hook.enabled
            ? <ToggleRight className="w-5 h-5 text-indigo-400" />
            : <ToggleLeft className="w-5 h-5" />}
        </button>
        <button onClick={() => onRemove(hook.id)} className="text-slate-400 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => setOpen((v) => !v)} className="text-slate-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400 space-y-1">
          <p>Events: {hook.events.join(', ')}</p>
          {hook.lastTriggeredAt && <p>Last triggered: {new Date(hook.lastTriggeredAt).toLocaleString()}</p>}
        </div>
      )}
    </div>
  )
}

// ── Add webhook form ──────────────────────────────────────────────────────────

function AddWebhookForm({ onSave, onCancel }: {
  onSave: (input: { name: string; url: string; events: WebhookEvent[]; secret?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: '', url: '', secret: '' })
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    setErr(null)
    setBusy(true)
    try {
      await onSave({ name: form.name, url: form.url, events, secret: form.secret || undefined })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 bg-slate-800/60 rounded-lg space-y-2 mb-3">
      <input className="input-field text-xs" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="input-field text-xs" placeholder="URL (https://…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
      <input className="input-field text-xs" placeholder="Secret (optional, for HMAC signature)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
      <div>
        <p className="text-xs text-slate-400 mb-1">Trigger on:</p>
        <EventCheckboxes selected={events} onChange={setEvents} />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={busy} className="btn-primary text-xs">Save</button>
        <button onClick={onCancel} className="btn-secondary text-xs">Cancel</button>
      </div>
    </div>
  )
}

// ── Telegram config form ──────────────────────────────────────────────────────

function TelegramSection() {
  const { telegram, fetchTelegram, saveTelegram } = useWebhookStore()
  const [form, setForm] = useState<TelegramConfig>({ enabled: false, botToken: '', chatId: '', events: [] })
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchTelegram() }, [fetchTelegram])
  useEffect(() => { if (telegram) setForm(telegram) }, [telegram])

  const handleSave = async () => {
    await saveTelegram(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-white flex items-center gap-2 mb-2">
        <Send className="w-3.5 h-3.5 text-sky-400" />Telegram Alerts
      </h4>
      <div className="p-3 bg-slate-800/60 rounded-lg space-y-2">
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" className="w-3 h-3 accent-indigo-500" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Enable Telegram alerts
        </label>
        <input className="input-field text-xs" placeholder="Bot token (from @BotFather)" value={form.botToken} onChange={(e) => setForm({ ...form, botToken: e.target.value })} />
        <input className="input-field text-xs" placeholder="Chat ID" value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })} />
        <div>
          <p className="text-xs text-slate-400 mb-1">Send alerts for:</p>
          <EventCheckboxes selected={form.events} onChange={(events) => setForm({ ...form, events })} />
        </div>
        <button onClick={handleSave} className="btn-primary text-xs">
          {saved ? 'Saved!' : 'Save Telegram Config'}
        </button>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function WebhooksPanel() {
  const { hooks, loading, fetch, add, remove, update } = useWebhookStore()
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Webhook className="w-4 h-4 text-indigo-400" />
          Outbound Webhooks
        </h3>
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add Webhook
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Send HTTP POST notifications to external services when events occur.
        Payloads are signed with HMAC-SHA256 when a secret is configured.
      </p>

      {showAdd && (
        <AddWebhookForm
          onSave={async (input) => { await add(input as any); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading && hooks.length === 0 ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : hooks.length === 0 && !showAdd ? (
        <p className="text-xs text-slate-500 text-center py-3">No webhooks configured.</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <WebhookRow
              key={h.id}
              hook={h}
              onRemove={remove}
              onToggle={(id, enabled) => update(id, { enabled })}
            />
          ))}
        </div>
      )}

      <TelegramSection />
    </div>
  )
}
