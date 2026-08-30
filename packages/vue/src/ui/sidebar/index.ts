import type { VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "vue"
import { cva } from "class-variance-authority"

export interface SidebarProps {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
  closeLabel?: string
  mobileDescription?: string
  mobileTitle?: string
  class?: HTMLAttributes["class"]
}

export { default as Sidebar } from "./Sidebar.vue"
export { default as SidebarContent } from "./SidebarContent.vue"
export { default as SidebarFooter } from "./SidebarFooter.vue"
export { default as SidebarGroup } from "./SidebarGroup.vue"
export { default as SidebarGroupAction } from "./SidebarGroupAction.vue"
export { default as SidebarGroupContent } from "./SidebarGroupContent.vue"
export { default as SidebarGroupLabel } from "./SidebarGroupLabel.vue"
export { default as SidebarHeader } from "./SidebarHeader.vue"
export { default as SidebarInput } from "./SidebarInput.vue"
export { default as SidebarInset } from "./SidebarInset.vue"
export { default as SidebarMenu } from "./SidebarMenu.vue"
export { default as SidebarMenuAction } from "./SidebarMenuAction.vue"
export { default as SidebarMenuBadge } from "./SidebarMenuBadge.vue"
export { default as SidebarMenuButton } from "./SidebarMenuButton.vue"
export { default as SidebarMenuItem } from "./SidebarMenuItem.vue"
export { default as SidebarMenuSkeleton } from "./SidebarMenuSkeleton.vue"
export { default as SidebarMenuSub } from "./SidebarMenuSub.vue"
export { default as SidebarMenuSubButton } from "./SidebarMenuSubButton.vue"
export { default as SidebarMenuSubItem } from "./SidebarMenuSubItem.vue"
export { default as SidebarProvider } from "./SidebarProvider.vue"
export { default as SidebarRail } from "./SidebarRail.vue"
export { default as SidebarSeparator } from "./SidebarSeparator.vue"
export { default as SidebarTrigger } from "./SidebarTrigger.vue"

export { useSidebar } from "./utils"

export const sidebarMenuButtonVariants = cva(
  'hp:peer/menu-button hp:flex hp:w-full hp:items-center hp:gap-2 hp:overflow-hidden hp:rounded-md hp:p-2 hp:text-left hp:text-sm hp:outline-hidden hp:ring-sidebar-ring hp:transition-[width,height,padding] hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:group-has-data-[sidebar=menu-action]/menu-item:pr-8 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:data-[active=true]:bg-sidebar-accent hp:data-[active=true]:font-medium hp:data-[active=true]:text-sidebar-accent-foreground hp:data-[state=open]:hover:bg-sidebar-accent hp:data-[state=open]:hover:text-sidebar-accent-foreground hp:group-data-[collapsible=icon]:size-8! hp:group-data-[collapsible=icon]:p-2! hp:[&>span:last-child]:truncate hp:[&>svg]:size-4 hp:[&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground',
        outline:
          'hp:bg-background hp:shadow-[0_0_0_1px_var(--sidebar-border)] hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]',
      },
      size: {
        default: 'hp:h-8 hp:text-sm',
        sm: 'hp:h-7 hp:text-xs',
        lg: 'hp:h-12 hp:text-sm hp:group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type SidebarMenuButtonVariants = VariantProps<typeof sidebarMenuButtonVariants>
