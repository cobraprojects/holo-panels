import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  "hp:inline-flex hp:shrink-0 hp:items-center hp:justify-center hp:gap-2 hp:rounded-md hp:text-sm hp:font-medium hp:whitespace-nowrap hp:transition-all hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "hp:bg-primary hp:text-primary-foreground hp:hover:bg-primary/90",
        destructive:
          "hp:bg-destructive hp:text-white hp:hover:bg-destructive/90 hp:focus-visible:ring-destructive/20 hp:dark:bg-destructive/60 hp:dark:focus-visible:ring-destructive/40",
        outline:
          "hp:border hp:bg-background hp:shadow-xs hp:hover:bg-accent hp:hover:text-accent-foreground hp:dark:border-input hp:dark:bg-input/30 hp:dark:hover:bg-input/50",
        secondary:
          "hp:bg-secondary hp:text-secondary-foreground hp:hover:bg-secondary/80",
        ghost:
          "hp:hover:bg-accent hp:hover:text-accent-foreground hp:dark:hover:bg-accent/50",
        link: "hp:text-primary hp:underline-offset-4 hp:hover:underline",
      },
      size: {
        default: "hp:h-9 hp:px-4 hp:py-2 hp:has-[>svg]:px-3",
        xs: "hp:h-6 hp:gap-1 hp:rounded-md hp:px-2 hp:text-xs hp:has-[>svg]:px-1.5 hp:[&_svg:not([class*=size-])]:size-3",
        sm: "hp:h-8 hp:gap-1.5 hp:rounded-md hp:px-3 hp:has-[>svg]:px-2.5",
        lg: "hp:h-10 hp:rounded-md hp:px-6 hp:has-[>svg]:px-4",
        icon: "hp:size-9",
        "icon-xs": "hp:size-6 hp:rounded-md hp:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "hp:size-8",
        "icon-lg": "hp:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ref,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonVariants }
