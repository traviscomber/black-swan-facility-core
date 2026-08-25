import { chromium } from "playwright"

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100"
const reservationId = "00000000-0000-0000-0000-000000000401"

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  await page.goto(`${baseURL}/bookings/e2e-harness`)
  await page.waitForFunction(() => document.querySelector('[data-testid="e2e-hydrated"]')?.textContent === "ready")
  const reservation = page.getByTestId(`booking-reservation-${reservationId}`)
  await reservation.scrollIntoViewIfNeeded()
  const box = await reservation.boundingBox()
  if (!box) throw new Error("missing reservation box")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 92, y, { steps: 12 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector('[data-testid="e2e-last-action"]')?.textContent?.startsWith("changed:") ?? false)
  await page.waitForTimeout(250)
  const diagnostic = await page.evaluate(() => ({
    action: document.querySelector('[data-testid="e2e-last-action"]')?.textContent ?? null,
    toasterCount: document.querySelectorAll('[data-sonner-toaster]').length,
    toastCount: document.querySelectorAll('[data-sonner-toast]').length,
    buttons: Array.from(document.querySelectorAll('button')).map((button) => ({ text: button.textContent, aria: button.getAttribute('aria-label') })).filter((item) => item.text || item.aria),
    sonner: Array.from(document.querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')).map((element) => element.outerHTML),
    bodyText: document.body.innerText.slice(-1200),
  }))
  console.log("BOOKING_UNDO_DEBUG", JSON.stringify(diagnostic))
} finally {
  await browser.close()
}
