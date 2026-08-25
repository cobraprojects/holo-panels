<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="empty"
    :class="cn(
      'hp:flex hp:min-w-0 hp:flex-1 hp:flex-col hp:items-center hp:justify-center hp:gap-6 hp:text-balance hp:rounded-lg hp:border-dashed hp:p-6 hp:text-center hp:md:p-12',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
