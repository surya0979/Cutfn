// Brutalist primitives (see DESIGN.md): 4px ink borders, no radius, no shadow,
// no icons, nothing smooth. Hover inversion lives in index.css.

import { useEffect, useId, useRef, useState } from 'react'
import { colorHex, colorLabel } from '../lib/vocab.js'

const PRESS = 'active:translate-x-[3px] active:translate-y-[3px] disabled:active:translate-x-0 disabled:active:translate-y-0'

/**
 * primary = red, the screen's ONE main CTA (turns black on hover, never teal).
 * black = filled ink for strong secondary actions. secondary = 4px outline.
 * ghost = underlined text.
 */
export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  const sizes = {
    sm: 'h-10 px-3 text-[15px]',
    md: 'h-12 px-4 text-[18px]',
    lg: 'h-16 px-6 text-[26px]',
  }
  const styles = {
    primary: 'red border-4 border-accent bg-accent text-on-accent',
    black: 'border-4 border-ink bg-ink text-page',
    secondary: 'border-4 border-ink bg-page text-ink',
    ghost: 'border-4 border-transparent bg-page text-ink underline decoration-4 underline-offset-4',
  }
  return (
    <button
      type="button"
      className={`display inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:border-dashed disabled:border-ink disabled:bg-page disabled:text-muted disabled:no-underline ${PRESS} ${sizes[size]} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A square text button (×, ←, →). */
export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center border-4 border-ink bg-page text-[30px] leading-none font-bold text-ink disabled:border-dashed disabled:text-muted ${PRESS} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A toggleable tag: 4px box, Courier bold caps; selected = black. */
export function Chip({ active, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-10 shrink-0 items-center gap-2 border-4 px-2.5 text-[14px] font-bold whitespace-nowrap uppercase ${PRESS} ${
        active ? 'border-ink bg-ink text-page' : 'border-ink bg-page text-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A square of colour. Multicolour is four hard blocks, never a gradient. */
export function Swatch({ color, size = 24, className = '' }) {
  const hex = colorHex(color)
  const style = { width: size, height: size }
  if (!hex.startsWith('#')) {
    return (
      <span title={colorLabel(color)} className={`inline-grid shrink-0 grid-cols-2 border-4 border-ink ${className}`} style={style}>
        {['#c4282d', '#ecc94b', '#2f7d4f', '#2f63b8'].map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </span>
    )
  }
  return <span title={colorLabel(color)} className={`inline-block shrink-0 border-4 border-ink ${className}`} style={{ ...style, background: hex }} />
}

/** Colour names as text: brutalist pieces say what they are. */
export function ColorWords({ colors = [], className = '' }) {
  return <span className={`meta ${className}`}>{colors.slice(0, 3).map(colorLabel).join(' / ')}</span>
}

const FRAMES = ['|', '/', '-', '\\']

/** An ASCII spinner, stepping. Nothing rotates smoothly. */
export function Spinner({ className = '' }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FRAMES.length), 110)
    return () => clearInterval(t)
  }, [])
  return (
    <span aria-hidden="true" className={`inline-block w-[1ch] text-center font-bold ${className}`}>
      {FRAMES[i]}
    </span>
  )
}

/** Label above the control, hint below. `children` may be a function of the control's id. */
export function Field({ label, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="display text-[22px] text-ink">
        {label}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-[14px] text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full min-w-0 border-4 border-ink bg-page px-3 py-2.5 text-[16px] text-ink placeholder:text-muted'

/** One-of-N buttons, for small scales (formality, warmth). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col border-4 border-ink">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 px-1 py-2.5 text-[12px] leading-tight font-bold uppercase not-first:border-l-4 not-first:border-ink ${
            value === o.value ? 'bg-ink text-page' : 'bg-page text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A hard-edged panel: bottom sheet on phones, framed dialog on wider screens.
 * Escape and the scrim close it; focus moves inside on open.
 */
export function Sheet({ open, onClose, title, children, footer, wide = false }) {
  const panel = useRef(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    panel.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`slam relative flex max-h-[92dvh] w-full flex-col border-4 border-ink bg-page outline-none ${wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'}`}
      >
        <div className="flex items-start gap-3 border-b-4 border-ink px-4 pt-4 pb-3">
          <h2 id={titleId} className="display min-w-0 flex-1 text-[40px] break-words">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            ×
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">{children}</div>
        {footer && <div className="border-t-4 border-ink px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

/**
 * The extreme page title: Impact at clamp(72px, 14vw, 160px). An optional red
 * count (the section's one red number) and a Courier line set off to the right.
 */
export function PageTitle({ children, count, sub, aside }) {
  return (
    <div className="grid gap-4 border-b-4 border-ink pb-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end">
      <h1 className="display min-w-0 text-[clamp(72px,14vw,160px)] break-words">
        {children}
        {count != null && <span className="ml-2 align-top text-[0.36em] text-accent tnum">{count}</span>}
      </h1>
      {(sub || aside) && (
        <div className="flex flex-col items-start gap-4 md:pb-3 md:pl-6">
          {sub && <p className="max-w-[40ch] text-[16px]">{sub}</p>}
          {aside}
        </div>
      )}
    </div>
  )
}

/** A titled block: Impact heading over a 4px rule. */
export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-5 ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-ink pb-2">
          {title && <h2 className="display text-[44px] sm:text-[64px]">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

const TONE_WORD = { info: 'Note', warn: 'Wait', error: 'Error' }

/** A 4px box with an Impact prefix word. Tone is in the word, not the colour. */
export function Notice({ tone = 'info', children, className = '' }) {
  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-start border-4 border-ink text-[15px] ${tone === 'error' ? 'bg-ink text-page' : 'bg-page text-ink'}`}>
      <span className={`display self-stretch px-3 py-2.5 text-[20px] ${tone === 'error' ? 'bg-page text-ink' : 'bg-ink text-page'}`}>{TONE_WORD[tone]}</span>
      <div className={`min-w-0 px-3 py-2.5 ${className}`}>{children}</div>
    </div>
  )
}

/** The one marquee: black band, cream Impact, linear and endless. */
export function Marquee({ items }) {
  const text = items.filter(Boolean)
  if (!text.length) return null
  const run = (
    <span className="display flex shrink-0 items-center gap-6 pr-6 text-[22px]">
      {text.map((t, i) => (
        <span key={i} className="flex items-center gap-6">
          {t} <span aria-hidden="true">→</span>
        </span>
      ))}
    </span>
  )
  return (
    <div className="overflow-hidden border-y-4 border-ink bg-ink py-2 text-page" aria-label={text.join('. ')} role="marquee">
      <div className="marquee-track" aria-hidden="true">
        {run}
        {run}
        {run}
        {run}
      </div>
    </div>
  )
}
