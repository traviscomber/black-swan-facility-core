import type * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  icon?: React.ReactNode
}

function Input({ className, type, icon, ...props }: InputProps) {
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 border-0 bg-input px-3 py-2 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:outline-destructive",
        icon && "pl-10",
        className,
      )}
      {...props}
    />
  )

  if (!icon) return input

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {input}
    </div>
  )
}

export { Input }
