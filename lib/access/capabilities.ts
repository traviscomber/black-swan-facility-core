export type CapabilityLevel = 'view' | 'operate' | 'approve' | 'admin'

export type DomainCapability = {
  domain: string
  levels: CapabilityLevel[]
}

export type RouteCapability = {
  route: string
  domain: string
  required: CapabilityLevel
}

export type CanonicalCapabilitySnapshot = {
  domains: Record<string, CapabilityLevel[]>
}

const ORDER: CapabilityLevel[] = ['view', 'operate', 'approve', 'admin']
const LEVELS = new Set<CapabilityLevel>(ORDER)

function normalizeLevels(value: unknown): CapabilityLevel[] {
  if (!Array.isArray(value)) return []
  const valid = value.filter((item): item is CapabilityLevel => typeof item === 'string' && LEVELS.has(item as CapabilityLevel))
  if (valid.length !== value.length) return []
  return [...new Set(valid)]
}

export function normalizeCapabilitySnapshot(input: unknown): CanonicalCapabilitySnapshot {
  if (!input || typeof input !== 'object') return { domains: {} }
  const record = input as Record<string, unknown>
  const rawDomains = record.domains ?? record.capabilities
  if (!rawDomains || typeof rawDomains !== 'object' || Array.isArray(rawDomains)) return { domains: {} }

  const domains: Record<string, CapabilityLevel[]> = {}
  for (const [domain, rawLevels] of Object.entries(rawDomains as Record<string, unknown>)) {
    const levels = normalizeLevels(rawLevels)
    if (levels.length > 0) domains[domain] = levels
  }
  return { domains }
}

export function hasCapability(snapshot: CanonicalCapabilitySnapshot, domain: string, required: CapabilityLevel): boolean {
  const levels = snapshot.domains[domain]
  if (!levels?.length) return false
  const requiredIndex = ORDER.indexOf(required)
  return levels.some((level) => ORDER.indexOf(level) >= requiredIndex)
}
