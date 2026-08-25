"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { usePanelsPortalContainer } from "../portal"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const container = usePanelsPortalContainer()
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "hp:z-50 hp:w-fit hp:origin-(--radix-tooltip-content-transform-origin) hp:animate-in hp:rounded-md hp:bg-foreground hp:px-3 hp:py-1.5 hp:text-xs hp:text-balance hp:text-background hp:fade-in-0 hp:zoom-in-95 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="hp:z-50 hp:size-2.5 hp:translate-y-[calc(-50%_-_2px)] hp:rotate-45 hp:rounded-[2px] hp:bg-foreground hp:fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
