'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Crown,
  Leaf,
  Tractor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Persona = 'ceo' | 'field_admin' | 'projects' | 'general'

type BudgetRow = {
  division_id: string
  category_id: string
  budgeted_amount: number | string | null
  actual_amount: number | string | null
}

type Division = {
  id: string
  name: string
  source_key: string | null
  parent_id: string | null
  is_aggregate: boolean
}

type Category = {
  id: string
  name: string
  source_key: string | null
  category_role: 'cost' | 'income' | null
}

const eur = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function n(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function personaFromEmail(email?: string | null): Persona {
  const normalized = (email ?? '').trim().toLowerCase()
  if (normalized === 'santiago@blackswan.com') return 'ceo'
  if (normalized === 'raimundo@blackswan.com') return 'field_admin'
  if (normalized === 'tomas@blackswn.org') return 'projects'
  return 'general'
}

const personaCopy = {
  ceo: {
    eyebrow: 'Santiago · CEO',
    title: 'Visión ejecutiva del campo y la operación',
    description: 'El Budget canónico se resume aquí para decidir rápido: costo, ingreso, desviaciones y dónde requiere atención la organización.',
    Icon: Crown,
  },
  field_admin: {
    eyebrow: 'Raimundo · Administrador del campo',
    title: 'Control administrativo del campo',
    description: 'Farming, Landscaping, compras, vehículos, edificios y gastos del campo concentrados en una sola vista operacional.',
    Icon: Tractor,
  },
  projects: {
    eyebrow: 'Tomás · Jefe de proyectos',
    title: 'Presupuesto y ejecución de proyectos',
    description: 'Inversiones planificadas y en ejecución conectadas con Procurement, Assets e Infrastructure.',
    Icon: BriefcaseBusiness,
  },
  general: {
    eyebrow: 'Budget & P&L',
    title: 'Vista financiera operacional',
    description: 'Resumen del Budget canónico importado desde Excel y sus principales rutas operacionales.',
    Icon: CircleDollarSign,
  },
} satisfies Record<Persona, { eyebrow: string; title: string; description: string; Icon: typeof Crown }>

export function BudgetRoleDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const now = new Date()
  const [persona, setPersona] = useState<Persona>('general')
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pending, setPending] = useState(0)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: authData }, divisionResult, categoryResult, budgetResult, approvalResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('budget_divisions').select('id,name,source_key,parent_id,is_aggregate').eq('is_active', true),
        supabase.from('budget_categories').select('id,name,source_key,category_role').eq('is_active', true),
        supabase.from('budgets').select('division_id,category_id,budgeted_amount,actual_amount').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1).eq('source_kind', 'workbook'),
        supabase.from('finance_approval_queue').select('classification_status'),
      ])
      if (!active) return
      setPersona(personaFromEmail(authData.user?.email))
      setDivisions((divisionResult.data ?? []) as Division[])
      setCategories((categoryResult.data ?? []) as Category[])
      setRows((budgetResult.data ?? []) as BudgetRow[])
      const statuses = (approvalResult.data ?? []) as Array<{ classification_status: string | null }>
      setPending(statuses.filter((item) => item.classification_status === 'exception' || item.classification_status === 'manual_review').length)
      setReady(statuses.filter((item) => item.classification_status === 'ready').length)
    }
    void load()
    return () => { active = false }
  }, [supabase])

  const divisionById = useMemo(() => new Map(divisions.map((item) => [item.id, item])), [divisions])
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])

  const scopedRows = useMemo(() => {
    if (persona === 'field_admin') {
      const allowed = new Set(['farming-cattle', 'farming-vineyard', 'farming-horses', 'farming-orchard', 'landscaping'])
      return rows.filter((row) => allowed.has(divisionById.get(row.division_id)?.source_key ?? ''))
    }
    if (persona === 'projects') {
      const allowed = new Set(['planning-investments-hr', 'realising-investments'])
      return rows.filter((row) => allowed.has(categoryById.get(row.category_id)?.source_key ?? ''))
    }
    return rows
  }, [categoryById, divisionById, persona, rows])

  const summary = useMemo(() => {
    let planCost = 0
    let actualCost = 0
    let planIncome = 0
    let actualIncome = 0
    for (const row of scopedRows) {
      const category = categoryById.get(row.category_id)
      const isIncome = category?.category_role === 'income' || category?.source_key === 'income'
      if (isIncome) {
        planIncome += n(row.budgeted_amount)
        actualIncome += n(row.actual_amount)
      } else {
        planCost += n(row.budgeted_amount)
        actualCost += n(row.actual_amount)
      }
    }
    return {
      planCost,
      actualCost,
      planIncome,
      actualIncome,
      variance: (planCost - planIncome) - (actualCost - actualIncome),
    }
  }, [categoryById, scopedRows])

  const copy = personaCopy[persona]
  const Icon = copy.Icon

  const actions = persona === 'ceo'
    ? [
        { label: 'Operación Hospitality', href: '/bookings', Icon: Building2 },
        { label: 'Administración del campo', href: '/cattle', Icon: Leaf },
        { label: 'Aprobación financiera', href: '/budgets/approvals', Icon: ClipboardCheck },
      ]
    : persona === 'field_admin'
      ? [
          { label: 'Aprobación financiera', href: '/budgets/approvals', Icon: ClipboardCheck },
          { label: 'Ganadería', href: '/cattle', Icon: Tractor },
          { label: 'Combustibles', href: '/fuel-consumption', Icon: CircleDollarSign },
          { label: 'Compras del campo', href: '/procurement', Icon: ClipboardCheck },
          { label: 'Mantenimiento', href: '/maintenance', Icon: Building2 },
        ]
      : persona === 'projects'
        ? [
            { label: 'Procurement', href: '/procurement', Icon: ClipboardCheck },
            { label: 'Assets', href: '/assets', Icon: Building2 },
            { label: 'Infrastructure', href: '/infrastructure', Icon: BriefcaseBusiness },
          ]
        : [
            { label: 'Aprobación financiera', href: '/budgets/approvals', Icon: ClipboardCheck },
            { label: 'Procurement', href: '/procurement', Icon: BriefcaseBusiness },
          ]

  const metrics = persona === 'projects'
    ? [
        ['Inversión plan', summary.planCost],
        ['Inversión ejecutada', summary.actualCost],
        ['Disponible / variación', summary.planCost - summary.actualCost],
      ]
    : [
        ['Costo plan', summary.planCost],
        ['Costo actual', summary.actualCost],
        ['Ingreso actual', summary.actualIncome],
        ['Variación neta', summary.variance],
      ]

  return (
    <section className="mx-4 mt-4 md:mx-8 md:mt-6">
      <div className="bg-[var(--bs-surface-primary)] p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[var(--bs-warm-yellow)]">
              <Icon className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.14em]">{copy.eyebrow}</p>
            </div>
            <h2 className="mt-3 text-xl font-normal text-[var(--bs-text-primary)]">{copy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">{copy.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map(({ label, href, Icon: ActionIcon }) => (
              <Button key={`${href}-${label}`} asChild variant="outline">
                <Link href={href}><ActionIcon className="mr-2 h-4 w-4" />{label}<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            ))}
          </div>
        </div>

        <div className={`mt-6 grid gap-3 ${metrics.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
          {metrics.map(([label, value]) => (
            <div key={String(label)} className="bg-[var(--bs-surface-secondary)] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">{label}</p>
              <p className="mt-2 text-xl font-normal text-[var(--bs-text-primary)]">{eur.format(Number(value))}</p>
            </div>
          ))}
        </div>

        {(persona === 'field_admin' || persona === 'ceo') && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="bg-[var(--bs-surface-secondary)] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Listo para aprobar</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-xl text-[var(--bs-cool-sage)]">{ready}</p>
                <Button asChild variant="ghost" size="sm"><Link href="/budgets/approvals">Revisar<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </div>
            <div className="bg-[var(--bs-surface-secondary)] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">Excepciones / pendientes</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-xl text-[var(--bs-warm-orange)]">{pending}</p>
                <Button asChild variant="ghost" size="sm"><Link href="/budgets/approvals">Resolver<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--bs-text-muted)]">Fuente: Budget & PnL 26 · EUR canónico · vista contextual, sin duplicar datos.</p>
      </div>
    </section>
  )
}
