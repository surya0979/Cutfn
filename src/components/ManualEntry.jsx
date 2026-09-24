import { Check, ChevronDown, LoaderCircle, Plus, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { estimateFoods, useAiAvailable } from '../lib/aiEstimate.js'
import { FOOD_BY_ID } from '../lib/foodDb.js'
import { fmtInt } from '../lib/units.js'
import { Button, Field, inputClass } from './ui.jsx'

const blank = { name: '', kcal: '', p: '', c: '', f: '' }

const QUICK_KCAL = [100, 250, 500]
const coconut = FOOD_BY_ID['coconut-water']

/** One-tap logging: generic calorie blocks plus a favorite drink. */
function QuickAdd({ onAdd }) {
  const [done, setDone] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const log = (key, meal) => {
    onAdd(meal)
    setDone(key)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(null), 1200)
  }
  const chip = 'inline-flex items-center gap-1 rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold ring-1 ring-line transition-colors hover:text-volt hover:ring-volt/40'

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">Quick add</p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_KCAL.map((kcal) => (
          <button key={kcal} type="button" className={`${chip} ${done === kcal ? 'text-good-ink' : 'text-ink'}`} onClick={() => log(kcal, { name: `Quick add ${kcal} kcal`, kcal, source: 'quick' })}>
            {done === kcal ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
            {kcal} kcal
          </button>
        ))}
        <button
          type="button"
          className={`${chip} ${done === 'coconut' ? 'text-good-ink' : 'text-ink'}`}
          onClick={() => log('coconut', { name: coconut.name, portion: coconut.portion, kcal: coconut.kcal, protein: coconut.p, carbs: coconut.c, fat: coconut.f, source: 'quick' })}
          title={`${coconut.name}, ${coconut.portion}: about ${coconut.kcal} kcal`}
        >
          {done === 'coconut' ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          Coconut water <span className="font-normal text-muted">{coconut.kcal}</span>
        </button>
      </div>
    </div>
  )
}
const num = (v) => (v === '' || v == null ? null : Number(v))

export default function ManualEntry({ onAdd, recentFoods, prefill }) {
  const [form, setForm] = useState(blank)
  const [showMacros, setShowMacros] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (prefill) {
      setForm({ ...blank, name: prefill.name })
      setError('')
    }
  }, [prefill])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const macros = { p: num(form.p), c: num(form.c), f: num(form.f) }
  const hasMacros = macros.p != null || macros.c != null || macros.f != null
  const macroKcal = (macros.p ?? 0) * 4 + (macros.c ?? 0) * 4 + (macros.f ?? 0) * 9

  const aiAvailable = useAiAvailable()
  const [estimating, setEstimating] = useState(false)
  const [estimated, setEstimated] = useState(null)
  const typedKcal = num(form.kcal)
  const aiMode = aiAvailable && typedKcal == null && !hasMacros && form.name.trim() !== ''

  const submit = async (e) => {
    e.preventDefault()
    if (estimating) return
    const name = form.name.trim()
    if (!name) return setError('Type what you ate.')
    setEstimated(null)

    if (aiMode) {
      // No calories typed: let Claude estimate, then log each food it found.
      setEstimating(true)
      setError('')
      try {
        const items = await estimateFoods(name)
        for (const it of items) {
          onAdd({ name: it.name, portion: it.portion, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, source: 'ai', note: it.assumption })
        }
        setEstimated(items)
        setForm(blank)
      } catch (err) {
        setError(err.message)
      } finally {
        setEstimating(false)
      }
      return
    }

    const kcal = typedKcal ?? (hasMacros ? Math.round(macroKcal) : null)
    if (!(kcal > 0) || kcal > 10000) {
      return setError(aiAvailable === false ? 'Enter calories between 1 and 10,000. (AI estimates work in the claude.ai version.)' : 'Enter calories between 1 and 10,000.')
    }
    onAdd({
      name,
      kcal: Math.round(kcal),
      protein: macros.p,
      carbs: macros.c,
      fat: macros.f,
      source: 'manual',
    })
    setForm(blank)
    setError('')
  }

  const applyRecent = (meal) => {
    setForm({
      name: meal.name,
      kcal: String(meal.kcal),
      p: meal.protein ?? '',
      c: meal.carbs ?? '',
      f: meal.fat ?? '',
    })
    setShowMacros(meal.protein != null)
    setError('')
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Field label="Food">
          {(id) => (
            <input id={id} value={form.name} onChange={set('name')} placeholder={aiAvailable ? 'e.g. 2 chapatis + dal' : 'e.g. Protein shake'} autoComplete="off" maxLength={200} className={inputClass} />
          )}
        </Field>
        <Field label="Calories">
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              value={form.kcal}
              onChange={set('kcal')}
              placeholder={hasMacros && macroKcal > 0 ? fmtInt(macroKcal) : aiAvailable ? 'AI' : 'kcal'}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <button
        type="button"
        onClick={() => setShowMacros((s) => !s)}
        aria-expanded={showMacros}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
      >
        <ChevronDown className={`size-3.5 transition-transform ${showMacros ? 'rotate-180' : ''}`} aria-hidden />
        Macros (optional)
      </button>
      {showMacros && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['p', 'Protein'],
            ['c', 'Carbs'],
            ['f', 'Fat'],
          ].map(([key, label]) => (
            <Field key={key} label={label} hint="g">
              {(id) => (
                <input id={id} type="number" inputMode="decimal" min={0} value={form[key]} onChange={set(key)} placeholder="0" className={inputClass} />
              )}
            </Field>
          ))}
          {hasMacros && !form.kcal && (
            <p className="col-span-3 text-xs text-muted">Calories left blank will be calculated from macros: {fmtInt(macroKcal)} kcal.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-critical-ink">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={estimating}>
        {estimating ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Asking Claude for calories…
          </>
        ) : aiMode ? (
          <>
            <Sparkles className="size-4" aria-hidden /> Add with AI estimate
          </>
        ) : (
          <>
            <Plus className="size-4" aria-hidden /> Add to log
          </>
        )}
      </Button>
      {aiAvailable && !estimated && !error && (
        <p className="-mt-1 text-xs text-muted">Don’t know the calories? Leave them blank and Claude estimates them, macros included.</p>
      )}
      {estimated && (
        <div role="status" className="rounded-xl bg-volt-soft px-3 py-2.5 text-xs ring-1 ring-volt/25">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
            <Sparkles className="size-3.5 text-volt" aria-hidden /> Logged with Claude’s estimate
          </p>
          <ul className="space-y-1 text-ink-2">
            {estimated.map((it, i) => (
              <li key={i}>
                <span className="font-semibold text-ink">{it.name}</span> · {it.portion} · {fmtInt(it.kcal)} kcal · P {it.protein} C {it.carbs} F {it.fat}
                {it.assumption && <span className="block text-muted">Assumed {it.assumption.replace(/^assum(ed|ing)\s*/i, '')}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted">Wrong portion? Delete it below and add it again with a quantity, like “2 bowls”.</p>
        </div>
      )}

      <QuickAdd onAdd={onAdd} />

      {recentFoods.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Recent</p>
          <div className="flex flex-wrap gap-1.5">
            {recentFoods.map((meal) => (
              <button
                key={meal.name}
                type="button"
                onClick={() => applyRecent(meal)}
                className="rounded-full bg-raised px-3 py-1 text-xs text-ink-2 ring-1 ring-line hover:text-ink hover:ring-volt/40"
              >
                {meal.name} <span className="text-muted">· {fmtInt(meal.kcal)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
