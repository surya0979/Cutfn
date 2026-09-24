import { useCallback, useEffect, useRef, useState } from 'react'

export const STORAGE_KEYS = {
  meals: 'cutfn.v1.meals',
  exercises: 'cutfn.v1.exercises',
  weights: 'cutfn.v1.weights',
  settings: 'cutfn.v1.settings',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const value = JSON.parse(raw)
    // Guard against hand-edited or corrupted storage.
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback
    if (fallback && typeof fallback === 'object') return { ...fallback, ...value }
    return value
  } catch {
    return fallback
  }
}

/**
 * useState that mirrors to localStorage and stays in sync across tabs.
 * Storage failures (private mode, quota) degrade to in-memory state.
 */
export function usePersistentState(key, fallback) {
  const fallbackRef = useRef(fallback)
  const [value, setValue] = useState(() => read(key, fallback))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [key, value])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === key) setValue(read(key, fallbackRef.current))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, useCallback((next) => setValue(next), [])]
}
