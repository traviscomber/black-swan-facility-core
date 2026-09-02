"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type SeasonPulsePoint = {
  label: string
  sow: number
  transplant: number
  harvest: number
}

type WorkloadPoint = {
  label: string
  implantation: number
  followUp: number
}

type CapacityPoint = {
  label: string
  occupancy: number
  capacity: number
}

type Locale = "en" | "es" | "de"

const palette = {
  sow: "#d5b45a",
  transplant: "#ef7654",
  harvest: "#87c7b8",
  implantation: "#e69a45",
  followUp: "#d7a8bc",
  occupancy: "#4f9d7a",
  capacity: "#8d968f",
  grid: "rgba(145, 155, 147, .18)",
}

const labels = {
  en: { sow: "Sowing", transplant: "Transplant", harvest: "First harvest", implantation: "Implantation", followUp: "Follow-up work", occupancy: "Occupied bed-m", capacity: "Physical capacity", actions: "actions", meters: "bed-m" },
  es: { sow: "Siembra", transplant: "Trasplante", harvest: "Primera cosecha", implantation: "Implantación", followUp: "Labores posteriores", occupancy: "Bed-m ocupados", capacity: "Capacidad física", actions: "acciones", meters: "bed-m" },
  de: { sow: "Aussaat", transplant: "Verpflanzung", harvest: "Erste Ernte", implantation: "Pflanzung", followUp: "Folgearbeiten", occupancy: "Belegte Beetmeter", capacity: "Physische Kapazität", actions: "Arbeiten", meters: "Beet-m" },
} as const

function TooltipShell({ active, payload, label, suffix }: { active?: boolean; payload?: readonly any[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null
  return <div className="min-w-40 border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-primary)] px-3 py-2 text-xs shadow-xl">
    <p className="mb-2 font-medium text-foreground">{label}</p>
    <div className="space-y-1.5">{payload.map((item) => <div key={String(item.dataKey)} className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }}/>{item.name}</span><span className="font-mono tabular-nums text-foreground">{Number(item.value ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 1 })}{suffix ? ` ${suffix}` : ""}</span></div>)}</div>
  </div>
}

export function SeasonPulseChart({ data, language }: { data: SeasonPulsePoint[]; language: Locale }) {
  const text = labels[language]
  return <div className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 12, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} width={32} />
        <Tooltip cursor={{ fill: "rgba(128,128,128,.08)" }} content={(props) => <TooltipShell {...props} />} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Bar dataKey="sow" name={text.sow} fill={palette.sow} radius={[2, 2, 0, 0]} />
        <Bar dataKey="transplant" name={text.transplant} fill={palette.transplant} radius={[2, 2, 0, 0]} />
        <Bar dataKey="harvest" name={text.harvest} fill={palette.harvest} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
}

export function PlannedWorkloadChart({ data, language }: { data: WorkloadPoint[]; language: Locale }) {
  const text = labels[language]
  return <div className="h-[360px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 12, left: -12, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} tick={{ fill: "currentColor", fontSize: 10 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} width={34} />
        <Tooltip cursor={{ fill: "rgba(128,128,128,.08)" }} content={(props) => <TooltipShell {...props} suffix={text.actions} />} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Bar dataKey="implantation" name={text.implantation} stackId="work" fill={palette.implantation} />
        <Bar dataKey="followUp" name={text.followUp} stackId="work" fill={palette.followUp} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
}

export function CapacityCurveChart({ data, language, peakLabel }: { data: CapacityPoint[]; language: Locale; peakLabel?: string | null }) {
  const text = labels[language]
  return <div className="h-[330px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 18, right: 14, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id="orchard-capacity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.occupancy} stopOpacity={0.42} />
            <stop offset="100%" stopColor={palette.occupancy} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={palette.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} tick={{ fill: "currentColor", fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} width={48} />
        <Tooltip content={(props) => <TooltipShell {...props} suffix={text.meters} />} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Area type="monotone" dataKey="occupancy" name={text.occupancy} stroke={palette.occupancy} strokeWidth={2} fill="url(#orchard-capacity-fill)" />
        <Line type="monotone" dataKey="capacity" name={text.capacity} stroke={palette.capacity} strokeWidth={1.5} strokeDasharray="6 5" dot={false} />
        {peakLabel ? <ReferenceLine x={peakLabel} stroke={palette.sow} strokeDasharray="3 3" /> : null}
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
