import { useMemo, useState } from 'react'
import CardioLog from './components/CardioLog.jsx'
import Dashboard from './components/Dashboard.jsx'
import Header from './components/Header.jsx'
import LogMeal from './components/LogMeal.jsx'
import MealList from './components/MealList.jsx'
import WeightSection from './components/WeightSection.jsx'
import { formatDay } from './lib/dates.js'
import { exerciseBurn } from './lib/exercise.js'
import { useTrackerData } from './lib/trackerStore.js'
import { useToday } from './lib/useToday.js'
import { resolveBodyWeight } from './lib/weight.js'

export default function App() {
  const today = useToday()
  const [viewDate, setViewDate] = useState(null)
  // Viewing "today" follows the calendar, so the app rolls over at midnight.
  const date = viewDate && viewDate < today ? viewDate : today
  const dayLabel = formatDay(date, today)

  const { dayMeals, recentMeals, dayExercises: rawExercises, weights, settings, actions, mode, ready, error, clearError } = useTrackerData(date)
  const updateSettings = actions.updateSettings

  // Burns are recomputed from stored inputs against the latest weigh-in as of
  // that day, so logging a new weight immediately updates the day's totals.
  const bodyWeight = useMemo(() => resolveBodyWeight(weights, date), [weights, date])
  const dayExercises = useMemo(
    () =>
      rawExercises.map((e) => ({ ...e, burn: exerciseBurn(e, bodyWeight.kg) })),
    [rawExercises, bodyWeight.kg],
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
    for (const m of recentMeals) {
      const key = m.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(m)
      if (out.length === 8) break
    }
    return out
  }, [recentMeals])

  const stamp = (entry) => ({ ...entry, date, createdAt: Date.now() })
  const addMeal = (meal) => actions.addMeal(stamp(meal))
  const addExercise = (entry) => actions.addExercise(stamp(entry))
  // One weigh-in per day: saving again for the same date replaces it.
  const saveWeight = ({ date: day, kg }) => actions.saveWeight({ date: day, kg, createdAt: Date.now() })

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <Header date={date} today={today} syncMode={mode} onDateChange={(d) => setViewDate(d >= today ? null : d)} />

      {error && (
        <div role="alert" className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 px-4">
          <p className="flex-1 rounded-xl bg-critical/15 px-3 py-2 text-sm text-critical-ink ring-1 ring-critical/40">{error}</p>
          <button type="button" onClick={clearError} className="text-xs font-semibold text-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      <main aria-busy={!ready} className={`transition-opacity ${ready ? '' : 'opacity-60'} mx-auto max-w-6xl space-y-4 px-4 py-4 sm:space-y-6 sm:py-6`}>
        <Dashboard
          consumed={totals.consumed}
          burned={totals.burned}
          target={settings.targetKcal}
          onTargetChange={(targetKcal) => updateSettings({ targetKcal })}
          macros={totals.macros}
          dayLabel={dayLabel}
        />

        <WeightSection
          weights={weights}
          unit={settings.weightUnit}
          onUnitChange={(weightUnit) => updateSettings({ weightUnit })}
          onSave={saveWeight}
          onDelete={actions.deleteWeight}
          selectedDate={date}
          today={today}
        />

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4 sm:space-y-6">
            <LogMeal onAdd={addMeal} recentFoods={recentFoods} dayLabel={dayLabel} />
            <MealList meals={dayMeals} onDelete={actions.deleteMeal} dayLabel={dayLabel} />
          </div>
          <CardioLog
            exercises={dayExercises}
            bodyWeight={bodyWeight}
            weightUnit={settings.weightUnit}
            distanceUnit={settings.distanceUnit}
            onDistanceUnitChange={(distanceUnit) => updateSettings({ distanceUnit })}
            onAdd={addExercise}
            onDelete={actions.deleteExercise}
            dayLabel={dayLabel}
          />
        </div>

      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted">
        {mode === 'cloud'
          ? 'Synced to your claude.ai account. Open this page on any device to see the same log.'
          : 'Saved in this browser only. Open Cutfn on claude.ai to sync between devices.'}{' '}
        Nutrition and burn figures are estimates.
      </footer>
    </div>
  )
}
