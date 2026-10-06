// The masthead: wordmark, text-only tabs in 4px boxes, sync state in Courier.
// No icons anywhere (DESIGN.md rule 4).

export const TABS = [
  { id: 'closet', label: 'Closet' },
  { id: 'style', label: 'Style me' },
  { id: 'looks', label: 'Saved' },
  { id: 'history', label: 'History' },
]

function SyncBadge({ mode }) {
  const text = mode === 'connecting' ? 'Connecting' : mode === 'cloud' ? 'Synced' : 'This device'
  return (
    <span className="meta hidden sm:inline" title={mode === 'cloud' ? 'Synced across your devices through claude.ai' : 'Saved in this browser only'}>
      [{text}]
    </span>
  )
}

export default function Header({ tab, onTab, mode, onSettings }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b-4 border-ink bg-page">
      <div className="mx-auto flex h-16 max-w-[1200px] items-stretch">
        <button type="button" onClick={() => onTab('closet')} className="display flex items-center border-r-4 border-ink px-4 text-[40px] leading-none" aria-label="Fitfn, go to closet">
          Fitfn
        </button>
        <nav className="hidden items-stretch md:flex" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`display flex items-center border-r-4 border-ink px-5 text-[22px] ${tab === t.id ? 'bg-ink text-page' : 'bg-page text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-stretch">
          <span className="flex items-center px-3">
            <SyncBadge mode={mode} />
          </span>
          <button type="button" onClick={onSettings} aria-label="Style profile" className="display flex items-center border-l-4 border-ink px-4 text-[20px]">
            <span className="hidden sm:inline">Style profile</span>
            <span className="sm:hidden">Profile</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function BottomNav({ tab, onTab }) {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-ink bg-page pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`display flex h-14 items-center justify-center text-[19px] not-first:border-l-4 not-first:border-ink ${on ? 'bg-ink text-page' : 'bg-page text-ink'}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
