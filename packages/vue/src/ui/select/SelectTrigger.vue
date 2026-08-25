<script setup lang="ts">
import type { SelectTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { ChevronDownIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { SelectIcon, SelectTrigger, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<SelectTriggerProps & { class?: HTMLAttributes["class"], size?: "sm" | "default" }>(),
  { size: "default" },
)

const delegatedProps = reactiveOmit(props, "class", "size")
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    v-bind="forwardedProps"
    :class="cn(
      `hp:border-input hp:data-[placeholder]:text-muted-foreground hp:[&_svg:not([class*='text-'])]:text-muted-foreground hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive hp:dark:bg-input/30 hp:dark:hover:bg-input/50 hp:flex hp:w-fit hp:items-center hp:justify-between hp:gap-2 hp:rounded-md hp:border hp:bg-transparent hp:px-3 hp:py-2 hp:text-sm hp:whitespace-nowrap hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:focus-visible:ring-3 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:data-[size=default]:h-9 hp:data-[size=sm]:h-8 hp:*:data-[slot=select-value]:line-clamp-1 hp:*:data-[slot=select-value]:flex hp:*:data-[slot=select-value]:items-center hp:*:data-[slot=select-value]:gap-2 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4`,
      props.class,
    )"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDownIcon class="hp:size-4 hp:opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
