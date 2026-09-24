import { CalendarCheck, LoaderCircle, Sparkles, Target } from 'lucide-react'
import { useState } from 'react'
import { askClaude, useAiAvailable } from '../lib/aiEstimate.js'
import { fromDateKey } from '../lib/dates.js'
import { COLORS } from '../lib/theme.js'
import { fmt1, fmtInt, fromKg } from '../lib/units.js'
import { Button, Card, CardHeader, Swatch } from './ui.jsx'

const avg = (list, get) => (list.length ? list.reduce((s, x) => s + get(x), 0) / list.length : null)
const weekday = (key) => fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short' })

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

/** Seven columns of net calories against the target line. */
function WeekBars({ days, target }) {
  const max = Math.max(target * 1.25, ...days.map((d) => d.net))
  const h = 120
  const y = (v) => h - (Math.max(0, v) / max) * h
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Swatch color={COLORS.eat} /> Net kcal
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={COLORS.critical} /> Over target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-volt" /> Target {fmtInt(target)}
        </span>
      </div>
      <div className="relative" style={{ height: h + 36 }}>
        <div className="absolute inset-x-0 border-t border-volt/70" style={{ top: y(target) }} aria-hidden />
        <ol className="absolute inset-0 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const over = d.logged && d.net > target
            return (
              <li key={d.date} className="flex flex-col items-center" title={`${weekday(d.date)}: ${d.entries ? `${fmtInt(d.net)} kcal net` : 'not logged'}`}>
                <div className="relative w-full" style={{ height: h }}>
                  {d.entries > 0 ? (
                    <div
                      className="absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 rounded-t"
                      style={{ height: h - y(d.net), backgroundColor: over ? COLORS.critical : COLORS.eat, opacity: d.logged ? 1 : 0.45 }}
                    />
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-1 w-full max-w-6 -translate-x-1/2 rounded bg-line" />
                  )}
                </div>
                <span className="mt-1 text-[11px] text-muted">{weekday(d.date)}</span>
                <span className="text-[11px] tabular-nums text-ink-2">{d.entries ? fmtInt(d.net) : '–'}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </figure>
  )
}

