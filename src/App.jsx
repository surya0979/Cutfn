import { useMemo, useState } from 'react'
import CardioLog from './components/CardioLog.jsx'
import Dashboard from './components/Dashboard.jsx'
import Header from './components/Header.jsx'
import LogMeal from './components/LogMeal.jsx'
import MealList from './components/MealList.jsx'
import WeightSection from './components/WeightSection.jsx'
import { formatDay } from './lib/dates.js'
import { exerciseBurn } from './lib/exercise.js'
import { makeId } from './lib/id.js'
import { STORAGE_KEYS, usePersistentState } from './lib/storage.js'
import { useToday } from './lib/useToday.js'
import { resolveBodyWeight } from './lib/weight.js'

const DEFAULT_SETTINGS = { targetKcal: 2000, weightUnit: 'lb', distanceUnit: 'mi' }

const byCreated = (a, b) => a.createdAt - b.createdAt

export default function App() {
  const [meals, setMeals] = usePersistentState(STORAGE_KEYS.meals, [])
  const [exercises, setExercises] = usePersistentState(STORAGE_KEYS.exercises, [])
  const [weights, setWeights] = usePersistentState(STORAGE_KEYS.weights, [])
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }))

  const today = useToday()
  const [viewDate, setViewDate] = useState(null)
  // Viewing "today" follows the calendar, so the app rolls over at midnight.
  const date = viewDate && viewDate < today ? viewDate : today
  const dayLabel = formatDay(date, today)

  const dayMeals = useMemo(() => meals.filter((m) => m.date === date).sort(byCreated), [meals, date])

  // Burns are recomputed from stored inputs against the latest weigh-in as of
  // that day, so logging a new weight immediately updates the day's totals.
  const bodyWeight = useMemo(() => resolveBodyWeight(weights, date), [weights, date])
  const dayExercises = useMemo(
    () =>
      exercises
        .filter((e) => e.date === date)
        .sort(byCreated)
        .map((e) => ({ ...e, burn: exerciseBurn(e, bodyWeight.kg) })),
    [exercises, date, bodyWeight.kg],
  )

  const totals = useMemo(() => {
    const sum = (list, get) => list.reduce((acc, x) => acc + (get(x) ?? 0), 0)
    return {
      consumed: sum(dayMeals, (m) => m.kcal),
      burned: Math.round(sum(dayExercises, (e) => e.burn?.kcal)),
      macros: {
        protein: sum(dayMeals, (m) => m.protein),
        carbs: sum(dayMeals, (m) => m.carbs),
        fat: sum(dayMeals, (m) => m.fat),
      },
    }
  }, [dayMeals, dayExercises])

  const recentFoods = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const m of [...meals].sort((a, b) => b.createdAt - a.createdAt)) {
      const key = m.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(m)
      if (out.length === 8) break
    }
    return out
  }, [meals])

  const addMeal = (meal) => setMeals((list) => [...list, { ...meal, id: makeId(), date, createdAt: Date.now() }])
  const deleteMeal = (id) => setMeals((list) => list.filter((m) => m.id !== id))
  const addExercise = (entry) => setExercises((list) => [...list, { ...entry, id: makeId(), date, createdAt: Date.now() }])
  const deleteExercise = (id) => setExercises((list) => list.filter((e) => e.id !== id))
  // One weigh-in per day: saving again for the same date replaces it.
  const saveWeight = ({ date: day, kg }) =>
    setWeights((list) => [...list.filter((w) => w.date !== day), { id: makeId(), date: day, kg, createdAt: Date.now() }])
  const deleteWeight = (id) => setWeights((list) => list.filter((w) => w.id !== id))

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <Header date={date} today={today} onDateChange={(d) => setViewDate(d >= today ? null : d)} />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:space-y-6 sm:py-6">
        <Dashboard
          consumed={totals.consumed}
          burned={totals.burned}
          target={settings.targetKcal}
          onTargetChange={(targetKcal) => updateSettings({ targetKcal })}
          macros={totals.macros}
          dayLabel={dayLabel}
        />

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4 sm:space-y-6">
            <LogMeal onAdd={addMeal} recentFoods={recentFoods} dayLabel={dayLabel} />
            <MealList meals={dayMeals} onDelete={deleteMeal} dayLabel={dayLabel} />
          </div>
          <CardioLog
            exercises={dayExercises}
            bodyWeight={bodyWeight}
            weightUnit={settings.weightUnit}
            distanceUnit={settings.distanceUnit}
            onDistanceUnitChange={(distanceUnit) => updateSettings({ distanceUnit })}
            onAdd={addExercise}
            onDelete={deleteExercise}
            dayLabel={dayLabel}
          />
        </div>

        <WeightSection
          weights={weights}
          unit={settings.weightUnit}
          onUnitChange={(weightUnit) => updateSettings({ weightUnit })}
          onSave={saveWeight}
          onDelete={deleteWeight}
          selectedDate={date}
          today={today}
        />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted">
        Everything is saved in this browser only (localStorage). Nutrition and burn figures are estimates.
      </footer>
    </div>
  )
}
