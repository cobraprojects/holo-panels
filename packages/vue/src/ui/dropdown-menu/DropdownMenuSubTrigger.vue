<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { ChevronRightIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  DropdownMenuSubTrigger,
  useForwardProps,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DropdownMenuSubTriggerProps & { class?: HTMLAttributes["class"], inset?: boolean }>()

const delegatedProps = reactiveOmit(props, "class", "inset")
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwardedProps"
    :data-inset="inset ? '' : undefined"
    :class="cn(
      `hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:data-[inset]:ps-8 hp:data-[variant=destructive]:text-destructive hp:data-[variant=destructive]:focus:bg-destructive/10 hp:data-[variant=destructive]:focus:text-destructive hp:dark:data-[variant=destructive]:focus:bg-destructive/20 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4 hp:[&_svg:not([class*='text-'])]:text-muted-foreground hp:data-[variant=destructive]:*:[svg]:text-destructive!`,
      props.class,
    )"
  >
    <slot />
    <ChevronRightIcon class="hp:ms-auto hp:size-4" />
  </DropdownMenuSubTrigger>
</template>
