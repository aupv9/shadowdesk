import { create } from 'zustand'
import type { SupportTicket, TicketMessage, CreateTicketInput, FeedbackInput, TicketStatus } from '../types'

interface SupportState {
  tickets: SupportTicket[]
  ticketTotal: number
  activeTicket: SupportTicket | null
  activeMessages: TicketMessage[]
  loading: boolean
  error: string | null

  fetchTickets: (params?: { page?: number; limit?: number; status?: TicketStatus }) => Promise<void>
  fetchTicket: (ticketId: string) => Promise<void>
  createTicket: (input: CreateTicketInput) => Promise<SupportTicket>
  reply: (ticketId: string, message: string) => Promise<void>
  closeTicket: (ticketId: string) => Promise<void>
  reopenTicket: (ticketId: string) => Promise<void>
  submitFeedback: (input: FeedbackInput) => Promise<{ id: string }>
  getDiagnostics: () => Promise<string>
}

export const useSupportStore = create<SupportState>((set, get) => ({
  tickets: [],
  ticketTotal: 0,
  activeTicket: null,
  activeMessages: [],
  loading: false,
  error: null,

  fetchTickets: async (params) => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.support.tickets(params)
      set({ tickets: result.tickets, ticketTotal: result.total, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchTicket: async (ticketId: string) => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.support.ticket(ticketId)
      set({ activeTicket: result.ticket, activeMessages: result.messages, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  createTicket: async (input: CreateTicketInput) => {
    set({ loading: true, error: null })
    try {
      const ticket = await window.api.support.createTicket(input)
      set((state) => ({
        tickets: [ticket, ...state.tickets],
        ticketTotal: state.ticketTotal + 1,
        loading: false
      }))
      return ticket
    } catch (err: any) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  reply: async (ticketId: string, message: string) => {
    try {
      const msg = await window.api.support.reply(ticketId, message)
      set((state) => ({
        activeMessages: [...state.activeMessages, msg]
      }))
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  closeTicket: async (ticketId: string) => {
    try {
      const updated = await window.api.support.close(ticketId)
      set((state) => ({
        activeTicket: state.activeTicket?.id === ticketId ? updated : state.activeTicket,
        tickets: state.tickets.map((t) => t.id === ticketId ? updated : t)
      }))
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  reopenTicket: async (ticketId: string) => {
    try {
      const updated = await window.api.support.reopen(ticketId)
      set((state) => ({
        activeTicket: state.activeTicket?.id === ticketId ? updated : state.activeTicket,
        tickets: state.tickets.map((t) => t.id === ticketId ? updated : t)
      }))
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  submitFeedback: async (input: FeedbackInput) => {
    return window.api.support.feedback(input)
  },

  getDiagnostics: async () => {
    return window.api.support.diagnostics()
  }
}))
