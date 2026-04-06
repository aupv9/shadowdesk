import { create } from 'zustand'
import type { ProfileGroup } from '../types'

interface GroupState {
  groups: ProfileGroup[]
  fetchGroups:  ()                                        => Promise<void>
  createGroup:  (input: { name: string; color?: string }) => Promise<void>
  deleteGroup:  (id: string)                              => Promise<void>
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],

  fetchGroups: async () => {
    const groups = await window.api.groups.list()
    set({ groups })
  },

  createGroup: async (input) => {
    const group = await window.api.groups.create(input)
    set((s) => ({ groups: [...s.groups, group] }))
  },

  deleteGroup: async (id: string) => {
    await window.api.groups.delete(id)
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
  }
}))
