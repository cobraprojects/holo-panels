<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <div
    data-slot="sheet-footer"
    :class="cn('hp:mt-auto hp:flex hp:flex-col hp:gap-2 hp:p-4', props.class)
    "
  >
    <slot />
  </div>
</template>
