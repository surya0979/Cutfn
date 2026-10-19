// Turns picked photos into wardrobe pieces. Each photo is saved straight
// away (so nothing is lost if the page closes), then Claude tags it in the
// background, two at a time. A photo with several pieces in it becomes one
// piece each, cut from the photo; the whole photo is kept so any cut can go
// back to it. Whenever Claude can't help (switched off in settings, no photos
// in this view, an error) the piece waits to be tagged by hand.
//
// One job per piece at a time, and a job owns its piece only while it is the
// one registered for it. Stopping a piece (tagged by hand, deleted) lets go of
// it at once; the old job checks it still owns the piece before every write,
// so nothing it learns later can overwrite the owner's work.

import { useCallback, useEffect, useRef, useState } from 'react'
import { STOP_CODES, canSendImages, tagGarment } from './ai.js'
import { padBox } from './detect.js'
import { makeId } from './id.js'
import { cropPhoto, dataUrlToBlob, isImageFile, preparePhoto } from './images.js'

const MAX_BATCH = 40
const TAG_CONCURRENCY = 2
const STALE_MS = 3 * 60_000

/** A piece's photo fields, in the shape savePhoto returns. */
const photoOf = (ref) => (ref?.photo ? { photo: ref.photo } : ref?.photoData ? { photoData: ref.photoData } : {})

/** Where Claude's tags leave a piece: done, or (type outside the list) waiting for the owner to pick one. */
const statusOf = (tags) =>
  tags.category ? { aiStatus: 'done', aiError: null } : { aiStatus: 'failed', aiError: 'Claude couldn’t tell what type of piece this is. Pick one.' }

/** Cut each piece out of the photo and store the cuts. Resolves the cuts, or null (nothing kept) if any failed. */
async function cutPieces(act, photo, pieces) {
  const cuts = []
  try {
    for (const p of pieces) {
      const { full, thumb } = await cropPhoto(photo, padBox(p.box))
      cuts.push({ ...(await act.savePhoto(full)), thumb, tags: p.tags, box: p.box })
    }
    return cuts
  } catch {
    for (const c of cuts) act.dropPhoto(c)
    return null
  }
}

/**
 * File the cuts from one photo. The piece the photo was added as takes the
 * first cut; the rest become new pieces right after it. If the job loses the
 * piece part-way, whatever was filed is taken back. Resolves undo() (back to
 * one piece on the whole photo), or null if it was taken back.
 */
async function fileCuts(act, job, cuts, live) {
  const whole = photoOf(job.stored)
  const [first, ...rest] = cuts
  const extra = []
  const takeBack = (from) => {
    for (const piece of extra) act.deleteItem(piece)
    for (const c of [first, ...rest.slice(from)]) act.dropPhoto(c)
    return null
  }
  for (const [i, c] of rest.entries()) {
    if (!live()) return takeBack(i)
    const piece = { id: makeId(), ...photoOf(c), thumb: c.thumb, ...c.tags, ...statusOf(c.tags), box: c.box, whole, splitFrom: job.id, tagSource: 'claude', createdAt: job.createdAt - (i + 1) / 100 }
    await act.addItem(piece)
    extra.push(piece)
  }
  if (!live()) return takeBack(rest.length)
  await act.updateItem(job.id, { ...first.tags, ...statusOf(first.tags), ...photoOf(first), thumb: first.thumb, box: first.box, whole, splitFrom: job.id, tagSource: 'claude' })

  return () => {
    for (const piece of extra) act.deleteItem(piece)
    act.updateItem(job.id, { ...whole, thumb: job.thumb, whole: null, splitFrom: null, box: null })
    act.dropPhoto(first, job.id)
  }
}

