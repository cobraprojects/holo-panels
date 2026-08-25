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
    data-slot="sidebar-group-action"
    data-sidebar="group-action"
    :as="as"
    :as-child="asChild"
    :class="cn(
      'hp:text-sidebar-foreground hp:ring-sidebar-ring hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:absolute hp:top-3.5 hp:right-3 hp:flex hp:aspect-square hp:w-5 hp:items-center hp:justify-center hp:rounded-md hp:p-0 hp:outline-hidden hp:transition-transform hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0',
      'hp:after:absolute hp:after:-inset-2 hp:md:after:hidden',
      'hp:group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
