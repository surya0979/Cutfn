import { CircleAlert, Pencil } from 'lucide-react'
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
      <span className="text-xl font-bold tracking-tight sm:text-2xl">
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

function TargetEditor({ target, onChange }) {
  const [draft, setDraft] = useState(null)
  const editing = draft !== null

  const commit = () => {
    const n = Math.round(Number(draft))
    if (n >= 800 && n <= 8000) onChange(n)
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
          min={800}
          max={8000}
          step={50}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          aria-label="Daily calorie target"
          className={`${inputClass} w-28 py-1.5`}
        />
        <span className="text-sm text-muted">kcal</span>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(String(target))}
      className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 text-left hover:bg-raised"
      aria-label={`Daily target ${target} kilocalories. Edit`}
    >
      <span className="text-xl font-bold tracking-tight">{fmtInt(target)}</span>
      <span className="text-sm text-muted">kcal</span>
      <Pencil className="size-3.5 text-muted group-hover:text-volt" aria-hidden />
    </button>
  )
}

function MacroBar({ protein, carbs, fat }) {
  const parts = [
    { key: 'Protein', grams: protein, kcal: protein * 4, color: COLORS.protein },
    { key: 'Carbs', grams: carbs, kcal: carbs * 4, color: COLORS.carbs },
    { key: 'Fat', grams: fat, kcal: fat * 9, color: COLORS.fat },
  ]
  const total = parts.reduce((s, p) => s + p.kcal, 0)

  if (total === 0) {
    return <p className="text-xs text-muted">Macros show up here when a logged food includes protein, carbs and fat.</p>
  }

  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Macro calorie split">
        {parts.map(
          (p) =>
            p.kcal > 0 && (
              <div key={p.key} style={{ width: `${(p.kcal / total) * 100}%`, backgroundColor: p.color }} className="first:rounded-l-full last:rounded-r-full" />
            ),
        )}
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-2">
              <Swatch color={p.color} />
              {p.key}
            </dt>
            <dd className="mt-0.5 text-sm">
              <span className="font-semibold">{Math.round(p.grams)} g</span>
              <span className="text-muted"> · {Math.round((p.kcal / total) * 100)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function Dashboard({ consumed, burned, target, onTargetChange, macros, dayLabel }) {
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
                <span className={`text-xl font-bold tracking-tight ${over ? 'text-critical-ink' : 'text-volt'}`}>{fmtInt(Math.abs(remaining))}</span>
                <span className="ml-2 text-sm text-muted">kcal</span>
              </div>
            </div>
          </div>

          <MacroBar {...macros} />
        </div>
      </div>
    </Card>
  )
}
