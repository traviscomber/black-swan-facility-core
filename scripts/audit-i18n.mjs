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
  ['binary-locale-map', /(?:label|labels|copy|text|messages|translations|statuses|names)\s*[:=][\s\S]{0,120}\ben\s*:\s*["'`][\s\S]{0,260}\bes\s*:\s*["'`]/g],
  ['legacy-deu-locale', /["']deu["']/g],
  ['english-fallback-in-de', /language\s*===\s*["']de["'][\s\S]{0,220}translations\.en/g],
]

const allowedBinaryFiles = new Set([
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

function countMatches(source, pattern) {
  const copy = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let count = 0
  while (copy.exec(source)) count += 1
  return count
}

function hasLocaleSignal(source) {
  return /\buseLanguage\s*\(/.test(source)
    || /\b(?:t|translate)\s*\(\s*["'`]/.test(source)
    || /from\s+["'][^"']*translations?[^"']*["']/.test(source)
    || /\b(?:en|es|de)\s*:\s*\{/.test(source)
}

function visibleLiteralCount(source) {
  const jsxText = countMatches(source, />\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñÄÖÜäöüß][^<>{}\n]{1,160})\s*</g)
  const visibleProps = countMatches(source, /\b(?:title|description|label|placeholder|aria-label|aria-description|alt|helperText|emptyText|message)\s*=\s*["'][A-Za-zÁÉÍÓÚÜÑáéíóúüñÄÖÜäöüß][^"']{1,180}["']/g)
  return jsxText + visibleProps
}

const allFiles = roots.flatMap(walk)
const findings = []
for (const file of allFiles) {
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

const pageFiles = walk('app').filter((file) => /\/(?:page|layout)\.(?:tsx|jsx|ts|js)$/.test(file))
const pageCoverage = pageFiles.map((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const literals = visibleLiteralCount(source)
  const localeSignal = hasLocaleSignal(source)
  const explicitlyMentionsDe = /["']de["']\s*:|\bde\s*:|===\s*["']de["']|\bdeTranslations\b/.test(source)
  return { file, literals, localeSignal, explicitlyMentionsDe }
})

const unwiredPages = pageCoverage.filter((item) => item.literals > 0 && !item.localeSignal)
const localeAwareWithoutGerman = pageCoverage.filter((item) => item.literals > 0 && item.localeSignal && !item.explicitlyMentionsDe)

const translationFiles = walk('lib/translations').filter((file) => !ignored.includes(file))
const binaryCatalogs = translationFiles.filter((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const hasEn = /\ben\s*:\s*\{/.test(source)
  const hasEs = /\bes\s*:\s*\{/.test(source)
  const hasDe = /\bde\s*:\s*\{/.test(source)
  return hasEn && hasEs && !hasDe
})

const byRule = Object.groupBy(findings, (item) => item.rule)
console.log(`\nPolyglot structural audit: ${findings.length} finding(s)`)
for (const [rule, items] of Object.entries(byRule)) {
  console.log(`\n[${rule}] ${items.length}`)
  for (const item of items) console.log(`- ${item.file}:${item.line} :: ${item.sample}`)
}

console.log(`\nPolyglot interior-page inventory: ${pageFiles.length} page/layout file(s)`)
console.log(`[unwired-interior-pages] ${unwiredPages.length}`)
for (const item of unwiredPages) console.log(`- ${item.file} :: ${item.literals} visible literal candidate(s), no locale signal`)
console.log(`\n[locale-aware-but-no-explicit-de] ${localeAwareWithoutGerman.length}`)
for (const item of localeAwareWithoutGerman) console.log(`- ${item.file} :: ${item.literals} visible literal candidate(s)`)
console.log(`\n[binary-translation-catalogs] ${binaryCatalogs.length}`)
for (const file of binaryCatalogs) console.log(`- ${file}`)

const blockingRules = new Set([
  'binary-es-locale',
  'binary-en-locale',
  'binary-locale-union',
  'binary-lang-normalizer',
  'binary-locale-normalizer',
  'binary-locale-map',
  'english-fallback-in-de',
])
const blocking = findings.filter((item) => blockingRules.has(item.rule))
const coverageBlocking = unwiredPages.length + localeAwareWithoutGerman.length + binaryCatalogs.length
if (blocking.length || coverageBlocking) {
  console.error(`\nBlocking: ${blocking.length} structural locale collapse(s) + ${coverageBlocking} interior/catalog coverage gap(s).`)
  console.error('A translated shell is not sufficient: every rendered page, dialog, state and locale catalog must support en/es/de before merge.')
  process.exitCode = 1
}
