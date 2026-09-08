import { callOpenAIDirect } from "@/lib/openai/direct-response"

export type CentralAIMode = "DIRECT" | "FASTTRACK" | "FULL_AGENTIC"

export type CentralAIContext = {
  authorization: {
    authenticated: true
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
  /^(que puedes hacer|who are you|quien eres)[.!?\s]*$/i,
]

const ACTION_VERBS = [
  "crea",
  "crear",
  "crees",
  "create",
  "actualiza",
  "actualizar",
  "actualices",
  "update",
  "elimina",
  "eliminar",
  "elimines",
  "delete",
  "envia",
  "enviar",
  "envies",
  "send",
  "manda",
  "mandar",
  "mandes",
  "aprueba",
  "aprobar",
  "apruebes",
  "approve",
  "rechaza",
  "rechazar",
  "rechaces",
  "reject",
  "asigna",
  "asignar",
  "asignes",
  "assign",
  "programa",
  "programar",
  "programes",
  "schedule",
  "publica",
  "publicar",
  "publiques",
  "publish",
  "archiva",
  "archivar",
  "archives",
  "archive",
  "cancela",
  "cancelar",
  "canceles",
  "cancel",
  "modifica",
  "modificar",
  "modifiques",
  "modify",
  "cambia",
  "cambiar",
  "cambies",
  "change",
]

const ACTION_VERB_PATTERN = new RegExp(`(?:${ACTION_VERBS.join("|")})\\b`, "i")
const DIRECT_ACTION_PATTERN = new RegExp(`^(?:por favor\\s+|please\\s+)?(?:${ACTION_VERBS.join("|")})\\b`, "i")
const REQUEST_ACTION_PATTERN = new RegExp(
  `\\b(?:puedes|podrias|quiero que|necesito que|haz que|can you|could you|i need you to|please)\\s+(?:${ACTION_VERBS.join("|")})\\b`,
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

const EVIDENCE_RULES = [
  "El contexto operacional contiene evidencia canonica observada y puede declarar fuentes no disponibles.",
  "Para hechos operacionales usa solo canonicalSources y attention/recentChanges del contexto autorizado.",
  "Nunca interpretes una fuente ausente o unavailableSources como cero, normalidad o inexistencia del problema.",
  "Separa claramente DATO OBSERVADO, INTERPRETACION y PROPUESTA cuando una respuesta mezcle evidencia con razonamiento.",
  "No reveles identificadores internos ni solicites datos personales que no sean necesarios para la tarea.",
  "Cuando cites evidencia, nombra la fuente canonica relevante de forma legible.",
].join(" ")

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
        EVIDENCE_RULES,
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
      EVIDENCE_RULES,
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
