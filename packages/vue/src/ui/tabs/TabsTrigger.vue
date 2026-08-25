<script setup lang="ts">
import type { TabsTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsTrigger, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    :class="cn(
      `hp:data-[state=active]:bg-background hp:dark:data-[state=active]:text-foreground hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:focus-visible:outline-ring hp:dark:data-[state=active]:border-input hp:dark:data-[state=active]:bg-input/30 hp:text-foreground hp:dark:text-muted-foreground hp:inline-flex hp:h-[calc(100%-1px)] hp:flex-1 hp:items-center hp:justify-center hp:gap-1.5 hp:rounded-md hp:border hp:border-transparent hp:px-2 hp:py-1 hp:text-sm hp:font-medium hp:whitespace-nowrap hp:transition-[color,box-shadow] hp:focus-visible:ring-3 hp:focus-visible:outline-1 hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:data-[state=active]:shadow-sm hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4`,
      props.class,
    )"
    v-bind="forwardedProps"
  >
    <slot />
  </TabsTrigger>
</template>
