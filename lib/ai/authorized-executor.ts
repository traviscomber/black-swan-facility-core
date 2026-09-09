export const AI_CAPABILITIES = {
  CREATE_INTERNAL_TASK: "task.create_internal",
} as const

export type CreateInternalTaskProposal = {
  capability: typeof AI_CAPABILITIES.CREATE_INTERNAL_TASK
  title: string
  description: string | null
}

const CREATE_TASK_PATTERNS = [
  /^(?:por favor\s+)?(?:crea|crear|cree|create)\s+(?:una?\s+)?tarea\s+(?:para\s+|de\s+|que\s+)?(.+)$/i,
  /^(?:please\s+)?create\s+(?:an?\s+)?(?:internal\s+)?task\s+(?:to\s+|for\s+)?(.+)$/i,
]

function cleanTaskTitle(value: string) {
  return value
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseAuthorizedAction(message: string): CreateInternalTaskProposal | null {
  const normalized = message.trim()

  for (const pattern of CREATE_TASK_PATTERNS) {
    const match = normalized.match(pattern)
    const title = cleanTaskTitle(match?.[1] ?? "")

    if (!title || title.length > 160) continue

    return {
      capability: AI_CAPABILITIES.CREATE_INTERNAL_TASK,
      title,
      description: null,
    }
  }

  return null
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}
