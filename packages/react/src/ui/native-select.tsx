import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "../lib/utils"

function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <div
      className="hp:group/native-select hp:relative hp:w-full hp:has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "hp:h-9 hp:w-full hp:min-w-0 hp:appearance-none hp:rounded-md hp:border hp:border-input hp:bg-transparent hp:px-3 hp:py-2 hp:pr-9 hp:text-sm hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:selection:bg-primary hp:selection:text-primary-foreground hp:placeholder:text-muted-foreground hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:data-[size=sm]:h-8 hp:data-[size=sm]:py-1 hp:dark:bg-input/30 hp:dark:hover:bg-input/50",
          "hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50",
          "hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
      <ChevronDownIcon
        className="hp:pointer-events-none hp:absolute hp:top-1/2 hp:right-3.5 hp:size-4 hp:-translate-y-1/2 hp:text-muted-foreground hp:opacity-50 hp:select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("hp:bg-[Canvas] hp:text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("hp:bg-[Canvas] hp:text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
