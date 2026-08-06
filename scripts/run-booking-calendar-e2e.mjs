import { spawn } from "node:child_process"
import process from "node:process"

const host = "127.0.0.1"
const port = 3100
const baseURL = `http://${host}:${port}`

const server = spawn("pnpm", ["dev", "--hostname", host, "--port", String(port)], {
  env: { ...process.env, E2E_CALENDAR_HARNESS: "1" },
  stdio: "inherit",
  detached: process.platform !== "win32",
})

async function waitForServer() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/bookings/e2e-harness`, { redirect: "manual" })
      if (response.status < 500) return
    } catch {
      // Development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  throw new Error("E2E development server did not start within 90 seconds")
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

try {
  await waitForServer()
  const runner = spawn(
    "node",
    ["--experimental-strip-types", "--test", "tests/e2e/booking-calendar.e2e.ts"],
    {
      env: { ...process.env, E2E_BASE_URL: baseURL },
      stdio: "inherit",
    },
  )
  const exitCode = await new Promise((resolve) => runner.on("exit", (code) => resolve(code ?? 1)))
  stopServer()
  process.exit(Number(exitCode))
} catch (error) {
  stopServer()
  console.error(error)
  process.exit(1)
}
