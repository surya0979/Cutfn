import { Beef, CircleAlert, Droplet, Minus, Pencil, Plus, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'
import CalorieRing from './CalorieRing.jsx'
import { Card, inputClass, Swatch } from './ui.jsx'

function Term({ label, value, color, sign }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {color && <Swatch color={color} />}
        {label}
      </span>
      <span className="font-display text-3xl font-bold leading-none tracking-tight">
        {sign}
        {fmtInt(value)}
      </span>
    </div>
  )
}

function Operator({ children }) {
  return (
    <span aria-hidden className="self-center text-lg font-bold text-muted">
      {children}
    </span>
  )
}

function TargetEditor({ target, onChange, min = 800, max = 8000, step = 50, unit = 'kcal', label = 'Daily calorie target', size = 'lg' }) {
  const [draft, setDraft] = useState(null)
  const editing = draft !== null

  const commit = () => {
    const n = Math.round(Number(draft))
    if (n >= min && n <= max) onChange(n)
    setDraft(null)
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
        className="flex items-center gap-2"
      >
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          aria-label={label}
          className={`${inputClass} ${size === 'lg' ? 'w-28 py-1.5' : 'w-20 py-1 text-sm'}`}
        />
        <span className="text-sm text-muted">{unit}</span>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(String(target))}
      className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 text-left hover:bg-raised"
      aria-label={`${label} ${target} ${unit}. Edit`}
    >
      <span className={size === 'lg' ? 'font-display text-3xl font-bold leading-none tracking-tight' : 'text-xs font-semibold text-ink-2'}>{fmtInt(target)}</span>
      <span className={size === 'lg' ? 'text-sm text-muted' : 'text-xs text-muted'}>{unit}</span>
      <Pencil className="size-3.5 text-muted group-hover:text-volt" aria-hidden />
    </button>
  )
}

/** Carb and fat goals follow from the calorie and protein targets: 25% of calories from fat, the rest carbs. */
export function macroTargets(kcalTarget, proteinTarget) {
  const fat = (kcalTarget * 0.25) / 9
  const carbs = Math.max(0, (kcalTarget - proteinTarget * 4 - fat * 9) / 4)
  return { protein: proteinTarget, carbs, fat }
}

