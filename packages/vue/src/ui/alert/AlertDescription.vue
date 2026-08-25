<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="alert-description"
    :class="cn('hp:text-muted-foreground hp:col-start-2 hp:text-sm hp:[&_p]:leading-relaxed', props.class)"
  >
    <slot />
  </div>
</template>
