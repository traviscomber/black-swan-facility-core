import type * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap border-0 rounded-none px-4 text-[13px] font-medium leading-none shadow-none transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#9fd8b9] active:bg-[#79b998]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[#f65a2a] active:bg-[#c92402]",
        outline: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-[#675e52]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-[#675e52]",
        accent: "bg-accent text-accent-foreground hover:bg-[#5d554a] active:bg-[#675e52]",
        ghost: "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-accent",
        link: "min-h-0 bg-transparent p-0 text-[#36b6f8] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-10 px-3 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "size-10 p-0",
        "icon-sm": "size-10 p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
