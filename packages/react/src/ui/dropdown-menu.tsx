"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { usePanelsPortalContainer } from "../portal"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  container,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  const panelsContainer = usePanelsPortalContainer()
  return (
    <DropdownMenuPrimitive.Portal container={container ?? panelsContainer} data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "hp:z-50 hp:max-h-(--radix-dropdown-menu-content-available-height) hp:min-w-[8rem] hp:origin-(--radix-dropdown-menu-content-transform-origin) hp:overflow-x-hidden hp:overflow-y-auto hp:rounded-md hp:border hp:bg-popover hp:p-1 hp:text-popover-foreground hp:shadow-md hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:data-[inset]:pl-8 hp:data-[variant=destructive]:text-destructive hp:data-[variant=destructive]:focus:bg-destructive/10 hp:data-[variant=destructive]:focus:text-destructive hp:dark:data-[variant=destructive]:focus:bg-destructive/20 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4 hp:[&_svg:not([class*=text-])]:text-muted-foreground hp:data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:py-1.5 hp:pr-2 hp:pl-8 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="hp:pointer-events-none hp:absolute hp:left-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="hp:size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:py-1.5 hp:pr-2 hp:pl-8 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      <span className="hp:pointer-events-none hp:absolute hp:left-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="hp:size-2 hp:fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "hp:px-2 hp:py-1.5 hp:text-sm hp:font-medium hp:data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("hp:-mx-1 hp:my-1 hp:h-px hp:bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "hp:ml-auto hp:text-xs hp:tracking-widest hp:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[inset]:pl-8 hp:data-[state=open]:bg-accent hp:data-[state=open]:text-accent-foreground hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4 hp:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="hp:ml-auto hp:size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "hp:z-50 hp:min-w-[8rem] hp:origin-(--radix-dropdown-menu-content-transform-origin) hp:overflow-hidden hp:rounded-md hp:border hp:bg-popover hp:p-1 hp:text-popover-foreground hp:shadow-lg hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
