<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  SelectContent,
  SelectPortal,
  SelectViewport,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import { SelectScrollDownButton, SelectScrollUpButton } from "."

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<SelectContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    position: "popper",
  },
)
const emits = defineEmits<SelectContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="cn(
        'hp:bg-popover hp:text-popover-foreground hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:zoom-in-95 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:relative hp:z-50 hp:max-h-(--reka-select-content-available-height) hp:min-w-[8rem] hp:overflow-x-hidden hp:overflow-y-auto hp:rounded-md hp:border hp:shadow-md',
        position === 'popper'
          && 'hp:data-[side=bottom]:translate-y-1 hp:data-[side=left]:-translate-x-1 hp:data-[side=right]:translate-x-1 hp:data-[side=top]:-translate-y-1',
        props.class,
      )
      "
    >
      <SelectScrollUpButton />
      <SelectViewport :class="cn('hp:p-1', position === 'popper' && 'hp:h-(--reka-select-trigger-height) hp:w-full hp:min-w-(--reka-select-trigger-width) hp:scroll-my-1')">
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
