<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'hp:bg-card hp:text-card-foreground hp:flex hp:flex-col hp:gap-6 hp:rounded-xl hp:border hp:py-6 hp:shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
