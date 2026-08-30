"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeftIcon } from "lucide-react"
import { Slot } from "@radix-ui/react-slot"

import { useIsMobile } from "./use-mobile"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Separator } from "./separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet"
import { Skeleton } from "./skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "hp:group/sidebar-wrapper hp:flex hp:min-h-svh hp:w-full hp:has-data-[variant=inset]:bg-sidebar",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  closeLabel = "Close",
  mobileDescription = "Displays the mobile sidebar.",
  mobileTitle = "Sidebar",
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
  closeLabel?: string
  mobileDescription?: string
  mobileTitle?: string
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "hp:flex hp:h-full hp:w-(--sidebar-width) hp:flex-col hp:bg-sidebar hp:text-sidebar-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          closeLabel={closeLabel}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className={cn("hp:w-(--sidebar-width) hp:bg-sidebar hp:p-0 hp:text-sidebar-foreground hp:[&>button]:hidden", className)}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="hp:sr-only">
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </SheetHeader>
          <div className="hp:flex hp:h-full hp:w-full hp:flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="hp:group hp:peer hp:hidden hp:text-sidebar-foreground hp:md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "hp:relative hp:w-(--sidebar-width) hp:bg-transparent hp:transition-[width] hp:duration-200 hp:ease-linear",
          "hp:group-data-[collapsible=offcanvas]:w-0",
          "hp:group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "hp:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "hp:fixed hp:inset-y-0 hp:z-10 hp:hidden hp:h-svh hp:w-(--sidebar-width) hp:transition-[left,right,width] hp:duration-200 hp:ease-linear hp:md:flex",
          side === "left"
            ? "hp:left-0 hp:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "hp:right-0 hp:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "hp:p-2 hp:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon) hp:group-data-[side=left]:border-r hp:group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="hp:flex hp:h-full hp:w-full hp:flex-col hp:bg-sidebar hp:group-data-[variant=floating]:rounded-lg hp:group-data-[variant=floating]:border hp:group-data-[variant=floating]:border-sidebar-border hp:group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ref,
  "aria-label": ariaLabel = "Toggle Sidebar",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const previousOpenMobile = React.useRef(openMobile)

  const setTriggerRef = React.useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node
    if (typeof ref === "function") {
      ref(node)
      return
    }
    if (ref) ref.current = node
  }, [ref])

  React.useEffect(() => {
    if (isMobile && previousOpenMobile.current && !openMobile) {
      queueMicrotask(() => triggerRef.current?.focus())
    }
    previousOpenMobile.current = openMobile
  }, [isMobile, openMobile])

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-expanded={isMobile ? openMobile : open}
      aria-label={ariaLabel}
      ref={setTriggerRef}
      variant="ghost"
      size="icon"
      className={cn("hp:size-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="hp:sr-only">{ariaLabel}</span>
    </Button>
  )
}

