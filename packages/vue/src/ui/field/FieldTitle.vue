<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="field-label"
    :class="cn(
      'hp:flex hp:w-fit hp:items-center hp:gap-2 hp:text-sm hp:leading-snug hp:font-medium hp:group-data-[disabled=true]/field:opacity-50',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
