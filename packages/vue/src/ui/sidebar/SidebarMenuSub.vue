<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <ul
    data-slot="sidebar-menu-sub"
    data-sidebar="menu-badge"
    :class="cn(
      'hp:border-sidebar-border hp:mx-3.5 hp:flex hp:min-w-0 hp:translate-x-px hp:flex-col hp:gap-1 hp:border-l hp:px-2.5 hp:py-0.5',
      'hp:group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </ul>
</template>
