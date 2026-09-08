import { mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import process from "node:process"
import { chromium } from "playwright"

const host = "127.0.0.1"
const port = 3101
const baseURL = `http://${host}:${port}`
const outputDir = process.env.VISUAL_QA_OUTPUT_DIR ?? "artifacts/visual-qa"
const harnessPath = "/bookings/e2e-harness"
const server = spawn("pnpm", ["dev", "--hostname", host, "--port", String(port)], {
  env: {
    ...process.env,
    E2E_CALENDAR_HARNESS: "1",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "e2e-anon-key",
  },
  stdio: "inherit",
  detached: process.platform !== "win32",
})

async function waitForServer() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Visual QA server exited with code ${server.exitCode}`)
    try {
      const response = await fetch(`${baseURL}${harnessPath}`, { redirect: "manual" })
      if (response.status === 200) return
    } catch {
      // The development server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  throw new Error("Visual QA server did not expose the deterministic harness within 90 seconds")
}

function stopServer() {
  if (!server.pid) return
  try {
    if (process.platform === "win32") server.kill("SIGTERM")
    else process.kill(-server.pid, "SIGTERM")
  } catch {
    server.kill("SIGTERM")
  }
}

async function capture(page, name, viewport) {
  const pageErrors = []
  const consoleErrors = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  await page.setViewportSize(viewport)
  await page.goto(`${baseURL}${harnessPath}`, { waitUntil: "networkidle" })
  await page.getByTestId("e2e-hydrated").waitFor({ state: "visible" })
  await page.waitForFunction(() => document.querySelector('[data-testid="e2e-hydrated"]')?.textContent === "ready")
  await page.getByTestId("booking-calendar-root").waitFor({ state: "visible" })
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true })
  return { name, viewport, url: page.url(), pageErrors, consoleErrors }
}

try {
  await mkdir(outputDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const captures = [
      await capture(page, "booking-calendar-desktop", { width: 1440, height: 960 }),
      await capture(page, "booking-calendar-mobile", { width: 390, height: 844 }),
    ]
    await writeFile(`${outputDir}/summary.json`, `${JSON.stringify({ baseURL, captures }, null, 2)}\n`)
    const failures = captures.flatMap((capture) => [...capture.pageErrors, ...capture.consoleErrors])
    if (failures.length > 0) throw new Error(`Visual QA detected browser errors: ${failures.join(" | ")}`)
  } finally {
    await browser.close()
  }
} finally {
  stopServer()
}
