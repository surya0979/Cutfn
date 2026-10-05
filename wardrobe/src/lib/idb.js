// A tiny IndexedDB wrapper for the "this device only" mode (npm run dev, a
// saved copy). localStorage is too small for photos, IndexedDB is not.

const DB_NAME = 'fitfn'
const VERSION = 1
export const STORES = ['items', 'looks', 'wears', 'kv', 'photos']

let opening = null

function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('blocked'))
  })
  return opening
}

async function run(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const idbGet = (store, key) => run(store, 'readonly', (s) => s.get(key))
export const idbPut = (store, key, value) => run(store, 'readwrite', (s) => s.put(value, key))
export const idbDelete = (store, key) => run(store, 'readwrite', (s) => s.delete(key))

/** Every value in a store, as [key, value] pairs. */
export async function idbEntries(store) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const out = []
    const req = tx.objectStore(store).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      out.push([cursor.key, cursor.value])
      cursor.continue()
    }
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  })
}
