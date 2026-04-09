import { create } from 'zustand'
import type {
  ImportFormat,
  ImportOptions,
  ImportPreviewResult,
  ImportResult,
  ImportSession,
  ImportRecordEntry,
  DuplicateResolution,
  SelectiveFields
} from '../../../shared/types'

interface ImportState {
  // Wizard state
  wizardOpen: boolean
  wizardStep: 'format' | 'upload' | 'options' | 'preview' | 'importing' | 'results'
  format: ImportFormat
  options: ImportOptions
  fileData: { text: string; filename: string } | null
  zipBuffers: { buffer: Buffer; filename: string }[] | null

  // Preview / results
  preview: ImportPreviewResult | null
  result: ImportResult | null
  loading: boolean
  error: string | null

  // Import history
  sessions: ImportSession[]
  selectedSession: ImportSession | null
  selectedRecords: ImportRecordEntry[]
  historyLoading: boolean
  stats: { totalSessions: number; totalImported: number; totalErrors: number } | null

  // Wizard actions
  openWizard: () => void
  closeWizard: () => void
  setFormat: (format: ImportFormat) => void
  setFileData: (data: { text: string; filename: string }) => void
  setZipBuffers: (buffers: { buffer: Buffer; filename: string }[]) => void
  setDuplicateResolution: (resolution: DuplicateResolution) => void
  setSelectiveFields: (fields: Partial<SelectiveFields>) => void
  setAssignProxyId: (proxyId: string | null) => void
  setAssignGroupId: (groupId: string | null) => void
  goToStep: (step: ImportState['wizardStep']) => void

  // Import operations
  runPreview: () => Promise<void>
  executeImport: () => Promise<void>
  reset: () => void

  // History operations
  fetchSessions: () => Promise<void>
  fetchRecords: (sessionId: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  fetchStats: () => Promise<void>
}

const DEFAULT_OPTIONS: ImportOptions = {
  format: 'csv',
  duplicateResolution: 'skip',
  selectiveFields: { name: true, fingerprint: true, cookies: true, notes: true },
  assignProxyId: null,
  assignGroupId: null
}

export const useImportStore = create<ImportState>((set, get) => ({
  wizardOpen: false,
  wizardStep: 'format',
  format: 'csv',
  options: { ...DEFAULT_OPTIONS },
  fileData: null,
  zipBuffers: null,
  preview: null,
  result: null,
  loading: false,
  error: null,
  sessions: [],
  selectedSession: null,
  selectedRecords: [],
  historyLoading: false,
  stats: null,

  openWizard: () => set({ wizardOpen: true, wizardStep: 'format', preview: null, result: null, error: null, fileData: null, zipBuffers: null, options: { ...DEFAULT_OPTIONS } }),
  closeWizard: () => set({ wizardOpen: false, wizardStep: 'format', preview: null, result: null, error: null, fileData: null, zipBuffers: null }),
  setFormat: (format) => set({ format, options: { ...get().options, format } }),
  setFileData: (data) => set({ fileData: data }),
  setZipBuffers: (buffers) => set({ zipBuffers: buffers }),
  setDuplicateResolution: (resolution) => set({ options: { ...get().options, duplicateResolution: resolution } }),
  setSelectiveFields: (fields) => set({ options: { ...get().options, selectiveFields: { ...get().options.selectiveFields, ...fields } } }),
  setAssignProxyId: (proxyId) => set({ options: { ...get().options, assignProxyId: proxyId } }),
  setAssignGroupId: (groupId) => set({ options: { ...get().options, assignGroupId: groupId } }),
  goToStep: (step) => set({ wizardStep: step }),

  runPreview: async () => {
    const { format, fileData, zipBuffers } = get()
    set({ loading: true, error: null })
    try {
      let preview: ImportPreviewResult
      if (format === 'csv' && fileData) {
        preview = await window.api.bulkImport.previewCSV(fileData.text)
      } else if (format === 'json' && fileData) {
        preview = await window.api.bulkImport.previewJSON(fileData.text)
      } else if (format === 'zip' && zipBuffers) {
        preview = await window.api.bulkImport.previewZIP(zipBuffers.map((b) => b.buffer))
      } else {
        throw new Error('No file data provided')
      }
      set({ preview, loading: false, wizardStep: 'preview' })
    } catch (err: any) {
      set({ error: err.message ?? 'Preview failed', loading: false })
    }
  },

  executeImport: async () => {
    const { format, fileData, zipBuffers, options } = get()
    set({ loading: true, error: null, wizardStep: 'importing' })
    try {
      let result: ImportResult
      if (format === 'csv' && fileData) {
        result = await window.api.bulkImport.executeCSV(fileData.text, options, fileData.filename)
      } else if (format === 'json' && fileData) {
        result = await window.api.bulkImport.executeJSON(fileData.text, options, fileData.filename)
      } else if (format === 'zip' && zipBuffers) {
        result = await window.api.bulkImport.executeZIP(
          zipBuffers.map((b) => b.buffer),
          options,
          zipBuffers.map((b) => b.filename)
        )
      } else {
        throw new Error('No file data provided')
      }
      set({ result, loading: false, wizardStep: 'results' })
    } catch (err: any) {
      set({ error: err.message ?? 'Import failed', loading: false, wizardStep: 'preview' })
    }
  },

  reset: () => set({
    wizardOpen: false,
    wizardStep: 'format',
    format: 'csv',
    options: { ...DEFAULT_OPTIONS },
    fileData: null,
    zipBuffers: null,
    preview: null,
    result: null,
    loading: false,
    error: null
  }),

  fetchSessions: async () => {
    set({ historyLoading: true })
    try {
      const sessions = await window.api.bulkImport.sessions()
      set({ sessions, historyLoading: false })
    } catch {
      set({ historyLoading: false })
    }
  },

  fetchRecords: async (sessionId: string) => {
    set({ historyLoading: true })
    try {
      const session = await window.api.bulkImport.session(sessionId)
      const records = await window.api.bulkImport.records(sessionId)
      set({ selectedSession: session, selectedRecords: records, historyLoading: false })
    } catch {
      set({ historyLoading: false })
    }
  },

  deleteSession: async (id: string) => {
    await window.api.bulkImport.deleteSession(id)
    set((s) => ({ sessions: s.sessions.filter((s) => s.id !== id), selectedSession: null, selectedRecords: [] }))
  },

  fetchStats: async () => {
    try {
      const stats = await window.api.bulkImport.stats()
      set({ stats })
    } catch { /* ignore */ }
  }
}))
