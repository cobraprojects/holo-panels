import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { usePanelsPortalContainer } from "../portal"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "hp:flex hp:w-fit hp:items-center hp:justify-between hp:gap-2 hp:rounded-md hp:border hp:border-input hp:bg-transparent hp:px-3 hp:py-2 hp:text-sm hp:whitespace-nowrap hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:data-[placeholder]:text-muted-foreground hp:data-[size=default]:h-9 hp:data-[size=sm]:h-8 hp:*:data-[slot=select-value]:line-clamp-1 hp:*:data-[slot=select-value]:flex hp:*:data-[slot=select-value]:items-center hp:*:data-[slot=select-value]:gap-2 hp:dark:bg-input/30 hp:dark:hover:bg-input/50 hp:dark:aria-invalid:ring-destructive/40 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4 hp:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="hp:size-4 hp:opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const container = usePanelsPortalContainer()
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "hp:relative hp:z-50 hp:max-h-(--radix-select-content-available-height) hp:min-w-[8rem] hp:origin-(--radix-select-content-transform-origin) hp:overflow-x-hidden hp:overflow-y-auto hp:rounded-md hp:border hp:bg-popover hp:text-popover-foreground hp:shadow-md hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95",
          position === "popper" &&
            "hp:data-[side=bottom]:translate-y-1 hp:data-[side=left]:-translate-x-1 hp:data-[side=right]:translate-x-1 hp:data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "hp:p-1",
            position === "popper" &&
              "hp:h-[var(--radix-select-trigger-height)] hp:w-full hp:min-w-[var(--radix-select-trigger-width)] hp:scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("hp:px-2 hp:py-1.5 hp:text-xs hp:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "hp:relative hp:flex hp:w-full hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:py-1.5 hp:pr-8 hp:pl-2 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4 hp:[&_svg:not([class*=text-])]:text-muted-foreground hp:*:[span]:last:flex hp:*:[span]:last:items-center hp:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="hp:absolute hp:right-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="hp:size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("hp:pointer-events-none hp:-mx-1 hp:my-1 hp:h-px hp:bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "hp:flex hp:cursor-default hp:items-center hp:justify-center hp:py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="hp:size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "hp:flex hp:cursor-default hp:items-center hp:justify-center hp:py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="hp:size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
