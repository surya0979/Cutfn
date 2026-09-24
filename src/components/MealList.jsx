import { ScanLine, Trash2, Utensils } from 'lucide-react'
import { COLORS } from '../lib/theme.js'
import { formatTime } from '../lib/dates.js'
import { dayPossessive } from '../lib/labels.js'
import { fmtInt } from '../lib/units.js'
import { Card, CardHeader, EmptyState, IconButton, Swatch } from './ui.jsx'

export default function MealList({ meals, onDelete, dayLabel }) {
  const total = meals.reduce((sum, m) => sum + m.kcal, 0)

  return (
    <Card aria-label={`${dayLabel} meals`}>
      <CardHeader
        icon={Utensils}
        title={dayPossessive(dayLabel, 'meals')}
        subtitle={meals.length ? `${meals.length} item${meals.length === 1 ? '' : 's'}` : 'Nothing logged yet'}
        action={
          meals.length > 0 && (
            <div className="flex items-center gap-1.5 text-right">
              <Swatch color={COLORS.eat} />
              <span className="text-lg font-bold">{fmtInt(total)}</span>
              <span className="text-xs text-muted">kcal</span>
            </div>
          )
        }
      />

      {meals.length === 0 ? (
        <EmptyState icon={Utensils}>Log a meal above and it shows up here.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {meals.map((meal) => (
            <li key={meal.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {meal.source === 'menu' && <ScanLine className="size-3.5 shrink-0 text-muted" aria-label="From menu scan" />}
                  <span className="truncate">{meal.name}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {formatTime(meal.createdAt)}
                  {meal.portion && ` · ${meal.portion}`}
                  {meal.protein != null && ` · P ${Math.round(meal.protein)} · C ${Math.round(meal.carbs ?? 0)} · F ${Math.round(meal.fat ?? 0)}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {fmtInt(meal.kcal)} <span className="text-xs font-normal text-muted">kcal</span>
              </span>
              <IconButton label={`Delete ${meal.name}`} onClick={() => onDelete(meal.id)} className="hover:!text-critical-ink">
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
