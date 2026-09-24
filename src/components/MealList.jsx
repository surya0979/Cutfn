import { Bookmark, Minus, Pencil, Plus, ScanLine, Sparkles, Trash2, Utensils } from 'lucide-react'
import { useState } from 'react'
import { formatTime } from '../lib/dates.js'
import { dayPossessive } from '../lib/labels.js'
import { SECTIONS, SECTION_LABEL, sectionOf } from '../lib/sections.js'
import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, inputClass, Swatch } from './ui.jsx'

const round1 = (n) => Math.round(n * 10) / 10
const SERVINGS = [0.5, 1, 1.5, 2, 2.5, 3]

/** Inline editor: rename, fix calories, rescale the portion, or move sections. */
function MealEditor({ meal, onSave, onCancel, onDelete }) {
  const base = meal.servings ?? 1
  const [name, setName] = useState(meal.name)
  const [kcal, setKcal] = useState(String(meal.kcal))
  const [servings, setServings] = useState(base)
  const [section, setSection] = useState(sectionOf(meal))

  const step = (dir) => {
    const i = SERVINGS.indexOf(servings)
    const next = SERVINGS[Math.min(SERVINGS.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir))]
    setServings(next)
    setKcal(String(Math.round((meal.kcal * next) / base)))
  }

  const save = (e) => {
    e.preventDefault()
    const k = Math.round(Number(kcal))
    if (!name.trim() || !(k > 0) || k > 10000) return
    // Macros follow the portion change; a hand-typed calorie fix leaves them alone.
    const factor = servings / base
    const scale = (v) => (v == null ? v : round1(v * factor))
    onSave({
      ...meal,
      name: name.trim(),
      kcal: k,
      servings,
      section,
      protein: scale(meal.protein),
      carbs: scale(meal.carbs),
      fat: scale(meal.fat),
    })
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-xl bg-page p-3 ring-1 ring-volt/30">
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Field label="Food">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} py-2`} />}</Field>
        <Field label="Calories">
          {(id) => <input id={id} type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={`${inputClass} py-2`} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-2">Portion</p>
          <div className="flex items-center rounded-lg ring-1 ring-line" role="group" aria-label="Portion">
            <button type="button" onClick={() => step(-1)} className="grid size-9 place-items-center text-ink-2" aria-label="Smaller portion">
              <Minus className="size-3.5" />
            </button>
            <span className="w-10 text-center text-sm font-semibold">{servings}×</span>
            <button type="button" onClick={() => step(1)} className="grid size-9 place-items-center text-ink-2" aria-label="Bigger portion">
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
        <Field label="Meal" className="min-w-0 flex-1">
          {(id) => (
            <select id={id} value={section} onChange={(e) => setSection(e.target.value)} className={`${inputClass} py-2`}>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" className="flex-1 py-2">
          Save
        </Button>
        <Button variant="secondary" className="py-2" onClick={onCancel}>
          Cancel
        </Button>
        <IconButton label={`Delete ${meal.name}`} onClick={() => onDelete(meal.id)} className="hover:!text-critical-ink">
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </form>
  )
}

function SaveUsual({ section, items, onSave, suggested }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`My ${SECTION_LABEL[section].toLowerCase()}`)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium hover:bg-raised ${suggested ? 'text-volt' : 'text-muted hover:text-ink'}`}
      >
        <Bookmark className="size-3.5" aria-hidden />
        {suggested ? 'You eat this often: save as a usual' : 'Save as usual'}
      </button>
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSave({
          name: name.trim(),
          section,
          items: items.map(({ name: n, portion, kcal, protein, carbs, fat, servings }) => ({ name: n, portion, kcal, protein, carbs, fat, servings })),
        })
        setOpen(false)
      }}
      className="flex w-full items-center gap-2 py-1"
    >
      <input aria-label="Name for this usual" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className={`${inputClass} py-1.5 text-sm`} />
      <Button type="submit" className="py-1.5">
        Save
      </Button>
      <Button variant="ghost" className="px-2 py-1.5" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}

