'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { parseBudgetWorkbook, type BudgetWorkbookPreview } from '@/lib/budget-workbook'

type WorkspaceView = 'overview' | 'import' | 'history'
type DisplayCurrency = 'EUR' | 'CLP'

type BudgetDivision = {
  id: string
  name: string
  parent_id: string | null
  is_aggregate: boolean
  sort_order: number
  source_key: string | null
}

type BudgetCategory = {
  id: string
  division_id: string
  name: string
  category_role: 'cost' | 'income' | null
  sort_order: number
  source_key: string | null
}

type BudgetRow = {
  id: string
  division_id: string
  category_id: string
  year: number
  month: number
  budgeted_amount: number
  actual_amount: number | null
  variance: number | null
  source_kind: string | null
  import_run_id: string | null
}

type ImportRun = {
  id: string
  file_name: string
  file_hash: string
  storage_path: string | null
  workbook_title: string | null
  fiscal_year: number
  status: string
  row_count: number
  warning_count: number
  imported_at: string | null
  created_at: string
  error_message: string | null
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const eurMoney = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const clpMoney = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const DISPLAY_RATE_KEY = 'bsfc:budget-display-clp-per-eur'

function formatMoney(value: number, currency: DisplayCurrency, clpPerEur: number | null) {
  if (currency === 'CLP') {
    if (!clpPerEur || clpPerEur <= 0) return '—'
    return clpMoney.format(value * clpPerEur)
  }
  return eurMoney.format(value)
}

function amount(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
}

export function BudgetWorkspace() {
  const supabase = useMemo(() => createClient(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<WorkspaceView>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [divisions, setDivisions] = useState<BudgetDivision[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [imports, setImports] = useState<ImportRun[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BudgetWorkbookPreview | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [alreadyImported, setAlreadyImported] = useState<ImportRun | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('EUR')
  const [clpRateText, setClpRateText] = useState('')

  const clpPerEur = useMemo(() => {
    const parsed = Number(clpRateText.replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [clpRateText])

  const money = useCallback((value: number) => formatMoney(value, displayCurrency, clpPerEur), [clpPerEur, displayCurrency])

  useEffect(() => {
    const saved = window.localStorage.getItem(DISPLAY_RATE_KEY)
    if (saved) setClpRateText(saved)
  }, [])

  function updateDisplayRate(value: string) {
    setClpRateText(value)
    if (value.trim()) window.localStorage.setItem(DISPLAY_RATE_KEY, value)
    else window.localStorage.removeItem(DISPLAY_RATE_KEY)
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const [divisionResult, categoryResult, budgetResult, importResult] = await Promise.all([
      supabase.from('budget_divisions').select('id,name,parent_id,is_aggregate,sort_order,source_key').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('budget_categories').select('id,division_id,name,category_role,sort_order,source_key').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('budgets').select('id,division_id,category_id,year,month,budgeted_amount,actual_amount,variance,source_kind,import_run_id').eq('year', year).eq('month', month),
      supabase.from('budget_import_runs').select('id,file_name,file_hash,storage_path,workbook_title,fiscal_year,status,row_count,warning_count,imported_at,created_at,error_message').order('created_at', { ascending: false }).limit(20),
    ])

    const firstError = divisionResult.error || categoryResult.error || budgetResult.error || importResult.error
    if (firstError) toast.error(firstError.message)
    setDivisions((divisionResult.data ?? []) as BudgetDivision[])
    setCategories((categoryResult.data ?? []) as BudgetCategory[])
    setBudgets((budgetResult.data ?? []) as BudgetRow[])
    setImports((importResult.data ?? []) as ImportRun[])
    setLoading(false)
    setRefreshing(false)
  }, [month, supabase, year])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('budget-workspace-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_import_runs' }, () => void load(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const leafDivisions = useMemo(() => divisions.filter((division) => !division.is_aggregate), [divisions])

  useEffect(() => {
    if (!selectedDivisionId && leafDivisions[0]) setSelectedDivisionId(leafDivisions[0].id)
    if (selectedDivisionId && !leafDivisions.some((division) => division.id === selectedDivisionId)) {
      setSelectedDivisionId(leafDivisions[0]?.id ?? null)
    }
  }, [leafDivisions, selectedDivisionId])

  const latestCompletedImport = imports.find((item) => item.status === 'completed') ?? null
  const workbookBudgets = budgets.filter((item) => item.source_kind === 'workbook')
  const activeBudgets = workbookBudgets.length ? workbookBudgets : budgets
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const divisionById = useMemo(() => new Map(divisions.map((division) => [division.id, division])), [divisions])

  const selectedRows = useMemo(() => activeBudgets.filter((row) => row.division_id === selectedDivisionId), [activeBudgets, selectedDivisionId])
  const categoryRows = useMemo(() => {
    return selectedRows
      .map((row) => ({ row, category: categoryById.get(row.category_id) }))
      .filter((item): item is { row: BudgetRow; category: BudgetCategory } => Boolean(item.category))
      .sort((a, b) => a.category.sort_order - b.category.sort_order || a.category.name.localeCompare(b.category.name))
  }, [categoryById, selectedRows])

  const totals = useMemo(() => {
    let planCost = 0
    let actualCost = 0
    let planIncome = 0
    let actualIncome = 0
    for (const row of activeBudgets) {
      const category = categoryById.get(row.category_id)
      if (!category) continue
      if (category.category_role === 'income' || category.name.toLocaleLowerCase() === 'income') {
        planIncome += amount(row.budgeted_amount)
        actualIncome += amount(row.actual_amount)
      } else {
        planCost += amount(row.budgeted_amount)
        actualCost += amount(row.actual_amount)
      }
    }
    return { planCost, actualCost, planIncome, actualIncome, planNet: planCost - planIncome, actualNet: actualCost - actualIncome }
  }, [activeBudgets, categoryById])

  const availableYears = useMemo(() => {
    const values = new Set([new Date().getFullYear(), year, ...imports.map((item) => item.fiscal_year)])
    return Array.from(values).sort((a, b) => b - a)
  }, [imports, year])

  async function inspectFile(file: File) {
    setSelectedFile(file)
    setPreview(null)
    setAlreadyImported(null)
    setParsing(true)
    try {
      const parsed = await parseBudgetWorkbook(await file.arrayBuffer(), file.name)
      const { data } = await supabase
        .from('budget_import_runs')
        .select('id,file_name,file_hash,storage_path,workbook_title,fiscal_year,status,row_count,warning_count,imported_at,created_at,error_message')
        .eq('file_hash', parsed.fileHash)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPreview(parsed)
      setAlreadyImported((data ?? null) as ImportRun | null)
      setYear(parsed.fiscalYear)
    } catch (error) {
      setSelectedFile(null)
      toast.error(error instanceof Error ? error.message : 'No fue posible leer el Excel.')
    } finally {
      setParsing(false)
    }
  }

  async function importWorkbook() {
    if (!preview || !selectedFile) return
    if (alreadyImported) {
      toast.info('Esta versión ya fue importada. La interfaz está usando sus datos canónicos.')
      setView('overview')
      return
    }

    setImporting(true)
    const path = `${preview.fiscalYear}/${preview.fileHash}-${safeFileName(preview.fileName)}`
    try {
      const upload = await supabase.storage.from('budget-workbooks').upload(path, selectedFile, {
        contentType: selectedFile.type || 'application/octet-stream',
        upsert: false,
      })
      if (upload.error && !upload.error.message.toLocaleLowerCase().includes('already exists')) throw upload.error

      const { data, error } = await supabase.rpc('import_budget_workbook', {
        p_file_name: preview.fileName,
        p_file_hash: preview.fileHash,
        p_storage_path: path,
        p_workbook_title: preview.workbookTitle,
        p_fiscal_year: preview.fiscalYear,
        p_lines: preview.lines,
        p_warnings: preview.warnings,
        p_metadata: {
          source_sheet: preview.sourceSheet,
          sheet_names: preview.sheetNames,
          currency: preview.currency,
          file_size: preview.fileSize,
        },
      })
      if (error) throw error
      const result = data as { success?: boolean; error?: string; already_imported?: boolean } | null
      if (result?.success === false) throw new Error(result.error || 'La importación fue rechazada por la base de datos.')

      toast.success(result?.already_imported ? 'La versión ya estaba importada.' : 'Excel importado y publicado en Budget & P&L.')
      setPreview(null)
      setSelectedFile(null)
      setAlreadyImported(null)
      setMonth(1)
      setView('overview')
      await load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible importar el Excel.')
    } finally {
      setImporting(false)
    }
  }

  async function downloadImport(run: ImportRun) {
    if (!run.storage_path) return
    const { data, error } = await supabase.storage.from('budget-workbooks').createSignedUrl(run.storage_path, 60)
    if (error) toast.error(error.message)
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const selectedDivision = selectedDivisionId ? divisionById.get(selectedDivisionId) : null

  if (loading) return <div className="p-6 text-sm text-[var(--bs-text-secondary)]">Cargando Budget & P&L…</div>

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 bg-[var(--bs-surface-primary)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--bs-warm-yellow)]">Excel maestro + vista operacional</p>
          <h2 className="mt-2 text-xl font-medium text-[var(--bs-text-primary)]">Dos formas de trabajar, una sola versión controlada</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bs-text-secondary)]">
            El equipo puede mantener el formato conocido en Excel o trabajar desde esta interfaz. Cada carga conserva el archivo original, su huella, las celdas de origen y el historial de importación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Canónico: EUR</Badge>
          {latestCompletedImport && <Badge variant="secondary">Última carga: {new Date(latestCompletedImport.imported_at ?? latestCompletedImport.created_at).toLocaleString('es-CL')}</Badge>}
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Vistas de presupuesto">
        {([
          ['overview', 'Budget general', LayoutDashboard],
          ['import', 'Importar Excel', UploadCloud],
          ['history', 'Historial', History],
        ] as const).map(([key, label, Icon]) => (
          <Button key={key} variant={view === key ? 'default' : 'outline'} onClick={() => setView(key)}>
            <Icon className="mr-2 h-4 w-4" />{label}
          </Button>
        ))}
      </nav>

      {view === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3 bg-[var(--bs-surface-primary)] p-4">
            <label className="space-y-2 text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">
              Año fiscal
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="block h-10 min-w-32 bg-[var(--bs-surface-secondary)] px-3 text-sm normal-case tracking-normal text-[var(--bs-text-primary)]">
                {availableYears.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">
              Mes
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="block h-10 min-w-44 bg-[var(--bs-surface-secondary)] px-3 text-sm normal-case tracking-normal text-[var(--bs-text-primary)]">
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">Moneda visual</p>
              <div className="flex h-10 bg-[var(--bs-surface-secondary)] p-1">
                {(['EUR', 'CLP'] as const).map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    aria-pressed={displayCurrency === currency}
                    onClick={() => setDisplayCurrency(currency)}
                    className={`min-w-16 px-3 text-xs font-medium ${displayCurrency === currency ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'text-[var(--bs-text-muted)] hover:text-[var(--bs-text-secondary)]'}`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
            {displayCurrency === 'CLP' && (
              <label className="space-y-2 text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">
                Tasa de visualización
                <div className="flex h-10 items-center bg-[var(--bs-surface-secondary)] px-3">
                  <span className="mr-2 whitespace-nowrap text-[11px] normal-case tracking-normal">1 EUR =</span>
                  <input
                    inputMode="decimal"
                    value={clpRateText}
                    onChange={(event) => updateDisplayRate(event.target.value)}
                    placeholder="CLP"
                    className="w-24 bg-transparent text-sm normal-case tracking-normal text-[var(--bs-text-primary)] outline-none placeholder:text-[var(--bs-text-muted)]"
                    aria-label="Pesos chilenos por euro para visualización"
                  />
                  <span className="ml-2 text-[11px] normal-case tracking-normal">CLP</span>
                </div>
              </label>
            )}
            <div className="ml-auto text-right text-xs text-[var(--bs-text-muted)]">
              <p>Fuente activa</p>
              <p className="mt-1 text-sm text-[var(--bs-text-primary)]">{workbookBudgets.length ? 'Excel maestro importado' : 'Registros manuales existentes'}</p>
              <p className="mt-1">{displayCurrency === 'EUR' ? 'Valores canónicos' : clpPerEur ? 'Conversión solo visual · no modifica EUR' : 'Ingresa una tasa para visualizar CLP'}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['Costo plan', totals.planCost],
              ['Costo actual', totals.actualCost],
              ['Ingreso plan', totals.planIncome],
              ['Ingreso actual', totals.actualIncome],
              ['P&L neto actual', totals.actualNet],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-[var(--bs-surface-primary)] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">{label}</p>
                <p className="mt-3 text-xl text-[var(--bs-text-primary)]">{money(Number(value))}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="bg-[var(--bs-surface-primary)] p-3">
              <p className="px-2 pb-3 text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">Centros P&L</p>
              <div className="space-y-1">
                {leafDivisions.map((division) => {
                  const parent = division.parent_id ? divisionById.get(division.parent_id) : null
                  return (
                    <button key={division.id} type="button" onClick={() => setSelectedDivisionId(division.id)} className={`w-full px-3 py-3 text-left ${selectedDivisionId === division.id ? 'bg-[var(--bs-surface-elevated)] text-[var(--bs-text-primary)]' : 'text-[var(--bs-text-secondary)] hover:bg-[var(--bs-surface-secondary)]'}`}>
                      {parent && <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--bs-text-muted)]">{parent.name}</span>}
                      <span className="mt-1 block text-sm">{division.name}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="min-w-0 bg-[var(--bs-surface-primary)]">
              <div className="flex flex-col gap-2 bg-[var(--bs-surface-secondary)] p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">{MONTHS[month - 1]} {year}</p>
                  <h3 className="mt-1 text-lg text-[var(--bs-text-primary)]">{selectedDivision?.name ?? 'Centro de costo'}</h3>
                </div>
                <p className="text-xs text-[var(--bs-text-muted)]">Selecciona una categoría para continuar con su detalle operacional.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">
                    <tr>
                      <th className="px-5 py-4 font-normal">Categoría</th>
                      <th className="px-5 py-4 text-right font-normal">Plan</th>
                      <th className="px-5 py-4 text-right font-normal">Actual</th>
                      <th className="px-5 py-4 text-right font-normal">Variación</th>
                      <th className="px-5 py-4 font-normal">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(({ row, category }) => {
                      const plan = amount(row.budgeted_amount)
                      const actual = amount(row.actual_amount)
                      const variance = plan - actual
                      const isIncome = category.category_role === 'income'
                      const alert = isIncome ? actual < plan : actual > plan
                      return (
                        <tr key={row.id} className="bg-[var(--bs-surface-primary)] even:bg-[var(--bs-surface-secondary)]/40">
                          <td className="px-5 py-4 text-[var(--bs-text-primary)]">{category.name}</td>
                          <td className="px-5 py-4 text-right text-[var(--bs-text-secondary)]">{money(plan)}</td>
                          <td className="px-5 py-4 text-right text-[var(--bs-text-primary)]">{money(actual)}</td>
                          <td className={`px-5 py-4 text-right ${alert ? 'text-[var(--bs-warm-orange)]' : 'text-[var(--bs-cool-sage)]'}`}>{money(variance)}</td>
                          <td className="px-5 py-4"><span className={alert ? 'text-[var(--bs-warm-orange)]' : 'text-[var(--bs-cool-sage)]'}>{alert ? 'Revisar' : 'En rango'}</span></td>
                        </tr>
                      )
                    })}
                    {!categoryRows.length && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--bs-text-muted)]">No existen datos para este centro y periodo. Importa el Excel maestro para publicar el presupuesto completo.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {view === 'import' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5 bg-[var(--bs-surface-primary)] p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-warm-yellow)]">Carga canónica</p>
              <h3 className="mt-2 text-lg text-[var(--bs-text-primary)]">Subir el mismo Budget & P&L de la organización</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--bs-text-secondary)]">No es necesario convertirlo a CSV ni cambiar sus pestañas. La app lee Budget 26, conserva el archivo original y publica sus centros, categorías, meses, Plan y Actual.</p>
            </div>

            <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectFile(file) }} />
            <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center bg-[var(--bs-surface-secondary)] p-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-cool-sky)]">
              <UploadCloud className="h-8 w-8 text-[var(--bs-cool-sage)]" />
              <span className="mt-4 text-sm text-[var(--bs-text-primary)]">{parsing ? 'Leyendo estructura y fórmulas…' : selectedFile?.name ?? 'Seleccionar archivo Excel'}</span>
              <span className="mt-2 text-xs text-[var(--bs-text-muted)]">XLSX, XLSM o XLS · máximo 25 MB</span>
            </button>

            {preview && (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ['Año', preview.fiscalYear],
                    ['Hojas', preview.sheetNames.length],
                    ['Centros', preview.divisions.length],
                    ['Líneas mensuales', preview.lines.length],
                  ].map(([label, value]) => <div key={String(label)} className="bg-[var(--bs-surface-secondary)] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]">{label}</p><p className="mt-2 text-lg text-[var(--bs-text-primary)]">{value}</p></div>)}
                </div>

                {alreadyImported && (
                  <div className="flex gap-3 bg-[var(--bs-cool-basil)]/20 p-4 text-sm text-[var(--bs-cool-sage)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Esta versión exacta ya fue importada el {new Date(alreadyImported.imported_at ?? alreadyImported.created_at).toLocaleString('es-CL')}.
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="bg-[var(--bs-warm-orange)]/15 p-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--bs-warm-orange)]"><AlertTriangle className="h-4 w-4" />{preview.warnings.length} advertencias de estructura</div>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--bs-text-secondary)]">{preview.warnings.slice(0, 8).map((warning) => <li key={warning}>— {warning}</li>)}</ul>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr><th className="py-3 font-normal">Centro</th><th className="py-3 text-right font-normal">Costo plan anual</th><th className="py-3 text-right font-normal">Costo actual anual</th><th className="py-3 text-right font-normal">P&L plan</th><th className="py-3 text-right font-normal">P&L actual</th></tr></thead>
                    <tbody>{preview.divisions.map((division) => <tr key={division.key} className="even:bg-[var(--bs-surface-secondary)]/40"><td className="py-3 pr-4 text-[var(--bs-text-primary)]">{division.parentName && <span className="mr-2 text-xs text-[var(--bs-text-muted)]">{division.parentName} /</span>}{division.name}</td><td className="py-3 text-right text-[var(--bs-text-secondary)]">{money(division.annualPlanCost)}</td><td className="py-3 text-right text-[var(--bs-text-secondary)]">{money(division.annualActualCost)}</td><td className="py-3 text-right text-[var(--bs-text-primary)]">{money(division.annualPlanNet)}</td><td className="py-3 text-right text-[var(--bs-text-primary)]">{money(division.annualActualNet)}</td></tr>)}</tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void importWorkbook()} disabled={importing || parsing}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />{importing ? 'Importando…' : alreadyImported ? 'Usar versión importada' : 'Importar y publicar'}
                  </Button>
                  <Button variant="outline" onClick={() => { setPreview(null); setSelectedFile(null); setAlreadyImported(null); if (fileInput.current) fileInput.current.value = '' }}>Cancelar</Button>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4 bg-[var(--bs-surface-primary)] p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">Qué ocurre al importar</p>
            {[
              ['1', 'Se guarda el Excel original en un repositorio privado.'],
              ['2', 'Se valida la hoja Budget 26 y el año fiscal.'],
              ['3', 'Se crean o actualizan centros P&L y categorías conocidas.'],
              ['4', 'Plan y Actual se publican mes a mes con trazabilidad de celda.'],
              ['5', 'La vista general se actualiza mediante Supabase Realtime.'],
            ].map(([number, text]) => <div key={number} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[var(--bs-surface-elevated)] text-xs text-[var(--bs-warm-yellow)]">{number}</span><p className="text-sm leading-6 text-[var(--bs-text-secondary)]">{text}</p></div>)}
          </aside>
        </div>
      )}

      {view === 'history' && (
        <section className="bg-[var(--bs-surface-primary)]">
          <div className="p-5"><p className="text-xs uppercase tracking-[0.14em] text-[var(--bs-text-muted)]">Versiones cargadas</p><h3 className="mt-2 text-lg text-[var(--bs-text-primary)]">Historial del Excel maestro</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.1em] text-[var(--bs-text-muted)]"><tr><th className="px-5 py-4 font-normal">Archivo</th><th className="px-5 py-4 font-normal">Año</th><th className="px-5 py-4 font-normal">Estado</th><th className="px-5 py-4 font-normal">Filas</th><th className="px-5 py-4 font-normal">Fecha</th><th className="px-5 py-4 font-normal">Original</th></tr></thead>
              <tbody>{imports.map((run) => <tr key={run.id} className="even:bg-[var(--bs-surface-secondary)]/40"><td className="px-5 py-4 text-[var(--bs-text-primary)]">{run.file_name}<span className="mt-1 block font-mono text-[10px] text-[var(--bs-text-muted)]">{run.file_hash.slice(0, 16)}…</span></td><td className="px-5 py-4 text-[var(--bs-text-secondary)]">{run.fiscal_year}</td><td className="px-5 py-4"><span className={run.status === 'completed' ? 'text-[var(--bs-cool-sage)]' : run.status === 'failed' ? 'text-[var(--bs-warm-fire)]' : 'text-[var(--bs-warm-yellow)]'}>{run.status === 'completed' ? 'Completado' : run.status === 'failed' ? 'Falló' : 'Procesando'}</span>{run.error_message && <span className="mt-1 block text-xs text-[var(--bs-text-muted)]">{run.error_message}</span>}</td><td className="px-5 py-4 text-[var(--bs-text-secondary)]">{run.row_count}</td><td className="px-5 py-4 text-[var(--bs-text-secondary)]">{new Date(run.imported_at ?? run.created_at).toLocaleString('es-CL')}</td><td className="px-5 py-4"><Button size="sm" variant="outline" disabled={!run.storage_path} onClick={() => void downloadImport(run)}><ArrowDownToLine className="mr-2 h-4 w-4" />Descargar</Button></td></tr>)}</tbody>
            {!imports.length && <tbody><tr><td colSpan={6} className="px-5 py-10 text-center text-[var(--bs-text-muted)]">Todavía no se ha importado un Excel maestro.</td></tr></tbody>}
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
