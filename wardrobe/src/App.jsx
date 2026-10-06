import { useCallback, useEffect, useMemo, useState } from 'react'
import Closet from './components/Closet.jsx'
import Header, { BottomNav, TABS } from './components/Header.jsx'
import History from './components/History.jsx'
import ItemSheet from './components/ItemSheet.jsx'
import Looks from './components/Looks.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import StyleMe from './components/StyleMe.jsx'
import Toast, { useToast } from './components/Toast.jsx'
import { Notice } from './components/ui.jsx'
import { useAi } from './lib/ai.js'
import { WardrobeContext, useWardrobeStore } from './lib/store.js'
import { useUploader } from './lib/useUploader.js'

const TAB_KEY = 'fitfn.tab'
const TAB_IDS = TABS.map((t) => t.id)

function readTab() {
  const hash = typeof location !== 'undefined' ? location.hash.slice(1) : ''
  if (TAB_IDS.includes(hash)) return hash
  try {
    const saved = localStorage.getItem(TAB_KEY)
    return TAB_IDS.includes(saved) ? saved : 'closet'
  } catch {
    return 'closet'
  }
}

export default function App() {
  const store = useWardrobeStore()
  const { items, looks, wears, settings, taste, actions, mode, ready } = store
  const ai = useAi()
  const { toast, show: showToast, dismiss } = useToast()
  const uploader = useUploader({ actions, items, ready })

  const [tab, setTabState] = useState(readTab)
  const [openItemId, setOpenItemId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [styleRequest, setStyleRequest] = useState(null)

  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])
  const openItem = itemsById[openItemId] ?? null

  const setTab = useCallback((next) => {
    setTabState(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* per-device convenience only */
    }
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onHash = () => {
      const id = location.hash.slice(1)
      if (TAB_IDS.includes(id)) setTab(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setTab])

  const onOpenItem = useCallback((item) => setOpenItemId(item.id), [])
  const styleItem = useCallback(
    (item) => {
      setOpenItemId(null)
      setStyleRequest({ mustInclude: item.id, at: Date.now() })
      setTab('style')
    },
    [setTab],
  )

  // Without Claude to tag it, a single new piece opens straight away for tagging by hand.
  const { addPhotos: addRaw } = uploader
  const addPhotos = useCallback(
    async (files) => {
      const { ids, canTag } = await addRaw(files)
      if (!canTag && ids.length === 1) setOpenItemId(ids[0])
      return ids
    },
    [addRaw],
  )
  const closetUploader = useMemo(() => ({ ...uploader, addPhotos }), [uploader, addPhotos])

  const onLaundryClean = (ids) => {
    actions.setLaundry(ids, false)
    showToast({ message: `${ids.length} piece${ids.length > 1 ? 's' : ''} back in the closet` })
  }

  return (
    <WardrobeContext.Provider value={store}>
      <div className="min-h-dvh bg-page text-ink">
        <Header tab={tab} onTab={setTab} mode={mode} onSettings={() => setSettingsOpen(true)} />

        <main className="mx-auto max-w-6xl px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-16">
          {store.error && (
            <Notice tone="error" className="mb-5 flex items-start justify-between gap-3">
              <span>{store.error}</span>
              <button type="button" onClick={store.clearError} className="condensed shrink-0 text-[13px] text-muted hover:text-ink">
                Dismiss
              </button>
            </Notice>
          )}

          <div hidden={tab !== 'closet'}>
            <Closet
              items={items}
              ready={ready}
              uploader={closetUploader}
              canTag={Boolean(ai.images)}
              onOpenItem={onOpenItem}
              onStyle={() => setTab('style')}
              onLaundryClean={onLaundryClean}
            />
          </div>
          <div hidden={tab !== 'style'}>
            <StyleMe
              items={items}
              itemsById={itemsById}
              looks={looks}
              settings={settings}
              taste={taste}
              ai={ai}
              actions={actions}
              showToast={showToast}
              onOpenItem={onOpenItem}
              request={styleRequest}
              onRequestHandled={() => setStyleRequest(null)}
            />
          </div>
          <div hidden={tab !== 'looks'}>
            <Looks looks={looks} items={items} itemsById={itemsById} actions={actions} showToast={showToast} onOpenItem={onOpenItem} onStyle={() => setTab('style')} />
          </div>
          <div hidden={tab !== 'history'}>
            <History
              wears={wears}
              items={items}
              itemsById={itemsById}
              settings={settings}
              ai={ai}
              actions={actions}
              showToast={showToast}
              onOpenItem={onOpenItem}
              onStyleItem={styleItem}
            />
          </div>
        </main>

        <BottomNav tab={tab} onTab={setTab} />

        {actions && (
          <ItemSheet
            item={openItem}
            open={Boolean(openItem)}
            onClose={() => setOpenItemId(null)}
            actions={actions}
            uploader={uploader}
            canTag={Boolean(ai.images)}
            onStyle={styleItem}
            showToast={showToast}
          />
        )}
        {actions && (
          <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} taste={taste} actions={actions} mode={mode} />
        )}
        <Toast toast={toast} onDismiss={dismiss} />
      </div>
    </WardrobeContext.Provider>
  )
}
