<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="sidebar-menu-badge"
    data-sidebar="menu-badge"
    :class="cn(
      'hp:text-sidebar-foreground hp:pointer-events-none hp:absolute hp:right-1 hp:flex hp:h-5 hp:min-w-5 hp:items-center hp:justify-center hp:rounded-md hp:px-1 hp:text-xs hp:font-medium hp:tabular-nums hp:select-none',
      'hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
      'hp:peer-data-[size=sm]/menu-button:top-1',
      'hp:peer-data-[size=default]/menu-button:top-1.5',
      'hp:peer-data-[size=lg]/menu-button:top-2.5',
      'hp:group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
