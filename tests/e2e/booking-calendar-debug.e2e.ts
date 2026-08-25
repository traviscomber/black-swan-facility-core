import assert from "node:assert/strict"
import test from "node:test"
import { chromium } from "playwright"

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100"
const reservationAId = "00000000-0000-0000-0000-000000000401"

async function state(page: import("playwright").Page, label: string) {
  const value = await page.evaluate(() => ({
    drag: Reflect.get(window, "__bookingDragDebug") ?? null,
    grabbed: Array.from(document.querySelectorAll('[aria-grabbed="true"]')).map((el) => el.getAttribute("data-testid")),
    action: document.querySelector('[data-testid="e2e-last-action"]')?.textContent ?? null,
  }))
  console.log(`CHECKPOINT ${label} ${JSON.stringify(value)}`)
  return value
}

test("chromium pointer session checkpoints", async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
    await page.goto(`${baseURL}/bookings/e2e-harness`)
    await page.getByTestId("e2e-hydrated").waitFor({ state: "visible" })
    await page.waitForFunction(() => document.querySelector('[data-testid="e2e-hydrated"]')?.textContent === "ready")
    const locator = page.getByTestId(`booking-reservation-${reservationAId}`)
    await locator.waitFor({ state: "visible" })
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    assert.ok(box)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await page.mouse.move(x, y)
    await state(page, "before-down")
    await page.mouse.down()
    await state(page, "after-down")
    await page.mouse.move(x + 10, y)
    await state(page, "after-move-10")
    await page.mouse.move(x + 92, y)
    await state(page, "after-move-92")
    await page.mouse.up()
    await state(page, "after-up")
  } finally {
    await browser.close()
  }
})
