import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTaskNotificationMessage,
  getTaskNotificationCapabilities,
  normalizeChileWhatsappNumber,
  prepareTaskNotification,
} from "../lib/notifications/task-notification.ts"

const payload = {
  recipientName: "María",
  recipientPhone: "+56 9 1234 5678",
  taskId: "11111111-1111-1111-1111-111111111111",
  title: "Revisar bebederos",
  description: "Confirmar flujo y limpieza.",
  status: "nueva" as const,
  priority: "alta" as const,
  dueDate: "2026-07-28",
  locationName: "Potrero norte",
  taskUrl: "https://blackswanfc.vercel.app/tasks?selected=11111111-1111-1111-1111-111111111111",
}

test("normaliza teléfonos chilenos sin duplicar el código país", () => {
  assert.equal(normalizeChileWhatsappNumber("+56 9 1234 5678"), "56912345678")
  assert.equal(normalizeChileWhatsappNumber("9 1234 5678"), "56912345678")
  assert.equal(normalizeChileWhatsappNumber("056912345678"), "56912345678")
})

test("construye un mensaje operativo en español con seguimiento", () => {
  const message = buildTaskNotificationMessage(payload)
  assert.match(message, /Hola María,/)
  assert.match(message, /\*Revisar bebederos\*/)
  assert.match(message, /Estado: Pendiente/)
  assert.match(message, /Prioridad: Alta/)
  assert.match(message, /Fecha objetivo: 28 de julio de 2026/)
  assert.match(message, /Lugar: Potrero norte/)
  assert.match(message, /Seguimiento: https:\/\/blackswanfc\.vercel\.app\/tasks\?selected=/)
})

test("prepara WhatsApp Web como envío manual y codifica el mensaje", () => {
  const notification = prepareTaskNotification(payload)
  assert.equal(notification.provider, "whatsapp_web")
  assert.equal(notification.mode, "manual")
  assert.equal(notification.recipient, "56912345678")
  assert.match(notification.href, /^https:\/\/wa\.me\/56912345678\?text=/)
  assert.ok(notification.href.includes(encodeURIComponent("Revisar bebederos")))
})

test("mantiene GreenAPI desactivado hasta configurar credenciales y reglas", () => {
  assert.throws(
    () => prepareTaskNotification(payload, "greenapi"),
    /GreenAPI aún no está configurado/,
  )
})

test("declara capacidades reales sin prometer automatización", () => {
  assert.deepEqual(getTaskNotificationCapabilities(), {
    activeProvider: "whatsapp_web",
    automaticDelivery: false,
    requiresUserConfirmation: true,
    futureProvider: "greenapi",
  })
})
