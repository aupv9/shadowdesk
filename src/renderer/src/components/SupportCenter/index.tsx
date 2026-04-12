import React, { useEffect, useState } from 'react'
import {
  LifeBuoy, MessageSquare, Plus, Send,
  ChevronRight, Clock, CheckCircle, AlertCircle,
  XCircle, RefreshCw, Bug, Lightbulb,
  CreditCard, User, Shield, Globe, HelpCircle,
  Copy, Star, ThumbsUp
} from 'lucide-react'
import { useSupportStore } from '../../stores/supportStore'
import { useToastStore } from '../../stores/toastStore'
import type { TicketCategory, TicketPriority, SupportTicket } from '../../types'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:          { label: 'Open',          color: 'text-blue-400 bg-blue-500/20',    icon: AlertCircle },
  in_progress:   { label: 'In Progress',   color: 'text-amber-400 bg-amber-500/20',  icon: Clock },
  waiting_reply: { label: 'Waiting Reply', color: 'text-purple-400 bg-purple-500/20', icon: MessageSquare },
  resolved:      { label: 'Resolved',      color: 'text-green-400 bg-green-500/20',  icon: CheckCircle },
  closed:        { label: 'Closed',        color: 'text-slate-400 bg-slate-500/20',  icon: XCircle }
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  bug:             Bug,
  feature_request: Lightbulb,
  billing:         CreditCard,
  account:         User,
  detection:       Shield,
  proxy:           Globe,
  general:         HelpCircle
}

type View = 'list' | 'create' | 'detail' | 'feedback'

export function SupportCenter() {
  const [view, setView] = useState<View>('list')
  const store = useSupportStore()
  const pushToast = useToastStore((s) => s.push)

  useEffect(() => { store.fetchTickets() }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-cyan-400" />
            Support Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">Get help, report issues, or share feedback</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('feedback')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            <ThumbsUp className="w-4 h-4" />
            Feedback
          </button>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {store.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {store.error}
        </div>
      )}

      {view === 'list' && <TicketList onSelect={(t) => { store.fetchTicket(t.id); setView('detail') }} />}
      {view === 'create' && <CreateTicketForm onCreated={() => setView('list')} onCancel={() => setView('list')} />}
      {view === 'detail' && <TicketDetail onBack={() => setView('list')} />}
      {view === 'feedback' && <FeedbackForm onDone={() => setView('list')} onCancel={() => setView('list')} />}
    </div>
  )
}

function TicketList({ onSelect }: { onSelect: (t: SupportTicket) => void }) {
  const { tickets, ticketTotal, loading, fetchTickets } = useSupportStore()
  const [filter, setFilter] = useState<string>('')

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium">Your Tickets ({ticketTotal})</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              fetchTickets(e.target.value ? { status: e.target.value as any } : undefined)
            }}
            className="bg-slate-700 border border-slate-600 rounded text-sm text-white px-2 py-1"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={() => fetchTickets()} className="text-slate-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No support tickets yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {tickets.map((ticket) => {
            const status = STATUS_CONFIG[ticket.status]
            const CategoryIcon = CATEGORY_ICONS[ticket.category] ?? HelpCircle
            return (
              <button
                key={ticket.id}
                onClick={() => onSelect(ticket)}
                className="w-full text-left p-4 hover:bg-slate-700/30 transition-colors flex items-center gap-4"
              >
                <CategoryIcon className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{ticket.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ticket.category} &middot; {new Date(ticket.created_at).toLocaleDateString()}
                    {ticket.message_count > 0 && ` \u00B7 ${ticket.message_count} messages`}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status?.color}`}>
                  {status?.label}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateTicketForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('general')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [message, setMessage] = useState('')
  const [includeDiag, setIncludeDiag] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { createTicket } = useSupportStore()
  const pushToast = useToastStore((s) => s.push)

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      await createTicket({ subject, category, priority, message, include_diagnostics: includeDiag })
      pushToast('Ticket created successfully', 'success')
      onCreated()
    } catch {
      pushToast('Failed to create ticket', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-2xl">
      <h3 className="text-white font-medium mb-4">Create Support Ticket</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
            >
              <option value="bug">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="billing">Billing</option>
              <option value="account">Account</option>
              <option value="detection">Detection</option>
              <option value="proxy">Proxy</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue in detail..."
            rows={6}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeDiag}
            onChange={(e) => setIncludeDiag(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          <span className="text-sm text-slate-300">Include system diagnostics</span>
        </label>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !message.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TicketDetail({ onBack }: { onBack: () => void }) {
  const { activeTicket, activeMessages, loading, reply, closeTicket, reopenTicket } = useSupportStore()
  const pushToast = useToastStore((s) => s.push)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  if (loading || !activeTicket) {
    return <div className="text-slate-400">Loading ticket...</div>
  }

  const status = STATUS_CONFIG[activeTicket.status]
  const canReply = !['resolved', 'closed'].includes(activeTicket.status)

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      await reply(activeTicket.id, replyText)
      setReplyText('')
    } catch {
      pushToast('Failed to send reply', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1">
        &larr; Back to tickets
      </button>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-white">{activeTicket.subject}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {activeTicket.category} &middot; Created {new Date(activeTicket.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status?.color}`}>
                {status?.label}
              </span>
              {activeTicket.status === 'resolved' || activeTicket.status === 'closed' ? (
                <button
                  onClick={() => reopenTicket(activeTicket.id)}
                  className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                >
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => closeTicket(activeTicket.id)}
                  className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
          {activeMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-lg ${
                msg.author_type === 'user'
                  ? 'bg-slate-700/50 ml-8'
                  : msg.author_type === 'support'
                  ? 'bg-cyan-500/10 border border-cyan-500/20 mr-8'
                  : 'bg-slate-600/30 text-sm italic mx-8'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">{msg.author_name}</span>
                <span className="text-xs text-slate-500">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Reply Box */}
        {canReply && (
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none"
              />
              <button
                onClick={handleReply}
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [type, setType] = useState<'feature_request' | 'improvement' | 'praise' | 'other'>('improvement')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const { submitFeedback } = useSupportStore()
  const pushToast = useToastStore((s) => s.push)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      await submitFeedback({ type, message, rating: rating > 0 ? rating : undefined })
      pushToast('Feedback submitted - thank you!', 'success')
      onDone()
    } catch {
      pushToast('Failed to submit feedback', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-xl">
      <h3 className="text-white font-medium mb-4 flex items-center gap-2">
        <ThumbsUp className="w-5 h-5 text-cyan-400" />
        Share Feedback
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="feature_request">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="praise">Praise</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onClick={() => setRating(i)}
                className="p-1"
              >
                <Star className={`w-5 h-5 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think..."
            rows={4}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}
