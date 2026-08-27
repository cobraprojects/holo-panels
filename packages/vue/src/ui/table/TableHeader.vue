<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <thead
    data-slot="table-header"
    :class="cn('hp:bg-muted/40 hp:[&_tr]:border-b', props.class)"
  >
    <slot />
  </thead>
</template>
