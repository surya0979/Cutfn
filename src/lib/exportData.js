// Export the whole log: an .xlsx workbook to read or share (one sheet per
// kind of data) and a .json backup that "Restore" can load back in.
//
// The .xlsx is written by hand: a zip (stored, no compression) of the few
// XML parts Excel, Google Sheets and Numbers need. No library required.

import { dailyTotals } from './insights.js'
import { SECTION_LABEL, sectionOf } from './sections.js'
import { kmToMi } from './units.js'
import { exerciseBurn } from './exercise.js'
import { resolveBodyWeight } from './weight.js'
import { toDateKey } from './dates.js'

// ── zip (store method) ────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zipStore(files) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name)
    const data = typeof content === 'string' ? enc.encode(content) : content
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(8, 0, true) // stored
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, data)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, nameBytes.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const dirSize = central.reduce((s, p) => s + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, dirSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0))
  let pos = 0
  for (const p of all) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

// ── xlsx ──────────────────────────────────────────────────────────
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // strip characters XML 1.0 forbids
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

const colName = (i) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function sheetXml(rows) {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v == null || v === '') return ''
          const ref = `${colName(c)}${r + 1}`
          const style = r === 0 ? ' s="1"' : ''
          return typeof v === 'number' && Number.isFinite(v)
            ? `<c r="${ref}"${style}><v>${Math.round(v * 100) / 100}</v></c>`
            : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const widths = (rows[0] ?? []).map((_, c) => {
    const longest = Math.max(...rows.map((row) => String(row[c] ?? '').length))
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(Math.max(longest + 2, 8), 48)}" customWidth="1"/>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${widths.length ? `<cols>${widths.join('')}</cols>` : ''}<sheetData>${body}</sheetData></worksheet>`
}

/** Build an .xlsx file from [{ name, rows }] where rows[0] is the header. */
export function buildWorkbook(sheets) {
  const ns = 'http://schemas.openxmlformats.org'
  const files = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)]),
  ]
  return zipStore(files)
}

// ── the tracker's sheets ──────────────────────────────────────────
const KIND_LABEL = { walk: 'Walk', run: 'Run', jumprope: 'Jump rope', football: 'Football', gym: 'Gym' }
const r1 = (n) => (n == null ? '' : Math.round(n * 10) / 10)

/** All of the tracker's data as workbook sheets. */
export function trackerSheets({ meals, exercises, weights, water, settings }) {
  const byDate = (a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0)
  const lb = settings.weightUnit === 'lb'
  const dates = [...meals, ...exercises, ...weights].map((x) => x.date).sort()
  const days = dates.length
    ? dailyTotals({ meals, exercises, weights, from: dates[0], to: dates.at(-1) }).filter((d) => d.entries || d.burned)
    : []

  return [
    {
      name: 'Daily totals',
      rows: [
        ['Date', 'Eaten (kcal)', 'Daily max (kcal)', 'Left / over (kcal)', 'Burned (kcal)', 'Protein (g)', 'Entries'],
        ...days.map((d) => [d.date, d.eaten, settings.targetKcal, settings.targetKcal - d.eaten, d.burned, r1(d.protein), d.entries]),
      ],
    },
    {
      name: 'Meals',
      rows: [
        ['Date', 'Time', 'Meal', 'Food', 'Portion', 'kcal', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Source'],
        ...[...meals].sort(byDate).map((m) => [
          m.date,
          m.createdAt ? new Date(m.createdAt).toTimeString().slice(0, 5) : '',
          SECTION_LABEL[sectionOf(m)],
          m.name,
          [m.servings && m.servings !== 1 ? `${m.servings}×` : '', m.portion ?? ''].join(' ').trim(),
          m.kcal,
          r1(m.protein),
          r1(m.carbs),
          r1(m.fat),
          m.source ?? '',
        ]),
      ],
    },
    {
      name: 'Workouts',
      rows: [
        ['Date', 'Activity', 'Distance (mi)', 'Minutes', 'Skips', 'Intensity', 'MET', 'kcal burned'],
        ...[...exercises].sort(byDate).map((e) => {
          const burn = exerciseBurn(e, resolveBodyWeight(weights, e.date).kg)
          return [
            e.date,
            KIND_LABEL[e.kind] ?? e.kind,
            e.distanceKm ? r1(kmToMi(e.distanceKm)) : '',
            r1(burn?.minutes),
            e.kind === 'jumprope' ? burn?.skips : '',
            e.level ?? e.intensity ?? '',
            r1(burn?.met),
            Math.round(burn?.kcal ?? 0),
          ]
        }),
      ],
    },
    {
      name: 'Weight',
      rows: [['Date', lb ? 'Weight (lb)' : 'Weight (kg)', 'Weight (kg)'], ...[...weights].sort(byDate).map((w) => [w.date, r1(lb ? w.kg / 0.45359237 : w.kg), r1(w.kg)])],
    },
    {
      name: 'Water',
      rows: [['Date', 'Glasses'], ...[...water].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.glasses])],
    },
  ]
}

export const BACKUP_VERSION = 1

export function backupJson(data) {
  return JSON.stringify({ app: 'cutfn', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data }, null, 1)
}

/** Validate a backup file; returns its data or throws a readable Error. */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a Cutfn backup (it isn’t valid JSON).')
  }
  if (data?.app !== 'cutfn') throw new Error('That file isn’t a Cutfn backup.')
  const list = (k) => (Array.isArray(data[k]) ? data[k].filter((x) => x && typeof x === 'object') : [])
  return {
    meals: list('meals').filter((m) => m.date && m.name && Number(m.kcal) >= 0),
    exercises: list('exercises').filter((e) => e.date && e.kind),
    weights: list('weights').filter((w) => w.date && Number(w.kg) > 0),
    water: list('water').filter((w) => w.date),
    savedMeals: list('savedMeals').filter((u) => u.name && Array.isArray(u.items)),
    menus: list('menus').filter((m) => m.weekStart && m.days),
    settings: data.settings && typeof data.settings === 'object' ? data.settings : null,
  }
}

export const exportFileName = (ext) => `cutfn-${toDateKey()}.${ext}`

/**
 * Save a file. On claude.ai the page asks the viewer through the
 * `downloads` capability; elsewhere a normal browser download.
 */
export async function saveFile(filename, data, mime) {
  if (typeof window.claude?.use === 'function') {
    const downloads = await window.claude.use('downloads').catch(() => null)
    if (downloads) {
      try {
        await downloads.save({ filename, data })
        return 'saved'
      } catch (err) {
        if (err?.code === 'declined') return 'declined'
        throw new Error('Couldn’t save the file here. Try again in a moment.')
      }
    }
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'saved'
}
