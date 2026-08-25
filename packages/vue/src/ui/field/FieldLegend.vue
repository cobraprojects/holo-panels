<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  variant?: "legend" | "label"
}>()
</script>

<template>
  <legend
    data-slot="field-legend"
    :data-variant="variant"
    :class="cn(
      'hp:mb-3 hp:font-medium',
      'hp:data-[variant=legend]:text-base',
      'hp:data-[variant=label]:text-sm',
      props.class,
    )"
  >
    <slot />
  </legend>
</template>
