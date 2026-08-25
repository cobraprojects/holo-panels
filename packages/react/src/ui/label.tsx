import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "hp:flex hp:items-center hp:gap-2 hp:text-sm hp:leading-none hp:font-medium hp:select-none hp:group-data-[disabled=true]:pointer-events-none hp:group-data-[disabled=true]:opacity-50 hp:peer-disabled:cursor-not-allowed hp:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
