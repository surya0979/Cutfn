import { Activity, Dumbbell, Flame, Footprints, Plus, Scale, SportShoe, Trash2, TriangleAlert, Volleyball } from 'lucide-react'
import { useState } from 'react'
import { formatShortDate, formatTime } from '../lib/dates.js'
import { distanceBurn, formatPace, JUMP_ROPE, jumpRopeBurn, TIMED_ACTIVITIES, timedBurn } from '../lib/exercise.js'
import { dayPossessive } from '../lib/labels.js'
import { COLORS } from '../lib/theme.js'
import { fmt1, fmtInt, fromKg, fromKm, toKm } from '../lib/units.js'
import { Button, Card, CardHeader, EmptyState, Field, IconButton, inputClass, Segmented, Swatch, TabPanel, Tabs } from './ui.jsx'

const positive = (v) => {
  const n = Number(v)
  return v !== '' && n > 0 ? n : null
}

function WeightNotice({ bodyWeight, weightUnit }) {
  const shown = `${fmt1(fromKg(bodyWeight.kg, weightUnit))} ${weightUnit}`
  if (bodyWeight.isDefault) {
    return (
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-ink-2 ring-1 ring-warning/30">
        <TriangleAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden />
        <span>
          No weigh-in yet, so burns assume {shown}.{' '}
          <a href="#weight" className="font-semibold text-ink underline decoration-warning/60 underline-offset-2">
            Log your weight
          </a>{' '}
          for accurate numbers.
        </span>
      </p>
    )
  }
  return (
    <p className="mb-4 flex items-center gap-2 text-xs text-ink-2">
      <Scale className="size-4 shrink-0 text-muted" aria-hidden />
      <span>
        Burns use your latest weigh-in: <strong className="font-semibold text-ink">{shown}</strong>
        <span className="text-muted"> ({formatShortDate(bodyWeight.date)})</span>
      </span>
    </p>
  )
}

