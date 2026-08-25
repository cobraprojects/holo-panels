<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="field-content"
    :class="cn(
      'hp:group/field-content hp:flex hp:flex-1 hp:flex-col hp:gap-1.5 hp:leading-snug',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
