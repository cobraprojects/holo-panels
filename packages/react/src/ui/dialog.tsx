import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { usePanelsPortalContainer } from "../portal"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  container,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const panelsContainer = usePanelsPortalContainer()
  return <DialogPrimitive.Portal container={container ?? panelsContainer} data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "hp:fixed hp:inset-0 hp:z-50 hp:bg-black/50 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-modal="true"
        data-slot="dialog-content"
        data-panels-component="modal"
        className={cn(
          "hp:fixed hp:top-[50%] hp:left-[50%] hp:z-50 hp:grid hp:w-full hp:max-w-[calc(100%-2rem)] hp:translate-x-[-50%] hp:translate-y-[-50%] hp:gap-4 hp:rounded-lg hp:border hp:bg-background hp:p-6 hp:shadow-lg hp:duration-200 hp:outline-none hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95 hp:sm:max-w-lg",
          "hp-modal",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="hp:absolute hp:top-4 hp:end-4 hp:rounded-xs hp:opacity-70 hp:ring-offset-background hp:transition-opacity hp:hover:opacity-100 hp:focus:ring-2 hp:focus:ring-ring hp:focus:ring-offset-2 hp:focus:outline-hidden hp:disabled:pointer-events-none hp:data-[state=open]:bg-accent hp:data-[state=open]:text-muted-foreground hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4"
          >
            <XIcon />
            <span className="hp:sr-only hp:rtl:hidden">Close</span><span className="hp:sr-only hp:hidden hp:rtl:inline">إغلاق</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("hp:flex hp:flex-col hp:gap-2 hp:text-center hp:sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "hp:flex hp:flex-col-reverse hp:gap-2 hp:sm:flex-row hp:sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline"><span className="hp:rtl:hidden">Close</span><span className="hp:hidden hp:rtl:inline">إغلاق</span></Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("hp:text-lg hp:leading-none hp:font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("hp:text-sm hp:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
