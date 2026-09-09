import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("../components/orchard/orchard-ai-dock.tsx", import.meta.url), "utf8")

test("Orchard AI dock respects mobile safe area and touch target minimums", () => {
  assert.match(source, /bottom-\[calc\(1\.25rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(source, /bottom-\[calc\(\.75rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(source, /max-h-\[calc\(78dvh-env\(safe-area-inset-bottom\)\)\]/)
  assert.match(source, /aria-label=\{text\.clear\}[\s\S]*?h-11 w-11/)
  assert.match(source, /aria-label=\{text\.close\}[\s\S]*?h-11 w-11/)
  assert.match(source, /aria-label=\{text\.send\}[\s\S]*?h-11 w-11/)
  assert.match(source, /className="min-h-12[\s\S]*?text-base[\s\S]*?sm:text-sm"/)
  assert.match(source, /className="mt-2 flex min-h-11 items-center justify-center/)
})