function BurnPreview({ result, details, formula, emptyText, warning }) {
  if (!result) {
    return <p className="rounded-xl bg-page px-3 py-3 text-sm text-muted ring-1 ring-line">{emptyText}</p>
  }
  return (
    <div className="rounded-xl bg-page px-3 py-3 ring-1 ring-line" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <Swatch color={COLORS.burn} /> Estimated burn
        </span>
        <span>
          <span className="font-display text-4xl font-bold leading-none tracking-tight">{fmtInt(result.kcal)}</span>
          <span className="ml-1 text-sm text-muted">kcal</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-2">{details}</p>
      <p className="mt-0.5 font-mono text-[11px] text-muted">{formula}</p>
      {warning && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlert className="size-3.5" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  )
}

const formulaText = (met, kg, minutes) => `${fmt1(met)} MET × ${fmt1(kg)} kg × ${(minutes / 60).toFixed(2)} h`

function DistanceForm({ weightKg, distanceUnit, onDistanceUnitChange, onAdd }) {
  const [activity, setActivity] = useState('run')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')

  const dist = positive(distance)
  const mins = positive(duration)
  const result = dist ? distanceBurn({ activity, distanceKm: toKm(dist, distanceUnit), durationMin: mins, weightKg }) : null

  const submit = (e) => {
    e.preventDefault()
    if (!result) return
    onAdd({ kind: activity, distanceKm: toKm(dist, distanceUnit), durationMin: mins })
    setDistance('')
    setDuration('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        label="Activity type"
        value={activity}
        onChange={setActivity}
        className="w-full"
        options={[
          { value: 'walk', label: 'Walking', icon: Footprints },
          { value: 'run', label: 'Running', icon: SportShoe },
        ]}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Distance traveled">
          {(id) => (
            <div className="flex gap-1.5">
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0.0"
                className={`${inputClass} min-w-0`}
              />
              <Segmented
                label="Distance unit"
                size="sm"
                value={distanceUnit}
                onChange={onDistanceUnitChange}
                options={[
                  { value: 'mi', label: 'mi' },
                  { value: 'km', label: 'km' },
                ]}
              />
            </div>
          )}
        </Field>
        <Field label="Time" hint="optional, min">
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <BurnPreview
        result={result}
        emptyText="Enter a distance to see the calorie burn."
        details={
          result &&
          `${fmt1(dist)} ${distanceUnit} · ${formatPace(result.speedMph, distanceUnit)}${result.assumedPace ? ' (typical pace, add a time to refine)' : ''} · ${Math.round(result.minutes)} min`
        }
        formula={result && formulaText(result.met, weightKg, result.minutes)}
        warning={result?.outOfRange && `That pace looks unusual for ${activity === 'run' ? 'running' : 'walking'}. Double-check distance and time.`}
      />

      <Button type="submit" disabled={!result} className="w-full">
        <Plus className="size-4" aria-hidden /> Log {activity === 'run' ? 'run' : 'walk'}
      </Button>
    </form>
  )
}

function JumpRopeForm({ weightKg, onAdd }) {
  const [mode, setMode] = useState('skips')
  const [amount, setAmount] = useState('')
  const [intensity, setIntensity] = useState('moderate')

  const value = positive(amount)
  const result = value
    ? jumpRopeBurn({ mode, skips: mode === 'skips' ? Math.round(value) : null, minutes: mode === 'minutes' ? value : null, intensity, weightKg })
    : null
  const preset = JUMP_ROPE[intensity]

  const submit = (e) => {
    e.preventDefault()
    if (!result) return
    onAdd({
      kind: 'jumprope',
      mode,
      skips: mode === 'skips' ? Math.round(value) : null,
      minutes: mode === 'minutes' ? value : null,
      intensity,
    })
    setAmount('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        label="Count by"
        value={mode}
        onChange={(m) => {
          setMode(m)
          setAmount('')
        }}
        className="w-full"
        options={[
          { value: 'skips', label: 'Number of skips' },
          { value: 'minutes', label: 'Minutes skipping' },
        ]}
      />
      <Field label={mode === 'skips' ? 'Skips' : 'Minutes'}>
        {(id) => (
          <input
            id={id}
            type="number"
            inputMode={mode === 'skips' ? 'numeric' : 'decimal'}
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'skips' ? 'e.g. 1000' : 'e.g. 10'}
            className={inputClass}
          />
        )}
      </Field>
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-2">
          Pace <span className="font-normal text-muted">{preset.detail} · {preset.met} MET</span>
        </p>
        <Segmented
          label="Skipping pace"
          value={intensity}
          onChange={setIntensity}
          className="w-full"
          options={Object.entries(JUMP_ROPE).map(([value, p]) => ({ value, label: p.label }))}
        />
      </div>

      <BurnPreview
        result={result}
        emptyText={`Enter ${mode === 'skips' ? 'a skip count' : 'minutes'} to see the calorie burn.`}
        details={
          result &&
          (mode === 'skips'
            ? `${fmtInt(result.skips)} skips ≈ ${fmt1(result.minutes)} min at ~${preset.skipsPerMin}/min`
            : `${fmt1(result.minutes)} min ≈ ${fmtInt(result.skips)} skips at ~${preset.skipsPerMin}/min`)
        }
        formula={result && formulaText(result.met, weightKg, result.minutes)}
      />

      <Button type="submit" disabled={!result} className="w-full">
        <Plus className="size-4" aria-hidden /> Log jump rope
      </Button>
    </form>
  )
}

function TimedForm({ kind, weightKg, onAdd }) {
  const activity = TIMED_ACTIVITIES[kind]
  const [minutes, setMinutes] = useState('')
  const [level, setLevel] = useState('moderate')
  const mins = positive(minutes)
  const result = mins ? timedBurn({ kind, minutes: mins, level, weightKg }) : null
  const preset = activity.levels[level]

  const submit = (e) => {
    e.preventDefault()
    if (!result) return
    onAdd({ kind, minutes: mins, level })
    setMinutes('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Minutes">
        {(id) => (
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={kind === 'football' ? 'e.g. 60' : 'e.g. 45'}
            className={inputClass}
          />
        )}
      </Field>
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-2">
          Intensity <span className="font-normal text-muted">{preset.detail} · {preset.met} MET</span>
        </p>
        <Segmented
          label={`${activity.label} intensity`}
          value={level}
          onChange={setLevel}
          className="w-full"
          options={Object.entries(activity.levels).map(([value, l]) => ({ value, label: l.label }))}
        />
      </div>
      <BurnPreview
        result={result}
        emptyText="Enter how many minutes to see the calorie burn."
        details={result && `${Math.round(result.minutes)} min of ${activity.label.toLowerCase()} · ${preset.label.toLowerCase()}`}
        formula={result && formulaText(result.met, weightKg, result.minutes)}
      />
      <Button type="submit" disabled={!result} className="w-full">
        <Plus className="size-4" aria-hidden /> Log {activity.label.toLowerCase()}
      </Button>
    </form>
  )
}

const KIND = {
  walk: { label: 'Walk', icon: Footprints },
  run: { label: 'Run', icon: SportShoe },
  jumprope: { label: 'Jump rope', icon: Activity },
  football: { label: 'Football', icon: Volleyball },
  gym: { label: 'Gym', icon: Dumbbell },
}

function describe(entry, distanceUnit) {
  const { burn } = entry
  if (!burn) return { title: KIND[entry.kind]?.label ?? 'Exercise', detail: '' }
  if (TIMED_ACTIVITIES[entry.kind]) {
    const level = TIMED_ACTIVITIES[entry.kind].levels[entry.level] ?? TIMED_ACTIVITIES[entry.kind].levels.moderate
    return { title: `${KIND[entry.kind].label} · ${Math.round(entry.minutes)} min`, detail: `${level.label} · ${fmt1(burn.met)} MET` }
  }
  if (entry.kind === 'jumprope') {
    return {
      title: `Jump rope · ${entry.mode === 'skips' ? `${fmtInt(entry.skips)} skips` : `${fmt1(entry.minutes)} min`}`,
      detail: `${fmt1(burn.minutes)} min · ${JUMP_ROPE[entry.intensity]?.label ?? 'Moderate'} · ${fmt1(burn.met)} MET`,
    }
  }
  return {
    title: `${KIND[entry.kind].label} · ${fmt1(fromKm(entry.distanceKm, distanceUnit))} ${distanceUnit}`,
    detail: `${Math.round(burn.minutes)} min · ${formatPace(burn.speedMph, distanceUnit)}${burn.assumedPace ? ' (typical)' : ''} · ${fmt1(burn.met)} MET`,
  }
}

export default function CardioLog({ exercises, bodyWeight, weightUnit, distanceUnit, onDistanceUnitChange, onAdd, onDelete, dayLabel }) {
  const [tab, setTab] = useState('distance')
  const total = exercises.reduce((sum, e) => sum + (e.burn?.kcal ?? 0), 0)

  return (
    <Card id="cardio">
      <CardHeader icon={Flame} title="Calorie burn & cardio" subtitle="MET formula · scales with your body weight" />
      <WeightNotice bodyWeight={bodyWeight} weightUnit={weightUnit} />

      <Tabs
        label="Exercise type"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'distance', label: 'Walk/Run', icon: Footprints },
          { value: 'rope', label: 'Rope', icon: Activity },
          { value: 'football', label: 'Football', icon: Volleyball },
          { value: 'gym', label: 'Gym', icon: Dumbbell },
        ]}
      />
      <TabPanel value={tab}>
        {tab === 'distance' && <DistanceForm weightKg={bodyWeight.kg} distanceUnit={distanceUnit} onDistanceUnitChange={onDistanceUnitChange} onAdd={onAdd} />}
        {tab === 'rope' && <JumpRopeForm weightKg={bodyWeight.kg} onAdd={onAdd} />}
        {(tab === 'football' || tab === 'gym') && <TimedForm key={tab} kind={tab} weightKg={bodyWeight.kg} onAdd={onAdd} />}
      </TabPanel>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{dayPossessive(dayLabel, 'workouts')}</h3>
          {exercises.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Swatch color={COLORS.burn} />
              <span className="font-display text-2xl font-bold leading-none">{fmtInt(total)}</span>
              <span className="text-xs text-muted">kcal burned</span>
            </span>
          )}
        </div>
        {exercises.length === 0 ? (
          <EmptyState icon={Activity}>No workouts logged. Every mile counts.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {exercises.map((entry) => {
              const { title, detail } = describe(entry, distanceUnit)
              const Icon = KIND[entry.kind]?.icon ?? Activity
              return (
                <li key={entry.id} className="flex items-center gap-3 py-2.5 last:pb-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-burn/15 text-burn-ink">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    <p className="truncate text-xs text-muted">
                      {formatTime(entry.createdAt)} · {detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {fmtInt(entry.burn?.kcal ?? 0)} <span className="text-xs font-normal text-muted">kcal</span>
                  </span>
                  <IconButton label={`Delete ${title}`} onClick={() => onDelete(entry.id)} className="hover:!text-critical-ink">
                    <Trash2 className="size-4" />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}
        {exercises.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Recalculated at {fmt1(fromKg(bodyWeight.kg, weightUnit))} {weightUnit}. Burns update if you log a new weight for this day.
          </p>
        )}
      </div>
    </Card>
  )
}
