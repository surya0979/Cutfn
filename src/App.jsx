import { useCallback, useEffect, useMemo, useState } from 'react'
import CardioLog from './components/CardioLog.jsx'
import DataCard from './components/DataCard.jsx'
import Dashboard, { Guardrails } from './components/Dashboard.jsx'
import Header, { BottomNav, TAB_OF } from './components/Header.jsx'
import LogMeal from './components/LogMeal.jsx'
import MealList from './components/MealList.jsx'
import Toast, { useToast } from './components/Toast.jsx'
import TodayMenu from './components/TodayMenu.jsx'
import WeeklyCheckIn from './components/WeeklyCheckIn.jsx'
import WeightSection from './components/WeightSection.jsx'
import { addDays, formatDay } from './lib/dates.js'
import { exerciseBurn } from './lib/exercise.js'
import { makeId } from './lib/id.js'
import { dailyTotals, guardrails, proteinIdeas, smartTarget } from './lib/insights.js'
import { sectionForTime, sectionOf } from './lib/sections.js'
import { HISTORY_DAYS, useTrackerData } from './lib/trackerStore.js'
import { menuFoods, menuForDate } from './lib/weeklyMenu.js'
import { useToday } from './lib/useToday.js'
import { fmtInt } from './lib/units.js'
import { resolveBodyWeight } from './lib/weight.js'

const TAB_KEY = 'cutfn.tab'
const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) || 'home'
  } catch {
    return 'home'
  }
}

export default function App() {
  const today = useToday()
  const [tab, setTabState] = useState(readTab)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()
  const setTab = (next, scrollTo) => {
    setTabState(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* per-device convenience only */
    }
    requestAnimationFrame(() => {
      const el = scrollTo && document.getElementById(scrollTo)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else window.scrollTo({ top: 0 })
    })
  }

  // In-page links like #weight switch to the tab that holds that card.
  useEffect(() => {
    const onHash = () => {
      const id = location.hash.slice(1)
      if (TAB_OF[id]) setTab(TAB_OF[id], id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
    settingsLoaded,
  } = useTrackerData(date, today)
  const updateSettings = actions.updateSettings
  // One-time switch to the intake cap: the daily max applies to food eaten
  // (exercise no longer adds to it) and starts at 2,200 kcal.
  useEffect(() => {
    if (settingsLoaded && mode !== 'connecting' && !settings.intakeCap) updateSettings({ targetKcal: 2200, intakeCap: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, mode, settings.intakeCap])
  const [section, setSection] = useState(() => sectionForTime())
  const [prefillRequest, setPrefillRequest] = useState(null)
  const clearPrefill = useCallback(() => setPrefillRequest(null), [])

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
  const addMeal = (meal) => {
    const id = makeId()
    actions.addMeal(stamp({ ...meal, id, section: meal.section ?? section }))
    showToast({ message: `Added ${meal.name} · ${fmtInt(meal.kcal)} kcal`, onUndo: () => actions.deleteMeal(id) })
  }
  const addFood = (food) =>
    addMeal({ name: food.name, portion: food.portion, kcal: food.kcal, protein: food.p, carbs: food.c, fat: food.f, source: 'menu' })
  const logUsual = (usual) => {
    const ids = usual.items.map((item, i) => {
      const id = makeId()
      actions.addMeal({ ...item, id, source: 'usual', section, date, createdAt: Date.now() + i })
      return id
    })
    const kcal = usual.items.reduce((s, i) => s + (i.kcal ?? 0), 0)
    showToast({ message: `Logged ${usual.name} · ${fmtInt(kcal)} kcal`, onUndo: () => ids.forEach((id) => actions.deleteMeal(id)) })
  }
  const openManual = (name) => {
    setPrefillRequest({ name, at: Date.now() })
    setTab('food', 'food')
  }
  const addExercise = (entry) => {
    const id = makeId()
    actions.addExercise(stamp({ ...entry, id }))
    showToast({ message: 'Workout logged', onUndo: () => actions.deleteExercise(id) })
  }
  // One weigh-in per day: saving again for the same date replaces it.
  const saveWeight = ({ date: day, kg }) => actions.saveWeight({ date: day, kg, createdAt: Date.now() })

  const mealList = (
    <MealList
      meals={dayMeals}
      onDelete={actions.deleteMeal}
      onUpdate={actions.updateMeal}
      onSaveUsual={actions.saveCombo}
      savedKeys={savedKeys}
      repeatedSections={repeatedSections}
      dayLabel={dayLabel}
    />
  )

  return (
    <div className="min-h-dvh bg-page text-ink">
      <Header date={date} today={today} syncMode={mode} onDateChange={(d) => setViewDate(d >= today ? null : d)} tab={tab} onTabChange={(t) => setTab(t)} />

      {error && (
        <div role="alert" className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 px-4">
          <p className="flex-1 rounded-xl bg-critical/15 px-3 py-2 text-sm text-critical-ink ring-1 ring-critical/40">{error}</p>
          <button type="button" onClick={clearError} className="text-xs font-semibold text-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      <main
        key={tab}
        aria-busy={!ready}
        className={`view-in mx-auto max-w-6xl space-y-4 px-4 pb-28 pt-4 transition-opacity sm:space-y-6 sm:pt-6 lg:pb-10 ${ready ? '' : 'opacity-60'}`}
      >
        {tab === 'home' && (
          <>
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
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
              <TodayMenu
                date={date}
                today={today}
                menus={menus}
                onSaveMenus={actions.saveMenus}
                onDeleteMenu={actions.deleteMenu}
                onAdd={addMeal}
                onManual={openManual}
                onPhoto={() => {
                  setPrefillRequest({ tab: 'photo', at: Date.now() })
                  setTab('food', 'food')
                }}
              />
              {mealList}
            </div>
          </>
        )}

        {tab === 'food' && (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
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
              onPrefillHandled={clearPrefill}
            />
            {mealList}
          </div>
        )}

        {tab === 'train' && (
          <div className="mx-auto max-w-2xl">
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
        )}

        {tab === 'progress' && (
          <>
            <WeightSection
              weights={weights}
              unit={settings.weightUnit}
              onUnitChange={(weightUnit) => updateSettings({ weightUnit })}
              onSave={saveWeight}
              onDelete={actions.deleteWeight}
              selectedDate={date}
              today={today}
            />
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
            <DataCard loadAll={actions.loadAll} restore={actions.restore} />
          </>
        )}

        <footer className="pt-2 text-center text-xs text-muted">
          {mode === 'cloud'
            ? 'Synced to your claude.ai account. Open this page on any device to see the same log.'
            : 'Saved in this browser only. Open Cutfn on claude.ai to sync between devices.'}{' '}
          Nutrition and burn figures are estimates.
        </footer>
      </main>

      <Toast toast={toast} onDismiss={dismissToast} />
      <BottomNav tab={tab} onTabChange={(t) => setTab(t)} />
    </div>
  )
}
