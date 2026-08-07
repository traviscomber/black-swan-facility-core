import assert from "node:assert/strict"
import test from "node:test"
import { chromium, firefox, webkit, type BrowserType, type Page } from "playwright"

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

async function waitForHydration(page: Page) {
  const hydration = page.getByTestId("e2e-hydrated")
  await hydration.waitFor({ state: "visible" })
  await page.waitForFunction(
    () => document.querySelector('[data-testid="e2e-hydrated"]')?.textContent === "ready",
  )
  await page.getByTestId("booking-calendar-root").waitFor({ state: "visible" })
}

async function openHarness(page: Page) {
  await page.goto(`${baseURL}/bookings/e2e-harness`)
  await waitForHydration(page)
}

async function reloadHarness(page: Page) {
  await page.reload()
  await waitForHydration(page)
}

async function visibleBox(page: Page, selector: string) {
  const locator = page.locator(selector)
  await locator.waitFor({ state: "visible" })
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  assert.ok(box, `No bounding box for ${selector}`)
  return box
}

async function dragBy(page: Page, selector: string, deltaX: number, deltaY: number) {
  const box = await visibleBox(page, selector)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 })
  await page.mouse.up()
}

async function waitForAction(page: Page, prefix: string) {
  const action = page.getByTestId("e2e-last-action")
  await action.waitFor({ state: "visible" })
  await page.waitForFunction(
    ({ testId, expectedPrefix }) => {
      const element = document.querySelector(`[data-testid="${testId}"]`)
      return element?.textContent?.startsWith(expectedPrefix) ?? false
    },
    { testId: "e2e-last-action", expectedPrefix: prefix },
  )
  const value = await action.innerText()
  assert.ok(value.startsWith(prefix), `Expected action ${prefix}, received ${value}`)
  return value
}

function registerDesktopSuite(name: string, browserType: BrowserType) {
  if (!requestedBrowsers.has(name)) return

  test(`${name}: movimiento, teclado, swap, creación y undo`, async () => {
    const browser = await browserType.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
      await openHarness(page)

      await dragBy(page, `[data-testid="booking-reservation-${reservationAId}"]`, 92, 0)
      await waitForAction(page, "changed:")

      const undoButton = page.getByRole("button", { name: "Deshacer" })
      await undoButton.waitFor({ state: "visible" })
      await undoButton.click()
      await waitForAction(page, "undone:")

      await reloadHarness(page)
      const reservationA = page.getByTestId(`booking-reservation-${reservationAId}`)
      await reservationA.waitFor({ state: "visible" })
      await reservationA.scrollIntoViewIfNeeded()
      await reservationA.focus()
      await page.keyboard.press("Space")
      await page.keyboard.press("ArrowRight")
      await page.keyboard.press("Enter")
      await waitForAction(page, "changed:")

      await reloadHarness(page)
      const aSelector = `[data-testid="booking-reservation-${reservationAId}"]`
      const bSelector = `[data-testid="booking-reservation-${reservationBId}"]`
      const aBox = await visibleBox(page, aSelector)
      const bBox = await visibleBox(page, bSelector)
      page.once("dialog", (dialog) => void dialog.accept())
      await dragBy(
        page,
        aSelector,
        0,
        bBox.y + bBox.height / 2 - (aBox.y + aBox.height / 2),
      )
      await waitForAction(page, "swapped:")
      await page.waitForFunction(
        ({ testId, targetBedId }) => document.querySelector(`[data-testid="${testId}"]`)?.getAttribute("data-booking-bed-id") === targetBedId,
        { testId: `booking-reservation-${reservationAId}`, targetBedId: bedBId },
      )
      assert.equal(
        await page.getByTestId(`booking-reservation-${reservationAId}`).getAttribute("data-booking-bed-id"),
        bedBId,
      )

      await reloadHarness(page)
      const startSelector = `[data-testid="booking-cell-${emptyBedId}-2026-08-10"]`
      const endSelector = `[data-testid="booking-cell-${emptyBedId}-2026-08-12"]`
      const startBox = await visibleBox(page, startSelector)
      const endBox = await visibleBox(page, endSelector)
      await dragBy(
        page,
        startSelector,
        endBox.x + endBox.width / 2 - (startBox.x + startBox.width / 2),
        0,
      )
      assert.equal(
        await waitForAction(page, "create:"),
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
      await openHarness(page)
      const locator = page.getByTestId(`booking-reservation-${reservationAId}`)
      await locator.waitFor({ state: "visible" })
      await locator.scrollIntoViewIfNeeded()
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

      await waitForAction(page, "changed:")
    } finally {
      await browser.close()
    }
  })
}
