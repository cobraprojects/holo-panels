"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { usePanelsPortalContainer } from "../portal"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  forceMount,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  forceMount?: true
}) {
  const container = usePanelsPortalContainer()
  return (
    <PopoverPrimitive.Portal container={container} forceMount={forceMount}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        forceMount={forceMount}
        sideOffset={sideOffset}
        className={cn(
          "hp:z-50 hp:w-72 hp:origin-(--radix-popover-content-transform-origin) hp:rounded-md hp:border hp:bg-popover hp:p-4 hp:text-popover-foreground hp:shadow-md hp:outline-hidden hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("hp:flex hp:flex-col hp:gap-1 hp:text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("hp:font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("hp:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
