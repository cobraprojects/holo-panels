import * as React from "react"

import { cn } from "../lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "hp:h-9 hp:w-full hp:min-w-0 hp:rounded-md hp:border hp:border-input hp:bg-transparent hp:px-3 hp:py-1 hp:text-base hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:selection:bg-primary hp:selection:text-primary-foreground hp:file:inline-flex hp:file:h-7 hp:file:border-0 hp:file:bg-transparent hp:file:text-sm hp:file:font-medium hp:file:text-foreground hp:placeholder:text-muted-foreground hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:md:text-sm hp:dark:bg-input/30",
        "hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50",
        "hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
