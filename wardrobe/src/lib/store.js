// Where the wardrobe lives.
//
// Published on claude.ai the page gets the platform's `db` capability: a
// realtime document store. Everything goes under the signed-in person's
// private `data/users/<id>/` subtree, and every open device subscribes to
// it, so a piece added on the phone shows up on the laptop within seconds.
// Full-size photos go to the artifact's `assets` store; each item keeps a
// small thumbnail inline so the closet grid draws without extra requests.
//
// Anywhere else (npm run dev, a saved copy) there is no `window.claude`, and
// the same API is served from IndexedDB in this browser.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { makeId } from './id.js'
import { idbDelete, idbEntries, idbGet, idbPut } from './idb.js'
import { dataUrlToBlob, shrink, blobToDataUrl } from './images.js'
import { DEFAULT_SETTINGS } from './vocab.js'
import { afterWear } from './outfits.js'

const EMPTY = { items: [], looks: [], wears: [], settings: DEFAULT_SETTINGS, taste: { liked: [], disliked: [] }, ready: false }

const hasClaude = () => typeof window !== 'undefined' && typeof window.claude?.use === 'function'

/** Resolve the backend once: { mode: 'connecting' | 'cloud' | 'local', db, uid, assets }. */
function useBackend() {
  const [backend, setBackend] = useState(() => (hasClaude() ? { mode: 'connecting' } : { mode: 'local' }))
  useEffect(() => {
    if (!hasClaude()) return
    let cancelled = false
    ;(async () => {
      try {
        const [db, user, assets] = await Promise.all([
          window.claude.use('db'),
          window.claude.use('user'),
          window.claude.use('assets').catch(() => null),
        ])
        const uid = user ? await user.id() : null
        if (!cancelled) setBackend(db && uid ? { mode: 'cloud', db, uid, assets } : { mode: 'local' })
      } catch {
        if (!cancelled) setBackend({ mode: 'local' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return backend
}

function describeError(err) {
  if (err?.code === 'quota_exceeded') return 'Your wardrobe storage is full. Delete pieces you no longer own, then try again.'
  if (err?.code === 'quota_or_state') return 'Photo storage is full. Remove unused photos in Settings, or delete old pieces.'
  if (err?.code === 'too_large') return 'That photo is too large to store. Try a smaller one.'
  if (err?.code === 'revoked' || err?.code === 'not_granted') return 'Lost access to your synced wardrobe. Reload the page.'
  if (err?.code === 'invalid_argument') return 'That change couldn’t be saved. Reload the page and try again.'
  return 'Couldn’t save. Check your connection and try again.'
}

/** Drop undefined fields and the id (the document id carries it). */
function toDoc(entry) {
  const body = {}
  for (const [k, v] of Object.entries(entry)) if (v !== undefined && k !== 'id') body[k] = v
  return body
}

const fromSnap = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }))

const newestFirst = (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt ?? 0) - (a.createdAt ?? 0))

/** A write, retried once on a transient failure. Resolves false if it failed. */
async function attempt(fn, onError) {
  try {
    await fn()
    return true
  } catch (err) {
    if (err?.code === 'unavailable' || err?.code === 'store_unavailable') {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600))
      try {
        await fn()
        return true
      } catch (again) {
        onError(describeError(again))
        return false
      }
    }
    onError(describeError(err))
    return false
  }
}

// ---------------------------------------------------------------- adapters
// Both backends expose the same small surface; the actions are built once on top.

function cloudAdapter(backend, setState) {
  const { db, uid, assets } = backend
  const root = db.doc(`data/users/${uid}/closet`)
  const cols = { items: root.collection('items'), looks: root.collection('looks'), wears: root.collection('wears') }
  const docs = { settings: db.doc(`data/users/${uid}/settings`), taste: db.doc(`data/users/${uid}/taste`) }

  return {
    subscribe(onError) {
      const fail = (err) => onError(describeError(err))
      let loaded = 0
      const mark = () => {
        loaded += 1
        if (loaded === 1) setState((st) => ({ ...st, ready: true }))
      }
      const unsubs = [
        cols.items.onSnapshot((s) => {
          setState((st) => ({ ...st, items: fromSnap(s).sort(newestFirst) }))
          mark()
        }, fail),
        cols.looks.onSnapshot((s) => setState((st) => ({ ...st, looks: fromSnap(s).sort(newestFirst) })), fail),
        cols.wears
          .orderBy('date', 'desc')
          .limit(600)
          .onSnapshot((s) => setState((st) => ({ ...st, wears: fromSnap(s).sort(byDateDesc) })), fail),
        docs.settings.onSnapshot((s) => setState((st) => ({ ...st, settings: { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) } })), fail),
        docs.taste.onSnapshot((s) => setState((st) => ({ ...st, taste: { liked: [], disliked: [], ...(s.exists ? s.data() : {}) } })), fail),
      ]
      return () => unsubs.forEach((u) => u())
    },
    put: (col, id, body) => cols[col].doc(id).set(toDoc(body)),
    patch: (col, id, patch) => cols[col].doc(id).update(toDoc(patch)),
    remove: (col, id) => cols[col].doc(id).delete(),
    putDoc: (name, body) => docs[name].set(toDoc(body)),

    canStorePhotos: Boolean(assets),
    async savePhoto(blob) {
      if (assets) {
        const { id } = await assets.upload(blob, { type: 'image/jpeg' })
        return { photo: { asset: id } }
      }
      // No photo storage in this view: keep a smaller copy inside the record.
      return { photoData: await blobToDataUrl(await shrink(blob, 720, 0.8)) }
    },
    photoUrl: (item) => (item.photo?.asset ? `/_blob/${item.photo.asset}` : item.photoData || null),
    async photoBlob(item) {
      if (item.photo?.asset) {
        const res = await fetch(`/_blob/${item.photo.asset}`)
        if (!res.ok) throw new Error('missing')
        return res.blob()
      }
      if (item.photoData) return dataUrlToBlob(item.photoData)
      throw new Error('missing')
    },
    async deletePhoto(item) {
      if (assets && item.photo?.asset) await assets.delete(item.photo.asset).catch(() => {})
    },
    async storage(items) {
      if (!assets) return null
      const { assets: list, usage } = await assets.list()
      const used = new Set(items.map((i) => i.photo?.asset).filter(Boolean))
      const orphans = list.filter((a) => !used.has(a.id))
      return {
        usage,
        orphans: orphans.length,
        orphanBytes: orphans.reduce((n, a) => n + (a.sizeBytes ?? 0), 0),
        prune: async () => {
          for (const a of orphans) await assets.delete(a.id).catch(() => {})
        },
      }
    },
  }
}

