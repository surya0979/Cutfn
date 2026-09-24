import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate, fromDateKey } from '../lib/dates.js'
import { DAY, dayTicks, yScale } from '../lib/chartScale.js'
import { COLORS } from '../lib/theme.js'
import { fmt1, fromKg } from '../lib/units.js'
import { Swatch } from './ui.jsx'

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 text-xs text-muted">{formatShortDate(point.date)}</p>
      <p className="flex items-center gap-2">
        <Swatch color={COLORS.weighIn} shape="line" />
        <span className="font-semibold">
          {fmt1(point.w)} {unit}
        </span>
        <span className="text-xs text-ink-2">weigh-in</span>
      </p>
      <p className="flex items-center gap-2">
        <Swatch color={COLORS.trend} shape="line" />
        <span className="font-semibold">
          {fmt1(point.avg)} {unit}
        </span>
        <span className="text-xs text-ink-2">7-day avg</span>
      </p>
    </div>
  )
}

function EndLabel({ x, y, index, value, lastIndex, unit }) {
  if (index !== lastIndex || x == null) return null
  return (
    <text x={x + 10} y={y} dy={4} fill="#f4f6f8" fontSize={12} fontWeight={600}>
      {fmt1(value)}
      <tspan fill={COLORS.muted} fontWeight={400}>
        {' '}
        {unit}
      </tspan>
    </text>
  )
}

export default function WeightChart({ points, unit }) {
  const data = points.map((p) => ({
    date: p.date,
    t: fromDateKey(p.date).getTime(),
    w: fromKg(p.kg, unit),
    avg: fromKg(p.avgKg, unit),
  }))

  const first = data[0].t
  const last = data.at(-1).t
  // A lone point gets a few days of context on each side.
  const xDomain = first === last ? [first - 3 * DAY, last + 3 * DAY] : [first, last]
  const y = yScale(
    data.flatMap((d) => [d.w, d.avg]),
    unit,
  )
  const showDots = data.length <= 45
  const latest = data.at(-1)

  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Swatch color={COLORS.weighIn} shape="line" /> Weigh-in
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={COLORS.trend} shape="line" /> 7-day average
        </span>
      </div>
      <div
        className="h-64 w-full sm:h-72"
        role="img"
        aria-label={`Weight trend chart, ${data.length} weigh-ins from ${formatShortDate(data[0].date)} to ${formatShortDate(latest.date)}. Latest ${fmt1(latest.w)} ${unit}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 64, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLORS.line} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={xDomain}
              ticks={dayTicks(...xDomain)}
              tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: COLORS.axis }}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              domain={y.domain}
              ticks={y.ticks}
              interval={0}
              tickFormatter={(t) => (Number.isInteger(t) ? t : t.toFixed(1))}
              tick={{ fill: COLORS.muted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: COLORS.muted, strokeWidth: 1 }} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="avg"
              name="7-day average"
              stroke={COLORS.trend}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={false}
              animationDuration={500}
            />
            <Line
              type="linear"
              dataKey="w"
              name="Weigh-in"
              stroke={COLORS.weighIn}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={showDots ? { r: 4, fill: COLORS.weighIn, stroke: COLORS.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 6, fill: COLORS.weighIn, stroke: COLORS.surface, strokeWidth: 2 }}
              label={<EndLabel lastIndex={data.length - 1} unit={unit} />}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
