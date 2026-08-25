import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "hp:group/avatar hp:relative hp:flex hp:size-8 hp:shrink-0 hp:overflow-hidden hp:rounded-full hp:select-none hp:data-[size=lg]:size-10 hp:data-[size=sm]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("hp:aspect-square hp:size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "hp:flex hp:size-full hp:items-center hp:justify-center hp:rounded-full hp:bg-muted hp:text-sm hp:text-muted-foreground hp:group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "hp:absolute hp:right-0 hp:bottom-0 hp:z-10 hp:inline-flex hp:items-center hp:justify-center hp:rounded-full hp:bg-primary hp:text-primary-foreground hp:ring-2 hp:ring-background hp:select-none",
        "hp:group-data-[size=sm]/avatar:size-2 hp:group-data-[size=sm]/avatar:[&>svg]:hidden",
        "hp:group-data-[size=default]/avatar:size-2.5 hp:group-data-[size=default]/avatar:[&>svg]:size-2",
        "hp:group-data-[size=lg]/avatar:size-3 hp:group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "hp:group/avatar-group hp:flex hp:-space-x-2 hp:*:data-[slot=avatar]:ring-2 hp:*:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "hp:relative hp:flex hp:size-8 hp:shrink-0 hp:items-center hp:justify-center hp:rounded-full hp:bg-muted hp:text-sm hp:text-muted-foreground hp:ring-2 hp:ring-background hp:group-has-data-[size=lg]/avatar-group:size-10 hp:group-has-data-[size=sm]/avatar-group:size-6 hp:[&>svg]:size-4 hp:group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 hp:group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}
