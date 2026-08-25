<script lang="ts" setup>
import type { HTMLAttributes } from "vue"
import { DotsHorizontalIcon } from '@radix-icons/vue'
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <span
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden="true"
    :class="cn('hp:flex hp:size-9 hp:items-center hp:justify-center', props.class)"
  >
    <slot>
      <DotsHorizontalIcon class="hp:size-4" />
    </slot>
    <span class="hp:sr-only">More</span>
  </span>
</template>
