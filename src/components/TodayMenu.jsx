import { CalendarDays, Camera, Check, FileUp, HelpCircle, LoaderCircle, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatShortDate } from '../lib/dates.js'
import { SECTION_LABEL, SECTIONS } from '../lib/sections.js'
import { fmtInt } from '../lib/units.js'
import { menuFoods, menuForDate, parseWeeklyMenu, weekStartOf } from '../lib/weeklyMenu.js'
import { readSpreadsheetCells } from '../lib/xlsx.js'
import { Button, Card, CardHeader, IconButton } from './ui.jsx'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function DishButton({ food, onAdd }) {
  const [done, setDone] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      onClick={() => {
        onAdd()
        setDone(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1400)
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition-colors ${
        done ? 'bg-good/15 text-good-ink ring-good/40' : 'bg-raised text-ink ring-line hover:ring-volt/50'
      }`}
      aria-label={`Log ${food.name}, ${food.kcal} kilocalories`}
    >
      {done ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Plus className="size-3.5 shrink-0 text-volt" aria-hidden />}
      <span className="font-medium">{food.name}</span>
      <span className="text-muted">{fmtInt(food.kcal)}</span>
    </button>
  )
}

export default function TodayMenu({ date, today, menus, onSaveMenus, onDeleteMenu, onAdd, onManual, onPhoto }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [managing, setManaging] = useState(false)
  const input = useRef(null)

  const found = useMemo(() => menuForDate(menus, date), [menus, date])
  const bySection = useMemo(() => {
    if (!found) return []
    return SECTIONS.map((s) => {
      const { foods, unknown, special } = menuFoods(found.entries.filter((e) => (e.section ?? 'lunch') === s.id))
      return { ...s, foods, unknown, special }
    }).filter((s) => s.foods.length || s.unknown.length || s.special.length)
  }, [found])

  async function upload(files) {
    if (!files?.length) return
    setBusy(true)
    setStatus(null)
    const weeks = []
    const failed = []
    for (const file of files) {
      try {
        const week = parseWeeklyMenu(await readSpreadsheetCells(file), weekStartOf(today))
        if (week) weeks.push({ ...week, fileName: file.name })
        else failed.push(file.name)
      } catch {
        failed.push(file.name)
      }
    }
    if (weeks.length) await onSaveMenus(weeks)
    setBusy(false)
    setStatus(
      [
        weeks.length && `Saved ${weeks.map((w) => (w.week ? `Week ${w.week}` : `week of ${formatShortDate(w.weekStart)}`)).join(', ')}.`,
        failed.length && `Couldn’t find MONDAY…SUNDAY columns in ${failed.join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const weekLabel = found ? `${found.menu.week ? `Week ${found.menu.week}` : `Week of ${formatShortDate(found.menu.weekStart)}`}${found.repeated ? ' (repeating cycle)' : ''}` : ''
  const sortedMenus = [...menus].sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  return (
    <Card id="menu">
      <CardHeader
        icon={CalendarDays}
        title={date === today ? 'Today’s canteen menu' : `Canteen menu · ${WEEKDAYS[found?.weekday ?? 0]}`}
        subtitle={found ? `${WEEKDAYS[found.weekday]} · ${weekLabel} · tap a dish to log 1 serving` : 'Upload the weekly menu once, then log lunch in a tap'}
        action={
          <div className="flex shrink-0 gap-1">
            {menus.length > 0 && (
              <IconButton label="Manage uploaded menus" onClick={() => setManaging((m) => !m)} className={managing ? 'text-volt' : ''}>
                <Settings2 className="size-4" />
              </IconButton>
            )}
            <IconButton label="Upload weekly menu spreadsheets" onClick={() => input.current?.click()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            </IconButton>
          </div>
        }
      />
      <input
        ref={input}
        type="file"
        multiple
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          upload([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />

      {status && (
        <p role="status" className="mb-3 text-sm text-ink-2">
          {status}
        </p>
      )}

      {managing && (
        <div className="mb-4 rounded-xl bg-page p-3 ring-1 ring-line">
          <p className="mb-2 text-xs text-muted">
            Uploaded weeks. When the weeks are back to back, they repeat as a cycle after the last one.
          </p>
          <ul className="divide-y divide-line">
            {sortedMenus.map((m) => (
              <li key={m.id ?? m.weekStart} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span>
                  {m.week ? `Week ${m.week}` : 'Week'} <span className="text-muted">· from {formatShortDate(m.weekStart)}</span>
                </span>
                <IconButton label={`Delete menu for week of ${formatShortDate(m.weekStart)}`} onClick={() => onDeleteMenu(m.id ?? m.weekStart)} className="size-8 hover:!text-critical-ink">
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {menus.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-page p-5 text-center">
          <p className="text-sm text-ink-2">
            Add your school’s weekly <span className="font-semibold text-ink">.xlsx</span> menus. You can pick several weeks at once; the app works out each day’s
            dishes and keeps repeating the cycle.
          </p>
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            <FileUp className="size-4" aria-hidden /> Upload menus
          </Button>
        </div>
      ) : !found ? (
        <p className="rounded-xl bg-page px-3 py-3 text-sm text-muted ring-1 ring-line">No menu for this week yet. Upload it with the button above.</p>
      ) : bySection.length === 0 ? (
        <p className="rounded-xl bg-page px-3 py-3 text-sm text-muted ring-1 ring-line">Nothing listed for {WEEKDAYS[found.weekday]}.</p>
      ) : (
        <div className="space-y-3">
          {bySection.map((s) => (
            <div key={s.id}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{SECTION_LABEL[s.id]}</h3>
              {s.special.length > 0 && (
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-volt-soft px-3 py-2.5 ring-1 ring-volt/25">
                  <p className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-volt" aria-hidden />
                    <span>
                      <b className="font-semibold">{s.special[0].text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}</b>
                      <span className="text-ink-2">: dishes aren’t listed on the menu.</span>
                    </span>
                  </p>
                  <Button className="py-1.5" onClick={onPhoto}>
                    <Camera className="size-4" aria-hidden /> Log it with a photo
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {s.foods.map(({ food }) => (
                  <DishButton
                    key={food.id}
                    food={food}
                    onAdd={() =>
                      onAdd({ name: food.name, portion: food.portion, kcal: food.kcal, protein: food.p, carbs: food.c, fat: food.f, source: 'menu', section: s.id })
                    }
                  />
                ))}
                {s.unknown.map((entry) => (
                  <button
                    key={entry.text}
                    type="button"
                    onClick={() => onManual(entry.text)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink"
                    title="Not in the food list: opens the form (leave calories blank for an AI estimate)"
                  >
                    <HelpCircle className="size-3.5 text-muted" aria-hidden />
                    {entry.text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
