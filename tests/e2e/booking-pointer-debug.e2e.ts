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
  const during = await page.getByTestId("booking-calendar-root").evaluate((element) => ({
    down: (element as HTMLElement).dataset.bookingPointerDebug ?? null,
    move: (element as HTMLElement).dataset.bookingPointerMoveDebug ?? null,
    grabbed: Array.from(document.querySelectorAll('[aria-grabbed="true"]')).map((item) => item.getAttribute("data-testid")),
  }))
  console.log("BOOKING_POINTER_DEBUG", JSON.stringify(during))
  await page.mouse.up()
} finally {
  await browser.close()
}
