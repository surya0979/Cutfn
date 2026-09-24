import { ChevronLeft, ChevronRight, Cloud, CloudOff, Dumbbell, House, LineChart, LoaderCircle, Utensils, Zap } from 'lucide-react'
import { addDays, formatDay, fromDateKey } from '../lib/dates.js'

export const TABS = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'train', label: 'Train', icon: Dumbbell },
  { id: 'progress', label: 'Progress', icon: LineChart },
]

/** Which tab holds each card, for in-page links like #weight. */
export const TAB_OF = { today: 'home', menu: 'home', food: 'food', cardio: 'train', weight: 'progress', week: 'progress' }

function TabButtons({ tab, onTabChange, variant }) {
  const bottom = variant === 'bottom'
  return TABS.map((t) => {
    const active = t.id === tab
    const Icon = t.icon
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onTabChange(t.id)}
        aria-current={active ? 'page' : undefined}
        className={
          bottom
            ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${active ? 'text-volt' : 'text-muted'}`
            : `inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-volt text-page' : 'text-muted hover:text-ink'}`
        }
      >
        <Icon className={bottom ? 'size-5' : 'size-4'} strokeWidth={active ? 2.5 : 2} aria-hidden />
        {t.label}
      </button>
    )
  })
}

/** Phone navigation, pinned to the bottom within thumb reach. */
export function BottomNav({ tab, onTabChange }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-page/90 px-2 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden"
    >
      <TabButtons tab={tab} onTabChange={onTabChange} variant="bottom" />
    </nav>
  )
}

const SYNC = {
  cloud: { icon: Cloud, label: 'Synced', title: 'Saved to your account and synced across devices', tone: 'text-good-ink' },
  local: { icon: CloudOff, label: 'This device', title: 'Saved in this browser only', tone: 'text-muted' },
  connecting: { icon: LoaderCircle, label: 'Connecting', title: 'Connecting to cloud sync…', tone: 'text-muted' },
}

function SyncBadge({ mode }) {
  const s = SYNC[mode]
  const Icon = s.icon
  return (
    <span title={s.title} className={`inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-[11px] font-semibold ring-1 ring-line ${s.tone}`}>
      <Icon className={`size-3.5 ${mode === 'connecting' ? 'animate-spin' : ''}`} aria-hidden />
      <span className="hidden sm:inline">{s.label}</span>
      <span className="sr-only sm:hidden">{s.title}</span>
    </span>
  )
}

export default function Header({ date, today, syncMode, onDateChange, tab, onTabChange }) {
  const isToday = date === today
  const longDate = fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
        <a href="#today" onClick={(e) => { e.preventDefault(); onTabChange('home') }} className="flex items-center gap-2" aria-label="Cutfn home">
          <span className="grid size-8 place-items-center rounded-lg bg-volt text-page">
            <Zap className="size-[18px]" fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <span className="font-display text-2xl font-extrabold uppercase italic leading-none tracking-tight">
            Cut<span className="text-volt">fn</span>
          </span>
        </a>
        <SyncBadge mode={syncMode} />
        </div>

        <nav aria-label="Sections" className="hidden items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-line lg:flex">
          <TabButtons tab={tab} onTabChange={onTabChange} variant="top" />
        </nav>

        <nav aria-label="Day" className="flex items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
          <button
            type="button"
            onClick={() => onDateChange(addDays(date, -1))}
            className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-raised hover:text-ink"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(today)}
            disabled={isToday}
            title={isToday ? longDate : 'Jump back to today'}
            className="min-w-24 rounded-lg px-2 text-center text-sm font-semibold enabled:hover:bg-raised"
          >
            <span className="block leading-tight">{formatDay(date, today)}</span>
            {!isToday && <span className="block text-[10px] font-medium uppercase tracking-wide text-volt">Back to today</span>}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDays(date, 1))}
            disabled={isToday}
            className="grid size-8 place-items-center rounded-lg text-ink-2 enabled:hover:bg-raised enabled:hover:text-ink disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      </div>
    </header>
  )
}
