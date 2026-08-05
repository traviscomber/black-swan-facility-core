"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Loader2, ShieldX } from "lucide-react"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"

type AccessGateProps = {
  children: ReactNode
  action?: string
  anyAction?: string[]
  department?: string
  fallback?: ReactNode
  compact?: boolean
}

export function AccessGate({ children, action, anyAction, department, fallback, compact = false }: AccessGateProps) {
  const { loading, error, can, canAccessDepartment } = useEffectiveAccess()

  if (loading) {
    return <div className="flex min-h-[160px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  const actionAllowed = action ? can(action) : anyAction?.length ? anyAction.some(can) : true
  const departmentAllowed = department ? canAccessDepartment(department) : true
  const allowed = !error && actionAllowed && departmentAllowed

  if (allowed) return <>{children}</>
  if (fallback !== undefined) return <>{fallback}</>
  if (compact) return null

  return (
    <div className="flex min-h-[320px] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Acceso restringido</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tu perfil no tiene permiso para esta acción o módulo en el alcance asignado.</p>
        <Link href="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Volver al inicio</Link>
      </div>
    </div>
  )
}

export function PermissionGate(props: AccessGateProps) {
  return <AccessGate {...props} compact={props.compact ?? true} />
}