function localAdapter(setState) {
  const urls = new Map()
  const kv = { settings: DEFAULT_SETTINGS, taste: { liked: [], disliked: [] } }

  const writeCol = (col, fn) => setState((st) => ({ ...st, [col]: fn(st[col]) }))
  const sorter = { items: newestFirst, looks: newestFirst, wears: byDateDesc }

  return {
    subscribe(onError) {
      let live = true
      ;(async () => {
        try {
          const [items, looks, wears, kvs] = await Promise.all(['items', 'looks', 'wears', 'kv'].map((s) => idbEntries(s)))
          const map = (entries) => entries.map(([id, v]) => ({ ...v, id }))
          const kvObj = Object.fromEntries(kvs)
          Object.assign(kv, kvObj)
          if (!live) return
          setState((st) => ({
            ...st,
            items: map(items).sort(newestFirst),
            looks: map(looks).sort(newestFirst),
            wears: map(wears).sort(byDateDesc),
            settings: { ...DEFAULT_SETTINGS, ...(kvObj.settings ?? {}) },
            taste: { liked: [], disliked: [], ...(kvObj.taste ?? {}) },
            ready: true,
          }))
        } catch {
          onError('This browser won’t let the page save anything (private window?). Changes will be lost when you close it.')
          if (live) setState((st) => ({ ...st, ready: true }))
        }
      })()
      return () => {
        live = false
      }
    },
    async put(col, id, body) {
      const value = toDoc(body)
      writeCol(col, (list) => [...list.filter((x) => x.id !== id), { ...value, id }].sort(sorter[col]))
      await idbPut(col, id, value).catch(() => {})
    },
    async patch(col, id, patch) {
      let next = null
      writeCol(col, (list) =>
        list.map((x) => {
          if (x.id !== id) return x
          next = { ...x, ...patch }
          return next
        }),
      )
      const stored = await idbGet(col, id).catch(() => null)
      if (stored) await idbPut(col, id, { ...stored, ...toDoc(patch) }).catch(() => {})
      else if (next) await idbPut(col, id, toDoc(next)).catch(() => {})
    },
    async remove(col, id) {
      writeCol(col, (list) => list.filter((x) => x.id !== id))
      await idbDelete(col, id).catch(() => {})
    },
    async putDoc(name, body) {
      kv[name] = body
      setState((st) => ({ ...st, [name]: body }))
      await idbPut('kv', name, body).catch(() => {})
    },

    canStorePhotos: true,
    async savePhoto(blob) {
      const id = makeId()
      await idbPut('photos', id, blob)
      return { photo: { local: id } }
    },
    photoUrl(item) {
      const id = item.photo?.local
      if (!id) return item.photoData || null
      return urls.get(id) ?? null
    },
    async loadPhotoUrl(item) {
      const id = item.photo?.local
      if (!id) return null
      if (urls.has(id)) return urls.get(id)
      const blob = await idbGet('photos', id).catch(() => null)
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      urls.set(id, url)
      return url
    },
    async photoBlob(item) {
      if (item.photo?.local) {
        const blob = await idbGet('photos', item.photo.local)
        if (blob) return blob
      }
      if (item.photoData) return dataUrlToBlob(item.photoData)
      throw new Error('missing')
    },
    async deletePhoto(item) {
      if (item.photo?.local) await idbDelete('photos', item.photo.local).catch(() => {})
    },
    storage: async () => null,
  }
}

