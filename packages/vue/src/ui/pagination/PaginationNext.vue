<script setup lang="ts">
import type { PaginationNextProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '@/ui/button'
import { ChevronRightIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { PaginationNext, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from '@/ui/button'

const props = withDefaults(defineProps<PaginationNextProps & {
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}>(), {
  size: "default",
})

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationNext
    data-slot="pagination-next"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'hp:gap-1 hp:px-2.5 hp:sm:pr-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="hp:hidden hp:sm:block">Next</span>
      <ChevronRightIcon />
    </slot>
  </PaginationNext>
</template>
