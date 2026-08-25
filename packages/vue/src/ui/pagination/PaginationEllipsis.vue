<script setup lang="ts">
import type { PaginationEllipsisProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { DotsHorizontalIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { PaginationEllipsis } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<PaginationEllipsisProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <PaginationEllipsis
    data-slot="pagination-ellipsis"
    v-bind="delegatedProps"
    :class="cn('hp:flex hp:size-9 hp:items-center hp:justify-center', props.class)"
  >
    <slot>
      <DotsHorizontalIcon class="hp:size-4" />
      <span class="hp:sr-only">More pages</span>
    </slot>
  </PaginationEllipsis>
</template>
