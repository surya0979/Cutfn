// Brutalist rule check for one or more .jsx files (DESIGN.md).
// 1) Each file must parse on its own (JSX syntax).
// 2) No class or import that breaks the absolute rules.
// Usage: node scripts/check-brutal.mjs src/components/Closet.jsx [...]
// Exit code 1 when anything fails. Red (accent) uses are listed for review.
import { readFileSync } from 'node:fs'
import { transformSync } from 'rolldown/experimental'

const RULES = [
  [/@phosphor-icons|lucide-react|<svg\b/, 'icon library or inline SVG (rule 4: no icons)'],
  [/\brounded(-[a-z0-9[\]./]+)?\b(?<!rounded-none)/, 'border-radius class (rule 2)'],
  [/\bshadow-(?!none)[a-z0-9[]/, 'shadow class (rule 3)'],
  [/\b(bg-gradient|bg-linear|bg-radial|bg-conic|from-|via-|to-(?!do))[a-z[]/, 'gradient class (rule 3)'],
  [/\b(backdrop-|blur-|blur\b)/, 'blur / glass (rule 3)'],
  [/\bring(-[a-z0-9[]+)?\b/, 'ring outline (use 4px borders)'],
  [/\b(transition|duration-|ease-)/, 'smooth transition (rule 5: nothing smooth)'],
  [/\bborder(-[trblxys])?(?=[\s"'`}])/, '1px border (rule 1: borders are border-4)'],
  [/\bborder(-[trblxys])?-(?:2|8|\[[^\]]+\])/, 'non-4px border width (rule 1)'],
  [/className=\{?[`'"][^`'"]*\b(font-display|condensed|label)\b/, 'class from the previous design system'],
  [/[—–]/, 'em or en dash (rule 10)'],
]

let failed = false
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const out = transformSync(file, src)
  if (out.errors?.length) {
    failed = true
    console.log(`✗ ${file}: does not parse`)
    for (const e of out.errors) console.log(`    ${e.message ?? e}`)
    continue
  }
  const problems = []
  const reds = []
  src.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '')
    if (/^\s*(\*|\/\*)/.test(line)) return
    for (const [re, why] of RULES) if (re.test(code)) problems.push(`  line ${i + 1}: ${why}\n      ${line.trim().slice(0, 140)}`)
    if (/\b(bg|text|border)-accent\b|variant="primary"|\bred\b(?=[\s"'`])/.test(code)) reds.push(`  line ${i + 1}: ${line.trim().slice(0, 120)}`)
  })
  if (problems.length) failed = true
  console.log(`${problems.length ? '✗' : '✓'} ${file}${problems.length ? '' : ' passes the rules'}`)
  problems.forEach((p) => console.log(p))
  if (reds.length) {
    console.log(`  red used ${reds.length}× (allowed: the screen's ONE main CTA + ONE number per section):`)
    reds.forEach((r) => console.log(r))
  }
}
process.exit(failed ? 1 : 0)
