import fs from 'node:fs'
import path from 'node:path'

const roots = ['app', 'components', 'lib']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const ignored = [
  'lib/translations/legacy-generated.ts',
  'lib/translations/legacy-language-context.source.txt',
]

const rules = [
  // Advisory only: a raw locale comparison is not by itself a two-locale collapse.
  ['locale-es-comparison', /\blanguage\s*===\s*["']es["']/g],
  ['locale-en-comparison', /\blanguage\s*===\s*["']en["']/g],
  // A locale comparison used directly as a two-way UI ternary is a real collapse.
  ['binary-es-ternary', /\blanguage\s*===\s*["']es["']\s*\?[^\n;]{1,320}:[^\n;]{1,320}/g],
  ['binary-en-ternary', /\blanguage\s*===\s*["']en["']\s*\?[^\n;]{1,320}:[^\n;]{1,320}/g],
  // Match only exact two-locale unions. Do not match the en|es prefix of en|es|de.
  ['binary-locale-union', /(?:Record<\s*(?:["']en["']\s*\|\s*["']es["']|["']es["']\s*\|\s*["']en["'])\s*>|Partial<Record<\s*(?:["']en["']\s*\|\s*["']es["']|["']es["']\s*\|\s*["']en["'])\s*>>)/g],
  ['binary-lang-normalizer', /\blang(?:uage)?\s*=\s*language\s*===\s*["'](?:en|es)["']\s*\?\s*["'](?:en|es)["']\s*:\s*["'](?:en|es)["']/g],
  ['binary-locale-normalizer', /\blocale\s*=\s*(?:lang|language)\s*===\s*["']es["']\s*\?\s*["']es-CL["']\s*:\s*["']en-US["']|\blocale\s*=\s*(?:lang|language)\s*===\s*["']en["']\s*\?\s*["']en-US["']\s*:\s*["']es-CL["']/g],
  ['legacy-deu-locale', /["']deu["']/g],
  ['english-fallback-in-de', /language\s*===\s*["']de["'][\s\S]{0,220}translations\.en/g],
]

const allowedBinaryFiles = new Set([
  // Locale equality here only controls the selected-button visual variant.
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

function sourceExplicitlySupportsGerman(source) {
  return /["']de["']\s*:|\bde\s*:|===\s*["']de["']|\bdeTranslations\b/.test(source)
    || /Record<\s*["']en["']\s*\|\s*["']es["']\s*\|\s*["']de["']/.test(source)
    || /Record<\s*["']de["']\s*\|\s*["']es["']\s*\|\s*["']en["']/.test(source)
}

function resolveImportFile(fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = specifier.slice(2)
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier)
  else return null

  const normalized = base.replaceAll('\\', '/')
  const candidates = path.extname(normalized)
    ? [normalized]
    : [...extensions].map((extension) => `${normalized}${extension}`).concat([...extensions].map((extension) => `${normalized}/index${extension}`))
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function importedTranslationSupportsGerman(source, file) {
  const importPattern = /from\s+["']([^"']*translations?[^"']*)["']/g
  let match
  while ((match = importPattern.exec(source))) {
    const importedFile = resolveImportFile(file, match[1])
    if (!importedFile || ignored.includes(importedFile)) continue
    const importedSource = fs.readFileSync(importedFile, 'utf8')
    if (sourceExplicitlySupportsGerman(importedSource)) return true
  }
  return false
}

function explicitlySupportsGerman(source, file) {
  return sourceExplicitlySupportsGerman(source) || importedTranslationSupportsGerman(source, file)
}

function visibleLiteralCount(source) {
  const jsxText = countMatches(source, />\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñÄÖÜäöüß][^<>{}\n]{1,160})\s*</g)
  const visibleProps = countMatches(source, /\b(?:title|description|label|placeholder|aria-label|aria-description|alt|helperText|emptyText|message)\s*=\s*["'][A-Za-zÁÉÍÓÚÜÑáéíóúüñÄÖÜäöüß][^"']{1,180}["']/g)
  return jsxText + visibleProps
}

function objectAt(source, anchorIndex) {
  const open = source.indexOf('{', anchorIndex)
  if (open < 0 || open - anchorIndex > 500) return null
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, index + 1)
    }
  }
  return null
}

function hasBinaryLocaleMap(source, index) {
  const object = objectAt(source, index)
  if (!object) return false
  const hasEn = /\ben\s*:\s*(?:\{|["'`])/.test(object)
  const hasEs = /\bes\s*:\s*(?:\{|["'`])/.test(object)
  const hasDe = /\bde\s*:\s*(?:\{|["'`])/.test(object)
  return hasEn && hasEs && !hasDe
}

function ternaryHasGermanBranch(source, index) {
  // Inspect both sides of the match. A valid nested ternary may test German
  // before the Spanish/English branch (de ? de : es ? es : en) or after it.
  const sample = source.slice(Math.max(0, index - 500), index + 900)
  return /\blanguage\s*===\s*["']de["']/.test(sample)
}

const allFiles = roots.flatMap(walk)
const findings = []
for (const file of allFiles) {
  if (ignored.includes(file)) continue
  const source = fs.readFileSync(file, 'utf8')
  for (const [rule, pattern] of rules) {
    const isLocaleComparison = rule === 'locale-es-comparison' || rule === 'locale-en-comparison'
    const isBinaryTernary = rule === 'binary-es-ternary' || rule === 'binary-en-ternary'
    if (allowedBinaryFiles.has(file) && (isLocaleComparison || isBinaryTernary)) continue
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) {
      if (isBinaryTernary && ternaryHasGermanBranch(source, match.index)) continue
      const line = source.slice(0, match.index).split('\n').length
      findings.push({ rule, file, line, sample: match[0].replace(/\s+/g, ' ').slice(0, 180) })
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1
    }
  }

  const localeMapAnchor = /(?:label|labels|copy|text|messages|translations|statuses|names)\s*[:=]/g
  let mapMatch
  while ((mapMatch = localeMapAnchor.exec(source))) {
    if (!hasBinaryLocaleMap(source, mapMatch.index)) continue
    const line = source.slice(0, mapMatch.index).split('\n').length
    findings.push({ rule: 'binary-locale-map', file, line, sample: source.slice(mapMatch.index, mapMatch.index + 180).replace(/\s+/g, ' ') })
  }
}

const pageFiles = walk('app').filter((file) => /\/(?:page|layout)\.(?:tsx|jsx|ts|js)$/.test(file))
const pageCoverage = pageFiles.map((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const literals = visibleLiteralCount(source)
  const localeSignal = hasLocaleSignal(source)
  const explicitlyMentionsDe = explicitlySupportsGerman(source, file)
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
  'binary-es-ternary',
  'binary-en-ternary',
  'binary-locale-union',
  'binary-lang-normalizer',
  'binary-locale-normalizer',
  'binary-locale-map',
  'english-fallback-in-de',
])
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