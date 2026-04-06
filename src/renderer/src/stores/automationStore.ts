import { create } from 'zustand'
import type { AutomationWorkflow, AutomationRunResult, AutomationStep, CreateWorkflowInput } from '../types'

interface AutomationState {
  workflows: AutomationWorkflow[]
  selectedWorkflow: AutomationWorkflow | null
  runResult: AutomationRunResult | null
  runHistory: any[]
  loading: boolean
  running: boolean
  error: string | null

  fetchWorkflows: () => Promise<void>
  selectWorkflow: (id: string | null) => Promise<void>
  createWorkflow: (input: CreateWorkflowInput) => Promise<AutomationWorkflow>
  updateWorkflow: (id: string, data: { name?: string; description?: string; steps?: AutomationStep[] }) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  runWorkflow: (workflowId: string, profileId: string) => Promise<AutomationRunResult>
  stopWorkflow: (workflowId: string, profileId: string) => void
  fetchRunHistory: (workflowId: string) => Promise<void>
  clearError: () => void
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  workflows: [],
  selectedWorkflow: null,
  runResult: null,
  runHistory: [],
  loading: false,
  running: false,
  error: null,

  fetchWorkflows: async () => {
    set({ loading: true })
    try {
      const workflows = await window.api.workflows.list()
      set({ workflows, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  selectWorkflow: async (id) => {
    if (!id) {
      set({ selectedWorkflow: null, runHistory: [] })
      return
    }
    try {
      const workflow = await window.api.workflows.get(id)
      const runs = await window.api.workflows.runs(id)
      set({ selectedWorkflow: workflow, runHistory: runs })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  createWorkflow: async (input) => {
    const workflow = await window.api.workflows.create(input)
    set((s) => ({ workflows: [workflow, ...s.workflows] }))
    return workflow
  },

  updateWorkflow: async (id, data) => {
    const updated = await window.api.workflows.update(id, data)
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
      selectedWorkflow: s.selectedWorkflow?.id === id ? updated : s.selectedWorkflow
    }))
  },

  deleteWorkflow: async (id) => {
    await window.api.workflows.delete(id)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      selectedWorkflow: s.selectedWorkflow?.id === id ? null : s.selectedWorkflow
    }))
  },

  runWorkflow: async (workflowId, profileId) => {
    set({ running: true, runResult: null, error: null })
    try {
      const result = await window.api.workflows.run(workflowId, profileId)
      set({ runResult: result, running: false })
      // Refresh run history
      get().fetchRunHistory(workflowId)
      return result
    } catch (err: any) {
      set({ error: err.message, running: false })
      throw err
    }
  },

  stopWorkflow: (workflowId, profileId) => {
    window.api.workflows.stop(workflowId, profileId)
  },

  fetchRunHistory: async (workflowId) => {
    try {
      const runs = await window.api.workflows.runs(workflowId)
      set({ runHistory: runs })
    } catch { /* ignore */ }
  },

  clearError: () => set({ error: null })
}))
