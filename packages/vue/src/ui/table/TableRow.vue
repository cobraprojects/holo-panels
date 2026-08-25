<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <tr
    data-slot="table-row"
    :class="cn('hp:hover:bg-muted/50 hp:data-[state=selected]:bg-muted hp:border-b hp:transition-colors', props.class)"
  >
    <slot />
  </tr>
</template>
