// Where the tracker's data lives.
//
// Published on claude.ai, the page gets the platform's `db` capability: a
// realtime document store. Each signed-in user's entries go under their own
// private `data/users/<id>/` subtree, and every open device subscribes to it,
// so a meal logged on a phone shows up on the laptop within seconds.
//
// Anywhere else (npm run dev, GitHub Pages, a saved copy) there is no
// `window.claude`, and the same API is served from localStorage instead.

import { useEffect, useMemo, useState } from 'react'
import { makeId } from './id.js'
import { STORAGE_KEYS, usePersistentState } from './storage.js'

export const DEFAULT_SETTINGS = { targetKcal: 2000, weightUnit: 'lb', distanceUnit: 'mi' }

const byCreated = (a, b) => a.createdAt - b.createdAt

/** Resolve the backend once: { mode: 'connecting' | 'cloud' | 'local', db, uid }. */
function useBackend() {
  const hasClaude = typeof window !== 'undefined' && typeof window.claude?.use === 'function'
  const [backend, setBackend] = useState(() => (hasClaude ? { mode: 'connecting' } : { mode: 'local' }))

  useEffect(() => {
    if (!hasClaude) return
    let cancelled = false
    ;(async () => {
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')])
        const uid = user ? await user.id() : null
        if (!cancelled) setBackend(db && uid ? { mode: 'cloud', db, uid } : { mode: 'local' })
      } catch {
        if (!cancelled) setBackend({ mode: 'local' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasClaude])

  return backend
}

/** Drop undefined fields and the id (the document id carries it). */
function toDoc(entry) {
  const body = {}
  for (const [k, v] of Object.entries(entry)) if (v !== undefined && k !== 'id') body[k] = v
  return body
}

const fromSnap = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }))

function describeError(err) {
  if (err?.code === 'quota_exceeded') return 'Cloud storage is full. Delete some old entries to keep logging.'
  if (err?.code === 'revoked' || err?.code === 'not_granted') return 'Lost access to cloud sync. Reload the page.'
  return 'Couldn’t save to the cloud. Check your connection and try again.'
}

/** A write, retried once on a transient failure. */
async function write(fn, onError) {
  try {
    await fn()
  } catch (err) {
    if (err?.code === 'unavailable') {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600))
      try {
        return await fn()
      } catch (again) {
        return onError(describeError(again))
      }
    }
    onError(describeError(err))
  }
}

function useCloudData(backend, date) {
  const [state, setState] = useState({ dayMeals: [], recentMeals: [], dayExercises: [], weights: [], settings: DEFAULT_SETTINGS, ready: false })
  const [error, setError] = useState(null)
  const { db, uid } = backend
  const cloud = backend.mode === 'cloud'

  const refs = useMemo(() => {
    if (!cloud) return null
    const root = db.doc(`data/users/${uid}/tracker`)
    return {
      meals: root.collection('meals'),
      exercises: root.collection('exercises'),
      weights: root.collection('weights'),
      settings: db.doc(`data/users/${uid}/settings`),
    }
  }, [cloud, db, uid])

  // Things that don't depend on the viewed day: weigh-ins, settings, recent foods.
  useEffect(() => {
    if (!refs) return
    const fail = (err) => setError(describeError(err))
    const unsubs = [
      refs.weights.onSnapshot((s) => setState((st) => ({ ...st, weights: fromSnap(s), ready: true })), fail),
      refs.settings.onSnapshot((s) => setState((st) => ({ ...st, settings: { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) } })), fail),
      refs.meals
        .orderBy('createdAt', 'desc')
        .limit(40)
        .onSnapshot((s) => setState((st) => ({ ...st, recentMeals: fromSnap(s) })), fail),
    ]
    return () => unsubs.forEach((u) => u())
  }, [refs])

  // The viewed day's meals and workouts.
  useEffect(() => {
    if (!refs) return
    const fail = (err) => setError(describeError(err))
    const unsubs = [
      refs.meals.where('date', '==', date).onSnapshot((s) => setState((st) => ({ ...st, dayMeals: fromSnap(s).sort(byCreated) })), fail),
      refs.exercises.where('date', '==', date).onSnapshot((s) => setState((st) => ({ ...st, dayExercises: fromSnap(s).sort(byCreated) })), fail),
    ]
    return () => unsubs.forEach((u) => u())
  }, [refs, date])

  const actions = useMemo(() => {
    if (!refs) return null
    return {
      addMeal: (meal) => write(() => refs.meals.doc(makeId()).set(toDoc(meal)), setError),
      deleteMeal: (id) => write(() => refs.meals.doc(id).delete(), setError),
      addExercise: (entry) => write(() => refs.exercises.doc(makeId()).set(toDoc(entry)), setError),
      deleteExercise: (id) => write(() => refs.exercises.doc(id).delete(), setError),
      // The date is the document id, so each day holds one weigh-in on every device.
      saveWeight: (entry) => write(() => refs.weights.doc(entry.date).set(toDoc(entry)), setError),
      deleteWeight: (id) => write(() => refs.weights.doc(id).delete(), setError),
      updateSettings: (patch) => write(() => refs.settings.set({ ...state.settings, ...patch }), setError),
    }
  }, [refs, state.settings])

  return { ...state, actions, error, clearError: () => setError(null) }
}

function useLocalData(date) {
  const [meals, setMeals] = usePersistentState(STORAGE_KEYS.meals, [])
  const [exercises, setExercises] = usePersistentState(STORAGE_KEYS.exercises, [])
  const [weights, setWeights] = usePersistentState(STORAGE_KEYS.weights, [])
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS)

  const dayMeals = useMemo(() => meals.filter((m) => m.date === date).sort(byCreated), [meals, date])
  const dayExercises = useMemo(() => exercises.filter((e) => e.date === date).sort(byCreated), [exercises, date])
  const recentMeals = useMemo(() => [...meals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40), [meals])

  const actions = {
    addMeal: (meal) => setMeals((list) => [...list, { ...meal, id: makeId() }]),
    deleteMeal: (id) => setMeals((list) => list.filter((m) => m.id !== id)),
    addExercise: (entry) => setExercises((list) => [...list, { ...entry, id: makeId() }]),
    deleteExercise: (id) => setExercises((list) => list.filter((e) => e.id !== id)),
    saveWeight: (entry) => setWeights((list) => [...list.filter((w) => w.date !== entry.date), { ...entry, id: makeId() }]),
    deleteWeight: (id) => setWeights((list) => list.filter((w) => w.id !== id)),
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
  }

  return { dayMeals, recentMeals, dayExercises, weights, settings, actions, ready: true, error: null, clearError: () => {} }
}

/**
 * Everything the app shows for `date`, plus the actions that change it.
 * `mode` is 'cloud' (synced), 'local' (this browser only) or 'connecting'.
 */
export function useTrackerData(date) {
  const backend = useBackend()
  const cloud = useCloudData(backend, date)
  const local = useLocalData(date)
  const data = backend.mode === 'cloud' ? cloud : local
  const noop = () => {}
  const actions =
    backend.mode === 'connecting'
      ? Object.fromEntries(Object.keys(local.actions).map((k) => [k, noop]))
      : data.actions

  return { ...data, actions, mode: backend.mode, ready: backend.mode === 'local' || (backend.mode === 'cloud' && cloud.ready) }
}