function MacroRow({ label, grams, goal, color, editor }) {
  const pct = goal > 0 ? grams / goal : 0
  const over = pct > 1.05
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
          <Swatch color={color} />
          {label}
        </span>
        <span className="flex items-baseline gap-1 text-xs tabular-nums">
          <span className="font-display text-lg font-bold leading-none text-ink">{Math.round(grams)}</span>
          <span className="text-muted">/</span>
          {editor ?? <span className="text-muted">{Math.round(goal)} g</span>}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label={`${label} ${Math.round(grams)} of ${Math.round(goal)} grams`}
        aria-valuemin={0}
        aria-valuemax={Math.round(goal)}
        aria-valuenow={Math.round(grams)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(pct, 1) * 100}%`, backgroundColor: over ? COLORS.critical : color }}
        />
      </div>
    </div>
  )
}

function MacroBars({ protein, carbs, fat, target, proteinTarget, onProteinTargetChange }) {
  const goals = macroTargets(target, proteinTarget)
  return (
    <div className="space-y-2.5">
      <MacroRow
        label="Protein"
        grams={protein}
        goal={goals.protein}
        color={COLORS.protein}
        editor={
          <TargetEditor
            target={proteinTarget}
            onChange={onProteinTargetChange}
            min={20}
            max={400}
            step={5}
            unit="g"
            label="Protein target"
            size="sm"
          />
        }
      />
      <MacroRow label="Carbs" grams={carbs} goal={goals.carbs} color={COLORS.carbs} />
      <MacroRow label="Fat" grams={fat} goal={goals.fat} color={COLORS.fat} />
    </div>
  )
}

/** Safety warnings from the guardrails, most severe first. */
export function Guardrails({ warnings }) {
  if (!warnings.length) return null
  return (
    <div className="space-y-2" role="alert">
      {warnings.map((w) => {
        const critical = w.level === 'critical'
        const Icon = critical ? ShieldAlert : TriangleAlert
        return (
          <div key={w.id} className={`flex gap-3 rounded-2xl px-4 py-3 ring-1 ${critical ? 'bg-critical/12 ring-critical/45' : 'bg-warning/10 ring-warning/35'}`}>
            <Icon className={`mt-0.5 size-5 shrink-0 ${critical ? 'text-critical-ink' : 'text-warning'}`} aria-hidden />
            <div>
              <p className="text-sm font-semibold">{w.title}</p>
              <p className="text-xs text-ink-2">{w.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProteinHelper({ remaining, ideas, onAdd }) {
  if (remaining <= 5) {
    return (
      <p className="flex items-center gap-2 text-xs text-good-ink">
        <Beef className="size-4" aria-hidden /> Protein goal hit for today. Nice.
      </p>
    )
  }
  return (
    <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
      <p className="mb-2 flex items-center gap-2 text-xs text-ink-2">
        <Beef className="size-4 text-protein" aria-hidden />
        <span>
          <span className="font-bold text-ink">{Math.round(remaining)} g</span> protein to go. Good picks:
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ideas.slice(0, 4).map(({ food, onMenu }) => (
          <button
            key={food.id}
            type="button"
            onClick={() => onAdd(food)}
            className="inline-flex items-center gap-1 rounded-lg bg-raised px-2.5 py-1 text-xs ring-1 ring-line hover:ring-volt/50"
            title={`${food.portion} · ${food.kcal} kcal`}
            aria-label={`Log ${food.name}: ${food.p} grams protein, ${food.kcal} kilocalories`}
          >
            <Plus className="size-3 text-volt" aria-hidden />
            <span className="font-medium">{food.name}</span>
            <span className="text-muted">{Math.round(food.p)} g</span>
            {onMenu && <span className="rounded bg-volt-soft px-1 text-[10px] font-semibold uppercase text-volt">menu</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function WaterTracker({ glasses, goal, onChange }) {
  const slots = Math.max(goal, glasses)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <Droplet className="size-4 text-eat" aria-hidden />
        <span className="text-xs text-ink-2">
          Water <span className="font-bold text-ink">{glasses}</span> / {goal} glasses
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="mr-1 hidden gap-0.5 sm:flex" aria-hidden>
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`h-4 w-2.5 rounded-sm ${i < glasses ? 'bg-eat' : 'bg-line'}`} />
          ))}
        </div>
        <button type="button" onClick={() => onChange(Math.max(0, glasses - 1))} disabled={glasses === 0} className="grid size-8 place-items-center rounded-lg ring-1 ring-line text-ink-2 disabled:opacity-30" aria-label="Remove a glass">
          <Minus className="size-3.5" />
        </button>
        <button type="button" onClick={() => onChange(glasses + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-eat/20 px-2.5 text-xs font-semibold text-ink ring-1 ring-eat/40" aria-label="Add a glass of water">
          <Plus className="size-3.5" /> Glass
        </button>
      </div>
    </div>
  )
}

export default function Dashboard({ consumed, burned, target, onTargetChange, proteinTarget, onProteinTargetChange, macros, dayLabel, proteinIdeas, onAddFood, water }) {
  const net = consumed - burned
  const remaining = target - net
  const over = remaining < 0

  return (
    <Card id="today" aria-label={`${dayLabel} summary`}>
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch">
        <CalorieRing net={net} target={target} />

        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div>
            <h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dayLabel} · Net calories</h1>
            <div className="mt-2 flex items-stretch gap-1.5 sm:gap-2">
              <Term label="Eaten" value={consumed} color={COLORS.eat} />
              <Operator>−</Operator>
              <Term label="Burned" value={burned} color={COLORS.burn} />
              <Operator>=</Operator>
              <Term label="Net" value={net} color={over ? COLORS.critical : COLORS.volt} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Daily target</div>
              <TargetEditor target={target} onChange={onTargetChange} />
            </div>
            <div className={`rounded-xl px-3 py-2.5 ring-1 ${over ? 'bg-critical/10 ring-critical/40' : 'bg-volt-soft ring-volt/25'}`}>
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {over && <CircleAlert className="size-3.5 text-critical-ink" aria-hidden />}
                {over ? 'Over target' : 'Remaining'}
              </div>
              <div className="py-1">
                <span className={`font-display text-3xl font-bold leading-none tracking-tight ${over ? 'text-critical-ink' : 'text-volt'}`}>{fmtInt(Math.abs(remaining))}</span>
                <span className="ml-2 text-sm text-muted">kcal</span>
              </div>
            </div>
          </div>

          <MacroBars {...macros} target={target} proteinTarget={proteinTarget} onProteinTargetChange={onProteinTargetChange} />
          <ProteinHelper remaining={proteinTarget - macros.protein} ideas={proteinIdeas} onAdd={onAddFood} />
          <WaterTracker {...water} />
        </div>
      </div>
    </Card>
  )
}
