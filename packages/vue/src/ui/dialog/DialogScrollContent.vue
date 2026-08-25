<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Cross2Icon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="hp:fixed hp:inset-0 hp:z-50 hp:grid hp:place-items-center hp:overflow-y-auto hp:bg-black/80 hp: hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0"
    >
      <DialogContent
        :class="
          cn(
            'hp:relative hp:z-50 hp:grid hp:w-full hp:max-w-lg hp:my-8 hp:gap-4 hp:border hp:border-border hp:bg-background hp:p-6 hp:shadow-lg hp:duration-200 hp:sm:rounded-lg hp:md:w-full',
            props.class,
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose
          class="hp:absolute hp:top-4 hp:right-4 hp:p-0.5 hp:transition-colors hp:rounded-md hp:hover:bg-secondary"
        >
          <Cross2Icon class="hp:w-4 hp:h-4" />
          <span class="hp:sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
