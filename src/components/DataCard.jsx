import { DatabaseBackup, FileSpreadsheet, FileUp, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { backupJson, buildWorkbook, exportFileName, parseBackup, saveFile, trackerSheets } from '../lib/exportData.js'
import { Button, Card, CardHeader } from './ui.jsx'

/** Export the whole log as a spreadsheet, download a backup, or restore one. */
export default function DataCard({ loadAll, restore }) {
  const [busy, setBusy] = useState(null)
  const [status, setStatus] = useState(null)
  const [pending, setPending] = useState(null)
  const input = useRef(null)

  async function run(kind, fn) {
    setBusy(kind)
    setStatus(null)
    try {
      setStatus(await fn())
    } catch (err) {
      setStatus({ error: true, text: err.message || 'Something went wrong. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  const exportSheet = () =>
    run('xlsx', async () => {
      const data = await loadAll()
      if (!data) throw new Error('Still connecting. Try again in a second.')
      const bytes = buildWorkbook(trackerSheets(data))
      const result = await saveFile(exportFileName('xlsx'), bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      return result === 'declined'
        ? { text: 'Download cancelled.' }
        : { text: `Spreadsheet ready: ${data.meals.length} meals, ${data.exercises.length} workouts, ${data.weights.length} weigh-ins.` }
    })

  const exportBackup = () =>
    run('json', async () => {
      const data = await loadAll()
      if (!data) throw new Error('Still connecting. Try again in a second.')
      const result = await saveFile(exportFileName('json'), backupJson(data), 'application/json')
      return result === 'declined' ? { text: 'Download cancelled.' } : { text: 'Backup saved. Keep it somewhere safe, like Google Drive.' }
    })

  const pickBackup = async (file) => {
    if (!file) return
    setStatus(null)
    try {
      const data = parseBackup(await file.text())
      setPending({ data, name: file.name })
    } catch (err) {
      setStatus({ error: true, text: err.message })
    }
  }

  const confirmRestore = () =>
    run('restore', async () => {
      const { data } = pending
      setPending(null)
      await restore(data, (p) => setStatus({ text: `Restoring… ${Math.round(p * 100)}%` }))
      return { text: `Restored ${data.meals.length} meals, ${data.exercises.length} workouts and ${data.weights.length} weigh-ins.` }
    })

  return (
    <Card id="data">
      <CardHeader icon={ShieldCheck} title="Your data" subtitle="Download your whole log, or keep a backup you can restore" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="secondary" onClick={exportSheet} disabled={!!busy}>
          {busy === 'xlsx' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4 text-carbs" aria-hidden />}
          Spreadsheet (.xlsx)
        </Button>
        <Button variant="secondary" onClick={exportBackup} disabled={!!busy}>
          {busy === 'json' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <DatabaseBackup className="size-4 text-eat" aria-hidden />}
          Backup file
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={!!busy}>
          {busy === 'restore' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4 text-volt" aria-hidden />}
          Restore backup
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          pickBackup(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {pending && (
        <div className="mt-3 rounded-xl bg-page p-3 text-sm ring-1 ring-volt/30">
          <p className="text-ink-2">
            Restore <b className="text-ink">{pending.name}</b>? It adds {pending.data.meals.length} meals, {pending.data.exercises.length} workouts and{' '}
            {pending.data.weights.length} weigh-ins to your log. Entries already here stay; ones with the same ID are replaced by the backup’s copy.
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="py-1.5" onClick={confirmRestore}>
              Restore
            </Button>
            <Button variant="secondary" className="py-1.5" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status && (
        <p role="status" className={`mt-3 text-sm ${status.error ? 'text-critical-ink' : 'text-ink-2'}`}>
          {status.text}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        The spreadsheet opens in Excel, Google Sheets or Numbers, with sheets for daily totals, meals, workouts, weight and water. The backup file restores
        everything, including usuals and uploaded menus.
      </p>
    </Card>
  )
}