export function useUploader({ actions, items, ready, settings, onSplit, onTagFailed }) {
  const [status, setStatus] = useState({ adding: 0, tagging: 0, errors: [] })
  const jobs = useRef(new Map())
  const tagQueue = useRef([])
  const running = useRef(0)
  // Set when Claude turns photos away for now (rate limit, expired session):
  // the rest of that batch waits instead of asking again. The owner's next tap clears it.
  const halted = useRef(null)
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const hooks = useRef({})
  hooks.current = { onSplit, onTagFailed }

  const bump = (patch) => setStatus((s) => ({ ...s, ...patch(s) }))
  const count = () => bump(() => ({ tagging: jobs.current.size }))

  const pump = useCallback(() => {
    while (running.current < TAG_CONCURRENCY && tagQueue.current.length) {
      const job = tagQueue.current.shift()
      running.current += 1
      ;(async () => {
        const act = actionsRef.current
        const live = () => jobs.current.get(job.id) === job
        try {
          const plan = await tagGarment(job.photo, { signal: job.ctl.signal, several: job.several })
          if (!live()) return
          if (plan.split) {
            const cuts = await cutPieces(act, job.photo, plan.pieces)
            if (cuts && !live()) {
              for (const c of cuts) act.dropPhoto(c)
              return
            }
            if (cuts) {
              const undo = await fileCuts(act, job, cuts, live)
              if (undo) hooks.current.onSplit?.({ count: cuts.length, undo })
              return
            }
            // A photo that couldn't be cut stays one piece, tagged as its main piece.
          }
          const { tags } = plan.split ? plan.pieces[0] : plan.piece
          if (live()) await act.updateItem(job.id, { ...tags, aiStatus: 'done', aiError: null, tagSource: 'claude' })
        } catch (err) {
          if (!live() || err.code === 'cancelled') return
          // A view that can't send photos isn't a failure to retry: those pieces wait for the owner.
          const aiStatus = err.code === 'images_unavailable' ? 'manual' : 'failed'
          if (STOP_CODES.has(err.code)) {
            halted.current = { aiStatus, aiError: err.message }
            const drained = tagQueue.current.splice(0)
            for (const rest of drained) jobs.current.delete(rest.id)
            // Written straight away, so a hand save made after this lands on top.
            for (const rest of drained) act.updateItem(rest.id, { aiStatus, aiError: err.message })
            bump(() => ({ errors: [err.message] }))
          }
          await act.updateItem(job.id, { aiStatus, aiError: err.message })
          if (job.solo) hooks.current.onTagFailed?.(job.id)
        } finally {
          if (live()) jobs.current.delete(job.id)
          running.current -= 1
          count()
          pump()
        }
      })()
    }
  }, [])

  /** Splitting needs a stored photo to cut from and keep (not an inline copy). */
  const splitFor = (stored) => settingsRef.current?.splitPhotos !== false && Boolean(stored.photo) && Boolean(actionsRef.current?.storesPhotos)

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
      halted.current = null
      bump((s) => ({ adding: s.adding + files.length, errors: skipped ? [`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that weren’t photos (or over ${MAX_BATCH} at once).`] : [] }))
      const ids = []
      let tagging = false
      for (const file of files) {
        try {
          const { full, thumb } = await preparePhoto(file)
          const stored = await actionsRef.current.savePhoto(full)
          // Asked per photo: the first one through can show that this view can't send photos.
          const tag = !halted.current && settingsRef.current?.autoTag !== false && (await canSendImages())
          const id = makeId()
          const createdAt = Date.now()
          const waiting = halted.current ?? { aiStatus: 'manual', aiError: null }
          await actionsRef.current.addItem({ id, ...stored, thumb, name: '', category: null, colors: [], ...(tag ? { aiStatus: 'pending' } : waiting), createdAt })
          ids.push(id)
          if (tag) {
            tagging = true
            const job = { id, ctl: new AbortController(), photo: full, stored, thumb, createdAt, several: splitFor(stored), solo: files.length === 1 }
            jobs.current.set(id, job)
            tagQueue.current.push(job)
            count()
            pump()
          }
        } catch (err) {
          bump((s) => ({ errors: [...s.errors, err.message || 'Couldn’t save a photo. Try again.'] }))
        } finally {
          bump((s) => ({ adding: Math.max(0, s.adding - 1) }))
        }
      }
      return { ids, tagging }
    },
    [pump],
  )

  /** Ask Claude to tag a piece (again), from its stored photo or thumbnail. */
  const retag = useCallback(
    async (item) => {
      if (jobs.current.has(item.id)) return
      // Claimed before anything is awaited, so a second tap does nothing.
      const job = { id: item.id, ctl: new AbortController() }
      jobs.current.set(item.id, job)
      count()
      halted.current = null
      const live = () => jobs.current.get(item.id) === job
      const act = actionsRef.current
      let photo = null
      let fromThumb = false
      try {
        photo = await act.photoBlob(item)
      } catch {
        if (item.thumb) {
          photo = dataUrlToBlob(item.thumb)
          fromThumb = true
        }
      }
      // A cut that went back to the whole photo: Claude looks at its own part of it again.
      if (photo && !fromThumb && item.box && item.splitFrom && !item.whole) {
        photo = (await cropPhoto(photo, padBox(item.box)).catch(() => null))?.full ?? photo
      }
      if (!live()) return
      if (!photo) {
        jobs.current.delete(item.id)
        count()
        await act.updateItem(item.id, { aiStatus: 'failed', aiError: 'The photo for this piece is missing. Tag it yourself.' })
        return
      }
      const stored = photoOf(item)
      // Only a photo nobody has catalogued yet gets split; a tagged or cut piece stays one piece.
      const several = !fromThumb && !item.category && !item.splitFrom && splitFor(stored)
      Object.assign(job, { photo, stored, thumb: item.thumb, createdAt: item.createdAt ?? Date.now(), several, solo: false })
      await act.updateItem(item.id, { aiStatus: 'pending', aiError: null })
      if (!live()) return
      tagQueue.current.push(job)
      pump()
    },
    [pump],
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
    const job = jobs.current.get(id)
    if (!job) return
    jobs.current.delete(id)
    const queued = tagQueue.current.indexOf(job)
    if (queued >= 0) tagQueue.current.splice(queued, 1)
    job.ctl.abort()
    count()
  }, [])

  // Pieces left "tagging" by a page that closed mid-way: offer a retry instead.
  const swept = useRef(false)
  useEffect(() => {
    if (!ready || !actions || swept.current) return
    swept.current = true
    const now = Date.now()
    for (const item of items) {
      if (item.aiStatus === 'pending' && !jobs.current.has(item.id) && now - (item.createdAt ?? 0) > STALE_MS) {
        actions.updateItem(item.id, { aiStatus: 'failed', aiError: 'Tagging was interrupted. Retry, or tag it yourself.' })
      }
    }
  }, [ready, actions, items])

  return {
    ...status,
    isTagging: (id) => jobs.current.has(id),
    addPhotos,
    retag,
    retagFailed,
    stopTagging,
    clearErrors: () => bump(() => ({ errors: [] })),
  }
}