function SidebarRail({ className, label = "Toggle Sidebar", ...props }: React.ComponentPropsWithoutRef<"button"> & { label?: string }) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label={label}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={label}
      className={cn(
        "hp:absolute hp:inset-y-0 hp:z-20 hp:hidden hp:w-4 hp:-translate-x-1/2 hp:transition-all hp:ease-linear hp:group-data-[side=left]:-right-4 hp:group-data-[side=right]:left-0 hp:after:absolute hp:after:inset-y-0 hp:after:left-1/2 hp:after:w-[2px] hp:hover:after:bg-sidebar-border hp:sm:flex",
        "hp:in-data-[side=left]:cursor-w-resize hp:in-data-[side=right]:cursor-e-resize",
        "hp:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize hp:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hp:group-data-[collapsible=offcanvas]:translate-x-0 hp:group-data-[collapsible=offcanvas]:after:left-full hp:hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "hp:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "hp:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "hp:relative hp:flex hp:w-full hp:flex-1 hp:flex-col hp:bg-background",
        "hp:md:peer-data-[variant=inset]:m-2 hp:md:peer-data-[variant=inset]:ml-0 hp:md:peer-data-[variant=inset]:rounded-xl hp:md:peer-data-[variant=inset]:shadow-sm hp:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("hp:h-8 hp:w-full hp:bg-background hp:shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("hp:flex hp:flex-col hp:gap-2 hp:p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("hp:flex hp:flex-col hp:gap-2 hp:p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("hp:mx-2 hp:w-auto hp:bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "hp:flex hp:min-h-0 hp:flex-1 hp:flex-col hp:gap-2 hp:overflow-auto hp:group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("hp:relative hp:flex hp:w-full hp:min-w-0 hp:flex-col hp:p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "hp:flex hp:h-8 hp:shrink-0 hp:items-center hp:rounded-md hp:px-2 hp:text-xs hp:font-medium hp:text-sidebar-foreground/70 hp:ring-sidebar-ring hp:outline-hidden hp:transition-[margin,opacity] hp:duration-200 hp:ease-linear hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0",
        "hp:group-data-[collapsible=icon]:-mt-8 hp:group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "hp:absolute hp:top-3.5 hp:right-3 hp:flex hp:aspect-square hp:w-5 hp:items-center hp:justify-center hp:rounded-md hp:p-0 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:outline-hidden hp:transition-transform hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "hp:after:absolute hp:after:-inset-2 hp:md:after:hidden",
        "hp:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("hp:w-full hp:text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("hp:flex hp:w-full hp:min-w-0 hp:flex-col hp:gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("hp:group/menu-item hp:relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "hp:peer/menu-button hp:flex hp:w-full hp:items-center hp:gap-2 hp:overflow-hidden hp:rounded-md hp:p-2 hp:text-left hp:text-sm hp:ring-sidebar-ring hp:outline-hidden hp:transition-[width,height,padding] hp:group-has-data-[sidebar=menu-action]/menu-item:pr-8 hp:group-data-[collapsible=icon]:size-8! hp:group-data-[collapsible=icon]:p-2! hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:data-[active=true]:bg-sidebar-accent hp:data-[active=true]:font-medium hp:data-[active=true]:text-sidebar-accent-foreground hp:data-[state=open]:hover:bg-sidebar-accent hp:data-[state=open]:hover:text-sidebar-accent-foreground hp:[&>span:last-child]:truncate hp:[&>svg]:size-4 hp:[&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground",
        outline:
          "hp:bg-background hp:shadow-[0_0_0_1px_var(--sidebar-border)] hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "hp:h-8 hp:text-sm",
        sm: "hp:h-7 hp:text-xs",
        lg: "hp:h-12 hp:text-sm hp:group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "hp:absolute hp:top-1.5 hp:right-1 hp:flex hp:aspect-square hp:w-5 hp:items-center hp:justify-center hp:rounded-md hp:p-0 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:outline-hidden hp:transition-transform hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "hp:after:absolute hp:after:-inset-2 hp:md:after:hidden",
        "hp:peer-data-[size=sm]/menu-button:top-1",
        "hp:peer-data-[size=default]/menu-button:top-1.5",
        "hp:peer-data-[size=lg]/menu-button:top-2.5",
        "hp:group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "hp:group-focus-within/menu-item:opacity-100 hp:group-hover/menu-item:opacity-100 hp:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground hp:data-[state=open]:opacity-100 hp:md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "hp:pointer-events-none hp:absolute hp:right-1 hp:flex hp:h-5 hp:min-w-5 hp:items-center hp:justify-center hp:rounded-md hp:px-1 hp:text-xs hp:font-medium hp:text-sidebar-foreground hp:tabular-nums hp:select-none",
        "hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "hp:peer-data-[size=sm]/menu-button:top-1",
        "hp:peer-data-[size=default]/menu-button:top-1.5",
        "hp:peer-data-[size=lg]/menu-button:top-2.5",
        "hp:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("hp:flex hp:h-8 hp:items-center hp:gap-2 hp:rounded-md hp:px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="hp:size-4 hp:rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="hp:h-4 hp:max-w-(--skeleton-width) hp:flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "hp:mx-3.5 hp:flex hp:min-w-0 hp:translate-x-px hp:flex-col hp:gap-1 hp:border-l hp:border-sidebar-border hp:px-2.5 hp:py-0.5",
        "hp:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("hp:group/menu-sub-item hp:relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "hp:flex hp:h-7 hp:min-w-0 hp:-translate-x-px hp:items-center hp:gap-2 hp:overflow-hidden hp:rounded-md hp:px-2 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:outline-hidden hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:[&>span:last-child]:truncate hp:[&>svg]:size-4 hp:[&>svg]:shrink-0 hp:[&>svg]:text-sidebar-accent-foreground",
        "hp:data-[active=true]:bg-sidebar-accent hp:data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "hp:text-xs",
        size === "md" && "hp:text-sm",
        "hp:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