// ---------------------------------------------------------------- the hook

/**
 * The whole wardrobe plus the actions that change it.
 * `mode` is 'connecting', 'cloud' (synced via claude.ai) or 'local' (this browser).
 */
export function useWardrobeStore() {
  const backend = useBackend()
  const [state, setState] = useState(EMPTY)
  const [error, setError] = useState(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Writes to one document must not overlap, so rapid taps queue up.
  const queues = useRef(new Map())

  const adapter = useMemo(() => {
    if (backend.mode === 'cloud') return cloudAdapter(backend, setState)
    if (backend.mode === 'local') return localAdapter(setState)
    return null
  }, [backend])

  useEffect(() => {
    if (!adapter) return
    setState(EMPTY)
    return adapter.subscribe(setError)
  }, [adapter])

  const actions = useMemo(() => {
    if (!adapter) return null
    const queued = (key, fn) => {
      const next = (queues.current.get(key) ?? Promise.resolve()).then(() => attempt(fn, setError))
      queues.current.set(key, next)
      return next
    }
    const find = (col, id) => stateRef.current[col].find((x) => x.id === id)
    const pendingPhotoDeletes = new Map()

    const patchItem = (id, patch) => queued(`items:${id}`, () => adapter.patch('items', id, patch))

    return {
      /** Store a new piece. Returns its id. */
      addItem: async (item) => {
        const id = item.id ?? makeId()
        await queued(`items:${id}`, () => adapter.put('items', id, { createdAt: Date.now(), wearCount: 0, wearsSinceWash: 0, ...item }))
        return id
      },
      updateItem: patchItem,
      /** Delete a piece; returns undo(). Its photo is removed once the undo window passes. */
      deleteItem: (item, undoMs = 9000) => {
        queued(`items:${item.id}`, () => adapter.remove('items', item.id))
        const timer = setTimeout(() => {
          pendingPhotoDeletes.delete(item.id)
          adapter.deletePhoto(item)
        }, undoMs)
        pendingPhotoDeletes.set(item.id, timer)
        return () => {
          clearTimeout(pendingPhotoDeletes.get(item.id))
          pendingPhotoDeletes.delete(item.id)
          queued(`items:${item.id}`, () => adapter.put('items', item.id, item))
        }
      },
      setLaundry: (ids, inLaundry) => {
        for (const id of ids) patchItem(id, inLaundry ? { laundry: true } : { laundry: false, wearsSinceWash: 0 })
      },
      savePhoto: (blob) =>
        adapter.savePhoto(blob).catch((err) => {
          throw new Error(describeError(err))
        }),
      photoBlob: (item) => adapter.photoBlob(item),

      saveLook: (look) => {
        const id = look.id ?? makeId()
        queued(`looks:${id}`, () => adapter.put('looks', id, { createdAt: Date.now(), ...look }))
        return id
      },
      updateLook: (id, patch) => queued(`looks:${id}`, () => adapter.patch('looks', id, patch)),
      deleteLook: (look) => {
        queued(`looks:${look.id}`, () => adapter.remove('looks', look.id))
        return () => queued(`looks:${look.id}`, () => adapter.put('looks', look.id, look))
      },

      /** Log an outfit as worn on `date`; bumps each piece's counters. Returns undo(). */
      logWear: ({ date, itemIds, title, lookId, occasion }) => {
        const id = makeId()
        const before = itemIds.map((iid) => find('items', iid)).filter(Boolean)
        queued(`wears:${id}`, () => adapter.put('wears', id, { date, itemIds, title: title ?? '', lookId: lookId ?? null, occasion: occasion ?? null, createdAt: Date.now() }))
        const toLaundry = []
        for (const item of before) {
          const next = afterWear(item)
          if (next.laundry && !item.laundry) toLaundry.push(item.id)
          patchItem(item.id, {
            wearCount: (item.wearCount ?? 0) + 1,
            lastWorn: !item.lastWorn || item.lastWorn < date ? date : item.lastWorn,
            ...next,
          })
        }
        if (lookId && find('looks', lookId)) {
          const look = find('looks', lookId)
          queued(`looks:${lookId}`, () => adapter.patch('looks', lookId, { wornCount: (look.wornCount ?? 0) + 1, lastWorn: date }))
        }
        const undo = () => {
          queued(`wears:${id}`, () => adapter.remove('wears', id))
          for (const item of before) {
            patchItem(item.id, {
              wearCount: item.wearCount ?? 0,
              lastWorn: item.lastWorn ?? null,
              wearsSinceWash: item.wearsSinceWash ?? 0,
              laundry: Boolean(item.laundry),
            })
          }
        }
        return { undo, toLaundry }
      },
      /** Remove a wear from history and take it off each piece's counters. */
      deleteWear: (wear) => {
        queued(`wears:${wear.id}`, () => adapter.remove('wears', wear.id))
        const others = stateRef.current.wears.filter((w) => w.id !== wear.id)
        for (const iid of wear.itemIds ?? []) {
          const item = find('items', iid)
          if (!item) continue
          const last = others.filter((w) => w.itemIds?.includes(iid)).reduce((max, w) => (!max || w.date > max ? w.date : max), null)
          patchItem(iid, {
            wearCount: Math.max(0, (item.wearCount ?? 0) - 1),
            wearsSinceWash: Math.max(0, (item.wearsSinceWash ?? 0) - 1),
            lastWorn: last,
          })
        }
      },

      updateSettings: (patch) => {
        const next = { ...stateRef.current.settings, ...patch }
        setState((st) => ({ ...st, settings: next }))
        return queued('settings', () => adapter.putDoc('settings', next))
      },
      /** Remember a liked or rejected outfit so future suggestions learn from it. */
      addTaste: (kind, entry) => {
        const taste = stateRef.current.taste
        const list = [...(taste[kind] ?? []).filter((t) => t.summary !== entry.summary), { ...entry, at: Date.now() }].slice(-30)
        const next = { liked: taste.liked ?? [], disliked: taste.disliked ?? [], [kind]: list }
        setState((st) => ({ ...st, taste: next }))
        return queued('taste', () => adapter.putDoc('taste', next))
      },
      clearTaste: () => {
        const next = { liked: [], disliked: [] }
        setState((st) => ({ ...st, taste: next }))
        return queued('taste', () => adapter.putDoc('taste', next))
      },
      storage: () => adapter.storage(stateRef.current.items),
    }
  }, [adapter])

  return {
    ...state,
    mode: backend.mode,
    ready: Boolean(adapter) && state.ready,
    actions,
    canStorePhotos: adapter?.canStorePhotos ?? false,
    photoUrl: (item) => adapter?.photoUrl(item) ?? null,
    loadPhotoUrl: (item) => adapter?.loadPhotoUrl?.(item) ?? Promise.resolve(null),
    error,
    clearError: () => setError(null),
  }
}

export const WardrobeContext = createContext(null)
export const useWardrobe = () => useContext(WardrobeContext)

/** The full photo's URL for an item (resolves async in local mode); falls back to the thumbnail. */
export function usePhotoUrl(item) {
  const store = useWardrobe()
  const direct = item ? store.photoUrl(item) : null
  const [loaded, setLoaded] = useState(null)
  const localId = item?.photo?.local
  useEffect(() => {
    if (!localId || direct) return
    let live = true
    store.loadPhotoUrl(item).then((url) => live && setLoaded(url))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId, direct])
  return direct ?? loaded ?? item?.thumb ?? null
}
