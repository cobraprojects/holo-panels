import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "hp:flex hp:min-w-0 hp:flex-1 hp:flex-col hp:items-center hp:justify-center hp:gap-6 hp:rounded-lg hp:border-dashed hp:p-6 hp:text-center hp:text-balance hp:md:p-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "hp:flex hp:max-w-sm hp:flex-col hp:items-center hp:gap-2 hp:text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "hp:mb-2 hp:flex hp:shrink-0 hp:items-center hp:justify-center hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hp:bg-transparent",
        icon: "hp:flex hp:size-10 hp:shrink-0 hp:items-center hp:justify-center hp:rounded-lg hp:bg-muted hp:text-foreground hp:[&_svg:not([class*=size-])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("hp:text-lg hp:font-medium hp:tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "hp:text-sm/relaxed hp:text-muted-foreground hp:[&>a]:underline hp:[&>a]:underline-offset-4 hp:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "hp:flex hp:w-full hp:max-w-sm hp:min-w-0 hp:flex-col hp:items-center hp:gap-4 hp:text-sm hp:text-balance",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
