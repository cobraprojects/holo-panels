import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { usePanelsPortalContainer } from "../portal"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  container,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  const panelsContainer = usePanelsPortalContainer()
  return (
    <AlertDialogPrimitive.Portal container={container ?? panelsContainer} data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "hp:fixed hp:inset-0 hp:z-50 hp:bg-black/50 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "hp:group/alert-dialog-content hp:fixed hp:top-[50%] hp:left-[50%] hp:z-50 hp:grid hp:w-full hp:max-w-[calc(100%-2rem)] hp:translate-x-[-50%] hp:translate-y-[-50%] hp:gap-4 hp:rounded-lg hp:border hp:bg-background hp:p-6 hp:shadow-lg hp:duration-200 hp:data-[size=sm]:max-w-xs hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95 hp:data-[size=default]:sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "hp:grid hp:grid-rows-[auto_1fr] hp:place-items-center hp:gap-1.5 hp:text-center hp:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] hp:has-data-[slot=alert-dialog-media]:gap-x-6 hp:sm:group-data-[size=default]/alert-dialog-content:place-items-start hp:sm:group-data-[size=default]/alert-dialog-content:text-left hp:sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "hp:flex hp:flex-col-reverse hp:gap-2 hp:group-data-[size=sm]/alert-dialog-content:grid hp:group-data-[size=sm]/alert-dialog-content:grid-cols-2 hp:sm:flex-row hp:sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "hp:text-lg hp:font-semibold hp:sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("hp:text-sm hp:text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "hp:mb-2 hp:inline-flex hp:size-16 hp:items-center hp:justify-center hp:rounded-md hp:bg-muted hp:sm:group-data-[size=default]/alert-dialog-content:row-span-2 hp:*:[svg:not([class*=size-])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Partial<Pick<React.ComponentProps<typeof Button>, "variant" | "size">>) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Partial<Pick<React.ComponentProps<typeof Button>, "variant" | "size">>) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
