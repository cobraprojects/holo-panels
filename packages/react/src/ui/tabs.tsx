import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "hp:group/tabs hp:flex hp:gap-2 hp:data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "hp:group/tabs-list hp:inline-flex hp:w-fit hp:items-center hp:justify-center hp:rounded-lg hp:p-[3px] hp:text-muted-foreground hp:group-data-[orientation=horizontal]/tabs:h-9 hp:group-data-[orientation=vertical]/tabs:h-fit hp:group-data-[orientation=vertical]/tabs:flex-col hp:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "hp:bg-muted",
        line: "hp:gap-1 hp:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "hp:relative hp:inline-flex hp:h-[calc(100%-1px)] hp:flex-1 hp:items-center hp:justify-center hp:gap-1.5 hp:rounded-md hp:border hp:border-transparent hp:px-2 hp:py-1 hp:text-sm hp:font-medium hp:whitespace-nowrap hp:text-foreground/60 hp:transition-all hp:group-data-[orientation=vertical]/tabs:w-full hp:group-data-[orientation=vertical]/tabs:justify-start hp:hover:text-foreground hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:focus-visible:outline-1 hp:focus-visible:outline-ring hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm hp:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none hp:dark:text-muted-foreground hp:dark:hover:text-foreground hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*=size-])]:size-4",
        "hp:group-data-[variant=line]/tabs-list:bg-transparent hp:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent hp:dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent hp:dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "hp:data-[state=active]:bg-background hp:data-[state=active]:text-foreground hp:dark:data-[state=active]:border-input hp:dark:data-[state=active]:bg-input/30 hp:dark:data-[state=active]:text-foreground",
        "hp:after:absolute hp:after:bg-foreground hp:after:opacity-0 hp:after:transition-opacity hp:group-data-[orientation=horizontal]/tabs:after:inset-x-0 hp:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] hp:group-data-[orientation=horizontal]/tabs:after:h-0.5 hp:group-data-[orientation=vertical]/tabs:after:inset-y-0 hp:group-data-[orientation=vertical]/tabs:after:-right-1 hp:group-data-[orientation=vertical]/tabs:after:w-0.5 hp:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("hp:flex-1 hp:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
