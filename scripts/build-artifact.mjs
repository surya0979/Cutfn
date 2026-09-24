// Turns dist/index.html into dist/artifact.html for publishing on claude.ai,
// where the platform supplies the <html>/<head>/<body> skeleton itself.
// Run after `vite build` (npm run build:artifact does both).
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]

const keep = head
  .split('\n')
  .map((line) => line.trim())
  // The skeleton already sets charset and viewport; app-install meta tags do nothing there.
  .filter((line) => line && !/charset=|name="viewport"|apple-mobile|mobile-web-app|theme-color/.test(line))
  .map((line) => line.replace(/<title>[^<]*<\/title>/, '<title>Cutfn</title>'))

writeFileSync('dist/artifact.html', [...keep, body.trim()].join('\n') + '\n')
console.log('wrote dist/artifact.html')
