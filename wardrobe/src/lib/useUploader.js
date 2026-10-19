// Turns picked photos into wardrobe pieces. Each photo is saved straight
// away (so nothing is lost if the page closes), then Claude tags it in the
// background, two at a time. A photo with several pieces in it becomes one
// piece each, cut from the photo; the whole photo is kept so any cut can go
// back to it. Whenever Claude can't help (switched off in settings, no photos
// in this view, an error) the piece waits to be tagged by hand.

import { useCallback, useEffect, useRef, useState } from 'react'
import { canSendImages, tagGarment } from './ai.js'
import { padBox } from './detect.js'
import { makeId } from './id.js'
import { cropPhoto, dataUrlToBlob, isImageFile, preparePhoto } from './images.js'

const MAX_BATCH = 40
const TAG_CONCURRENCY = 2
const STALE_MS = 3 * 60_000
// After these, every later photo would fail the same way.
const STOP_ALL = new Set(['not_granted', 'sampling_disabled', 'rate_limited', 'session_expired', 'images_unavailable'])

/** What a stored piece's photo is, in the shape savePhoto returns. */
const storedOf = (item) => (item.photo ? { photo: item.photo } : item.photoData ? { photoData: item.photoData } : {})

/** Cut each piece out of the photo and store the cuts. Resolves the cuts, or null (nothing kept) if any failed. */
async function cutPieces(act, photo, pieces) {
  const cuts = []
  try {
    for (const p of pieces) {
      const { full, thumb } = await cropPhoto(photo, padBox(p.box))
      cuts.push({ ...(await act.savePhoto(full)), thumb, tags: p.tags })
    }
    return cuts
  } catch {
    for (const c of cuts) act.dropPhoto(c)
    return null
  }
}

/**
 * File the cuts from one photo. The piece the photo was added as takes the
 * first cut; the rest become new pieces right after it. Resolves undo(): back
 * to one piece on the whole photo.
 */
async function fileCuts(act, job, cuts) {
  const whole = job.stored
  const [first, ...rest] = cuts
  const extra = []
  for (const [i, c] of rest.entries()) {
    const piece = { id: makeId(), photo: c.photo, thumb: c.thumb, ...c.tags, whole, splitFrom: job.id, aiStatus: 'done', tagSource: 'claude', createdAt: job.createdAt - (i + 1) / 100 }
    await act.addItem(piece)
    extra.push(piece)
  }
  await act.updateItem(job.id, { ...first.tags, photo: first.photo, thumb: first.thumb, whole, splitFrom: job.id, aiStatus: 'done', tagSource: 'claude', aiError: null })

  return () => {
    for (const piece of extra) act.deleteItem(piece)
    act.updateItem(job.id, { photo: whole.photo, thumb: job.thumb, whole: null, splitFrom: null })
    act.dropPhoto(first, job.id)
  }
}

