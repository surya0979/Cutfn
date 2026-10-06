// Turns picked photos into wardrobe pieces. Each photo is saved straight
// away (so nothing is lost if the page closes), then Claude tags it in the
// background, two at a time.

import { useCallback, useEffect, useRef, useState } from 'react'
import { canSendImages, tagGarment } from './ai.js'
import { makeId } from './id.js'
import { dataUrlToBlob, isImageFile, preparePhoto } from './images.js'

const MAX_BATCH = 40
const TAG_CONCURRENCY = 2
const STALE_MS = 3 * 60_000

export function useUploader({ actions, items, ready }) {
  const [status, setStatus] = useState({ adding: 0, tagging: 0, errors: [] })
  const tagQueue = useRef([])
  const running = useRef(0)
  const active = useRef(new Set())
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const bump = (patch) => setStatus((s) => ({ ...s, ...patch(s) }))

  const pump = useCallback(() => {
    while (running.current < TAG_CONCURRENCY && tagQueue.current.length) {
      const job = tagQueue.current.shift()
      running.current += 1
      ;(async () => {
        try {
          const tags = await tagGarment(job.photo)
          await actionsRef.current.updateItem(job.id, { ...tags, aiStatus: 'done', aiError: null })
        } catch (err) {
          await actionsRef.current.updateItem(job.id, { aiStatus: 'failed', aiError: err.message })
          // Without permission every later job fails the same way.
          if (err.code === 'not_granted' || err.code === 'sampling_disabled' || err.code === 'rate_limited') {
            for (const rest of tagQueue.current.splice(0)) {
              await actionsRef.current.updateItem(rest.id, { aiStatus: 'failed', aiError: err.message })
              active.current.delete(rest.id)
            }
            bump(() => ({ tagging: 0, errors: [err.message] }))
          }
        } finally {
          active.current.delete(job.id)
          running.current -= 1
          bump(() => ({ tagging: active.current.size }))
          pump()
        }
      })()
    }
  }, [])

  const enqueueTag = useCallback(
    (id, photo) => {
      active.current.add(id)
      tagQueue.current.push({ id, photo })
      bump(() => ({ tagging: active.current.size }))
      pump()
    },
    [pump],
  )

  /** Add photos as new pieces. Resolves { ids, canTag }. */
  const addPhotos = useCallback(
    async (fileList) => {
      if (!actionsRef.current) return { ids: [], canTag: false }
      const files = [...fileList].filter(isImageFile).slice(0, MAX_BATCH)
      const skipped = fileList.length - files.length
      if (!files.length) {
        bump(() => ({ errors: ['Those files aren’t photos. Pick JPG, PNG or HEIC images.'] }))
        return { ids: [], canTag: false }
      }
      bump((s) => ({ adding: s.adding + files.length, errors: skipped ? [`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that weren’t photos (or over ${MAX_BATCH} at once).`] : [] }))
      const canTag = await canSendImages()
      const ids = []
      for (const file of files) {
        try {
          const { full, thumb } = await preparePhoto(file)
          const stored = await actionsRef.current.savePhoto(full)
          const id = makeId()
          await actionsRef.current.addItem({
            id,
            ...stored,
            thumb,
            name: '',
            category: null,
            colors: [],
            aiStatus: canTag ? 'pending' : 'manual',
            createdAt: Date.now(),
          })
          ids.push(id)
          if (canTag) enqueueTag(id, full)
        } catch (err) {
          bump((s) => ({ errors: [...s.errors, err.message || 'Couldn’t save a photo. Try again.'] }))
        } finally {
          bump((s) => ({ adding: Math.max(0, s.adding - 1) }))
        }
      }
      return { ids, canTag }
    },
    [enqueueTag],
  )

  /** Ask Claude to tag a piece again, from its stored photo (or thumbnail). */
  const retag = useCallback(
    async (item) => {
      if (active.current.has(item.id)) return
      let photo
      try {
        photo = await actionsRef.current.photoBlob(item)
      } catch {
        if (item.thumb) photo = dataUrlToBlob(item.thumb)
      }
      if (!photo) {
        await actionsRef.current.updateItem(item.id, { aiStatus: 'failed', aiError: 'The photo for this piece is missing. Tag it yourself.' })
        return
      }
      await actionsRef.current.updateItem(item.id, { aiStatus: 'pending', aiError: null })
      enqueueTag(item.id, photo)
    },
    [enqueueTag],
  )

  /** Re-queue every piece whose tagging failed (one tap, never automatic). */
  const retagFailed = useCallback(
    async (list) => {
      for (const item of list) await retag(item)
    },
    [retag],
  )

  // Pieces left "tagging" by a page that closed mid-way: offer a retry instead.
  const swept = useRef(false)
  useEffect(() => {
    if (!ready || !actions || swept.current) return
    swept.current = true
    const now = Date.now()
    for (const item of items) {
      if (item.aiStatus === 'pending' && !active.current.has(item.id) && now - (item.createdAt ?? 0) > STALE_MS) {
        actions.updateItem(item.id, { aiStatus: 'failed', aiError: 'Tagging was interrupted. Retry, or tag it yourself.' })
      }
    }
  }, [ready, actions, items])

  return {
    ...status,
    isTagging: (id) => active.current.has(id),
    addPhotos,
    retag,
    retagFailed,
    clearErrors: () => bump(() => ({ errors: [] })),
  }
}
