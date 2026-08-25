<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { DotFilledIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  RadioGroupIndicator,
  RadioGroupItem,
  useForwardProps,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="forwardedProps"
    :class="
      cn(
        'hp:border-input hp:text-primary hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive hp:dark:bg-input/30 hp:aspect-square hp:size-4 hp:shrink-0 hp:rounded-full hp:border hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:focus-visible:ring-3 hp:disabled:cursor-not-allowed hp:disabled:opacity-50',
        props.class,
      )
    "
  >
    <RadioGroupIndicator
      data-slot="radio-group-indicator"
      class="hp:relative hp:flex hp:items-center hp:justify-center"
    >
      <slot>
        <DotFilledIcon class="hp:fill-primary hp:absolute hp:top-1/2 hp:left-1/2 hp:size-2 hp:-translate-x-1/2 hp:-translate-y-1/2" />
      </slot>
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
