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
import DialogOverlay from "./DialogOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<DialogContentProps & { class?: HTMLAttributes["class"], showCloseButton?: boolean }>(), {
  showCloseButton: true,
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      aria-modal="true"
      data-slot="dialog-content"
      data-panels-component="modal"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'hp:bg-background hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:zoom-in-95 hp:fixed hp:top-[50%] hp:left-[50%] hp:z-50 hp:grid hp:w-full hp:max-w-[calc(100%-2rem)] hp:translate-x-[-50%] hp:translate-y-[-50%] hp:gap-4 hp:rounded-lg hp:border hp:p-6 hp:shadow-lg hp:duration-200 hp:sm:max-w-lg',
          'hp-modal',
          props.class,
        )"
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="hp:ring-offset-background hp:focus:ring-ring hp:data-[state=open]:bg-accent hp:data-[state=open]:text-muted-foreground hp:absolute hp:top-4 hp:end-4 hp:rounded-xs hp:opacity-70 hp:transition-opacity hp:hover:opacity-100 hp:focus:ring-2 hp:focus:ring-offset-2 hp:focus:outline-hidden hp:disabled:pointer-events-none hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4"
      >
        <Cross2Icon />
        <span class="hp:sr-only hp:rtl:hidden">Close</span><span class="hp:sr-only hp:hidden hp:rtl:inline">إغلاق</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
