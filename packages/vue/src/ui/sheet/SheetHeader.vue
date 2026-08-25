<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <div
    data-slot="sheet-header"
    :class="cn('hp:flex hp:flex-col hp:gap-1.5 hp:p-4', props.class)"
  >
    <slot />
  </div>
</template>
