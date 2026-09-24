import { Bookmark, Check, PenLine, ScanLine, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { dayInline } from '../lib/labels.js'
import { SECTIONS } from '../lib/sections.js'
import { fmtInt } from '../lib/units.js'
import ManualEntry from './ManualEntry.jsx'
import MenuScanner from './MenuScanner.jsx'
import { Card, CardHeader, inputClass, TabPanel, Tabs } from './ui.jsx'

/** Saved combos ("My usual lunch") that log several foods in one tap. */
function Usuals({ usuals, onLog, onDelete }) {
  const [done, setDone] = useState(null)
  const [editing, setEditing] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!usuals.length) return null

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Bookmark className="size-3.5" aria-hidden /> My usuals
        </p>
        <button type="button" onClick={() => setEditing((e) => !e)} className="text-xs font-medium text-muted hover:text-ink">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {usuals.map((u) => {
          const kcal = u.items.reduce((s, i) => s + (i.kcal ?? 0), 0)
          return editing ? (
            <button
              key={u.id}
              type="button"
              onClick={() => onDelete(u.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-critical/10 px-3 py-1.5 text-xs font-semibold text-critical-ink ring-1 ring-critical/40"
              aria-label={`Delete usual ${u.name}`}
            >
              <X className="size-3.5" aria-hidden /> {u.name}
            </button>
          ) : (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onLog(u)
                setDone(u.id)
                clearTimeout(timer.current)
                timer.current = setTimeout(() => setDone(null), 1400)
              }}
              title={u.items.map((i) => i.name).join(', ')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                done === u.id ? 'bg-good/15 text-good-ink ring-good/40' : 'bg-volt-soft text-ink ring-volt/30 hover:ring-volt/60'
              }`}
            >
              {done === u.id && <Check className="size-3.5" aria-hidden />}
              {u.name}
              <span className="font-normal text-muted">
                {u.items.length} items · {fmtInt(kcal)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function LogMeal({ onAdd, recentFoods, dayLabel, section, onSectionChange, usuals, onLogUsual, onDeleteUsual, prefillRequest }) {
  const [tab, setTab] = useState('manual')
  const [prefill, setPrefill] = useState(null)

  // Dishes tapped elsewhere (e.g. an unknown item on today's menu) open here.
  useEffect(() => {
    if (prefillRequest) {
      setPrefill(prefillRequest)
      setTab('manual')
    }
  }, [prefillRequest])

  return (
    <Card id="food">
      <CardHeader
        icon={UtensilsCrossed}
        title="Log a meal"
        subtitle={`Adding to ${dayInline(dayLabel)}`}
        action={
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span className="sr-only sm:not-sr-only">Meal</span>
            <select value={section} onChange={(e) => onSectionChange(e.target.value)} className={`${inputClass} w-auto py-1.5 pr-7 text-sm`} aria-label="Meal">
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <Usuals usuals={usuals} onLog={onLogUsual} onDelete={onDeleteUsual} />
      <Tabs
        label="How to log"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'manual', label: 'Manual', icon: PenLine },
          { value: 'scan', label: 'Scan menu', icon: ScanLine },
        ]}
      />
      {/* Keep both mounted so a scan in progress survives a tab switch. */}
      <div hidden={tab !== 'manual'}>
        <TabPanel value="manual">
          <ManualEntry onAdd={onAdd} recentFoods={recentFoods} prefill={prefill} />
        </TabPanel>
      </div>
      <div hidden={tab !== 'scan'}>
        <TabPanel value="scan">
          <MenuScanner
            onAdd={onAdd}
            onManual={(name) => {
              setPrefill({ name, at: Date.now() })
              setTab('manual')
            }}
          />
        </TabPanel>
      </div>
    </Card>
  )
}
