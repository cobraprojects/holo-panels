<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<PrimitiveProps & {
  showOnHover?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  as: "button",
})
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-action"
    data-sidebar="menu-action"
    :class="cn(
      'hp:text-sidebar-foreground hp:ring-sidebar-ring hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:absolute hp:top-1.5 hp:right-1 hp:flex hp:aspect-square hp:w-5 hp:items-center hp:justify-center hp:rounded-md hp:p-0 hp:outline-hidden hp:transition-transform hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:[&>svg]:shrink-0',
      'hp:after:absolute hp:after:-inset-2 hp:md:after:hidden',
      'hp:peer-data-[size=sm]/menu-button:top-1',
      'hp:peer-data-[size=default]/menu-button:top-1.5',
      'hp:peer-data-[size=lg]/menu-button:top-2.5',
      'hp:group-data-[collapsible=icon]:hidden',
      showOnHover
        && 'hp:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground hp:group-focus-within/menu-item:opacity-100 hp:group-hover/menu-item:opacity-100 hp:data-[state=open]:opacity-100 hp:md:opacity-0',
      props.class,
    )"
    :as="as"
    :as-child="asChild"
  >
    <slot />
  </Primitive>
</template>
