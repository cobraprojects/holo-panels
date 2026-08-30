<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { useSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  label?: string
}>()

const { toggleSidebar } = useSidebar()
</script>

<template>
  <button
    data-sidebar="rail"
    data-slot="sidebar-rail"
    :aria-label="props.label ?? 'Toggle Sidebar'"
    :tabindex="-1"
    :title="props.label ?? 'Toggle Sidebar'"
    :class="cn(
      'hp:hover:after:bg-sidebar-border hp:absolute hp:inset-y-0 hp:z-20 hp:hidden hp:w-4 hp:-translate-x-1/2 hp:transition-all hp:ease-linear hp:group-data-[side=left]:-right-4 hp:group-data-[side=right]:left-0 hp:after:absolute hp:after:inset-y-0 hp:after:left-1/2 hp:after:w-0.5 hp:sm:flex',
      'hp:in-data-[side=left]:cursor-w-resize hp:in-data-[side=right]:cursor-e-resize',
      'hp:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize hp:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'hp:hover:group-data-[collapsible=offcanvas]:bg-sidebar hp:group-data-[collapsible=offcanvas]:translate-x-0 hp:group-data-[collapsible=offcanvas]:after:left-full',
      'hp:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      'hp:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.class,
    )"
    @click="toggleSidebar"
  >
    <slot />
  </button>
</template>
