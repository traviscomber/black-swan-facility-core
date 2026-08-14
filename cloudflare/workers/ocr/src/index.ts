type JsonRecord = Record<string, unknown>

type OcrJob = {
  intake_id: string
  storage_key: string
  source_file_name: string
  content_type: string
  received_at: string
}

type QueueMessage<T> = {
  body: T
  ack(): void
  retry(): void
}

type QueueBatch<T> = {
  messages: QueueMessage<T>[]
}

type R2ObjectBody = {
  arrayBuffer(): Promise<ArrayBuffer>
}

type R2Bucket = {
  get(key: string): Promise<R2ObjectBody | null>
}

export interface Env {
  ENVIRONMENT: string
  MODEL_PROVIDER: string
  MODEL_NAME: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  OCR_MACHINE_TOKEN?: string
  DOCUMENT_AI_ENDPOINT?: string
  DOCUMENT_AI_TOKEN?: string
  DOCUMENTS_BUCKET: R2Bucket
}

type ExtractionProposal = {
  raw_ocr_text: string | null
  raw_extraction: JsonRecord
  proposed_document_type: string | null
  proposed_legal_entity_id: string | null
  proposed_counterparty_id: string | null
  proposed_document_number: string | null
  proposed_document_date: string | null
  proposed_due_date: string | null
  proposed_currency: string | null
  proposed_net_amount: number | null
  proposed_tax_amount: number | null
  proposed_total_amount: number | null
  proposed_direction: string | null
  proposed_department_id: string | null
  proposed_cost_center_id: string | null
  proposed_account_code: string | null
  confidence: number | null
}

type ReferenceCatalog = {
  legal_entities: JsonRecord[]
  departments: JsonRecord[]
  cost_centers: JsonRecord[]
  counterparties: JsonRecord[]
}

const allowedDocumentTypes = new Set([
  "supplier_invoice",
  "customer_invoice",
  "credit_note",
  "receipt",
  "payment_proof",
  "donation_slip",
  "bank_document",
  "tax_document",
  "contract",
  "other",
])

const allowedDirections = new Set(["payable", "receivable", "donation", "informational"])

