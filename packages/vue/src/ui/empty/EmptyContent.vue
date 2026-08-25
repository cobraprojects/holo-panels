<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="empty-content"
    :class="cn(
      'hp:flex hp:w-full hp:min-w-0 hp:max-w-sm hp:flex-col hp:items-center hp:gap-4 hp:text-balance hp:text-sm',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
