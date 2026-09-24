import { useMemo, useState } from 'react'
import CardioLog from './components/CardioLog.jsx'
import Dashboard, { Guardrails } from './components/Dashboard.jsx'
import Header from './components/Header.jsx'
import LogMeal from './components/LogMeal.jsx'
import MealList from './components/MealList.jsx'
import TodayMenu from './components/TodayMenu.jsx'
import WeeklyCheckIn from './components/WeeklyCheckIn.jsx'
import WeightSection from './components/WeightSection.jsx'
import { addDays, formatDay } from './lib/dates.js'
import { exerciseBurn } from './lib/exercise.js'
import { dailyTotals, guardrails, proteinIdeas, smartTarget } from './lib/insights.js'
import { sectionForTime, sectionOf } from './lib/sections.js'
import { HISTORY_DAYS, useTrackerData } from './lib/trackerStore.js'
import { menuFoods, menuForDate } from './lib/weeklyMenu.js'
import { useToday } from './lib/useToday.js'
import { resolveBodyWeight } from './lib/weight.js'

export default function App() {
  const today = useToday()
  const [viewDate, setViewDate] = useState(null)
  // Viewing "today" follows the calendar, so the app rolls over at midnight.
  const date = viewDate && viewDate < today ? viewDate : today
  const dayLabel = formatDay(date, today)

  const {
    dayMeals,
    recentMeals,
    dayExercises: rawExercises,
    historyMeals,
    historyExercises,
    weights,
    water,
    savedMeals,
    menus,
    settings,
    actions,
    mode,
    ready,
    error,
    clearError,
  } = useTrackerData(date, today)
  const updateSettings = actions.updateSettings
  const [section, setSection] = useState(() => sectionForTime())
  const [prefillRequest, setPrefillRequest] = useState(null)

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
      if (m.source === 'quick' && m.name.startsWith('Quick add')) continue
      const key = m.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(m)
      if (out.length === 8) break
    }
    return out
  }, [recentMeals])

  // Six weeks of daily totals feed the weekly check-in, smart target and guardrails.
  const days = useMemo(
    () => dailyTotals({ meals: historyMeals, exercises: historyExercises, weights, from: addDays(today, -HISTORY_DAYS), to: today }),
    [historyMeals, historyExercises, weights, today],
  )
  const smart = useMemo(() => smartTarget({ days, weights, today }), [days, weights, today])
  const warnings = useMemo(() => guardrails({ days, weights, today, targetKcal: settings.targetKcal }), [days, weights, today, settings.targetKcal])

  const menuToday = useMemo(() => menuForDate(menus, date), [menus, date])
  const ideas = useMemo(() => proteinIdeas(menuToday ? menuFoods(menuToday.entries).foods.map((f) => f.food) : []), [menuToday])

  const comboKey = (items) =>
    items
      .map((m) => m.name.toLowerCase())
      .sort()
      .join('|')
  const savedKeys = useMemo(() => new Set(savedMeals.map((u) => comboKey(u.items))), [savedMeals])
  // A section eaten the same way on another day is worth saving as a usual.
  const repeatedSections = useMemo(() => {
    const groups = new Map()
    for (const m of historyMeals) {
      if (m.date === date) continue
      const k = `${m.date}|${sectionOf(m)}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(m)
    }
    return new Set([...groups].filter(([, items]) => items.length >= 2).map(([k, items]) => `${k.split('|')[1]}:${comboKey(items)}`))
  }, [historyMeals, date])

  const glasses = water.find((w) => w.date === date)?.glasses ?? 0

  const stamp = (entry) => ({ ...entry, date, createdAt: Date.now() })
  const addMeal = (meal) => actions.addMeal(stamp({ ...meal, section: meal.section ?? section }))
  const addFood = (food) =>
    addMeal({ name: food.name, portion: food.portion, kcal: food.kcal, protein: food.p, carbs: food.c, fat: food.f, source: 'menu' })
  const logUsual = (usual) => usual.items.forEach((item, i) => actions.addMeal({ ...item, source: 'usual', section, date, createdAt: Date.now() + i }))
  const openManual = (name) => {
    setPrefillRequest({ name, at: Date.now() })
    document.getElementById('food')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
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
        <Guardrails warnings={warnings} />

        <Dashboard
          consumed={totals.consumed}
          burned={totals.burned}
          target={settings.targetKcal}
          onTargetChange={(targetKcal) => updateSettings({ targetKcal })}
          proteinTarget={settings.proteinTarget ?? 150}
          onProteinTargetChange={(proteinTarget) => updateSettings({ proteinTarget })}
          macros={totals.macros}
          dayLabel={dayLabel}
          proteinIdeas={ideas}
          onAddFood={addFood}
          water={{ glasses, goal: settings.waterGoal, onChange: (n) => actions.setWater(date, n) }}
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
            <TodayMenu
              date={date}
              today={today}
              menus={menus}
              onSaveMenus={actions.saveMenus}
              onDeleteMenu={actions.deleteMenu}
              onAdd={addMeal}
              onManual={openManual}
            />
            <LogMeal
              onAdd={addMeal}
              recentFoods={recentFoods}
              dayLabel={dayLabel}
              section={section}
              onSectionChange={setSection}
              usuals={savedMeals}
              onLogUsual={logUsual}
              onDeleteUsual={actions.deleteCombo}
              prefillRequest={prefillRequest}
            />
            <MealList
              meals={dayMeals}
              onDelete={actions.deleteMeal}
              onUpdate={actions.updateMeal}
              onSaveUsual={actions.saveCombo}
              savedKeys={savedKeys}
              repeatedSections={repeatedSections}
              dayLabel={dayLabel}
            />
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

        <WeeklyCheckIn
          week={days.slice(-7)}
          previousWeek={days.slice(-14, -7)}
          weights={weights}
          unit={settings.weightUnit}
          target={settings.targetKcal}
          proteinTarget={settings.proteinTarget}
          water={water}
          waterGoal={settings.waterGoal}
          smart={smart}
          onUseTarget={(targetKcal) => updateSettings({ targetKcal })}
        />
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
