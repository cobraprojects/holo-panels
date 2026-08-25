<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<PrimitiveProps & {
  size?: "sm" | "md"
  isActive?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  as: "a",
  size: "md",
})
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-sub-button"
    data-sidebar="menu-sub-button"
    :as="as"
    :as-child="asChild"
    :data-size="size"
    :data-active="isActive"
    :class="cn(
      'hp:text-sidebar-foreground hp:ring-sidebar-ring hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:[&>svg]:text-sidebar-accent-foreground hp:flex hp:h-7 hp:min-w-0 hp:-translate-x-px hp:items-center hp:gap-2 hp:overflow-hidden hp:rounded-md hp:px-2 hp:outline-hidden hp:focus-visible:ring-2 hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:[&>span:last-child]:truncate hp:[&>svg]:size-4 hp:[&>svg]:shrink-0',
      'hp:data-[active=true]:bg-sidebar-accent hp:data-[active=true]:text-sidebar-accent-foreground',
      size === 'sm' && 'hp:text-xs',
      size === 'md' && 'hp:text-sm',
      'hp:group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
