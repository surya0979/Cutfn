// Reads the text out of an .xlsx spreadsheet in the browser, with no library.
// An .xlsx file is a zip of XML files; this unzips just the parts it needs
// (shared strings and the first worksheet) using the built-in
// DecompressionStream, then returns every text cell, row by row.
//
// For weekly menu grids it skips the leftmost column (row labels like SOUP
// or DESSERT) and stops at the allergen legend, so only dishes come back.

const u16 = (b, o) => b[o] | (b[o + 1] << 8)
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

async function unzip(buffer, wanted) {
  const b = new Uint8Array(buffer)
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip')

  const files = {}
  let p = u32(b, eocd + 16)
  const count = u16(b, eocd + 10)
  for (let n = 0; n < count && u32(b, p) === 0x02014b50; n++) {
    const method = u16(b, p + 10)
    const size = u32(b, p + 20)
    const nameLen = u16(b, p + 28)
    const skip = nameLen + u16(b, p + 30) + u16(b, p + 32)
    const local = u32(b, p + 42)
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen))
    p += 46 + skip
    if (!wanted(name)) continue
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28)
    const raw = b.subarray(start, start + size)
    if (method === 0) files[name] = new TextDecoder().decode(raw)
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      files[name] = await new Response(stream).text()
    }
  }
  return files
}

const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)

/** Text cells of the first sheet, in reading order, as one line per cell. */
export async function readSpreadsheetText(file) {
  const files = await unzip(await file.arrayBuffer(), (name) => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  const sheetName = Object.keys(files)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort()[0]
  if (!sheetName) throw new Error('no worksheet')

  const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml')
  const textOf = (node) => [...node.getElementsByTagName('t')].map((t) => t.textContent).join('')
  const shared = files['xl/sharedStrings.xml'] ? [...parse(files['xl/sharedStrings.xml']).getElementsByTagName('si')].map(textOf) : []

  const cells = [...parse(files[sheetName]).getElementsByTagName('c')].map((c) => {
    const type = c.getAttribute('t')
    const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
    const text = type === 's' ? shared[Number(v)] : type === 'inlineStr' ? textOf(c) : v
    return { col: colIndex(c.getAttribute('r') || 'A'), text: (text ?? '').trim() }
  })

  const filled = cells.filter((c) => c.text)
  const firstCol = Math.min(...filled.map((c) => c.col))
  const multiColumn = filled.some((c) => c.col !== firstCol)
  const lines = []
  for (const cell of filled) {
    if (/allergic|allergen/i.test(cell.text)) break
    if (multiColumn && cell.col === firstCol) continue
    if (/^\*+$/.test(cell.text)) continue
    lines.push(cell.text.replace(/\s*\n\s*/g, ' '))
  }
  return lines.join('\n')
}
