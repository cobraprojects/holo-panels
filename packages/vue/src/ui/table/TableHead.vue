<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <th
    data-slot="table-head"
    :class="cn('hp:text-muted-foreground hp:h-9 hp:px-3 hp:text-left hp:align-middle hp:text-xs hp:font-medium hp:whitespace-nowrap hp:[&:has([role=checkbox])]:pr-0 hp:*:[[role=checkbox]]:translate-y-0.5', props.class)"
  >
    <slot />
  </th>
</template>
