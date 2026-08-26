<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Cross2Icon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import SheetOverlay from "./SheetOverlay.vue"

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes["class"]
  side?: "top" | "right" | "bottom" | "left"
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: "right",
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "side")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <SheetOverlay />
    <DialogContent
      data-slot="sheet-content"
      data-panels-component="slide-over"
      :class="cn(
        'hp:bg-background hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:fixed hp:z-50 hp:flex hp:flex-col hp:gap-4 hp:shadow-lg hp:transition hp:duration-200 hp:ease-in-out',
        side === 'right'
          && 'hp:data-[state=closed]:slide-out-to-right hp:data-[state=open]:slide-in-from-right hp:inset-y-0 hp:right-0 hp:h-full hp:w-3/4 hp:border-l hp:sm:max-w-sm',
        side === 'left'
          && 'hp:data-[state=closed]:slide-out-to-left hp:data-[state=open]:slide-in-from-left hp:inset-y-0 hp:left-0 hp:h-full hp:w-3/4 hp:border-r hp:sm:max-w-sm',
        side === 'top'
          && 'hp:data-[state=closed]:slide-out-to-top hp:data-[state=open]:slide-in-from-top hp:inset-x-0 hp:top-0 hp:h-auto hp:border-b',
        side === 'bottom'
          && 'hp:data-[state=closed]:slide-out-to-bottom hp:data-[state=open]:slide-in-from-bottom hp:inset-x-0 hp:bottom-0 hp:h-auto hp:border-t',
        'hp-slide-over',
        props.class)"
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <DialogClose
        class="hp:ring-offset-background hp:focus:ring-ring hp:data-[state=open]:bg-secondary hp:absolute hp:top-4 hp:right-4 hp:rounded-xs hp:opacity-70 hp:transition-opacity hp:hover:opacity-100 hp:focus:ring-2 hp:focus:ring-offset-2 hp:focus:outline-hidden hp:disabled:pointer-events-none"
      >
        <Cross2Icon class="hp:size-4" />
        <span class="hp:sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
