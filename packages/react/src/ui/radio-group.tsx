import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("hp:grid hp:gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "hp:aspect-square hp:size-4 hp:shrink-0 hp:rounded-full hp:border hp:border-input hp:text-primary hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:bg-input/30 hp:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="hp:relative hp:flex hp:items-center hp:justify-center"
      >
        <CircleIcon className="hp:absolute hp:top-1/2 hp:left-1/2 hp:size-2 hp:-translate-x-1/2 hp:-translate-y-1/2 hp:fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
