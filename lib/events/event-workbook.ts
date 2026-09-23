import * as XLSX from "xlsx"

type OperationalEvent = {
  id: string
  event_code: string
  name: string
  start_date: string
  end_date: string
  location_name: string | null
  status: string
  participant_count: number
  person_days: number | string | null
  estimated_total_clp: number | string | null
  actual_total_clp: number | string | null
  source_filename: string | null
  source_sha256: string | null
  source_version: string | null
  source_status: string | null
  notes: string | null
  source_event_id: string | null
}

type Participant = {
  participant_name: string
  accommodation_name: string | null
  room_name: string | null
  arrival_date: string | null
  arrival_time: string | null
  arrival_transport: string | null
  departure_date: string | null
  departure_time: string | null
  departure_transport: string | null
  planned_stay_days: number | string | null
  estimated_person_total_clp: number | string | null
  confirmation_status: string
  notes: string | null
  source_reference: string | null
}

type BudgetItem = {
  category: string
  item_name: string
  unit: string | null
  quantity: number | string | null
  estimated_unit_price_clp: number | string | null
  estimated_subtotal_clp: number | string | null
  actual_subtotal_clp: number | string | null
  cost_confidence: string | null
  procurement_status: string
  source_sheet: string | null
  source_row: number | null
}

type SourceEvent = Pick<OperationalEvent, "id" | "event_code" | "name" | "start_date" | "end_date"> | null

const SHOPPING_SHEETS = ["Bebestibles", "Carnes", "Vegetales", "Abarrotes", "Aseo"] as const

function number(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseCategory(notes: string | null) {
  const match = notes?.match(/Category:\s*([^|]+)/i)
  return match?.[1]?.trim() || "Adulto"
}

function parseDeposit(notes: string | null) {
  const match = notes?.match(/Deposit status from source:\s*([^|]+)/i)
  return match?.[1]?.trim() || ""
}

function cleanNotes(notes: string | null) {
  return (notes || "")
    .replace(/Category:\s*[^|]+\|?/i, "")
    .replace(/Deposit status from source:\s*[^|]+\|?/i, "")
    .replace(/\s*\|\s*/g, " · ")
    .trim()
}

function inclusiveDays(start: string | null, end: string | null, fallback: number | string | null) {
  if (start && end) {
    const a = new Date(start + "T00:00:00Z").getTime()
    const b = new Date(end + "T00:00:00Z").getTime()
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) return Math.round((b - a) / 86400000) + 1
  }
  return number(fallback)
}

function isConfirmed(status: string) {
  return status === "confirmed"
}

function participantWeights(participant: Participant) {
  const category = parseCategory(participant.notes)
  const days = inclusiveDays(participant.arrival_date, participant.departure_date, participant.planned_stay_days)
  if (!isConfirmed(participant.confirmation_status)) {
    return { category, days, food: 0, alcohol: 0, cleaning: 0, kitchen: 0 }
  }
  if (category.toLowerCase() === "fiesta") {
    return { category, days: 0, food: 0, alcohol: 1, cleaning: 1, kitchen: 0 }
  }
  if (category.toLowerCase().startsWith("ni")) {
    return { category, days, food: days * 0.5, alcohol: 0, cleaning: days, kitchen: days }
  }
  return { category, days, food: days, alcohol: days, cleaning: days, kitchen: days }
}

function applySheetDefaults(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }))
}

function asDateLabel(value: string | null) {
  return value || ""
}

