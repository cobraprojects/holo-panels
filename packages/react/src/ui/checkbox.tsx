"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "hp:peer hp:size-4 hp:shrink-0 hp:rounded-[4px] hp:border hp:border-input hp:shadow-xs hp:transition-shadow hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:data-[state=checked]:border-primary hp:data-[state=checked]:bg-primary hp:data-[state=checked]:text-primary-foreground hp:dark:bg-input/30 hp:dark:aria-invalid:ring-destructive/40 hp:dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="hp:grid hp:place-content-center hp:text-current hp:transition-none"
      >
        <CheckIcon className="hp:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
