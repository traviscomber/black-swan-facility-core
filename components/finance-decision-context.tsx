'use client'

import { FileText } from 'lucide-react'

type Props = {
  description?: string | null
  allocation?: string | null
  operationalLabel?: string | null
  reason?: string | null
  hasSourceFile?: boolean
  sourceHref?: string | null
  evidenceLabel?: string | null
  detail?: string | null
}

export function FinanceDecisionContext({
  description,
  allocation,
  operationalLabel,
  reason,
  hasSourceFile = false,
  sourceHref,
  evidenceLabel,
  detail,
}: Props) {
  const what = description?.trim() || operationalLabel?.trim() || 'Descripción no disponible'
  const why = reason?.trim() || 'Sin explicación adicional registrada.'
  const evidence = evidenceLabel || (hasSourceFile ? 'Factura fuente disponible' : 'Datos fiscales + historial')

  return (
    <div className="min-w-[250px] space-y-2 text-xs leading-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--bs-text-muted)]">Qué es</p>
        <p className="text-[var(--bs-text-primary)]">{what}</p>
      </div>
      {allocation && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--bs-text-muted)]">Imputación</p>
          <p className="text-[var(--bs-text-primary)]">{allocation}{operationalLabel && what !== operationalLabel ? ` · ${operationalLabel}` : ''}</p>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--bs-text-muted)]">Por qué</p>
        <p className="line-clamp-2 text-[var(--bs-text-secondary)]">{why}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--bs-cool-sage)]">Evidencia · {evidence}</span>
        {hasSourceFile && sourceHref && (
          <a className="inline-flex items-center gap-1 text-[var(--bs-cool-sky)] underline" href={sourceHref} target="_blank" rel="noreferrer">
            <FileText className="h-3.5 w-3.5" />Ver factura
          </a>
        )}
      </div>
      {detail && (
        <details>
          <summary className="cursor-pointer text-[11px] text-[var(--bs-text-muted)]">Ver detalle</summary>
          <p className="mt-1 text-[11px] text-[var(--bs-text-muted)]">{detail}</p>
        </details>
      )}
    </div>
  )
}
