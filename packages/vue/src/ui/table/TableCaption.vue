<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <caption
    data-slot="table-caption"
    :class="cn('hp:text-muted-foreground hp:mt-4 hp:text-sm', props.class)"
  >
    <slot />
  </caption>
</template>
