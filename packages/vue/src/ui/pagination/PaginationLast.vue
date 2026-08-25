<script setup lang="ts">
import type { PaginationLastProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '@/ui/button'
import { ChevronRightIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { PaginationLast, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from '@/ui/button'

const props = withDefaults(defineProps<PaginationLastProps & {
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}>(), {
  size: "default",
})

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationLast
    data-slot="pagination-last"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'hp:gap-1 hp:px-2.5 hp:sm:pr-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="hp:hidden hp:sm:block">Last</span>
      <ChevronRightIcon />
    </slot>
  </PaginationLast>
</template>
