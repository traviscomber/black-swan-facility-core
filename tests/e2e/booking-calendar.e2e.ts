import assert from "node:assert/strict"
import test from "node:test"
import { chromium, firefox, webkit, type BrowserType } from "playwright"

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100"
const requestedBrowsers = new Set(
  (process.env.E2E_BROWSERS ?? "chromium,firefox,webkit")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)

const reservationAId = "00000000-0000-0000-0000-000000000401"
const reservationBId = "00000000-0000-0000-0000-000000000402"
const bedBId = "00000000-0000-0000-0000-000000000302"
const emptyBedId = "00000000-0000-0000-0000-000000000303"

async function dragBy(page: import("playwright").Page, selector: string, deltaX: number, deltaY: number) {
  const locator = page.locator(selector)
  const box = await locator.boundingBox()
  assert.ok(box, `No bounding box for ${selector}`)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 8 })
  await page.mouse.up()
}

function registerDesktopSuite(name: string, browserType: BrowserType) {
  if (!requestedBrowsers.has(name)) return

  test(`${name}: movimiento, teclado, swap, creación y undo`, async () => {
    const browser = await browserType.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
    await page.goto(`${baseURL}/bookings/e2e-harness`)
    await page.getByTestId("booking-calendar-root").waitFor()

    await dragBy(page, `[data-testid="booking-reservation-${reservationAId}"]`, 92, 0)
    await page.getByTestId("e2e-last-action").waitFor()
    assert.match(await page.getByTestId("e2e-last-action").innerText(), /^changed:/)

    const undoButton = page.getByRole("button", { name: "Deshacer" })
    await undoButton.click()
    assert.match(await page.getByTestId("e2e-last-action").innerText(), /^undone:/)

    await page.reload()
    const reservationA = page.getByTestId(`booking-reservation-${reservationAId}`)
    await reservationA.focus()
    await page.keyboard.press("Space")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")
    assert.match(await page.getByTestId("e2e-last-action").innerText(), /^changed:/)

    await page.reload()
    const aBox = await page.getByTestId(`booking-reservation-${reservationAId}`).boundingBox()
    const bBox = await page.getByTestId(`booking-reservation-${reservationBId}`).boundingBox()
    assert.ok(aBox && bBox)
    page.once("dialog", (dialog) => void dialog.accept())
    await dragBy(
      page,
      `[data-testid="booking-reservation-${reservationAId}"]`,
      0,
      bBox.y + bBox.height / 2 - (aBox.y + aBox.height / 2),
    )
    assert.match(await page.getByTestId("e2e-last-action").innerText(), /^swapped:/)
    assert.equal(
      await page.getByTestId(`booking-reservation-${reservationAId}`).getAttribute("data-booking-bed-id"),
      bedBId,
    )

    await page.reload()
    const startCell = page.getByTestId(`booking-cell-${emptyBedId}-2026-08-10`)
    const endCell = page.getByTestId(`booking-cell-${emptyBedId}-2026-08-12`)
    const startBox = await startCell.boundingBox()
    const endBox = await endCell.boundingBox()
    assert.ok(startBox && endBox)
    await dragBy(
      page,
      `[data-testid="booking-cell-${emptyBedId}-2026-08-10"]`,
      endBox.x + endBox.width / 2 - (startBox.x + startBox.width / 2),
      0,
    )
      assert.equal(
        await page.getByTestId("e2e-last-action").innerText(),
        `create:${emptyBedId}:2026-08-10:2026-08-13`,
      )
    } finally {
      await browser.close()
    }
  })
}

registerDesktopSuite("chromium", chromium)
registerDesktopSuite("firefox", firefox)
registerDesktopSuite("webkit", webkit)

if (requestedBrowsers.has("chromium")) {
  test("chromium touch: long press activates movement", async () => {
    const browser = await chromium.launch()
    try {
      const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      isMobile: true,
    })
    const page = await context.newPage()
    await page.goto(`${baseURL}/bookings/e2e-harness`)
    const locator = page.getByTestId(`booking-reservation-${reservationAId}`)
    const box = await locator.boundingBox()
    assert.ok(box)
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2

    await locator.evaluate((element, point) => {
      element.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 77,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: point.x,
        clientY: point.y,
      }))
    }, { x: startX, y: startY })
    await page.waitForTimeout(380)
    await locator.evaluate((element, point) => {
      element.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 77,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: point.x + 92,
        clientY: point.y,
      }))
      element.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 77,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: point.x + 92,
        clientY: point.y,
      }))
    }, { x: startX, y: startY })

      await page.waitForTimeout(200)
      assert.match(await page.getByTestId("e2e-last-action").innerText(), /^changed:/)
    } finally {
      await browser.close()
    }
  })
}
