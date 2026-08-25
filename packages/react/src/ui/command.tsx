"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import { cn } from "../lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "hp:flex hp:h-full hp:w-full hp:flex-col hp:overflow-hidden hp:rounded-md hp:bg-popover hp:text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="hp:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("hp:overflow-hidden hp:p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command className="hp:**:data-[slot=command-input-wrapper]:h-12 hp:[&_[cmdk-group-heading]]:px-2 hp:[&_[cmdk-group-heading]]:font-medium hp:[&_[cmdk-group-heading]]:text-muted-foreground hp:[&_[cmdk-group]]:px-2 hp:[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 hp:[&_[cmdk-input-wrapper]_svg]:h-5 hp:[&_[cmdk-input-wrapper]_svg]:w-5 hp:[&_[cmdk-input]]:h-12 hp:[&_[cmdk-item]]:px-2 hp:[&_[cmdk-item]]:py-3 hp:[&_[cmdk-item]_svg]:h-5 hp:[&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="hp:flex hp:h-9 hp:items-center hp:gap-2 hp:border-b hp:px-3"
    >
      <SearchIcon className="hp:size-4 hp:shrink-0 hp:opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "hp:flex hp:h-10 hp:w-full hp:rounded-md hp:bg-transparent hp:py-3 hp:text-sm hp:outline-hidden hp:placeholder:text-muted-foreground hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "hp:max-h-[300px] hp:scroll-py-1 hp:overflow-x-hidden hp:overflow-y-auto",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="hp:py-6 hp:text-center hp:text-sm"
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "hp:overflow-hidden hp:p-1 hp:text-foreground hp:[&_[cmdk-group-heading]]:px-2 hp:[&_[cmdk-group-heading]]:py-1.5 hp:[&_[cmdk-group-heading]]:text-xs hp:[&_[cmdk-group-heading]]:font-medium hp:[&_[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("hp:-mx-1 hp:h-px hp:bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:data-[disabled=true]:pointer-events-none hp:data-[disabled=true]:opacity-50 hp:data-[selected=true]:bg-accent hp:data-[selected=true]:text-accent-foreground hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4 hp:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "hp:ml-auto hp:text-xs hp:tracking-widest hp:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
