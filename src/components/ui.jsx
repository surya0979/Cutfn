import { useId } from 'react'

export function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-raised text-volt">
            <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="line-clamp-2 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  )
}

/** Labeled single-choice control (a radio group styled as a pill switch). */
export function Segmented({ label, value, onChange, options, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-xl bg-page p-1 ring-1 ring-line ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors ${pad} ${
              active ? 'bg-raised text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink-2'
            }`}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** Tabs for switching between panels inside a card. */
export function Tabs({ label, value, onChange, tabs }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-page p-1 ring-1 ring-line">
      {tabs.map((tab) => {
        const active = tab.value === value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`panel-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              active ? 'bg-volt text-page' : 'text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon className={`size-4 ${tabs.length > 3 ? 'hidden sm:block' : ''}`} aria-hidden />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ value, children }) {
  return (
    <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`}>
      {children}
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {label}
        {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
      </label>
      {children(id)}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-page px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-volt/60 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-volt/25'

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-volt text-page hover:brightness-110 disabled:bg-raised disabled:text-muted',
    secondary: 'bg-raised text-ink ring-1 ring-line hover:bg-line disabled:text-muted',
    ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Colored key beside text: identity lives in the mark, never in text color. */
export function Swatch({ color, shape = 'dot' }) {
  const cls = shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-full'
  return <span aria-hidden className={`inline-block shrink-0 ${cls}`} style={{ backgroundColor: color }} />
}

export function EmptyState({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {Icon && <Icon className="size-5" aria-hidden />}
      {children}
    </div>
  )
}
