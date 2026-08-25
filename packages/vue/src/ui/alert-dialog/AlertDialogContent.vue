<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<AlertDialogContentProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<AlertDialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      data-slot="alert-dialog-overlay"
      class="hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0 hp:fixed hp:inset-0 hp:z-50 hp:bg-black/80"
    />
    <AlertDialogContent
      data-slot="alert-dialog-content"
      data-panels-component="confirmation"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'hp:bg-background hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:zoom-in-95 hp:fixed hp:top-[50%] hp:left-[50%] hp:z-50 hp:grid hp:w-full hp:max-w-[calc(100%-2rem)] hp:translate-x-[-50%] hp:translate-y-[-50%] hp:gap-4 hp:rounded-lg hp:border hp:p-6 hp:shadow-lg hp:duration-200 hp:sm:max-w-lg',
          'hp-confirmation',
          props.class,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
