import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-text-muted hover:text-text disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-segment [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:ring-ring focus-visible:ring-[3px] outline-none transition-[color,background-color,box-shadow] duration-120 ease-brand",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-border-strong bg-surface hover:bg-surface-2",
      },
      size: {
        default: "h-[38px] px-[18px] min-w-10",
        sm: "h-8 px-3 min-w-8",
        lg: "h-control px-5 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
