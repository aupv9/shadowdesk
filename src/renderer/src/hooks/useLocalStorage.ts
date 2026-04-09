/**
 * Tiny `useState` replacement that persists its value to `localStorage`
 * under the given key. Safe against malformed JSON and environments
 * where `localStorage` is unavailable (it degrades to in-memory state).
 *
 * Used by ProfileManager to remember UI preferences such as view mode,
 * sort order and active quick-filter across sessions so power users
 * don't have to re-set them every time they open the app.
 */

import { useCallback, useEffect, useState } from 'react'

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const read = (): T => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(key)
      if (raw == null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  }

  const [value, setValue] = useState<T>(read)

  // Persist on change. We intentionally don't guard on reference equality
  // — callers are expected to pass immutable values or stable references.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore quota / privacy-mode errors — state still works in-memory.
    }
  }, [key, value])

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => (typeof v === 'function' ? (v as (p: T) => T)(prev) : v))
    },
    [],
  )

  return [value, set]
}
