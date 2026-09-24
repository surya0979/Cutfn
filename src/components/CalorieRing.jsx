import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'

/** Progress ring for net calories (consumed − burned) against the daily target. */
export default function CalorieRing({ net, target, size = 208 }) {
  const stroke = 16
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const ratio = target > 0 ? Math.max(0, net) / target : 0
  const over = net > target
  const shown = Math.min(ratio, 1)
  const pct = Math.round(ratio * 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Net ${fmtInt(net)} of ${fmtInt(target)} kilocalories, ${pct}% of target`}
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
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms' }}
          opacity={shown === 0 ? 0 : 1}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Net kcal</span>
        <span className="text-5xl font-bold tracking-tight">{fmtInt(net)}</span>
        <span className="mt-0.5 text-xs text-ink-2">
          of {fmtInt(target)} · {pct}%
        </span>
      </div>
    </div>
  )
}