function SmartTarget({ smart, target, unit, onUse }) {
  if (smart.status === 'collecting') {
    const steps = [
      [`${Math.min(smart.loggedDays, smart.needDays)}/${smart.needDays} days fully logged`, smart.loggedDays >= smart.needDays],
      [`${Math.min(smart.weighIns, smart.needWeighIns)}/${smart.needWeighIns} weigh-ins`, smart.weighIns >= smart.needWeighIns],
      [`weigh-ins ${Math.min(smart.weighSpan, smart.needSpan)}/${smart.needSpan} days apart`, smart.weighSpan >= smart.needSpan],
    ]
    return (
      <div className="rounded-xl bg-page p-3 ring-1 ring-line">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-volt" aria-hidden /> Smart target: collecting data
        </p>
        <p className="mt-1 text-xs text-ink-2">
          Log your meals (2+ entries a day) and weigh in a few times a week. After about two weeks the app works out what you really burn and suggests a
          target.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs">
          {steps.map(([text, ok]) => (
            <li key={text} className={ok ? 'text-good-ink' : 'text-muted'}>
              {ok ? '✓' : '○'} {text}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (smart.status === 'unclear') {
    return (
      <div className="rounded-xl bg-page p-3 text-xs text-ink-2 ring-1 ring-line">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <Target className="size-4 text-volt" aria-hidden /> Smart target
        </p>
        The numbers don’t add up yet (usually from days with missing meals). Keep logging every meal and it will settle.
      </div>
    )
  }
  const same = Math.abs(smart.suggested - target) < 50
  const rate = fromKg(Math.abs(smart.expectedLossKgWeek), unit)
  return (
    <div className="rounded-xl bg-volt-soft p-3 ring-1 ring-volt/25">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Target className="size-4 text-volt" aria-hidden /> Smart target
      </p>
      <p className="mt-1 text-xs text-ink-2">
        Over the last 3 weeks you averaged <b className="text-ink">{fmtInt(smart.avgNet)}</b> kcal net and your weight moved{' '}
        <b className="text-ink">
          {smart.rateKgWeek <= 0 ? '−' : '+'}
          {fmt1(fromKg(Math.abs(smart.rateKgWeek), unit))} {unit}/week
        </b>
        . That puts your maintenance at about <b className="text-ink">{fmtInt(smart.maintenance)} kcal</b>.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Suggested: <span className="text-lg font-bold text-volt">{fmtInt(smart.suggested)}</span> kcal
          <span className="text-xs text-muted"> ≈ {fmt1(rate)} {unit}/week loss</span>
        </p>
        {same ? (
          <span className="text-xs text-good-ink">Your target already matches.</span>
        ) : (
          <Button className="py-1.5" onClick={() => onUse(smart.suggested)}>
            Use {fmtInt(smart.suggested)}
          </Button>
        )}
      </div>
      {smart.floored && <p className="mt-1 text-xs text-muted">Kept at the 1,800 kcal minimum so you still have fuel to grow and train.</p>}
    </div>
  )
}

export default function WeeklyCheckIn({ week, previousWeek, weights, unit, target, proteinTarget, water, waterGoal, smart, onUseTarget }) {
  const aiAvailable = useAiAvailable()
  const [summary, setSummary] = useState({ status: 'idle' })

  const logged = week.filter((d) => d.logged)
  const onTarget = logged.filter((d) => d.net <= target).length
  const proteinDays = logged.filter((d) => d.protein >= proteinTarget * 0.9).length
  const burned = week.reduce((s, d) => s + d.burned, 0)
  const weekWaters = week.map((d) => water.find((w) => w.date === d.date)?.glasses ?? 0)
  const avgWater = avg(weekWaters.filter((g) => g > 0), (g) => g)

  const inRange = (list) => weights.filter((w) => w.date >= list[0].date && w.date <= list.at(-1).date)
  const thisW = avg(inRange(week), (w) => w.kg)
  const lastW = avg(inRange(previousWeek), (w) => w.kg)
  const change = thisW != null && lastW != null ? fromKg(thisW - lastW, unit) : null

  const stats = {
    daysLogged: logged.length,
    avgEaten: Math.round(avg(logged, (d) => d.eaten) ?? 0),
    avgNet: Math.round(avg(logged, (d) => d.net) ?? 0),
    target,
    daysAtOrUnderTarget: onTarget,
    avgProtein: Math.round(avg(logged, (d) => d.protein) ?? 0),
    proteinTarget,
    daysHitProtein: proteinDays,
    cardioKcal: burned,
    weightChangeVsLastWeek: change == null ? null : `${change > 0 ? '+' : ''}${change.toFixed(1)} ${unit}`,
    avgWaterGlasses: avgWater == null ? null : Math.round(avgWater * 10) / 10,
    days: week.map((d) => ({ day: weekday(d.date), eaten: d.eaten, burned: d.burned, net: d.net, protein: Math.round(d.protein), logged: d.logged })),
  }

  async function summarize() {
    setSummary({ status: 'working' })
    try {
      const text = await askClaude(
        `You're a supportive coach for a high-school student in India on a gentle fat-loss cut. Here is their last 7 days from their tracker as JSON (net = eaten minus logged exercise):\n${JSON.stringify(stats)}\n\nWrite a short weekly check-in: 3–4 bullet points, plain text starting each with "• ". Mention one thing that went well, the clearest pattern (e.g. which days go over), and one specific, doable tip for next week. If intake looks very low or weight is dropping more than 1% a week, say to eat more. Under 90 words, no headings.`,
      )
      setSummary({ status: 'done', text })
    } catch (err) {
      setSummary({ status: 'error', text: err.message })
    }
  }

  return (
    <Card id="week">
      <CardHeader icon={CalendarCheck} title="Weekly check-in" subtitle="Last 7 days, today included" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Avg net" value={logged.length ? `${fmtInt(stats.avgNet)} kcal` : '–'} sub={`${logged.length}/7 days logged`} />
        <Stat label="On target" value={logged.length ? `${onTarget}/${logged.length} days` : '–'} sub={`target ${fmtInt(target)}`} />
        <Stat label="Avg protein" value={logged.length ? `${stats.avgProtein} g` : '–'} sub={`goal hit ${proteinDays}/${logged.length || 0} days`} />
        <Stat
          label="Weight vs last wk"
          value={change == null ? '–' : `${change > 0 ? '+' : ''}${fmt1(change)} ${unit}`}
          sub={change == null ? 'needs weigh-ins both weeks' : 'weekly average'}
        />
        <Stat label="Cardio" value={`${fmtInt(burned)} kcal`} sub="burned this week" />
        <Stat label="Water" value={avgWater == null ? '–' : `${fmt1(avgWater)} glasses`} sub={`daily avg · goal ${waterGoal}`} />
      </div>

      <div className="mt-5">
        <WeekBars days={week} target={target} />
      </div>

      {aiAvailable && (
        <div className="mt-4">
          {summary.status === 'done' || summary.status === 'error' ? (
            <div className={`rounded-xl p-3 text-sm ring-1 ${summary.status === 'error' ? 'text-critical-ink ring-critical/40' : 'bg-page text-ink-2 ring-line'}`}>
              {summary.status === 'done' && (
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Sparkles className="size-3.5 text-volt" aria-hidden /> Claude’s take on your week
                </p>
              )}
              <p className="whitespace-pre-line">{summary.text}</p>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={summarize} disabled={summary.status === 'working' || logged.length === 0}>
              {summary.status === 'working' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-volt" aria-hidden />}
              {summary.status === 'working' ? 'Claude is reading your week…' : 'Get Claude’s summary of my week'}
            </Button>
          )}
        </div>
      )}

      <div className="mt-4">
        <SmartTarget smart={smart} target={target} unit={unit} onUse={onUseTarget} />
      </div>
    </Card>
  )
}
