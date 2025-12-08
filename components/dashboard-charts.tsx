"use client"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts"

interface IssuesTrendChartProps {
  data: Array<{ date: string; issues: number }>
}

export function IssuesTrendChart({ data }: IssuesTrendChartProps) {
  return (
    <ChartContainer
      config={{
        issues: {
          label: "Issues Reported",
          color: "#1a73e8",
        },
      }}
      className="h-[200px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#666", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e0e0e0" }}
          />
          <YAxis tick={{ fill: "#666", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e0e0e0" }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="issues"
            stroke="var(--color-issues)"
            strokeWidth={2}
            dot={{ fill: "var(--color-issues)", r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

interface AssetDistributionChartProps {
  data: Array<{ type: string; count: number }>
}

export function AssetDistributionChart({ data }: AssetDistributionChartProps) {
  return (
    <ChartContainer
      config={{
        count: {
          label: "Assets",
          color: "#1a73e8",
        },
      }}
      className="h-[200px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="type"
            tick={{ fill: "#666", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e0e0e0" }}
          />
          <YAxis tick={{ fill: "#666", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e0e0e0" }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
