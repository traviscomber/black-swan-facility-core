import { callOpenAIDirect } from "@/lib/openai/direct-response"

export type CentralAIMode = "DIRECT" | "FASTTRACK" | "FULL_AGENTIC"

export type CentralAIContext = {
  user: {
    id: string
    email: string | null
  }
  operational?: Record<string, unknown>
}

export type CentralAIActionPlan = {
  intent: string
  steps: string[]
  executionStatus: "confirmation_required"
}

export type CentralAIResult = {
  mode: CentralAIMode
  response: string
  source: "deterministic" | "openai_responses"
  requiresConfirmation: boolean
  actionPlan: CentralAIActionPlan | null
  model: string | null
  responseId: string | null
}

const DIRECT_PATTERNS = [
  /^(hola|hello|hi|buenos dias|buenas tardes|buenas noches|gracias|thanks|ok|okay|listo|ayuda|help)[.!?\s]*$/i,
  /^(que puedes hacer|qué puedes hacer|who are you|quien eres|quién eres)[.!?\s]*$/i,
]

const ACTION_VERBS = [
  "crea",
  "crear",
  "actualiza",
  "actualizar",
  "elimina",
  "eliminar",
  "envia",
  "enviar",
  "manda",
  "mandar",
  "aprueba",
  "aprobar",
  "rechaza",
  "rechazar",
  "asigna",
  "asignar",
  "programa",
  "programar",
  "publica",
  "publicar",
  "archiva",
  "archivar",
  "cancela",
  "cancelar",
  "modifica",
  "modificar",
  "cambia",
  "cambiar",
]

const ACTION_VERB_PATTERN = new RegExp(`(?:${ACTION_VERBS.join("|")})\\b`, "i")
const DIRECT_ACTION_PATTERN = new RegExp(`^(?:por favor\\s+)?(?:${ACTION_VERBS.join("|")})\\b`, "i")
const REQUEST_ACTION_PATTERN = new RegExp(
  `\\b(?:puedes|podrias|podrías|quiero que|necesito que|haz que)\\s+(?:${ACTION_VERBS.join("|")})\\b`,
  "i",
)

function normalizeForRouting(message: string) {
  return message
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function classifyCentralAIMode(message: string): CentralAIMode {
  const normalized = normalizeForRouting(message)

  if (DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "DIRECT"
  }

  if (DIRECT_ACTION_PATTERN.test(normalized) || REQUEST_ACTION_PATTERN.test(normalized)) {
    return "FULL_AGENTIC"
  }

  return "FASTTRACK"
}

function inferActionIntent(message: string) {
  const normalized = normalizeForRouting(message)
  const match = normalized.match(ACTION_VERB_PATTERN)
  return match?.[0] ?? "accion_operacional"
}

function buildActionPlan(message: string): CentralAIActionPlan {
  return {
    intent: inferActionIntent(message),
    steps: [
      "Resolver el alcance y los objetos operacionales afectados.",
      "Validar permisos, datos canonicos y precondiciones antes de cualquier escritura.",
      "Presentar la accion concreta y solicitar confirmacion explicita.",
      "Ejecutar solo mediante conectores autorizados y registrar evidencia del resultado.",
    ],
    executionStatus: "confirmation_required",
  }
}

export async function routeCentralAI({
  message,
  context,
}: {
  message: string
  context: CentralAIContext
}): Promise<CentralAIResult> {
  const mode = classifyCentralAIMode(message)

  if (mode === "DIRECT") {
    return {
      mode,
      response:
        "Black Swan AI esta disponible. Puedo consultar y analizar contexto operacional, o preparar acciones; cualquier accion con efectos requiere confirmacion explicita.",
      source: "deterministic",
      requiresConfirmation: false,
      actionPlan: null,
      model: null,
      responseId: null,
    }
  }

  if (mode === "FULL_AGENTIC") {
    const actionPlan = buildActionPlan(message)
    const result = await callOpenAIDirect({
      system: [
        "Eres Black Swan AI, el asistente operacional del Facility Core.",
        "Estas en modo FULL_AGENTIC de planificacion segura.",
        "NO ejecutes acciones, NO afirmes que una accion fue realizada y NO inventes datos operacionales.",
        "Describe brevemente lo que se haria y deja claro que se requiere confirmacion explicita antes de cualquier efecto externo.",
        "Usa solamente el contexto autorizado para afirmaciones factuales.",
      ].join(" "),
      messages: [{ role: "user", content: message }],
      context,
      model: process.env.OPENAI_AGENTIC_MODEL?.trim() || undefined,
    })

    return {
      mode,
      response: result.text,
      source: "openai_responses",
      requiresConfirmation: true,
      actionPlan,
      model: result.model,
      responseId: result.responseId,
    }
  }

  const result = await callOpenAIDirect({
    system: [
      "Eres Black Swan AI, el asistente operacional del Facility Core.",
      "Estas en modo FASTTRACK de lectura y analisis: responde en un solo paso y no ejecutes acciones.",
      "No inventes datos ni conviertas inferencias en hechos.",
      "Usa solamente el contexto autorizado para afirmaciones factuales; si falta evidencia, dilo explicitamente.",
      "Responde en el idioma del usuario y de forma ejecutiva.",
    ].join(" "),
    messages: [{ role: "user", content: message }],
    context,
    model: process.env.OPENAI_FASTTRACK_MODEL?.trim() || undefined,
  })

  return {
    mode,
    response: result.text,
    source: "openai_responses",
    requiresConfirmation: false,
    actionPlan: null,
    model: result.model,
    responseId: result.responseId,
  }
}
