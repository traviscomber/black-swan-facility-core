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
  ['binary-locale-union', /(?:Record|Partial<Record)<\s*["'](?:en|es)["']\s*\|\s*["'](?:en|es)["']/g],
  ['binary-lang-normalizer', /\blang(?:uage)?\s*=\s*language\s*===\s*["'](?:en|es)["']\s*\?\s*["'](?:en|es)["']\s*:\s*["'](?:en|es)["']/g],
  ['binary-locale-normalizer', /\blocale\s*=\s*(?:lang|language)\s*===\s*["'](?:en|es)["']\s*\?[^\n;]+:[^\n;]+/g],
  ['legacy-deu-locale', /["']deu["']/g],
  ['english-fallback-in-de', /language\s*===\s*["']de["'][\s\S]{0,220}translations\.en/g],
]

const allowedBinaryFiles = new Set([
  // Language switcher controls can legitimately compare the active language
  // against each explicit locale. They are not binary translation branches.
  'components/language-switcher.tsx',
])

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
    if (allowedBinaryFiles.has(file) && (rule === 'binary-es-locale' || rule === 'binary-en-locale')) continue
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) {
      const line = source.slice(0, match.index).split('\n').length
      findings.push({ rule, file, line, sample: match[0].replace(/\s+/g, ' ').slice(0, 180) })
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

const blockingRules = new Set([
  'binary-es-locale',
  'binary-en-locale',
  'binary-locale-union',
  'binary-lang-normalizer',
  'binary-locale-normalizer',
  'english-fallback-in-de',
])
const blocking = findings.filter((item) => blockingRules.has(item.rule))
if (blocking.length) {
  console.error(`\nBlocking: ${blocking.length} locale branch(es) still collapse /en /es /de into a two-language UI.`)
  console.error('Every user-facing branch must define all three selected locales explicitly before merge.')
  process.exitCode = 1
}
