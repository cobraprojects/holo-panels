import * as React from "react"

import { cn } from "../lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "hp:flex hp:field-sizing-content hp:min-h-16 hp:w-full hp:rounded-md hp:border hp:border-input hp:bg-transparent hp:px-3 hp:py-2 hp:text-base hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:placeholder:text-muted-foreground hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:md:text-sm hp:dark:bg-input/30 hp:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
