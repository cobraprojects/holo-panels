import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "hp:shrink-0 hp:bg-border hp:data-[orientation=horizontal]:h-px hp:data-[orientation=horizontal]:w-full hp:data-[orientation=vertical]:h-full hp:data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
