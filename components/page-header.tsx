import type React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
      <div>
        <h1 className="text-lg font-semibold text-black md:text-xl">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
