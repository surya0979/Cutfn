import { useEffect, useState } from 'react'
import { COLORS, DRESSING_FOR, STYLES } from '../lib/vocab.js'
import { Button, Chip, Field, inputClass, Segmented, Sheet, Spinner, Swatch } from './ui.jsx'

const mb = (bytes) => `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`

function ColorPicker({ value = [], onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
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
            className={`flex size-8 items-center justify-center rounded-full border-2 ${on ? 'border-ink' : 'border-transparent hover:border-line'}`}
          >
            <Swatch color={c.value} size={22} />
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
      <p className="flex items-center gap-2 text-[14px] text-muted">
        <Spinner /> Checking photo storage…
      </p>
    )
  const { usage, orphans, orphanBytes, prune } = info
  const pct = usage.maxBytes ? Math.min(100, (usage.bytes / usage.maxBytes) * 100) : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="h-2 overflow-hidden rounded-sm bg-raised">
        <div className={`h-full rounded-sm ${pct > 85 ? 'bg-critical' : 'bg-accent'}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p className="text-[13.5px] text-ink-2 tnum">
        {usage.files} photos, {mb(usage.bytes)}
        {usage.maxBytes ? ` of ${mb(usage.maxBytes)}` : ''}
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
        <Button className="w-full" onClick={save}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[14.5px] text-ink-2">Claude reads this every time it styles you. The more it knows, the better the picks.</p>
        <Field label="Dressing for">
          <Segmented label="Dressing for" options={DRESSING_FOR} value={draft.dressingFor ?? 'any'} onChange={(v) => set({ dressingFor: v })} />
        </Field>
        <Field label="Styles you like">
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <Chip
                key={s}
                className="h-8 px-3 text-[13px]"
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
        <Field label="Colours to avoid">
          <ColorPicker label="Colours to avoid" value={draft.avoidColors} onChange={(v) => set({ avoidColors: v, loveColors: (draft.loveColors ?? []).filter((c) => !v.includes(c)) })} />
        </Field>
        <Field label="City" hint="So Claude knows the climate and what people wear there.">
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
              className={inputClass}
              maxLength={400}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <span className="condensed text-[15px]">Learned from your feedback</span>
          <p className="text-[14px] text-ink-2">
            {learned
              ? `${taste.liked?.length ?? 0} outfit${taste.liked?.length === 1 ? '' : 's'} you liked and ${taste.disliked?.length ?? 0} you passed on.`
              : 'Nothing yet. Use the thumbs up and down on outfit ideas and Claude adapts.'}
          </p>
          {learned > 0 && (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => actions.clearTaste()}>
              Forget my feedback
            </Button>
          )}
        </div>

        {mode === 'cloud' && (
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <span className="condensed text-[15px]">Photo storage</span>
            <Storage actions={actions} open={open} />
          </div>
        )}

        <p className="meta border-t border-line pt-5 text-muted">
          {mode === 'cloud' ? 'Synced through claude.ai. Private to your account.' : 'Saved in this browser only'}
        </p>
      </div>
    </Sheet>
  )
}