function buildGuestSheet(event: OperationalEvent, participants: Participant[]) {
  const rows: (string | number)[][] = [
    [event.name + " — " + event.start_date + " al " + event.end_date],
    [],
    ["Nombre","Llegada","Hora Llegada","Salida","Hora Salida","Se hospeda en","Días estadía","Categoría","Días pond. Comida","Días pond. Alcohol","Días pond. Aseo/Bencina/Leña","Días pond. Cocina/Gas/Lavandería","Monto a pagar (CLP)","Notas","Deposito"],
  ]

  for (const participant of participants) {
    const w = participantWeights(participant)
    const lodging = [participant.accommodation_name, participant.room_name].filter(Boolean).join(" / ")
    const statusNote = isConfirmed(participant.confirmation_status) ? "" : "Pendiente de confirmación"
    const notes = [cleanNotes(participant.notes), statusNote].filter(Boolean).join(" · ")
    rows.push([
      participant.participant_name,
      asDateLabel(participant.arrival_date),
      participant.arrival_time?.slice(0,5) || "",
      asDateLabel(participant.departure_date),
      participant.departure_time?.slice(0,5) || "",
      lodging,
      w.days,
      w.category,
      w.food,
      w.alcohol,
      w.cleaning,
      w.kitchen,
      number(participant.estimated_person_total_clp),
      notes,
      parseDeposit(participant.notes),
    ])
  }

  const weights = participants.map(participantWeights)
  const confirmed = participants.filter((participant) => isConfirmed(participant.confirmation_status))
  rows.push([])
  rows.push(["Total personas", participants.length])
  rows.push(["Confirmados", confirmed.length])
  rows.push(["Pendientes", participants.length - confirmed.length])
  rows.push(["Días totales del evento", inclusiveDays(event.start_date,event.end_date,null)])
  rows.push(["Personas adultas confirmadas", weights.filter((w, index) => isConfirmed(participants[index].confirmation_status) && w.category.toLowerCase() === "adulto").length])
  rows.push(["Niños confirmados", weights.filter((w, index) => isConfirmed(participants[index].confirmation_status) && w.category.toLowerCase().startsWith("ni")).length])
  rows.push(["Total días-persona — COMIDA", weights.reduce((sum,w)=>sum+w.food,0)])
  rows.push(["Total días-persona — ALCOHOL", weights.reduce((sum,w)=>sum+w.alcohol,0)])
  rows.push(["Total días-persona — ASEO/BENCINA/LEÑA", weights.reduce((sum,w)=>sum+w.cleaning,0)])
  rows.push(["Total días-persona — COCINA/GAS/LAVANDERÍA", weights.reduce((sum,w)=>sum+w.kitchen,0)])
  rows.push(["Suma montos por persona", participants.reduce((sum,p)=>sum+number(p.estimated_person_total_clp),0)])

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applySheetDefaults(sheet,[28,13,12,13,12,28,12,13,18,18,24,26,20,48,16])
  return sheet
}

