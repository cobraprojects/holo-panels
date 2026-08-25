<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { CheckIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn('hp:peer hp:border-input hp:data-[state=checked]:bg-primary hp:data-[state=checked]:text-primary-foreground hp:data-[state=checked]:border-primary hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive hp:size-4 hp:shrink-0 hp:rounded-[4px] hp:border hp:shadow-xs hp:transition-shadow hp:outline-none hp:focus-visible:ring-3 hp:disabled:cursor-not-allowed hp:disabled:opacity-50',
         props.class)"
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="hp:grid hp:place-content-center hp:text-current hp:transition-none"
    >
      <slot v-bind="slotProps">
        <CheckIcon class="hp:size-3.5" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
