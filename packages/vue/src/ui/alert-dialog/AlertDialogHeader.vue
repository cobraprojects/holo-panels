<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="alert-dialog-header"
    :class="cn('hp:flex hp:flex-col hp:gap-2 hp:text-center hp:sm:text-left', props.class)"
  >
    <slot />
  </div>
</template>
