import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "../lib/utils"

const badgeVariants = cva(
  "hp:inline-flex hp:w-fit hp:shrink-0 hp:items-center hp:justify-center hp:gap-1 hp:overflow-hidden hp:rounded-full hp:border hp:border-transparent hp:px-2 hp:py-0.5 hp:text-xs hp:font-medium hp:whitespace-nowrap hp:transition-[color,box-shadow] hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:[&>svg]:pointer-events-none hp:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "hp:bg-primary hp:text-primary-foreground hp:[a&]:hover:bg-primary/90",
        secondary:
          "hp:bg-secondary hp:text-secondary-foreground hp:[a&]:hover:bg-secondary/90",
        destructive:
          "hp:bg-destructive hp:text-white hp:focus-visible:ring-destructive/20 hp:dark:bg-destructive/60 hp:dark:focus-visible:ring-destructive/40 hp:[a&]:hover:bg-destructive/90",
        outline:
          "hp:border-border hp:text-foreground hp:[a&]:hover:bg-accent hp:[a&]:hover:text-accent-foreground",
        ghost: "hp:[a&]:hover:bg-accent hp:[a&]:hover:text-accent-foreground",
        link: "hp:text-primary hp:underline-offset-4 hp:[a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
