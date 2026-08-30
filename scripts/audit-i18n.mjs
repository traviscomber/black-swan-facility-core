import fs from 'node:fs'
import path from 'node:path'

const roots = ['app', 'components', 'lib']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const ignored = [
  'lib/translations/legacy-generated.ts',
  'lib/translations/legacy-language-context.source.txt',
]

const rules = [
  ['binary-es-locale', /\blanguage\s*===\s*["']es["']/g],
  ['binary-en-locale', /\blanguage\s*===\s*["']en["']/g],
  ['legacy-deu-locale', /["']deu["']/g],
  ['english-fallback-in-de', /language\s*===\s*["']de["'][\s\S]{0,220}translations\.en/g],
]

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return extensions.has(path.extname(entry.name)) ? [absolute.replaceAll('\\', '/')] : []
  })
}

const findings = []
for (const file of roots.flatMap(walk)) {
  if (ignored.includes(file)) continue
  const source = fs.readFileSync(file, 'utf8')
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) {
      const line = source.slice(0, match.index).split('\n').length
      findings.push({ rule, file, line, sample: match[0].replace(/\s+/g, ' ').slice(0, 150) })
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1
    }
  }
}

const byRule = Object.groupBy(findings, (item) => item.rule)
console.log(`\nPolyglot i18n audit: ${findings.length} structural finding(s)`)
for (const [rule, items] of Object.entries(byRule)) {
  console.log(`\n[${rule}] ${items.length}`)
  for (const item of items) console.log(`- ${item.file}:${item.line} :: ${item.sample}`)
}

const blocking = findings.filter((item) => item.rule === 'english-fallback-in-de')
if (blocking.length) {
  console.error('\nBlocking: /de contains an explicit English fallback.')
  process.exitCode = 1
}
