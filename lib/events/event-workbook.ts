import JSZip from "jszip"

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
type Cell = string | number
type SheetSpec = { name: string; rows: Cell[][] }

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
  if (!isConfirmed(participant.confirmation_status)) return { category, days, food: 0, alcohol: 0, cleaning: 0, kitchen: 0 }
  if (category.toLowerCase() === "fiesta") return { category, days: 0, food: 0, alcohol: 1, cleaning: 1, kitchen: 0 }
  if (category.toLowerCase().startsWith("ni")) return { category, days, food: days * 0.5, alcohol: 0, cleaning: days, kitchen: days }
  return { category, days, food: days, alcohol: days, cleaning: days, kitchen: days }
}

function guestRows(event: OperationalEvent, participants: Participant[]): Cell[][] {
  const rows: Cell[][] = [
    [event.name + " — " + event.start_date + " al " + event.end_date],
    [],
    ["Nombre","Llegada","Hora Llegada","Salida","Hora Salida","Se hospeda en","Días estadía","Categoría","Días pond. Comida","Días pond. Alcohol","Días pond. Aseo/Bencina/Leña","Días pond. Cocina/Gas/Lavandería","Monto a pagar (CLP)","Notas","Deposito"],
  ]
  for (const participant of participants) {
    const w = participantWeights(participant)
    const lodging = [participant.accommodation_name, participant.room_name].filter(Boolean).join(" / ")
    const statusNote = isConfirmed(participant.confirmation_status) ? "" : "Pendiente de confirmación"
    rows.push([
      participant.participant_name,
      participant.arrival_date || "",
      participant.arrival_time?.slice(0,5) || "",
      participant.departure_date || "",
      participant.departure_time?.slice(0,5) || "",
      lodging,
      w.days,
      w.category,
      w.food,
      w.alcohol,
      w.cleaning,
      w.kitchen,
      number(participant.estimated_person_total_clp),
      [cleanNotes(participant.notes), statusNote].filter(Boolean).join(" · "),
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
  return rows
}

function kitchenRows(event: OperationalEvent, participants: Participant[]): Cell[][] {
  const rows: Cell[][] = [
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
    rows.push([day, adults, children, adults + children])
  }
  return rows
}

function categoryRows(event: OperationalEvent, sourceSheet: string, items: BudgetItem[]): Cell[][] {
  const filtered = items.filter((item) => item.source_sheet === sourceSheet).sort((a,b)=>(a.source_row ?? 9999)-(b.source_row ?? 9999))
  const rows: Cell[][] = [
    [sourceSheet + " — " + event.name],
    [],
    ["Producto","Unidad","Cantidad baseline","Cantidad estimada","Precio unit. baseline/currente","Subtotal estimado","Precio Real","Subtotal Real"],
  ]
  for (const item of filtered) {
    const quantity = number(item.quantity)
    const estimatedUnit = number(item.estimated_unit_price_clp)
    const estimatedSubtotal = number(item.estimated_subtotal_clp)
    const actualSubtotal = item.actual_subtotal_clp == null ? "" : number(item.actual_subtotal_clp)
    rows.push([
      item.item_name,
      item.unit || "",
      quantity,
      quantity,
      estimatedUnit,
      estimatedSubtotal,
      actualSubtotal === "" || quantity === 0 ? "" : number(actualSubtotal) / quantity,
      actualSubtotal,
    ])
  }
  const estimatedTotal = filtered.reduce((sum,item)=>sum+number(item.estimated_subtotal_clp),0)
  const actualValues = filtered.filter((item)=>item.actual_subtotal_clp != null)
  rows.push([])
  rows.push(["TOTAL","","","","",estimatedTotal,"",actualValues.length ? actualValues.reduce((sum,item)=>sum+number(item.actual_subtotal_clp),0) : ""])
  return rows
}

function summaryRows(event: OperationalEvent, participants: Participant[], items: BudgetItem[], sourceEvent: SourceEvent): Cell[][] {
  const weights = participants.map(participantWeights)
  const categoryTotals = new Map<string,number>()
  for (const item of items) categoryTotals.set(item.category,(categoryTotals.get(item.category) || 0)+number(item.estimated_subtotal_clp))
  const staff = items.filter((item)=>item.category === "staff_and_operations").sort((a,b)=>(a.source_row ?? 9999)-(b.source_row ?? 9999))
  const shoppingTotal = ["beverages","proteins","vegetables","groceries","cleaning"].reduce((sum,key)=>sum+(categoryTotals.get(key)||0),0)
  const staffTotal = staff.reduce((sum,item)=>sum+number(item.estimated_subtotal_clp),0)
  const estimatedTotal = number(event.estimated_total_clp) || shoppingTotal + staffTotal
  const foodDays = weights.reduce((sum,w)=>sum+w.food,0)
  const rows: Cell[][] = [
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
  for (const item of staff) rows.push([item.item_name,number(item.estimated_unit_price_clp),item.unit || "",number(item.quantity),number(item.estimated_subtotal_clp),item.procurement_status || ""])
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
  return rows
}

function xml(value: string) {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")
}

function colName(index: number) {
  let n = index + 1
  let out = ""
  while (n > 0) {
    const mod = (n - 1) % 26
    out = String.fromCharCode(65 + mod) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function worksheetXml(rows: Cell[][]) {
  const body = rows.map((row,rowIndex) => {
    const cells = row.map((value,colIndex) => {
      const ref = colName(colIndex) + String(rowIndex + 1)
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`
      const text = xml(String(value ?? ""))
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
    }).join("")
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

function workbookXml(sheets: SheetSpec[]) {
  const body = sheets.map((sheet,index) => `<sheet name="${xml(sheet.name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${body}</sheets></workbook>`
}

function workbookRelsXml(sheets: SheetSpec[]) {
  const rels = sheets.map((_,index) => `<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
}

function contentTypesXml(sheets: SheetSpec[]) {
  const sheetOverrides = sheets.map((_,index) => `<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`
}

export async function buildOperationalEventWorkbook(
  event: OperationalEvent,
  participants: Participant[],
  items: BudgetItem[],
  sourceEvent: SourceEvent,
) {
  const sheets: SheetSpec[] = [
    { name:"Invitados", rows:guestRows(event,participants) },
    { name:"Resumen", rows:summaryRows(event,participants,items,sourceEvent) },
    { name:"Carga Cocina", rows:kitchenRows(event,participants) },
    ...SHOPPING_SHEETS.map((name)=>({name,rows:categoryRows(event,name,items)})),
  ]

  const zip = new JSZip()
  zip.file("[Content_Types].xml", contentTypesXml(sheets))
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.folder("xl")?.file("workbook.xml", workbookXml(sheets))
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", workbookRelsXml(sheets))
  const worksheetFolder = zip.folder("xl")?.folder("worksheets")
  sheets.forEach((sheet,index)=>worksheetFolder?.file(`sheet${index+1}.xml`, worksheetXml(sheet.rows)))
  return zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}})
}
