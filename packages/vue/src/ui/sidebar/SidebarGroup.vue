<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="sidebar-group"
    data-sidebar="group"
    :class="cn('hp:relative hp:flex hp:w-full hp:min-w-0 hp:flex-col hp:p-2', props.class)"
  >
    <slot />
  </div>
</template>
