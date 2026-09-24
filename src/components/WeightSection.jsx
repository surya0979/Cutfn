import { ChevronDown, Minus, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDays, daysBetween, formatShortDate } from '../lib/dates.js'
import { fmt1, fromKg, round, toKg } from '../lib/units.js'
import { weeklyRateKg, withMovingAverage } from '../lib/weight.js'
import { Button, Card, CardHeader, Field, IconButton, inputClass, Segmented } from './ui.jsx'

import WeightChart from './WeightChart.jsx'

const RANGES = [
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: 'all', label: 'All' },
]

/** On a cut, down is good: green with a down arrow; up gets red with an up arrow. */
function Delta({ value, unit, suffix = '' }) {
  if (value == null) return <span className="font-display text-3xl font-bold leading-none text-muted">–</span>
  const shown = round(value, 1)
  const Icon = shown < 0 ? TrendingDown : shown > 0 ? TrendingUp : Minus
  const tone = shown < 0 ? 'text-good-ink' : shown > 0 ? 'text-critical-ink' : 'text-ink-2'
  return (
    <span className={`inline-flex items-center gap-1 font-display text-3xl font-bold leading-none tracking-tight ${tone}`}>
      <Icon className="size-4" aria-hidden />
      {shown > 0 ? '+' : ''}
      {fmt1(shown)}
      <span className="text-sm font-medium text-muted">
        {unit}
        {suffix}
      </span>
    </span>
  )
}

function Stat({ label, children }) {
  return (
    <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function WeightForm({ weights, unit, onUnitChange, defaultDate, today, onSave }) {
  const [date, setDate] = useState(defaultDate)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setDate(defaultDate), [defaultDate])

  const existing = weights.find((w) => w.date === date)

  const submit = (e) => {
    e.preventDefault()
    const n = Number(value)
    const kg = toKg(n, unit)
    if (!(kg >= 25 && kg <= 350)) {
      setError(`Enter a weight between ${unit === 'lb' ? '55 and 770 lb' : '25 and 350 kg'}.`)
      return
    }
    onSave({ date, kg: round(kg, 3) })
    setValue('')
    setError('')
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_10rem_auto] sm:items-end">
        <Field label={date === today ? "Today's weight" : 'Weight'}>
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={existing ? fmt1(fromKg(existing.kg, unit)) : unit === 'lb' ? 'e.g. 182.4' : 'e.g. 82.7'}
              className={inputClass}
            />
          )}
        </Field>
        <div className="self-end">
          <Segmented
            label="Weight unit"
            value={unit}
            onChange={onUnitChange}
            options={[
              { value: 'lb', label: 'lb' },
              { value: 'kg', label: 'kg' },
            ]}
            className="h-[46px]"
          />
        </div>
        <Field label="Date">
          {(id) => (
            <input id={id} type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
          )}
        </Field>
        <Button type="submit" className="h-[46px] self-end">
          <Scale className="size-4" aria-hidden /> {existing ? 'Update' : 'Log weight'}
        </Button>
      </div>
      {existing && !error && (
        <p className="text-xs text-muted">
          Already logged {fmt1(fromKg(existing.kg, unit))} {unit} for {formatShortDate(date)}. Saving replaces it.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-critical-ink">
          {error}
        </p>
      )}
    </form>
  )
}

export default function WeightSection({ weights, unit, onUnitChange, onSave, onDelete, selectedDate, today }) {
  const [range, setRange] = useState('all')
  const [showTable, setShowTable] = useState(false)

  const all = useMemo(() => withMovingAverage(weights), [weights])
  const visible = range === 'all' ? all : all.filter((p) => p.date >= addDays(today, -Number(range)))

  const first = all[0]
  const latest = all.at(-1)
  const recent = latest ? all.filter((p) => daysBetween(p.date, latest.date) < 28) : []
  const rate = weeklyRateKg(recent.length >= 2 ? recent : all)

  return (
    <Card id="weight">
      <CardHeader
        icon={Scale}
        title="Weight trend"
        subtitle="Daily weigh-ins with a 7-day average to smooth out water swings"
        action={all.length > 1 && <Segmented label="Chart range" size="sm" value={range} onChange={setRange} options={RANGES} />}
      />

      <WeightForm weights={weights} unit={unit} onUnitChange={onUnitChange} defaultDate={selectedDate} today={today} onSave={onSave} />

      {all.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Start">
            <span className="font-display text-3xl font-bold leading-none tracking-tight">{fmt1(fromKg(first.kg, unit))}</span>
            <span className="ml-1 text-sm text-muted">{unit}</span>
          </Stat>
          <Stat label="Current">
            <span className="font-display text-3xl font-bold leading-none tracking-tight">{fmt1(fromKg(latest.kg, unit))}</span>
            <span className="ml-1 text-sm text-muted">{unit}</span>
          </Stat>
          <Stat label="Total change">
            <Delta value={all.length > 1 ? fromKg(latest.kg, unit) - fromKg(first.kg, unit) : null} unit={unit} />
          </Stat>
          <Stat label="Rate (last 4 wk)">
            <Delta value={rate == null ? null : fromKg(rate, unit)} unit={unit} suffix="/wk" />
          </Stat>
        </div>
      )}

      <div className="mt-5">
        {visible.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-page px-6 text-center sm:h-72">
            <Scale className="size-6 text-muted" aria-hidden />
            <p className="text-sm font-semibold">Your weight graph shows up here</p>
            <p className="max-w-xs text-xs text-muted">
              {all.length === 0
                ? 'Enter today’s weight above and tap Log weight. Each day you log adds a point to the line.'
                : 'No weigh-ins in this range. Switch to “All”.'}
            </p>
          </div>
        ) : (
          <>
            <WeightChart points={visible} unit={unit} />
            {all.length === 1 && <p className="mt-2 text-center text-xs text-muted">Log a few more days to see your trend line take shape.</p>}
          </>
        )}
      </div>

      {all.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-expanded={showTable}
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <ChevronDown className={`size-4 transition-transform ${showTable ? 'rotate-180' : ''}`} aria-hidden />
            All weigh-ins ({all.length})
          </button>
          {showTable && (
            <div className="mt-2 max-h-80 overflow-y-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 font-medium">
                      Date
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Weight
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      7-day avg
                    </th>
                    <th scope="col" className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...all].reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-1.5">{formatShortDate(entry.date)}</td>
                      <td className="py-1.5 text-right font-semibold">
                        {fmt1(fromKg(entry.kg, unit))} <span className="font-normal text-muted">{unit}</span>
                      </td>
                      <td className="py-1.5 text-right text-ink-2">{fmt1(fromKg(entry.avgKg, unit))}</td>
                      <td className="py-1 text-right">
                        <IconButton label={`Delete weigh-in for ${formatShortDate(entry.date)}`} onClick={() => onDelete(entry.id)} className="ml-auto size-8 hover:!text-critical-ink">
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
