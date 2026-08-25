import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const alertVariants = cva(
  "hp:relative hp:grid hp:w-full hp:grid-cols-[0_1fr] hp:items-start hp:gap-y-0.5 hp:rounded-lg hp:border hp:px-4 hp:py-3 hp:text-sm hp:has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] hp:has-[>svg]:gap-x-3 hp:[&>svg]:size-4 hp:[&>svg]:translate-y-0.5 hp:[&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "hp:bg-card hp:text-card-foreground",
        destructive:
          "hp:bg-card hp:text-destructive hp:*:data-[slot=alert-description]:text-destructive/90 hp:[&>svg]:text-current",
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
        "hp:col-start-2 hp:line-clamp-1 hp:min-h-4 hp:font-medium hp:tracking-tight",
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
        "hp:col-start-2 hp:grid hp:justify-items-start hp:gap-1 hp:text-sm hp:text-muted-foreground hp:[&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
