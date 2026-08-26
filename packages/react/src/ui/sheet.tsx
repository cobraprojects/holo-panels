"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { usePanelsPortalContainer } from "../portal"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  container,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  const panelsContainer = usePanelsPortalContainer()
  return <SheetPrimitive.Portal container={container ?? panelsContainer} data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "hp:fixed hp:inset-0 hp:z-50 hp:bg-black/50 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-panels-component="slide-over"
        data-side={side}
        className={cn(
          "hp:fixed hp:z-50 hp:flex hp:flex-col hp:gap-4 hp:bg-background hp:shadow-lg hp:transition hp:duration-200 hp:ease-in-out hp:data-[state=closed]:animate-out hp:data-[state=open]:animate-in",
          side === "right" &&
            "hp:inset-y-0 hp:right-0 hp:h-full hp:w-3/4 hp:border-l hp:data-[state=closed]:slide-out-to-right hp:data-[state=open]:slide-in-from-right hp:sm:max-w-sm",
          side === "left" &&
            "hp:inset-y-0 hp:left-0 hp:h-full hp:w-3/4 hp:border-r hp:data-[state=closed]:slide-out-to-left hp:data-[state=open]:slide-in-from-left hp:sm:max-w-sm",
          side === "top" &&
            "hp:inset-x-0 hp:top-0 hp:h-auto hp:border-b hp:data-[state=closed]:slide-out-to-top hp:data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "hp:inset-x-0 hp:bottom-0 hp:h-auto hp:border-t hp:data-[state=closed]:slide-out-to-bottom hp:data-[state=open]:slide-in-from-bottom",
          "hp-slide-over",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="hp:absolute hp:top-4 hp:right-4 hp:rounded-xs hp:opacity-70 hp:ring-offset-background hp:transition-opacity hp:hover:opacity-100 hp:focus:ring-2 hp:focus:ring-ring hp:focus:ring-offset-2 hp:focus:outline-hidden hp:disabled:pointer-events-none hp:data-[state=open]:bg-secondary">
            <XIcon className="hp:size-4" />
            <span className="hp:sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("hp:flex hp:flex-col hp:gap-1.5 hp:p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("hp:mt-auto hp:flex hp:flex-col hp:gap-2 hp:p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("hp:font-semibold hp:text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("hp:text-sm hp:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