export function useUploader({ actions, items, ready, settings, onSplit, onTagFailed }) {
  const [status, setStatus] = useState({ adding: 0, tagging: 0, errors: [] })
  const tagQueue = useRef([])
  const running = useRef(0)
  const active = useRef(new Set())
  const controllers = useRef(new Map())
  const stopped = useRef(new Set())
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const hooks = useRef({})
  hooks.current = { onSplit, onTagFailed }

  const bump = (patch) => setStatus((s) => ({ ...s, ...patch(s) }))

  const pump = useCallback(() => {
    while (running.current < TAG_CONCURRENCY && tagQueue.current.length) {
      const job = tagQueue.current.shift()
      const ctl = new AbortController()
      controllers.current.set(job.id, ctl)
      running.current += 1
      ;(async () => {
        const act = actionsRef.current
        try {
          const plan = await tagGarment(job.photo, { signal: ctl.signal, several: job.several })
          // Tagged by hand (or deleted) while Claude was looking: their tags win.
          if (stopped.current.has(job.id)) return
          if (plan.split) {
            const cuts = await cutPieces(act, job.photo, plan.pieces)
            if (cuts && stopped.current.has(job.id)) {
              for (const c of cuts) act.dropPhoto(c)
              return
            }
            // A photo that couldn't be cut stays one piece, tagged as its main piece.
            if (cuts) {
              const undo = await fileCuts(act, job, cuts)
              hooks.current.onSplit?.({ count: cuts.length, undo })
              return
            }
          }
          const { tags } = plan.split ? plan.pieces[0] : plan.piece
          await act.updateItem(job.id, { ...tags, aiStatus: 'done', tagSource: 'claude', aiError: null })
        } catch (err) {
          if (stopped.current.has(job.id) || err.code === 'cancelled') return
          // A view that can't send photos isn't a failure to retry: those pieces wait for the owner.
          const aiStatus = err.code === 'images_unavailable' ? 'manual' : 'failed'
          await act.updateItem(job.id, { aiStatus, aiError: err.message })
          if (job.solo) hooks.current.onTagFailed?.(job.id)
          if (STOP_ALL.has(err.code)) {
            for (const rest of tagQueue.current.splice(0)) {
              await act.updateItem(rest.id, { aiStatus, aiError: err.message })
              active.current.delete(rest.id)
            }
            bump(() => ({ errors: [err.message] }))
          }
        } finally {
          active.current.delete(job.id)
          controllers.current.delete(job.id)
          stopped.current.delete(job.id)
          running.current -= 1
          bump(() => ({ tagging: active.current.size }))
          pump()
        }
      })()
    }
  }, [])

  const enqueueTag = useCallback(
    (job) => {
      active.current.add(job.id)
      tagQueue.current.push(job)
      bump(() => ({ tagging: active.current.size }))
      pump()
    },
    [pump],
  )

  /** Splitting needs a stored photo to cut from and keep (not an inline copy). */
  const splitFor = (stored) => settingsRef.current?.splitPhotos !== false && Boolean(stored.photo)
  const autoTag = () => settingsRef.current?.autoTag !== false

  /** Add photos as new pieces. Resolves { ids, tagging } (tagging: Claude is on it). */
  const addPhotos = useCallback(
    async (fileList) => {
      if (!actionsRef.current) return { ids: [], tagging: false }
      const files = [...fileList].filter(isImageFile).slice(0, MAX_BATCH)
      const skipped = fileList.length - files.length
      if (!files.length) {
        bump(() => ({ errors: ['Those files aren’t photos. Pick JPG, PNG or HEIC images.'] }))
        return { ids: [], tagging: false }
      }
      bump((s) => ({ adding: s.adding + files.length, errors: skipped ? [`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that weren’t photos (or over ${MAX_BATCH} at once).`] : [] }))
      const ids = []
      let tagging = false
      for (const file of files) {
        try {
          const { full, thumb } = await preparePhoto(file)
          const stored = await actionsRef.current.savePhoto(full)
          // Asked per photo: the first one through can show this view can't send photos.
          const tag = autoTag() && (await canSendImages())
          const id = makeId()
          const createdAt = Date.now()
          await actionsRef.current.addItem({ id, ...stored, thumb, name: '', category: null, colors: [], aiStatus: tag ? 'pending' : 'manual', createdAt })
          ids.push(id)
          if (tag) {
            tagging = true
            enqueueTag({ id, photo: full, stored, thumb, createdAt, several: splitFor(stored), solo: files.length === 1 })
          }
        } catch (err) {
          bump((s) => ({ errors: [...s.errors, err.message || 'Couldn’t save a photo. Try again.'] }))
        } finally {
          bump((s) => ({ adding: Math.max(0, s.adding - 1) }))
        }
      }
      return { ids, tagging }
    },
    [enqueueTag],
  )

  /** Ask Claude to tag a piece (again), from its stored photo or thumbnail. */
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
      const stored = storedOf(item)
      await actionsRef.current.updateItem(item.id, { aiStatus: 'pending', aiError: null })
      // A piece already cut from a bigger photo is one piece.
      enqueueTag({ id: item.id, photo, stored, thumb: item.thumb, createdAt: item.createdAt ?? Date.now(), several: !item.whole && splitFor(stored), solo: false })
    },
    [enqueueTag],
  )

  /** Ask Claude to tag every piece in the list (one tap, never automatic). */
  const retagFailed = useCallback(
    async (list) => {
      for (const item of list) await retag(item)
    },
    [retag],
  )

  /** Stop Claude tagging a piece (it's being tagged by hand, or deleted). */
  const stopTagging = useCallback((id) => {
    if (!active.current.has(id)) return
    const queued = tagQueue.current.findIndex((j) => j.id === id)
    if (queued >= 0) {
      tagQueue.current.splice(queued, 1)
      active.current.delete(id)
      bump(() => ({ tagging: active.current.size }))
      return
    }
    stopped.current.add(id)
    controllers.current.get(id)?.abort()
  }, [])

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
    stopTagging,
    clearErrors: () => bump(() => ({ errors: [] })),
  }
}
