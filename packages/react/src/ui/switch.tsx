"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "hp:peer hp:group/switch hp:inline-flex hp:shrink-0 hp:items-center hp:rounded-full hp:border hp:border-transparent hp:shadow-xs hp:transition-all hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:data-[size=default]:h-[1.15rem] hp:data-[size=default]:w-8 hp:data-[size=sm]:h-3.5 hp:data-[size=sm]:w-6 hp:data-[state=checked]:bg-primary hp:data-[state=unchecked]:bg-input hp:dark:data-[state=unchecked]:bg-input/80",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "hp:pointer-events-none hp:block hp:rounded-full hp:bg-background hp:ring-0 hp:transition-transform hp:group-data-[size=default]/switch:size-4 hp:group-data-[size=sm]/switch:size-3 hp:data-[state=checked]:translate-x-[calc(100%-2px)] hp:data-[state=unchecked]:translate-x-0 hp:dark:data-[state=checked]:bg-primary-foreground hp:dark:data-[state=unchecked]:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
