// Where the tracker's data lives.
//
// Published on claude.ai, the page gets the platform's `db` capability: a
// realtime document store. Each signed-in user's entries go under their own
// private `data/users/<id>/` subtree, and every open device subscribes to it,
// so a meal logged on a phone shows up on the laptop within seconds.
//
// Anywhere else (npm run dev, GitHub Pages, a saved copy) there is no
// `window.claude`, and the same API is served from localStorage instead.

import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays } from './dates.js'
import { makeId } from './id.js'
import { STORAGE_KEYS, usePersistentState } from './storage.js'

export const DEFAULT_SETTINGS = { targetKcal: 2000, proteinTarget: 150, waterGoal: 8, weightUnit: 'lb', distanceUnit: 'mi' }

/** How far back the weekly check-in and smart target look. */
export const HISTORY_DAYS = 42

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

const EMPTY = {
  dayMeals: [],
  dayExercises: [],
  historyMeals: [],
  historyExercises: [],
  recentMeals: [],
  weights: [],
  water: [],
  savedMeals: [],
  menus: [],
  settings: DEFAULT_SETTINGS,
  ready: false,
}

function useCloudData(backend, date, today) {
  const [state, setState] = useState(EMPTY)
  const [error, setError] = useState(null)
  const { db, uid } = backend
  const cloud = backend.mode === 'cloud'
  const historyStart = addDays(today, -HISTORY_DAYS)
  // Writes to one document must not overlap, so rapid taps (water) queue up.
  const queues = useRef(new Map())
  const settingsRef = useRef(DEFAULT_SETTINGS)
  settingsRef.current = state.settings

  const refs = useMemo(() => {
    if (!cloud) return null
    const root = db.doc(`data/users/${uid}/tracker`)
    return {
      meals: root.collection('meals'),
      exercises: root.collection('exercises'),
      weights: root.collection('weights'),
      water: root.collection('water'),
      savedMeals: root.collection('savedMeals'),
      menus: root.collection('menus'),
      settings: db.doc(`data/users/${uid}/settings`),
    }
  }, [cloud, db, uid])

  const put = (key) => (s) => setState((st) => ({ ...st, [key]: fromSnap(s) }))

  // Everything that doesn't depend on the viewed day.
  useEffect(() => {
    if (!refs) return
    const fail = (err) => setError(describeError(err))
    const unsubs = [
      refs.weights.onSnapshot((s) => setState((st) => ({ ...st, weights: fromSnap(s), ready: true })), fail),
      refs.settings.onSnapshot((s) => setState((st) => ({ ...st, settings: { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) } })), fail),
      refs.meals.orderBy('createdAt', 'desc').limit(60).onSnapshot(put('recentMeals'), fail),
      refs.water.onSnapshot(put('water'), fail),
      refs.savedMeals.onSnapshot(put('savedMeals'), fail),
      refs.menus.onSnapshot(put('menus'), fail),
    ]
    return () => unsubs.forEach((u) => u())
  }, [refs])

  // The last six weeks, for the weekly check-in and the smart target.
  useEffect(() => {
    if (!refs) return
    const fail = (err) => setError(describeError(err))
    const unsubs = [
      refs.meals.where('date', '>=', historyStart).onSnapshot(put('historyMeals'), fail),
      refs.exercises.where('date', '>=', historyStart).onSnapshot(put('historyExercises'), fail),
    ]
    return () => unsubs.forEach((u) => u())
  }, [refs, historyStart])

  // The viewed day's meals and workouts (which may be older than the history window).
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
    const queued = (key, fn) => {
      const next = (queues.current.get(key) ?? Promise.resolve()).then(() => write(fn, setError))
      queues.current.set(key, next)
      return next
    }
    return {
      addMeal: (meal) => write(() => refs.meals.doc(meal.id ?? makeId()).set(toDoc(meal)), setError),
      updateMeal: (meal) => queued(`meal:${meal.id}`, () => refs.meals.doc(meal.id).set(toDoc(meal))),
      deleteMeal: (id) => write(() => refs.meals.doc(id).delete(), setError),
      addExercise: (entry) => write(() => refs.exercises.doc(entry.id ?? makeId()).set(toDoc(entry)), setError),
      deleteExercise: (id) => write(() => refs.exercises.doc(id).delete(), setError),
      // The date is the document id, so each day holds one weigh-in on every device.
      saveWeight: (entry) => write(() => refs.weights.doc(entry.date).set(toDoc(entry)), setError),
      deleteWeight: (id) => write(() => refs.weights.doc(id).delete(), setError),
      setWater: (day, glasses) => queued(`water:${day}`, () => refs.water.doc(day).set({ date: day, glasses })),
      saveCombo: (combo) => write(() => refs.savedMeals.doc(combo.id ?? makeId()).set(toDoc(combo)), setError),
      deleteCombo: (id) => write(() => refs.savedMeals.doc(id).delete(), setError),
      saveMenus: async (weeks) => {
        for (const week of weeks) await write(() => refs.menus.doc(week.weekStart).set(toDoc(week)), setError)
      },
      deleteMenu: (id) => write(() => refs.menus.doc(id).delete(), setError),
      updateSettings: (patch) => queued('settings', () => refs.settings.set({ ...settingsRef.current, ...patch })),
    }
  }, [refs])

  return { ...state, actions, error, clearError: () => setError(null) }
}

