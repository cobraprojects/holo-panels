<script setup lang="ts">
import type { SelectItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { CheckIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  useForwardProps,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<SelectItemProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectItem
    data-slot="select-item"
    v-bind="forwardedProps"
    :class="
      cn(
        `hp:focus:bg-accent hp:focus:text-accent-foreground hp:[&_svg:not([class*='text-'])]:text-muted-foreground hp:relative hp:flex hp:w-full hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:py-1.5 hp:pr-8 hp:pl-2 hp:text-sm hp:outline-hidden hp:select-none hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4 hp:*:[span]:last:flex hp:*:[span]:last:items-center hp:*:[span]:last:gap-2`,
        props.class,
      )
    "
  >
    <span class="hp:absolute hp:right-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center">
      <SelectItemIndicator>
        <slot name="indicator-icon">
          <CheckIcon class="hp:size-4" />
        </slot>
      </SelectItemIndicator>
    </span>

    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
