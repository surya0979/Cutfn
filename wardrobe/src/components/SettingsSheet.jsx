import { useEffect, useState } from 'react'
import { COLORS, DRESSING_FOR, STYLES } from '../lib/vocab.js'
import { Button, Chip, Field, inputClass, Segmented, Sheet, Spinner, Swatch } from './ui.jsx'

const mb = (bytes) => `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`

/** Square swatches joined edge to edge; a picked one gets a black ✓ block, a hovered one a + block. */
function ColorPicker({ value = [], onChange, label }) {
  return (
    <div className="flex flex-wrap pt-1 pl-1" role="group" aria-label={label}>
      {COLORS.filter((c) => c.value !== 'multicolor').map((c) => {
        const on = value.includes(c.value)
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={on}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(on ? value.filter((v) => v !== c.value) : [...value, c.value])}
            className={`group relative -mt-1 -ml-1 flex size-11 shrink-0 active:translate-x-[3px] active:translate-y-[3px] ${on ? 'z-10' : 'hover:z-10'}`}
          >
            {/* A colour sample keeps its true colour under the hover invert, like a photo; only the mark inverts. */}
            <Swatch color={c.value} size={44} className="group-hover:invert" />
            <span aria-hidden="true" className={`absolute inset-0 items-center justify-center ${on ? 'flex' : 'hidden group-hover:flex'}`}>
              <span className="flex size-6 items-center justify-center bg-ink text-[16px] font-bold text-page">{on ? '✓' : '+'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Storage({ actions, open }) {
  const [info, setInfo] = useState({ status: 'loading' })
  useEffect(() => {
    if (!open) return
    let live = true
    setInfo({ status: 'loading' })
    actions
      .storage()
      .then((s) => live && setInfo(s ? { status: 'ready', ...s } : { status: 'none' }))
      .catch(() => live && setInfo({ status: 'none' }))
    return () => {
      live = false
    }
  }, [open, actions])

  if (info.status === 'none') return null
  if (info.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <Spinner /> Checking photo storage…
      </p>
    )
  const { usage, orphans, orphanBytes, prune } = info
  const pct = usage.maxBytes ? Math.min(100, (usage.bytes / usage.maxBytes) * 100) : 0
  return (
    <div className="flex flex-col gap-3">
      {/* The meter: a 4px box, a solid black bar. Nearly full is said in words. */}
      <div className="h-8 border-4 border-ink bg-page">
        <div className="h-full bg-ink" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] tnum">
        <span>
          {usage.files} photos, {mb(usage.bytes)}
          {usage.maxBytes ? ` of ${mb(usage.maxBytes)}` : ''}
        </span>
        {pct > 85 && <span className="meta border-4 border-ink bg-ink px-2 py-1 text-page">Nearly full</span>}
      </p>
      {orphans > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={async () => {
            setInfo((s) => ({ ...s, status: 'loading' }))
            await prune()
            const next = await actions.storage().catch(() => null)
            setInfo(next ? { status: 'ready', ...next } : { status: 'none' })
          }}
        >
          Remove {orphans} unused photo{orphans > 1 ? 's' : ''} ({mb(orphanBytes)})
        </Button>
      )}
    </div>
  )
}

export default function SettingsSheet({ open, onClose, settings, taste, actions, mode }) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => {
    if (open) setDraft(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const save = () => {
    actions.updateSettings({
      dressingFor: draft.dressingFor,
      styles: draft.styles ?? [],
      loveColors: draft.loveColors ?? [],
      avoidColors: draft.avoidColors ?? [],
      city: (draft.city ?? '').trim(),
      notes: (draft.notes ?? '').trim(),
    })
    onClose()
  }
  const learned = (taste.liked?.length ?? 0) + (taste.disliked?.length ?? 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your style profile"
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-7">
        <p className="text-[16px] md:mr-[22%]">Claude reads this every time it styles you. The more it knows, the better the picks.</p>
        <Field label="Dressing for">
          <Segmented label="Dressing for" options={DRESSING_FOR} value={draft.dressingFor ?? 'any'} onChange={(v) => set({ dressingFor: v })} />
        </Field>
        <Field label="Styles you like">
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip
                key={s}
                active={draft.styles?.includes(s)}
                onClick={() => set({ styles: draft.styles?.includes(s) ? draft.styles.filter((x) => x !== s) : [...(draft.styles ?? []), s] })}
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Colours you love">
          <ColorPicker label="Colours you love" value={draft.loveColors} onChange={(v) => set({ loveColors: v, avoidColors: (draft.avoidColors ?? []).filter((c) => !v.includes(c)) })} />
        </Field>
        {/* Avoid sits off the left edge on wider screens: misaligned on purpose. */}
        <Field label="Colours to avoid" className="md:ml-10">
          <ColorPicker label="Colours to avoid" value={draft.avoidColors} onChange={(v) => set({ avoidColors: v, loveColors: (draft.loveColors ?? []).filter((c) => !v.includes(c)) })} />
        </Field>
        <Field label="City" hint="So Claude knows the climate and what people wear there." className="md:mr-[30%]">
          {(id) => <input id={id} value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Pune" className={inputClass} maxLength={60} />}
        </Field>
        <Field label="Anything else Claude should know">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={draft.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="e.g. 5′9″, prefer relaxed fits, school uniform on weekdays, no shorts"
              className={`${inputClass} block`}
              maxLength={400}
            />
          )}
        </Field>

        <section className="flex flex-col gap-3 border-t-4 border-ink pt-5">
          <h3 className="display text-[32px]">Learned from your feedback</h3>
          <p className="text-[15px] md:ml-[18%]">
            {learned
              ? `${taste.liked?.length ?? 0} outfit${taste.liked?.length === 1 ? '' : 's'} you liked and ${taste.disliked?.length ?? 0} you passed on.`
              : 'Nothing yet. Tap ↑ or ↓ on outfit ideas and Claude adapts.'}
          </p>
          {learned > 0 && (
            <Button size="sm" variant="ghost" className="-ml-3 self-start bg-page md:ml-[calc(18%_-_0.75rem)]" onClick={() => actions.clearTaste()}>
              Forget my feedback
            </Button>
          )}
        </section>

        {mode === 'cloud' && (
          <section className="flex flex-col gap-3 border-t-4 border-ink pt-5">
            <h3 className="display text-[32px]">Photo storage</h3>
            <Storage actions={actions} open={open} />
          </section>
        )}

        <p className="meta border-t-4 border-ink pt-4 text-muted">{mode === 'cloud' ? 'Synced through claude.ai. Private to your account.' : 'Saved in this browser only'}</p>
      </div>
    </Sheet>
  )
}