function useLocalData(date, today) {
  const [meals, setMeals] = usePersistentState(STORAGE_KEYS.meals, [])
  const [exercises, setExercises] = usePersistentState(STORAGE_KEYS.exercises, [])
  const [weights, setWeights] = usePersistentState(STORAGE_KEYS.weights, [])
  const [water, setWaterList] = usePersistentState(STORAGE_KEYS.water, [])
  const [savedMeals, setSavedMeals] = usePersistentState(STORAGE_KEYS.savedMeals, [])
  const [menus, setMenus] = usePersistentState(STORAGE_KEYS.menus, [])
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  const historyStart = addDays(today, -HISTORY_DAYS)

  const derived = useMemo(
    () => ({
      dayMeals: meals.filter((m) => m.date === date).sort(byCreated),
      dayExercises: exercises.filter((e) => e.date === date).sort(byCreated),
      historyMeals: meals.filter((m) => m.date >= historyStart),
      historyExercises: exercises.filter((e) => e.date >= historyStart),
      recentMeals: [...meals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 60),
    }),
    [meals, exercises, date, historyStart],
  )

  const upsert = (setList, key) => (item) => setList((list) => [...list.filter((x) => x[key] !== item[key]), item])

  const actions = {
    addMeal: (meal) => setMeals((list) => [...list, { ...meal, id: meal.id ?? makeId() }]),
    updateMeal: (meal) => setMeals((list) => list.map((m) => (m.id === meal.id ? meal : m))),
    deleteMeal: (id) => setMeals((list) => list.filter((m) => m.id !== id)),
    addExercise: (entry) => setExercises((list) => [...list, { ...entry, id: entry.id ?? makeId() }]),
    deleteExercise: (id) => setExercises((list) => list.filter((e) => e.id !== id)),
    saveWeight: (entry) => setWeights((list) => [...list.filter((w) => w.date !== entry.date), { ...entry, id: makeId() }]),
    deleteWeight: (id) => setWeights((list) => list.filter((w) => w.id !== id)),
    setWater: (day, glasses) => upsert(setWaterList, 'date')({ id: day, date: day, glasses }),
    saveCombo: (combo) => upsert(setSavedMeals, 'id')({ ...combo, id: combo.id ?? makeId() }),
    deleteCombo: (id) => setSavedMeals((list) => list.filter((c) => c.id !== id)),
    saveMenus: (weeks) => weeks.forEach((w) => upsert(setMenus, 'weekStart')({ ...w, id: w.weekStart })),
    deleteMenu: (id) => setMenus((list) => list.filter((m) => m.id !== id)),
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
  }

  return { ...derived, weights, water, savedMeals, menus, settings, actions, ready: true, error: null, clearError: () => {} }
}

/**
 * Everything the app shows for `date`, plus the actions that change it.
 * `mode` is 'cloud' (synced), 'local' (this browser only) or 'connecting'.
 */
export function useTrackerData(date, today) {
  const backend = useBackend()
  const cloud = useCloudData(backend, date, today)
  const local = useLocalData(date, today)
  const data = backend.mode === 'cloud' ? cloud : local
  const noop = () => {}
  const actions =
    backend.mode === 'connecting'
      ? Object.fromEntries(Object.keys(local.actions).map((k) => [k, noop]))
      : data.actions

  return {
    ...data,
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    actions,
    mode: backend.mode,
    ready: backend.mode === 'local' || (backend.mode === 'cloud' && cloud.ready),
  }
}
