import { Pause, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { formatShortDate } from '../lib/dates.js'
import { MIN_TARGET } from '../lib/insights.js'
import { defaultLimit, PLAN_MODES } from '../lib/plan.js'
import { fmtInt } from '../lib/units.js'
import { Button, Card, CardHeader, Field, inputClass, Segmented } from './ui.jsx'

const round50 = (n) => Math.round(n / 50) * 50

/** Weekly numbers from now until the plan settles at its limit (max 12 rows). */
function preview(mode, start, step, limit) {
  const dir = PLAN_MODES[mode].dir
  const rows = [start]
  while (rows.length < 12 && (dir < 0 ? rows.at(-1) > limit : rows.at(-1) < limit)) {
    rows.push(dir < 0 ? Math.max(limit, rows.at(-1) - step) : Math.min(limit, rows.at(-1) + step))
  }
  return rows
}

function Steps({ values, mode }) {
  const max = Math.max(...values)
  const min = Math.min(...values) - 150
  return (
    <ol className="flex h-20 items-end gap-1" aria-label="Weekly calories in this plan">
      {values.map((v, i) => (
        <li key={i} className="flex flex-1 flex-col items-center gap-1" title={`Week ${i + 1}: ${fmtInt(v)} kcal`}>
          <div className={`w-full max-w-6 rounded-t ${mode === 'bulk' ? 'bg-carbs' : 'bg-eat'}`} style={{ height: `${Math.max(8, ((v - min) / (max - min || 1)) * 56)}px` }} />
          <span className="text-[10px] text-muted">W{i + 1}</span>
        </li>
      ))}
    </ol>
  )
}

function PlanSetup({ initialMode, currentKcal, smart, onStart, onCancel }) {
  const [mode, setMode] = useState(initialMode)
  const cfg = PLAN_MODES[mode]
  const suggestedStart = smart?.status === 'ready' ? (mode === 'bulk' ? round50(smart.maintenance + 200) : Math.max(MIN_TARGET, round50(smart.maintenance - 400))) : null
  const [start, setStart] = useState(String(currentKcal))
  const [step, setStep] = useState(cfg.step)
  const [limit, setLimit] = useState(String(defaultLimit(mode, currentKcal)))
  const [error, setError] = useState('')

  const switchMode = (m) => {
    setMode(m)
    setStep(PLAN_MODES[m].step)
    setLimit(String(defaultLimit(m, Number(start) || currentKcal)))
    setError('')
  }

  const startN = Math.round(Number(start))
  const limitN = Math.round(Number(limit))
  const valid = startN >= MIN_TARGET && startN <= 6000 && (mode === 'cut' ? limitN >= MIN_TARGET && limitN <= startN : limitN >= startN && limitN <= 6000)
  const rows = valid ? preview(mode, startN, step, limitN) : []

  const submit = (e) => {
    e.preventDefault()
    if (!valid) {
      return setError(
        mode === 'cut'
          ? `Start at ${fmtInt(MIN_TARGET)} kcal or more, with a floor between ${fmtInt(MIN_TARGET)} and your starting number.`
          : 'The ceiling has to be at or above your starting number.',
      )
    }
    onStart({ mode, startKcal: startN, step, limit: limitN })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        label="Plan type"
        value={mode}
        onChange={switchMode}
        className="w-full"
        options={[
          { value: 'cut', label: 'Cut', icon: TrendingDown },
          { value: 'bulk', label: 'Bulk', icon: TrendingUp },
        ]}
      />
      <p className="text-xs text-ink-2">
        {mode === 'cut'
          ? 'Your daily max drops a little every week. If you’re already losing weight fast that week, the drop is skipped. It never goes below your floor (at least 1,800 kcal).'
          : 'Your daily goal rises a little every week. If you’re gaining weight fast, the rise is skipped to keep the bulk lean. It stops at your ceiling.'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field label={mode === 'cut' ? 'Starting max' : 'Starting goal'} hint="kcal">
          {(id) => <input id={id} type="number" inputMode="numeric" step={50} value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />}
        </Field>
        <Field label={mode === 'cut' ? 'Floor (lowest)' : 'Ceiling (highest)'} hint="kcal">
          {(id) => <input id={id} type="number" inputMode="numeric" step={50} value={limit} onChange={(e) => setLimit(e.target.value)} className={inputClass} />}
        </Field>
      </div>
      {suggestedStart && Math.abs(suggestedStart - startN) >= 50 && (
        <button type="button" onClick={() => setStart(String(suggestedStart))} className="text-xs font-medium text-volt hover:underline">
          Use {fmtInt(suggestedStart)} (from your maintenance of about {fmtInt(smart.maintenance)} kcal)
        </button>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-2">Change each week</p>
        <Segmented
          label="Weekly change"
          value={step}
          onChange={setStep}
          className="w-full"
          options={cfg.steps.map((s) => ({ value: s, label: `${mode === 'cut' ? '−' : '+'}${s} kcal` }))}
        />
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl bg-page p-3 ring-1 ring-line">
          <p className="mb-2 text-xs text-ink-2">
            {fmtInt(rows[0])} → {fmtInt(rows.at(-1))} kcal
            {rows.length > 1 ? ` over ${rows.length - 1} week${rows.length === 2 ? '' : 's'}` : ''}, then holds
            {rows.length === 12 && rows.at(-1) !== limitN ? ' (keeps going after week 12)' : ''}.
          </p>
          <Steps values={rows} mode={mode} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-critical-ink">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Start {cfg.label.toLowerCase()} plan
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

const STATUS_TEXT = {
  stepped: (h, mode) => (mode === 'cut' ? `dropped to ${fmtInt(h.kcal)}` : `rose to ${fmtInt(h.kcal)}`),
  held: (h, mode) => `held at ${fmtInt(h.kcal)}: ${mode === 'cut' ? 'already losing fast' : 'gaining fast'} (${h.pct > 0 ? '+' : ''}${h.pct.toFixed(1)}%/wk)`,
  limit: (h, mode) => `at your ${mode === 'cut' ? 'floor' : 'ceiling'} (${fmtInt(h.kcal)})`,
}

export default function PlanCard({ plan, planNow, fixedKcal, smart, onStart, onStop }) {
  const [editing, setEditing] = useState(false)
  const active = Boolean(planNow)

  return (
    <Card id="plan">
      <CardHeader
        icon={Target}
        title="Cut / bulk plan"
        subtitle={active ? `${planNow.label} · week ${planNow.week} · started ${formatShortDate(plan.startDate)}` : 'Adjust your daily calories a little every week'}
      />

      {!active || editing ? (
        <>
          {!active && (
            <p className="mb-3 text-sm text-ink-2">
              Right now your daily max is fixed at <b className="text-ink">{fmtInt(fixedKcal)} kcal</b>. Start a plan to change it gradually.
            </p>
          )}
          <PlanSetup
            key={editing ? 'edit' : 'new'}
            initialMode={plan?.mode ?? 'cut'}
            currentKcal={active ? planNow.kcal : fixedKcal}
            smart={smart}
            onStart={(p) => {
              onStart(p)
              setEditing(false)
            }}
            onCancel={editing ? () => setEditing(false) : null}
          />
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{planNow.mode === 'cut' ? 'Max this week' : 'Goal this week'}</div>
              <div className="mt-1 font-display text-3xl font-bold leading-none">{fmtInt(planNow.kcal)}</div>
            </div>
            <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Next week</div>
              {planNow.atLimit ? (
                <div className="mt-1 text-sm text-ink-2">Holding at your {planNow.mode === 'cut' ? 'floor' : 'ceiling'}</div>
              ) : (
                <>
                  <div className="mt-1 font-display text-3xl font-bold leading-none text-volt">{fmtInt(planNow.nextKcal)}</div>
                  <div className="text-xs text-muted">from {formatShortDate(planNow.nextDate)}</div>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-2">
            {planNow.mode === 'cut' ? '−' : '+'}
            {planNow.step} kcal a week, {planNow.mode === 'cut' ? 'floor' : 'ceiling'} {fmtInt(planNow.limit)} kcal
            {planNow.weeksToLimit > 0 ? ` (reached in about ${planNow.weeksToLimit} week${planNow.weeksToLimit === 1 ? '' : 's'})` : ''}. Weekly changes are
            skipped when your weight is already moving fast.
          </p>

          {planNow.history.length > 0 && (
            <ol className="space-y-1 rounded-xl bg-page p-3 text-xs ring-1 ring-line">
              {planNow.history
                .slice(-6)
                .reverse()
                .map((h) => (
                  <li key={h.week} className="flex items-center gap-2">
                    {h.status === 'held' ? <Pause className="size-3.5 text-warning" aria-hidden /> : <span className="size-1.5 rounded-full bg-volt" aria-hidden />}
                    <span className="text-muted">Week {h.week} ({formatShortDate(h.date)})</span>
                    <span className="text-ink-2">{STATUS_TEXT[h.status](h, planNow.mode)}</span>
                  </li>
                ))}
            </ol>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
              Change plan
            </Button>
            <Button variant="ghost" onClick={onStop}>
              Stop plan
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
