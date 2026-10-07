import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const sidebar = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
const install = readFileSync(new URL("../components/pwa-install-action.tsx", import.meta.url), "utf8")
const manifest = readFileSync(new URL("../app/manifest.ts", import.meta.url), "utf8")
const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8")

test("Black Swan exposes a cross-platform install action", () => {
  assert.match(sidebar, /PwaInstallAction/)
  assert.match(install, /beforeinstallprompt/)
  assert.match(install, /appinstalled/)
  assert.match(install, /Agregar a pantalla de inicio/)
  assert.match(install, /Instalar app/)
})

test("installed app opens the full operating system rather than a vertical", () => {
  assert.match(manifest, /id: "\/"/)
  assert.match(manifest, /start_url: "\/os"/)
  assert.match(manifest, /url: "\/my-tasks"/)
  assert.match(manifest, /url: "\/employees"/)
})

test("install service worker does not cache authenticated application data", () => {
  assert.match(serviceWorker, /skipWaiting/)
  assert.match(serviceWorker, /clients\.claim/)
  assert.doesNotMatch(serviceWorker, /caches\./)
  assert.doesNotMatch(serviceWorker, /fetch/)
})
