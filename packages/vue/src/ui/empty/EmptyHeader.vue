<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="empty-header"
    :class="cn(
      'hp:flex hp:max-w-sm hp:flex-col hp:items-center hp:gap-2 hp:text-center',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
