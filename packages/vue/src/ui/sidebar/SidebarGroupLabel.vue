<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<PrimitiveProps & {
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Primitive
    data-slot="sidebar-group-label"
    data-sidebar="group-label"
    :as="as"
    :as-child="asChild"
    :class="cn(
      'hp:text-sidebar-foreground/70 hp:ring-sidebar-ring hp:flex hp:h-8 hp:shrink-0 hp:items-center hp:rounded-md hp:px-2 hp:text-xs hp:font-medium hp:outline-hidden hp:transition-[margin,opacity] hp:duration-200 hp:ease-linear hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0',
      'hp:group-data-[collapsible=icon]:pointer-events-none hp:group-data-[collapsible=icon]:-mt-8 hp:group-data-[collapsible=icon]:select-none hp:group-data-[collapsible=icon]:opacity-0',
      props.class)"
  >
    <slot />
  </Primitive>
</template>