export default function MealList({ meals, onDelete, onUpdate, onSaveUsual, repeatedSections = new Set(), savedKeys = new Set(), dayLabel }) {
  const [editing, setEditing] = useState(null)
  const total = meals.reduce((sum, m) => sum + m.kcal, 0)
  const groups = SECTIONS.map((s) => ({ ...s, items: meals.filter((m) => sectionOf(m) === s.id) })).filter((g) => g.items.length)
  const comboKey = (items) =>
    items
      .map((m) => m.name.toLowerCase())
      .sort()
      .join('|')

  return (
    <Card aria-label={`${dayLabel} meals`}>
      <CardHeader
        icon={Utensils}
        title={dayPossessive(dayLabel, 'meals')}
        subtitle={meals.length ? `${meals.length} item${meals.length === 1 ? '' : 's'} · tap one to edit` : 'Nothing logged yet'}
        action={
          meals.length > 0 && (
            <div className="flex items-center gap-1.5 text-right">
              <Swatch color={COLORS.eat} />
              <span className="font-display text-2xl font-bold leading-none">{fmtInt(total)}</span>
              <span className="text-xs text-muted">kcal</span>
            </div>
          )
        }
      />

      {meals.length === 0 ? (
        <EmptyState icon={Utensils}>Log a meal above and it shows up here.</EmptyState>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const subtotal = g.items.reduce((s, m) => s + m.kcal, 0)
            const key = comboKey(g.items)
            return (
              <section key={g.id} aria-label={g.label}>
                <div className="mb-1 flex items-baseline justify-between border-b border-line pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h3>
                  <span className="text-xs text-ink-2">{fmtInt(subtotal)} kcal</span>
                </div>
                <ul className="divide-y divide-line">
                  {g.items.map((meal) =>
                    editing === meal.id ? (
                      <li key={meal.id} className="py-2">
                        <MealEditor
                          meal={meal}
                          onSave={(m) => {
                            onUpdate(m)
                            setEditing(null)
                          }}
                          onCancel={() => setEditing(null)}
                          onDelete={(id) => {
                            onDelete(id)
                            setEditing(null)
                          }}
                        />
                      </li>
                    ) : (
                      <li key={meal.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(meal.id)}
                          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 text-left hover:bg-raised/50"
                          aria-label={`Edit ${meal.name}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              {meal.source === 'menu' && <ScanLine className="size-3.5 shrink-0 text-muted" aria-label="From menu" />}
                              {meal.source === 'ai' && <Sparkles className="size-3.5 shrink-0 text-volt" aria-label="AI estimate" />}
                              <span className="truncate">{meal.name}</span>
                              <Pencil className="size-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                            </p>
                            <p className="truncate text-xs text-muted">
                              {formatTime(meal.createdAt)}
                              {meal.portion && ` · ${meal.servings && meal.servings !== 1 ? `${meal.servings}× ` : ''}${meal.portion}`}
                              {meal.protein != null && ` · P ${Math.round(meal.protein)} · C ${Math.round(meal.carbs ?? 0)} · F ${Math.round(meal.fat ?? 0)}`}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold">
                            {fmtInt(meal.kcal)} <span className="text-xs font-normal text-muted">kcal</span>
                          </span>
                        </button>
                        <IconButton label={`Delete ${meal.name}`} onClick={() => onDelete(meal.id)} className="hover:!text-critical-ink">
                          <Trash2 className="size-4" />
                        </IconButton>
                      </li>
                    ),
                  )}
                </ul>
                {g.items.length >= 2 && !savedKeys.has(key) && (
                  <SaveUsual section={g.id} items={g.items} onSave={onSaveUsual} suggested={repeatedSections.has(`${g.id}:${key}`)} />
                )}
              </section>
            )
          })}
        </div>
      )}
    </Card>
  )
}
