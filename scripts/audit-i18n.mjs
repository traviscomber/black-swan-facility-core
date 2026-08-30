import fs from 'node:fs'
import path from 'node:path'

const roots = ['app', 'components', 'lib']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const files = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (extensions.has(path.extname(entry.name))) files.push(full.replaceAll('\\', '/'))
  }
}
for (const root of roots) walk(root)

const findings = []
function addFinding(file, source, index, rule, sample) {
  const line = source.slice(0, index).split('\n').length
  findings.push({ file, line, rule, sample })
}

const rules = [
  { rule: 'binary-es-ternary', regex: /\blanguage\s*===?\s*['"]es['"]\s*\?/g },
  { rule: 'binary-en-ternary', regex: /\blanguage\s*===?\s*['"]en['"]\s*\?/g },
  { rule: 'locale-es-comparison', regex: /\blanguage\s*===?\s*['"]es['"]/g },
  { rule: 'locale-en-comparison', regex: /\blanguage\s*===?\s*['"]en['"]/g },
  { rule: 'legacy-deu-locale', regex: /['"]deu['"]/g },
  { rule: 'binary-locale-union', regex: /['"]en['"]\s*\|\s*['"]es['"]|['"]es['"]\s*\|\s*['"]en['"]/g },
  { rule: 'binary-lang-normalizer', regex: /language\s*===?\s*['"]es['"]\s*\?\s*['"]es['"]\s*:\s*['"]en['"]/g },
  { rule: 'binary-locale-normalizer', regex: /locale\s*===?\s*['"]es['"]\s*\?\s*['"]es['"]\s*:\s*['"]en['"]/g },
  { rule: 'english-fallback-in-de', regex: /\bde\b[^\n]{0,100}\?\?[^\n]{0,100}\ben\b/g },
]

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const { rule, regex } of rules) {
    regex.lastIndex = 0
    for (const match of source.matchAll(regex)) addFinding(file, source, match.index ?? 0, rule, match[0].slice(0, 140))
  }

  const localeMaps = source.matchAll(/(?:locale|language|lang)[A-Za-z0-9_]*\s*=\s*\{([\s\S]{0,800}?)\}/g)
  for (const match of localeMaps) {
    const body = match[1]
    if (/\ben\s*:/.test(body) && /\bes\s*:/.test(body) && !/\bde\s*:/.test(body)) addFinding(file, source, match.index ?? 0, 'binary-locale-map', match[0].slice(0, 140))
  }
}

const pageFiles = files.filter((file) => /(^|\/)app\/.*\/(page|layout)\.(t|j)sx?$/.test(file) || /^app\/(page|layout)\.(t|j)sx?$/.test(file))
const literalPattern = />\s*([^<{][^<{]{2,}?)\s*</g
const localeSignalPattern = /useLanguage\s*\(|\blanguage\b|\blocale\b|\btranslations?\b|\bcopy\b|\bCOPY\b|\bt\s*\(/
const ignoredLiteral = /^(?:[-–—•·|/\\]|\d+[\d.,:%\s-]*|[A-Z0-9_./:+-]{2,})$/

const pageInventory = pageFiles.map((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const literals = [...source.matchAll(literalPattern)].map((match) => match[1].replace(/\s+/g, ' ').trim()).filter((text) => text && !ignoredLiteral.test(text) && !text.includes('className=') && !text.includes('=>'))
  return { file, source, literals: literals.length, localeAware: localeSignalPattern.test(source) }
})
const unwiredPages = pageInventory.filter((item) => item.literals > 0 && !item.localeAware)
const localeAwareWithoutGerman = pageInventory.filter((item) => {
  if (!item.localeAware || item.literals === 0) return false
  if (/useLanguage\s*\(/.test(item.source) && /\bde\s*:/.test(item.source)) return false
  const hasEn = /\ben\s*:\s*\{/.test(item.source)
  const hasEs = /\bes\s*:\s*\{/.test(item.source)
  const hasDe = /\bde\s*:\s*\{/.test(item.source)
  return hasEn && hasEs && !hasDe
})

const binaryCatalogs = files.filter((file) => {
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

const blockingRules = new Set(['binary-es-ternary','binary-en-ternary','binary-locale-union','binary-lang-normalizer','binary-locale-normalizer','binary-locale-map','english-fallback-in-de'])
const blocking = findings.filter((item) => blockingRules.has(item.rule))
const orchardPath = (file) => file.startsWith('app/orchard/') || file.startsWith('components/orchard/')
const orchardBlocking = blocking.filter((item) => orchardPath(item.file))
const orchardUnwiredPages = unwiredPages.filter((item) => orchardPath(item.file))
const orchardLocaleAwareWithoutGerman = localeAwareWithoutGerman.filter((item) => orchardPath(item.file))
const orchardCoverageBlocking = orchardUnwiredPages.length + orchardLocaleAwareWithoutGerman.length
const globalCoverageBacklog = unwiredPages.length + localeAwareWithoutGerman.length + binaryCatalogs.length

console.log(`\nOrchard phase gate: ${orchardBlocking.length} structural locale collapse(s) + ${orchardCoverageBlocking} interior coverage gap(s).`)
console.log(`Global Polyglot backlog (reported, non-blocking during Orchard phase): ${blocking.length} structural locale collapse(s) + ${globalCoverageBacklog} interior/catalog coverage gap(s).`)
if (orchardBlocking.length || orchardCoverageBlocking) {
  console.error('Blocking Orchard phase: every Orchard page, dialog, state and locale catalog must support en/es/de before this phase can pass.')
  process.exitCode = 1
}
