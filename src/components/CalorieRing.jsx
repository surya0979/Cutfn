import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'

/** Progress ring for calories eaten against the daily max. */
export default function CalorieRing({ eaten, target }) {
  const size = 208
  const stroke = 16
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const ratio = target > 0 ? Math.max(0, eaten) / target : 0
  const over = eaten > target
  const shown = Math.min(ratio, 1)
  const pct = Math.round(ratio * 100)

  return (
    <div className="relative size-48 shrink-0 sm:size-52">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        role="img"
        aria-label={`Eaten ${fmtInt(eaten)} of ${fmtInt(target)} kilocalorie daily max, ${pct}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.line} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? COLORS.critical : COLORS.volt}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          style={{
            transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms',
            filter: `drop-shadow(0 0 6px ${over ? 'rgba(208,59,59,.45)' : 'rgba(198,244,50,.35)'})`,
          }}
          opacity={shown === 0 ? 0 : 1}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Eaten</span>
        <span className="font-display text-6xl font-bold leading-none tracking-tight">{fmtInt(eaten)}</span>
        <span className="mt-0.5 text-xs text-ink-2">
          of {fmtInt(target)} max · {pct}%
        </span>
      </div>
    </div>
  )
}
