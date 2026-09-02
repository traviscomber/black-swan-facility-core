import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import "./operations-control-plane-contract.test.ts"

const layout = readFileSync(new URL("../app/os/layout.tsx", import.meta.url), "utf8")
const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
const clientProviders = readFileSync(new URL("../components/client-providers.tsx", import.meta.url), "utf8")
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

test("all OS routes inherit the common AppLayout shell", () => {
  assert.match(layout, /AppLayout/)
  assert.match(layout, /<AppLayout>\{children\}<\/AppLayout>/)
})

test("BSFC is permanently dark across the root shell and client runtime", () => {
  assert.match(rootLayout, /className="dark notranslate"/)
  assert.match(rootLayout, /data-theme="dark"/)
  assert.match(rootLayout, /colorScheme:\s*"dark"/)
  assert.match(rootLayout, /themeColor:\s*"#171512"/)
  assert.match(rootLayout, /"color-scheme":\s*"dark"/)
  assert.doesNotMatch(rootLayout, /prefers-color-scheme:\s*light/)

  assert.match(clientProviders, /classList\.add\("dark"\)/)
  assert.match(clientProviders, /dataset\.theme\s*=\s*"dark"/)
  assert.match(clientProviders, /style\.colorScheme\s*=\s*"dark"/)
  assert.match(clientProviders, /<Toaster theme="dark"/)

  assert.match(globalStyles, /:root,\s*\n\.dark\s*\{/)
  assert.match(globalStyles, /--bs-bg-primary:\s*#171512/)
  assert.match(globalStyles, /body\s*\{[\s\S]*background:\s*var\(--bs-bg-primary\)/)
})
