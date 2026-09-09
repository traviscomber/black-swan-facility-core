import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"

const roots = ["app", "components", "lib"]
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"])
const stockHosts = ["images.unsplash.com", "source.unsplash.com", "unsplash.com/photos", "images.pexels.com", "pixabay.com"]
const nonOperationalFixtures = new Set([
  "components/orchard/orchard-visual-truth-policy.tsx",
  "components/orchard/orchard-shell-e2e-harness.tsx",
])
const stockRemoteBudgetByFile = new Map([
  ["app/orchard/crop-map/page.tsx", 3],
  ["app/orchard/crops/page.tsx", 2],
  ["app/orchard/field/advanced/page.tsx", 1],
  ["app/orchard/game-plan/page.tsx", 1],
  ["app/orchard/lifecycle/page.tsx", 2],
  ["app/orchard/nursery/advanced/page.tsx", 1],
  ["app/orchard/performance/page.tsx", 4],
  ["app/orchard/season-summary/advanced/page.tsx", 2],
  ["app/orchard/work/page.tsx", 8],
])
const allowedStaticPatterns = [
  /logo/i,
  /icon/i,
  /favicon/i,
  /flag/i,
  /avatar/i,
  /marker/i,
  /mapbox/i,
]

function extension(path) {
  const index = path.lastIndexOf(".")
  return index >= 0 ? path.slice(index) : ""
}

function normalizedRelative(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/")
}

async function walk(root) {
  const out = []
  for (const entry of await readdir(root)) {
    const path = join(root, entry)
    const info = await stat(path)
    if (info.isDirectory()) out.push(...await walk(path))
    else if (sourceExtensions.has(extension(path))) out.push(path)
  }
  return out
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length
}

const findings = []
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, "utf8")
    const rel = normalizedRelative(file)
    const auditOperationalImageUse = !nonOperationalFixtures.has(rel)

    if (auditOperationalImageUse) {
      for (const host of stockHosts) {
        let index = source.indexOf(host)
        while (index >= 0) {
          findings.push({ severity: "BLOCK", type: "stock_remote", file: rel, line: lineOf(source, index), value: host })
          index = source.indexOf(host, index + host.length)
        }
      }
    }

    const literalImage = /<(?:img|Image)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gms
    for (const match of source.matchAll(literalImage)) {
      const value = match[1]
      if (auditOperationalImageUse && !allowedStaticPatterns.some(pattern => pattern.test(value))) {
        findings.push({ severity: "REVIEW", type: "literal_image_src", file: rel, line: lineOf(source, match.index ?? 0), value })
      }
    }

    const remoteImage = /https?:\/\/[^"'`\s)]+(?:\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?[^"'`\s)]*)?|\/storage\/v1\/object\/[^"'`\s)]+)/gim
    for (const match of source.matchAll(remoteImage)) {
      const value = match[0]
      if (auditOperationalImageUse && !value.includes("supabase.co/storage/v1/object/public/orchard-crop-photos")) {
        findings.push({ severity: "REVIEW", type: "remote_image_literal", file: rel, line: lineOf(source, match.index ?? 0), value })
      }
    }
  }
}

const unique = Array.from(new Map(findings.map(item => [`${item.severity}|${item.type}|${item.file}|${item.line}|${item.value}`, item])).values())
const stockCounts = new Map()
for (const item of unique) {
  if (item.type !== "stock_remote") continue
  stockCounts.set(item.file, (stockCounts.get(item.file) ?? 0) + 1)
}

const stockBudgetDrift = []
const budgetFiles = new Set([...stockRemoteBudgetByFile.keys(), ...stockCounts.keys()])
for (const file of budgetFiles) {
  const count = stockCounts.get(file) ?? 0
  const budget = stockRemoteBudgetByFile.get(file) ?? 0
  if (count !== budget) stockBudgetDrift.push({ file, count, budget })
}

console.log(`[image-audit] findings=${unique.length}`)
for (const item of unique) console.log(`[image-audit] ${item.severity} ${item.type} ${item.file}:${item.line} ${item.value}`)
const stockDebt = Array.from(stockCounts.values()).reduce((sum, count) => sum + count, 0)
const stockBudget = Array.from(stockRemoteBudgetByFile.values()).reduce((sum, count) => sum + count, 0)
console.log(`[image-audit] stock-debt=${stockDebt}; locked-budget=${stockBudget}; any cleanup must lower the matching per-file budget in the same change`)
for (const { file, count, budget } of stockBudgetDrift) {
  const direction = count > budget ? "REGRESSION" : "BUDGET_NOT_RATCHETED"
  console.error(`[image-audit] ${direction} ${file}: stock_remote=${count}, locked budget=${budget}`)
}
console.log(`[image-audit] policy=Operational images should come from canonical metadata/data. Stock imagery is not authoritative.`)

if (stockBudgetDrift.length > 0) process.exitCode = 1