function buildKitchenLoadSheet(event: OperationalEvent, participants: Participant[]) {
  const rows: (string | number)[][] = [
    ["Carga de comensales por día — Hospitality / Carlos Bustamante"],
    [],
    ["Solo participantes confirmados. Excluye categoría Fiesta."],
    [],
    ["Fecha","Adultos","Niños","Total comensales"],
  ]
  const start = new Date(event.start_date + "T00:00:00Z")
  const end = new Date(event.end_date + "T00:00:00Z")
  for (let current = new Date(start); current <= end; current = new Date(current.getTime()+86400000)) {
    const day = current.toISOString().slice(0,10)
    let adults = 0
    let children = 0
    for (const participant of participants) {
      if (!isConfirmed(participant.confirmation_status) || !participant.arrival_date || !participant.departure_date) continue
      if (day < participant.arrival_date || day > participant.departure_date) continue
      const category = parseCategory(participant.notes).toLowerCase()
      if (category === "fiesta") continue
      if (category.startsWith("ni")) children += 1
      else adults += 1
    }
    rows.push([day,adults,children,adults+children])
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applySheetDefaults(sheet,[16,12,12,18])
  return sheet
}

function buildCategorySheet(event: OperationalEvent, sourceSheet: string, items: BudgetItem[]) {
  const filtered = items
    .filter((item) => item.source_sheet === sourceSheet)
    .sort((a,b)=>(a.source_row ?? 9999)-(b.source_row ?? 9999))

  const rows: (string | number)[][] = [
    [sourceSheet + " — " + event.name],
    [],
    ["Producto","Unidad","Cantidad baseline","Cantidad estimada","Precio unit. baseline/currente","Subtotal estimado","Precio Real","Subtotal Real"],
  ]

  for (const item of filtered) {
    const quantity = number(item.quantity)
    const estimatedUnit = number(item.estimated_unit_price_clp)
    const estimatedSubtotal = number(item.estimated_subtotal_clp)
    const actualSubtotal = item.actual_subtotal_clp == null ? "" : number(item.actual_subtotal_clp)
    const actualUnit = actualSubtotal === "" || quantity === 0 ? "" : number(actualSubtotal) / quantity
    rows.push([
      item.item_name,
      item.unit || "",
      quantity,
      quantity,
      estimatedUnit,
      estimatedSubtotal,
      actualUnit,
      actualSubtotal,
    ])
  }

  const estimatedTotal = filtered.reduce((sum,item)=>sum+number(item.estimated_subtotal_clp),0)
  const actualValues = filtered.filter((item)=>item.actual_subtotal_clp != null)
  const actualTotal = actualValues.length ? actualValues.reduce((sum,item)=>sum+number(item.actual_subtotal_clp),0) : ""
  rows.push([])
  rows.push(["TOTAL","","","","",estimatedTotal,"",actualTotal])

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applySheetDefaults(sheet,[42,15,18,18,26,20,18,20])
  return sheet
}

function buildSummarySheet(event: OperationalEvent, participants: Participant[], items: BudgetItem[], sourceEvent: SourceEvent) {
  const weights = participants.map(participantWeights)
  const categoryTotals = new Map<string,number>()
  for (const item of items) categoryTotals.set(item.category,(categoryTotals.get(item.category) || 0)+number(item.estimated_subtotal_clp))
  const staff = items.filter((item)=>item.category === "staff_and_operations").sort((a,b)=>(a.source_row ?? 9999)-(b.source_row ?? 9999))
  const shoppingTotal = ["beverages","proteins","vegetables","groceries","cleaning"].reduce((sum,key)=>sum+(categoryTotals.get(key)||0),0)
  const staffTotal = staff.reduce((sum,item)=>sum+number(item.estimated_subtotal_clp),0)
  const estimatedTotal = number(event.estimated_total_clp) || shoppingTotal + staffTotal
  const foodDays = weights.reduce((sum,w)=>sum+w.food,0)
  const rows: (string | number)[][] = [
    ["Presupuesto — " + event.name],
    [],
    ["Parámetros del evento"],
    ["Personas (total)",participants.length],
    ["Confirmados",participants.filter((participant)=>isConfirmed(participant.confirmation_status)).length],
    ["Días totales del evento",inclusiveDays(event.start_date,event.end_date,null)],
    ["Personas adultas confirmadas",weights.filter((w,index)=>isConfirmed(participants[index].confirmation_status)&&w.category.toLowerCase()==="adulto").length],
    ["Niños confirmados",weights.filter((w,index)=>isConfirmed(participants[index].confirmation_status)&&w.category.toLowerCase().startsWith("ni")).length],
    ["Peso niño en comida",0.5],
    ["Días-persona COMIDA",foodDays],
    ["Días-persona ALCOHOL",weights.reduce((sum,w)=>sum+w.alcohol,0)],
    ["Días-persona ASEO/BENCINA/LEÑA",weights.reduce((sum,w)=>sum+w.cleaning,0)],
    ["Días-persona COCINA/GAS/LAVANDERÍA",weights.reduce((sum,w)=>sum+w.kitchen,0)],
    [],
    ["Baseline / referencia",sourceEvent ? sourceEvent.name + " · " + sourceEvent.start_date + " — " + sourceEvent.end_date : event.source_filename || event.source_status || "Evento actual"],
    ["Source event code",sourceEvent?.event_code || event.event_code],
    [],
    ["Concepto","Monto Estimado (CLP)"],
    ["Bebestibles y alcohol",categoryTotals.get("beverages")||0],
    ["Carnes y proteínas",categoryTotals.get("proteins")||0],
    ["Vegetales",categoryTotals.get("vegetables")||0],
    ["Abarrotes y congelados",categoryTotals.get("groceries")||0],
    ["Aseo e higiene",categoryTotals.get("cleaning")||0],
    ["Subtotal lista de compras",shoppingTotal],
    [],
    ["Concepto","Precio unitario (CLP)","Unidad","Cantidad","Subtotal (CLP)","Responsable / estado"],
  ]
  for (const item of staff) {
    rows.push([
      item.item_name,
      number(item.estimated_unit_price_clp),
      item.unit || "",
      number(item.quantity),
      number(item.estimated_subtotal_clp),
      item.procurement_status || "",
    ])
  }
  rows.push(["Subtotal personal y otros gastos","","","",staffTotal])
  rows.push([])
  rows.push(["TOTAL GENERAL ESTIMADO",estimatedTotal])
  rows.push(["Monto estimado por día-persona comida",foodDays ? estimatedTotal/foodDays : 0])
  rows.push(["TOTAL REAL",event.actual_total_clp == null ? "" : number(event.actual_total_clp)])
  rows.push([])
  rows.push(["Trazabilidad",event.event_code])
  rows.push(["Fuente",event.source_filename || "Black Swan canonical event"])
  rows.push(["SHA-256 fuente",event.source_sha256 || ""])
  rows.push(["Estado fuente",event.source_status || ""])
  rows.push(["Notas",event.notes || ""])

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  applySheetDefaults(sheet,[58,26,18,18,22,36])
  return sheet
}

export function buildOperationalEventWorkbook(
  event: OperationalEvent,
  participants: Participant[],
  items: BudgetItem[],
  sourceEvent: SourceEvent,
) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, buildGuestSheet(event,participants), "Invitados")
  XLSX.utils.book_append_sheet(workbook, buildSummarySheet(event,participants,items,sourceEvent), "Resumen")
  XLSX.utils.book_append_sheet(workbook, buildKitchenLoadSheet(event,participants), "Carga Cocina")
  for (const sheetName of SHOPPING_SHEETS) {
    XLSX.utils.book_append_sheet(workbook, buildCategorySheet(event,sheetName,items), sheetName)
  }
  workbook.Props = {
    Title: event.name,
    Subject: "Black Swan canonical event export",
    Author: "Black Swan Facility Core",
    Company: "Black Swan",
    Comments: "Generated from canonical application data. Excel is an export snapshot, not the source of truth.",
  }
  return XLSX.write(workbook,{bookType:"xlsx",type:"buffer",compression:true})
}
