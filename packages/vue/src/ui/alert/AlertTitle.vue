<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="alert-title"
    :class="cn('hp:col-start-2 hp:line-clamp-1 hp:min-h-4 hp:font-medium hp:tracking-tight', props.class)"
  >
    <slot />
  </div>
</template>
