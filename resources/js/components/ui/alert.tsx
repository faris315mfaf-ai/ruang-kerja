import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg px-4 py-3.5 text-[15px] leading-[22px] grid has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-5 [&>svg]:translate-y-px [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface text-text",
        destructive:
          "bg-danger-soft text-danger *:data-[slot=alert-description]:text-text",
        warning:
          "bg-warning-soft text-warning *:data-[slot=alert-description]:text-text",
        success:
          "bg-success-soft text-success *:data-[slot=alert-description]:text-text",
        info: "bg-info-soft text-info *:data-[slot=alert-description]:text-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-5 font-bold",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-text-muted col-start-2 grid justify-items-start gap-1 text-[15px] [&_p]:leading-[22px]",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