function required(env: Env, key: keyof Env) {
  const value = env[key]
  if (typeof value !== "string" || !value) throw new Error(`${String(key)} is not configured`)
  return value
}

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function machineRpc(env: Env, name: string, payload: JsonRecord) {
  const url = required(env, "SUPABASE_URL")
  const anon = required(env, "SUPABASE_ANON_KEY")
  const machineToken = required(env, "OCR_MACHINE_TOKEN")

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anon,
      authorization: `Bearer ${anon}`,
      "content-type": "application/json",
      "x-black-swan-machine-token": machineToken,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${name} failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function asRows(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object") : []
}

function normalizeCatalog(value: unknown): ReferenceCatalog {
  const row = value && typeof value === "object" ? value as JsonRecord : {}
  return {
    legal_entities: asRows(row.legal_entities),
    departments: asRows(row.departments),
    cost_centers: asRows(row.cost_centers),
    counterparties: asRows(row.counterparties),
  }
}

function idSet(rows: JsonRecord[]) {
  return new Set(rows.map((row) => typeof row.id === "string" ? row.id : null).filter((id): id is string => Boolean(id)))
}

function extractionSchema(references: ReferenceCatalog) {
  return {
    document_types: [...allowedDocumentTypes],
    directions: [...allowedDirections],
    output: {
      raw_ocr_text: "string|null",
      raw_extraction: "object",
      proposed_document_type: "enum|null",
      proposed_legal_entity_id: "uuid|null",
      proposed_counterparty_id: "uuid|null",
      proposed_document_number: "string|null",
      proposed_document_date: "YYYY-MM-DD|null",
      proposed_due_date: "YYYY-MM-DD|null",
      proposed_currency: "ISO-4217|null",
      proposed_net_amount: "number|null",
      proposed_tax_amount: "number|null",
      proposed_total_amount: "number|null",
      proposed_direction: "enum|null",
      proposed_department_id: "uuid|null",
      proposed_cost_center_id: "uuid|null",
      proposed_account_code: "string|null",
      confidence: "0..1|null",
    },
    rules: [
      "Never invent a legal entity, counterparty, department, cost center, or account identifier.",
      "Identifier fields may use only IDs present in reference_catalog; otherwise return null.",
      "Use null when a canonical identifier cannot be resolved confidently.",
      "Amounts must be non-negative numbers in document currency.",
      "This output is a proposal only and will always require human review.",
    ],
    reference_catalog: references,
  }
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function canonicalId(value: unknown, allowed: Set<string>) {
  const id = nullableString(value)
  return id && allowed.has(id) ? id : null
}

function normalizeProposal(value: unknown, references: ReferenceCatalog): ExtractionProposal {
  if (!value || typeof value !== "object") throw new Error("Document AI returned a non-object response")
  const row = value as JsonRecord

  const documentType = nullableString(row.proposed_document_type)
  const direction = nullableString(row.proposed_direction)
  const confidenceValue = typeof row.confidence === "number" && Number.isFinite(row.confidence)
    ? Math.min(1, Math.max(0, row.confidence))
    : null

  const legalEntityIds = idSet(references.legal_entities)
  const departmentIds = idSet(references.departments)
  const costCenterIds = idSet(references.cost_centers)
  const counterpartyIds = idSet(references.counterparties)

  return {
    raw_ocr_text: nullableString(row.raw_ocr_text),
    raw_extraction: row.raw_extraction && typeof row.raw_extraction === "object"
      ? row.raw_extraction as JsonRecord
      : {},
    proposed_document_type: documentType && allowedDocumentTypes.has(documentType) ? documentType : null,
    proposed_legal_entity_id: canonicalId(row.proposed_legal_entity_id, legalEntityIds),
    proposed_counterparty_id: canonicalId(row.proposed_counterparty_id, counterpartyIds),
    proposed_document_number: nullableString(row.proposed_document_number),
    proposed_document_date: nullableString(row.proposed_document_date),
    proposed_due_date: nullableString(row.proposed_due_date),
    proposed_currency: nullableString(row.proposed_currency)?.toUpperCase() || null,
    proposed_net_amount: nullableNumber(row.proposed_net_amount),
    proposed_tax_amount: nullableNumber(row.proposed_tax_amount),
    proposed_total_amount: nullableNumber(row.proposed_total_amount),
    proposed_direction: direction && allowedDirections.has(direction) ? direction : null,
    proposed_department_id: canonicalId(row.proposed_department_id, departmentIds),
    proposed_cost_center_id: canonicalId(row.proposed_cost_center_id, costCenterIds),
    proposed_account_code: nullableString(row.proposed_account_code),
    confidence: confidenceValue,
  }
}

async function extractDocument(
  env: Env,
  job: OcrJob,
  file: ArrayBuffer,
  references: ReferenceCatalog,
) {
  const endpoint = required(env, "DOCUMENT_AI_ENDPOINT")
  const token = env.DOCUMENT_AI_TOKEN

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      task: "black_swan_accounting_document_extraction",
      schema_version: "1",
      file: {
        name: job.source_file_name,
        content_type: job.content_type,
        base64: bytesToBase64(file),
      },
      schema: extractionSchema(references),
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Document AI failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const payload = await response.json() as JsonRecord
  const proposal = payload.data ?? payload
  return normalizeProposal(proposal, references)
}

async function processJob(env: Env, job: OcrJob) {
  const runId = crypto.randomUUID()
  const provider = env.MODEL_PROVIDER || "configurable"
  const model = env.MODEL_NAME || "document-extraction-v1"

  await machineRpc(env, "ocr_claim_intake", {
    p_intake_id: job.intake_id,
    p_model_provider: provider,
    p_model_name: model,
    p_model_run_id: runId,
  })

  const object = await env.DOCUMENTS_BUCKET.get(job.storage_key)
  if (!object) throw new Error("Source document missing from R2")

  const references = normalizeCatalog(await machineRpc(env, "ocr_get_reference_catalog", {}))
  const proposal = await extractDocument(env, job, await object.arrayBuffer(), references)

  await machineRpc(env, "ocr_write_proposal", {
    p_intake_id: job.intake_id,
    p_raw_ocr_text: proposal.raw_ocr_text,
    p_raw_extraction: proposal.raw_extraction,
    p_proposed_document_type: proposal.proposed_document_type,
    p_proposed_legal_entity_id: proposal.proposed_legal_entity_id,
    p_proposed_counterparty_id: proposal.proposed_counterparty_id,
    p_proposed_document_number: proposal.proposed_document_number,
    p_proposed_document_date: proposal.proposed_document_date,
    p_proposed_due_date: proposal.proposed_due_date,
    p_proposed_currency: proposal.proposed_currency,
    p_proposed_net_amount: proposal.proposed_net_amount,
    p_proposed_tax_amount: proposal.proposed_tax_amount,
    p_proposed_total_amount: proposal.proposed_total_amount,
    p_proposed_direction: proposal.proposed_direction,
    p_proposed_department_id: proposal.proposed_department_id,
    p_proposed_cost_center_id: proposal.proposed_cost_center_id,
    p_proposed_account_code: proposal.proposed_account_code,
    p_confidence: proposal.confidence,
    p_model_provider: provider,
    p_model_name: model,
    p_model_run_id: runId,
  })
}

async function markFailed(env: Env, job: OcrJob, error: unknown) {
  try {
    await machineRpc(env, "ocr_mark_failed", {
      p_intake_id: job.intake_id,
      p_error_code: "ocr_processing_failed",
      p_error_message: error instanceof Error ? error.message : "Unknown OCR processing error",
    })
  } catch (markError) {
    console.error(JSON.stringify({
      level: "error",
      event: "ocr_mark_failed_error",
      intake_id: job.intake_id,
      message: markError instanceof Error ? markError.message : "unknown",
    }))
  }
}

export default {
  async queue(batch: QueueBatch<OcrJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body
      try {
        await processJob(env, job)
        message.ack()
        console.log(JSON.stringify({
          level: "info",
          event: "ocr_processed",
          intake_id: job.intake_id,
          environment: env.ENVIRONMENT || "unknown",
        }))
      } catch (error) {
        await markFailed(env, job, error)
        console.error(JSON.stringify({
          level: "error",
          event: "ocr_processing_failed",
          intake_id: job.intake_id,
          message: error instanceof Error ? error.message : "unknown",
        }))
        message.retry()
      }
    }
  },
}
