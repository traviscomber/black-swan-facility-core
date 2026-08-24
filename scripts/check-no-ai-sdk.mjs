import { readdir, readFile } from "node:fs/promises"
import { extname, join, relative } from "node:path"

const root = process.cwd()
const roots = ["app", "components", "hooks", "lib"]
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const forbidden = [
  { label: "Vercel AI SDK package", pattern: /from\s+["']ai["']|require\(["']ai["']\)/ },
  { label: "Vercel AI SDK scoped package", pattern: /["']@ai-sdk\// },
]

const violations = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }
    if (!extensions.has(extname(entry.name))) continue
    const content = await readFile(absolute, "utf8")
    for (const rule of forbidden) {
      if (rule.pattern.test(content)) {
        violations.push(`${relative(root, absolute)}: ${rule.label}`)
      }
    }
  }
}

for (const sourceRoot of roots) await walk(join(root, sourceRoot))

if (violations.length) {
  console.error("AI SDK imports are forbidden. Use the direct OpenAI Responses API server client instead:\n")
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log("AI architecture check passed: no AI SDK imports found.")
