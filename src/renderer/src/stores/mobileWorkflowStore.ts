import { create } from 'zustand'
import type {
  MobileWorkflow,
  MobileBehaviorArchetype,
  MobileExecutionResult,
  MobileBatchExecutionResult,
  MobileExecutionLog,
  GestureTemplate
} from '../types'

interface MobileWorkflowState {
  workflows: MobileWorkflow[]
  selectedWorkflow: MobileWorkflow | null
  archetypes: MobileBehaviorArchetype[]
  executionLogs: MobileExecutionLog[]
  gestureTemplates: GestureTemplate[]
  isExecuting: boolean
  lastResult: MobileExecutionResult | MobileBatchExecutionResult | null
  error: string | null

  // Workflow CRUD
  fetchWorkflows: () => Promise<void>
  createWorkflow: (input: any) => Promise<MobileWorkflow>
  updateWorkflow: (id: string, updates: any) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  duplicateWorkflow: (id: string) => Promise<MobileWorkflow>
  selectWorkflow: (id: string | null) => void

  // Execution
  executeWorkflow: (workflowId: string, profileIds: string[]) => Promise<MobileExecutionResult | MobileBatchExecutionResult>
  fetchExecutionLogs: (workflowId?: string) => Promise<void>
  deleteExecutionLog: (id: string) => Promise<void>

  // Behavior Archetypes
  fetchArchetypes: () => Promise<void>

  // Gesture Templates
  fetchGestureTemplates: () => Promise<void>
  createGestureTemplate: (input: any) => Promise<void>
  deleteGestureTemplate: (id: string) => Promise<void>
}

export const useMobileWorkflowStore = create<MobileWorkflowState>((set, get) => ({
  workflows: [],
  selectedWorkflow: null,
  archetypes: [],
  executionLogs: [],
  gestureTemplates: [],
  isExecuting: false,
  lastResult: null,
  error: null,

  fetchWorkflows: async () => {
    try {
      const workflows = await window.api.mobileWorkflow.list()
      set({ workflows, error: null })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  createWorkflow: async (input) => {
    const wf = await window.api.mobileWorkflow.create(input)
    set((s) => ({ workflows: [wf, ...s.workflows] }))
    return wf
  },

  updateWorkflow: async (id, updates) => {
    const updated = await window.api.mobileWorkflow.update(id, updates)
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
      selectedWorkflow: s.selectedWorkflow?.id === id ? updated : s.selectedWorkflow
    }))
  },

  deleteWorkflow: async (id) => {
    await window.api.mobileWorkflow.delete(id)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      selectedWorkflow: s.selectedWorkflow?.id === id ? null : s.selectedWorkflow
    }))
  },

  duplicateWorkflow: async (id) => {
    const wf = await window.api.mobileWorkflow.duplicate(id)
    set((s) => ({ workflows: [wf, ...s.workflows] }))
    return wf
  },

  selectWorkflow: (id) => {
    if (!id) {
      set({ selectedWorkflow: null })
      return
    }
    const wf = get().workflows.find((w) => w.id === id) ?? null
    set({ selectedWorkflow: wf })
  },

  executeWorkflow: async (workflowId, profileIds) => {
    set({ isExecuting: true, error: null, lastResult: null })
    try {
      const result = await window.api.mobileWorkflow.execute(workflowId, profileIds)
      set({ isExecuting: false, lastResult: result })
      // Refresh logs
      get().fetchExecutionLogs(workflowId)
      return result
    } catch (err: any) {
      set({ isExecuting: false, error: err.message })
      throw err
    }
  },

  fetchExecutionLogs: async (workflowId?) => {
    try {
      const logs = await window.api.mobileExecution.logs(workflowId)
      set({ executionLogs: logs })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  deleteExecutionLog: async (id) => {
    await window.api.mobileExecution.delete(id)
    set((s) => ({ executionLogs: s.executionLogs.filter((l) => l.id !== id) }))
  },

  fetchArchetypes: async () => {
    try {
      const archetypes = await window.api.mobileBehavior.list()
      set({ archetypes })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  fetchGestureTemplates: async () => {
    try {
      const gestureTemplates = await window.api.gestureTemplate.list()
      set({ gestureTemplates })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  createGestureTemplate: async (input) => {
    await window.api.gestureTemplate.create(input)
    get().fetchGestureTemplates()
  },

  deleteGestureTemplate: async (id) => {
    await window.api.gestureTemplate.delete(id)
    set((s) => ({ gestureTemplates: s.gestureTemplates.filter((t) => t.id !== id) }))
  }
}))
