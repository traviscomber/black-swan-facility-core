import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"

const roots = ["app", "components", "lib"]
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"])
const stockHosts = ["images.unsplash.com", "source.unsplash.com", "images.pexels.com", "pixabay.com"]
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
    const rel = relative(process.cwd(), file)

    for (const host of stockHosts) {
      let index = source.indexOf(host)
      while (index >= 0) {
        findings.push({ severity: "BLOCK", type: "stock_remote", file: rel, line: lineOf(source, index), value: host })
        index = source.indexOf(host, index + host.length)
      }
    }

    const literalImage = /<(?:img|Image)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gms
    for (const match of source.matchAll(literalImage)) {
      const value = match[1]
      if (!allowedStaticPatterns.some(pattern => pattern.test(value))) {
        findings.push({ severity: "REVIEW", type: "literal_image_src", file: rel, line: lineOf(source, match.index ?? 0), value })
      }
    }

    const remoteImage = /https?:\/\/[^"'`\s)]+(?:\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?[^"'`\s)]*)?|\/storage\/v1\/object\/[^"'`\s)]+)/gim
    for (const match of source.matchAll(remoteImage)) {
      const value = match[0]
      if (!value.includes("supabase.co/storage/v1/object/public/orchard-crop-photos")) {
        findings.push({ severity: "REVIEW", type: "remote_image_literal", file: rel, line: lineOf(source, match.index ?? 0), value })
      }
    }
  }
}

const unique = Array.from(new Map(findings.map(item => [`${item.severity}|${item.type}|${item.file}|${item.line}|${item.value}`, item])).values())
console.log(`[image-audit] findings=${unique.length}`)
for (const item of unique) console.log(`[image-audit] ${item.severity} ${item.type} ${item.file}:${item.line} ${item.value}`)
console.log(`[image-audit] policy=Operational images should come from canonical metadata/data. Stock imagery is not authoritative.`)
